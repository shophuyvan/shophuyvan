// workers/shv-api/src/modules/products/pd-utils.js
// Chứa các hàm Helper (Utility) dùng chung cho module Product

import { normalizeProduct } from '../../core/product-core.js';
import { getJSON } from '../../lib/kv.js';

// ✅ HELPER: Safe parse images (Xử lý chuỗi ảnh an toàn)
export function safeParseImages(imagesField) {
  if (!imagesField) return [];
  try {
    const str = String(imagesField).trim();
    if (str.startsWith('[') || str.startsWith('{')) {
      const parsed = JSON.parse(str);
      return Array.isArray(parsed) ? parsed : [parsed];
    }
    return [str];
  } catch (e) {
    console.warn('[safeParseImages] Parse error:', e.message);
    return [];
  }
}

// ✅ HELPER: Safe parse JSON field
export function safeParseJSON(field, defaultValue = []) {
  if (!field) return defaultValue;
  try {
    const str = String(field).trim();
    if (str.startsWith('[') || str.startsWith('{')) {
      return JSON.parse(str);
    }
    return defaultValue;
  } catch (e) {
    console.warn('[safeParseJSON] Parse error:', e.message);
    return defaultValue;
  }
}

// ✅ HELPER: Tạo slug từ tên
export function toSlug(input) {
  const text = String(input || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
}
export const slugify = toSlug; // Alias tên khác

// ✅ HELPER: Lấy hạng thành viên (Tier) từ Request Header/URL
export function getCustomerTier(req) {
  try {
    const url = new URL(req.url);
    const h = (req.headers.get('x-customer-tier') || req.headers.get('x-price-tier') || '').toLowerCase().trim();
    if (h) return h;
    const q = (url.searchParams.get('tier') || '').toLowerCase().trim();
    if (q) return q;
    return 'retail';
  } catch { return 'retail'; }
}

// ✅ HELPER: Tính giá hiển thị (Display Price)
// Chọn giá thấp nhất trong các variants để hiển thị ra ngoài danh sách
export function computeDisplayPrice(product, tier) {
  try {
    const toNum = (x) => typeof x === 'string' ? (Number(x.replace(/[^\d.-]/g, '')) || 0) : Number(x || 0);
    const vars = Array.isArray(product?.variants) ? product.variants : [];

    if (!vars.length) {
      return { price_display: 0, compare_at_display: null, price_tier: tier, no_variant: true };
    }

    let bestBase = null;
    let bestOrig = null;

    for (const v of vars) {
      const svTier = tier === 'wholesale' ? v.sale_price_wholesale ?? v.wholesale_sale_price ?? null : null;
      const rvTier = tier === 'wholesale' ? v.price_wholesale ?? v.wholesale_price ?? null : null;

      const sale = toNum(svTier ?? v.sale_price ?? v.price_sale);
      const reg = toNum(rvTier ?? v.price);

      let base = 0;
      let orig = 0;

      if (sale > 0 && reg > 0 && sale < reg) {
        base = sale;
        orig = reg;
      } else {
        base = reg;
        orig = 0;
      }

      if (base > 0) {
        if (bestBase == null || base < bestBase) {
          bestBase = base;
          bestOrig = orig;
        }
      }
    }

    if (bestBase == null) return { price_display: 0, compare_at_display: null, price_tier: tier };

    return {
      price_display: bestBase,
      compare_at_display: bestOrig > 0 ? bestOrig : null,
      price_tier: tier,
    };
  } catch {
    return { price_display: 0, compare_at_display: null, price_tier: tier };
  }
}

// ✅ HELPER: Chuyển đổi sang dạng Summary (Rút gọn cho danh sách)
export function toSummary(product) {
  const normalized = normalizeProduct(product);
  const priced = computeDisplayPrice(normalized, 'retail');

  return {
    id: normalized.id,
    title: normalized.name,
    name: normalized.name,
    slug: normalized.slug,
    sku: normalized.variants?.[0]?.sku || '',
    price_display: priced.price_display,
    compare_at_display: priced.compare_at_display,
    price: priced.price_display, 
    price_sale: 0,
    stock: normalized.stock_total,
    images: normalized.images || [],
    category: normalized.categories?.[0] || '', 
    category_slug: normalized.categories?.[0] || '',
    status: 1,
    sold: Number(product.sold || 0),
    rating: Number(product.rating || 5.0),
    rating_count: Number(product.rating_count || 0),
    variants: normalized.variants || []
  };
}

// ✅ HELPER: Lấy thông tin Flash Sale (Kiểm tra trong KV)
export async function getFlashSaleForProduct(env, productId) {
  try {
    const list = await getJSON(env, 'flash-sales:list', []);
    const now = Date.now();

    for (const id of list) {
      const fs = await getJSON(env, `flash-sale:${id}`, null);
      if (!fs) continue;

      const start = new Date(fs.start_time).getTime();
      const end = new Date(fs.end_time).getTime();

      if (fs.status === 'active' && start <= now && now <= end) {
        const item = (fs.products || []).find(p => String(p.product_id) === String(productId));
        if (item) {
          return {
            active: true,
            discount_type: item.discount_type,
            discount_value: item.discount_value,
            stock_limit: item.stock_limit || 0,
            ends_at: fs.end_time,
            flash_sale_id: fs.id,
            flash_sale_name: fs.name
          };
        }
      }
    }
    return null;
  } catch (e) {
    console.error('[Flash Sale] Check error:', e);
    return null;
  }
}

// ✅ HELPER: Áp dụng giảm giá Flash Sale vào Variant
export function applyFlashSaleDiscount(variant, flashSaleInfo) {
  if (!flashSaleInfo || !flashSaleInfo.active) return variant;

  const salePrice = Number(variant.price_sale || variant.sale_price || 0);
  const regularPrice = Number(variant.price || 0);
  const basePrice = salePrice > 0 ? salePrice : regularPrice;
  
  if (basePrice <= 0) return variant;

  let flashPrice = basePrice;

  if (flashSaleInfo.discount_type === 'percent') {
    const discount = basePrice * (flashSaleInfo.discount_value / 100);
    flashPrice = Math.floor(basePrice - discount);
  } else if (flashSaleInfo.discount_type === 'fixed') {
    flashPrice = Math.max(0, basePrice - flashSaleInfo.discount_value);
  }

  return {
    ...variant,
    flash_sale: {
      active: true,
      price: flashPrice,
      original_price: basePrice,
      discount_percent: flashSaleInfo.discount_type === 'percent' ? flashSaleInfo.discount_value : Math.round((basePrice - flashPrice) / basePrice * 100),
      ends_at: flashSaleInfo.ends_at,
      flash_sale_id: flashSaleInfo.flash_sale_id,
      flash_sale_name: flashSaleInfo.flash_sale_name
    }
  };
}