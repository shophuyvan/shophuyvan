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
  const sql = `
    SELECT p.*, 
      (SELECT json_group_array(json_object(
        'id', v.id,
        'name', v.name,
        'sku', v.sku,
        'price', v.price,
        'stock', v.stock
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

  const prices = product.variants.map(v => Number(v.price || 0));
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);

  return {
    minPrice,
    maxPrice,
    priceOriginal: minPrice,
    priceFinal: minPrice,
    discountPercent: 0
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

  let final = {
    id: product.id,
    name: product.name,
    slug: product.slug,
    images: product.images ? JSON.parse(product.images) : [],
    categories: product.categories ? JSON.parse(product.categories) : [],
    variants: product.variants || [],

    stock_total: stockTotal,

    price_original: priceInfo.priceOriginal,
    price_final: priceInfo.priceFinal,
    discount_percent: priceInfo.discountPercent,

    is_flash_sale: false,
    flash_price: product.flash_price || null,
    flash_stock: product.flash_stock || null
  };

  // Áp flash sale
  final = applyFlashSale(final);

  return final;
}

// ------------------------------------------------
// 6. Lưu cache sản phẩm vào KV (siêu nhanh 1–2ms)
// ------------------------------------------------
export async function cacheProduct(env, productId, normalized) {
  await putJSON(env, `product:${productId}`, normalized);
  return true;
}

// ------------------------------------------------
// 7. Lấy sản phẩm đã chuẩn hóa từ KV (nếu có)
// ------------------------------------------------
export async function getCachedProduct(env, productId) {
  return await getJSON(env, `product:${productId}`, null);
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
