// ===============================================
// SHOP HUY VÂN - PRODUCT CORE ENGINE
// Chuẩn hóa sản phẩm cho toàn hệ thống:
// FE, MiniApp, Shopee, Lazada, TikTok, Admin
// ===============================================

import { getJSON, putJSON } from '../lib/kv.js';

// ------------------------------------------------
// 1. Lấy sản phẩm BASE từ D1 (chỉ 1 query duy nhất)
// ------------------------------------------------
export async function getBaseProduct(env, productId) {
  // ✅ FIX: Thêm trường 'image' vào variants để frontend hiển thị đúng ảnh biến thể
  const sql = `
    SELECT p.*, 
      (SELECT json_group_array(json_object(
        'id', v.id,
        'name', v.name,
        'sku', v.sku,
        'price', v.price,
        'price_sale', v.price_sale,
        'price_wholesale', v.price_wholesale,
        'stock', v.stock,
        'image', v.image,
        'weight', v.weight
      ))
      FROM variants v
      WHERE v.product_id = p.id
    ) AS variants
    FROM products p
    WHERE p.id = ?
  `;

  const row = await env.DB.prepare(sql).bind(productId).first();
  if (!row) return null;

  row.variants = row.variants ? JSON.parse(row.variants) : [];
  return row;
}

// ------------------------------------------------
// 2. Tính toán tồn kho từ variants
// ------------------------------------------------
export function computeStock(product) {
  const total = product.variants.reduce((sum, v) => sum + Number(v.stock || 0), 0);
  return total;
}

// ------------------------------------------------
// 3. Tính giá sản phẩm từ variants
// ------------------------------------------------
export function computePrice(product) {
  if (!product.variants || !product.variants.length) {
    return {
      minPrice: 0,
      maxPrice: 0,
      priceOriginal: 0,
      priceFinal: 0,
      discountPercent: 0,
    };
  }

  // Lấy giá từ variants (ưu tiên giá sale nếu có)
  const prices = product.variants.map(v => {
    const p = Number(v.price || 0);
    const s = Number(v.price_sale || 0);
    return (s > 0 && s < p) ? s : p;
  });
  
  const originals = product.variants.map(v => Number(v.price || 0));

  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const maxOriginal = Math.max(...originals);

  return {
    minPrice,
    maxPrice,
    priceOriginal: maxOriginal > 0 ? maxOriginal : minPrice,
    priceFinal: minPrice,
    discountPercent: maxOriginal > minPrice ? Math.round((maxOriginal - minPrice) / maxOriginal * 100) : 0
  };
}

// ------------------------------------------------
// 4. Áp flash sale (nếu có)
// ------------------------------------------------
export function applyFlashSale(product) {
  if (
    !product.flash_price ||
    !product.flash_stock ||
    !product.flash_until ||
    Date.now() > Number(product.flash_until)
  ) {
    product.is_flash_sale = false;
    return product;
  }

  const flashPrice = Number(product.flash_price);
  const basePrice = Number(product.priceOriginal);

  product.is_flash_sale = true;
  product.priceFinal = flashPrice;
  product.discountPercent = Math.round((basePrice - flashPrice) / basePrice * 100);
  return product;
}

// ------------------------------------------------
// 5. Chuẩn hóa sản phẩm thành 1 dạng duy nhất
// ------------------------------------------------
export function normalizeProduct(product) {

  const stockTotal = computeStock(product);
  const priceInfo = computePrice(product);

  // Parse images an toàn
  let images = [];
  try {
    images = typeof product.images === 'string' ? JSON.parse(product.images) : (product.images || []);
  } catch (e) {
    images = [];
  }

  // Parse JSON fields an toàn
  const parseJsonField = (field) => {
    try {
      return typeof field === 'string' ? JSON.parse(field) : (field || []);
    } catch { return []; }
  };

  let final = {
    id: product.id,
    name: product.title || product.name || 'No Name',
    slug: product.slug,
    
    // Mô tả
    description: product.desc || product.description || '',
    short_description: product.shortDesc || product.short_description || '',
    
    // ✅ FIX: Thêm Video
    video: product.video || null,

    // SEO
    seo_title: product.seo_title || null,
    seo_desc: product.seo_desc || null,
    
    images: images,
    categories: parseJsonField(product.categories),
    category_slug: product.category_slug || '',
    
    variants: product.variants || [],

    stock_total: stockTotal,
    sold: Number(product.sold || 0),
    rating: Number(product.rating || 5.0),
    rating_count: Number(product.rating_count || 0),

    // Giá (Core tính sẵn để tham khảo)
    price_original: priceInfo.priceOriginal,
    price_final: priceInfo.priceFinal,
    discount_percent: priceInfo.discountPercent,

    is_flash_sale: false,
    flash_price: product.flash_price || null,
    flash_stock: product.flash_stock || null,
    
    // Extra data
    keywords: parseJsonField(product.keywords),
    faq: parseJsonField(product.faq),
    reviews: parseJsonField(product.reviews)
  };

  // Áp flash sale
  final = applyFlashSale(final);

  return final;
}

// ------------------------------------------------
// 6. Lưu cache sản phẩm vào KV (siêu nhanh 1–2ms)
// ------------------------------------------------
export async function cacheProduct(env, productId, normalized) {
  // Cache trong 2 phút (120s) để đồng bộ nhanh hơn
  await putJSON(env, `product:${productId}`, normalized, 120);
  return true;
}

// ------------------------------------------------
// 7. Lấy sản phẩm đã chuẩn hóa từ KV (nếu có)
// ------------------------------------------------
export async function getCachedProduct(env, productId) {
  return await getJSON(env, `product:${productId}`, null);
}

// ------------------------------------------------
// 7.1. Xóa cache sản phẩm (khi admin update)
// ------------------------------------------------
export async function invalidateProductCache(env, productId) {
  try {
    await env.KV.delete(`product:${productId}`);
    console.log(`🗑️ Invalidated cache for product ${productId}`);
    return true;
  } catch (e) {
    console.error(`❌ Failed to invalidate cache for product ${productId}:`, e);
    return false;
  }
}

// ------------------------------------------------
// 8. Hàm tổng: Load → Normalize → Cache
// ------------------------------------------------
export async function loadProductNormalized(env, productId, forceRefresh = false) {
  if (!forceRefresh) {
    const cached = await getCachedProduct(env, productId);
    if (cached) return cached;
  }

  const base = await getBaseProduct(env, productId);
  if (!base) return null;

  const normalized = normalizeProduct(base);
  await cacheProduct(env, productId, normalized);
  return normalized;
}