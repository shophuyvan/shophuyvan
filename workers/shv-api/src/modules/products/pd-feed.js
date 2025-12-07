// workers/shv-api/src/modules/products/pd-feed.js
// Chứa API Xuất dữ liệu (Facebook Feed CSV) và Metrics

import { getJSON } from '../../lib/kv.js';
import { readBody } from '../../lib/utils.js';
import { json, errorResponse } from '../../lib/response.js';
import { safeParseImages, slugify } from './pd-utils.js';
import { listProducts } from './pd-public.js'; // Tái sử dụng hàm list từ public

// ===================================================================
// EXPORT: Facebook Feed CSV
// ===================================================================
export async function exportFacebookFeedCsv(req, env) {
  try {
    const BASE_URL = 'https://shophuyvan.vn';

    // Lấy danh sách summary từ module Public
    let items = await listProducts(env);

    // Chỉ lấy sản phẩm đang active
    items = items.filter(p => p.status !== 0);

    // Nạp FULL product (để có variants)
    const fullProducts = [];
    for (const s of items) {
      const id = String(s.id || s.key || '');
      const p  = id ? (await getJSON(env, 'product:' + id, null)) : null;
      fullProducts.push(p || s);
    }

    // Helper escape CSV
    const esc = (val) => {
      if (val === null || val === undefined) return '';
      const s = String(val);
      return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    };

    // Header CSV
    const rows = [];
    rows.push([
      'id', 'item_group_id', 'title', 'description',
      'availability', 'condition', 'price',
      'link', 'image_link', 'brand', 'sku',
    ]);

    const toNum = (x) => typeof x === 'string' ? Number(x.replace(/[^\d.-]/g, '')) || 0 : Number(x || 0);

    for (const product of fullProducts) {
      const title = product.title || product.name || '';
      const desc = product.description || product.short_description || product.summary || '';
      const slug = product.slug || slugify(title || String(product.id || ''));
      const productUrl = `${BASE_URL}/product/${slug}`;
      const defaultImage = Array.isArray(product.images) && product.images.length ? product.images[0] : '';

      const variants = Array.isArray(product.variants) ? product.variants : [];

      if (variants.length === 0) {
        const basePrice = toNum(product.price || product.price_sale || 0);
        if (!basePrice) continue;

        const priceStr = `${basePrice.toFixed(0)} VND`;
        rows.push([
          product.id, product.id, title, desc,
          'in stock', 'new', priceStr,
          productUrl, defaultImage,
          product.brand || 'Shop Huy Vân', product.sku || '',
        ]);
        continue;
      }

      variants.forEach((v, idx) => {
        const vid = String(v.id || v.sku || idx + 1);
        if (!vid) return;

        const sale = toNum(v.sale_price ?? v.price_sale);
        const reg = toNum(v.price);
        const priceNum = sale > 0 && sale < reg ? sale : reg;

        if (!priceNum) return;

        const priceStr = `${priceNum.toFixed(0)} VND`;
        const avail = toNum(v.stock ?? v.qty ?? product.stock) > 0 ? 'in stock' : 'out of stock';
        const img = v.image || (Array.isArray(v.images) && v.images.length ? v.images[0] : null) || defaultImage;

        rows.push([
          `${product.id}_${vid}`, product.id, title, desc,
          avail, 'new', priceStr,
          productUrl, img || '',
          product.brand || 'Shop Huy Vân', v.sku || '',
        ]);
      });
    }

    const csv = rows.map((r) => r.map(esc).join(',')).join('\n');

    return new Response(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Cache-Control': 'public, max-age=600',
      },
    });
  } catch (e) {
    console.error('[FacebookFeed] error:', e);
    return errorResponse(e, 500, req);
  }
}

// ===================================================================
// PUBLIC: Get Product Metrics (Single)
// ===================================================================
export async function getProductMetrics(req, env, productId) {
  try {
    const product = await getJSON(env, 'product:' + productId, null);
    if (!product) return json({ ok: false, error: 'Product not found' }, { status: 404 }, req);

    const metrics = {
      product_id: productId,
      sold: Number(product.sold || product.sold_count || product.sales || 0),
      rating: Number(product.rating || product.rating_avg || 5.0),
      rating_count: Number(product.rating_count || product.reviews_count || 0)
    };

    return json({ ok: true, metrics }, {}, req);
  } catch (e) {
    console.error('[METRICS] Error:', e);
    return errorResponse(e, 500, req);
  }
}

// ===================================================================
// PUBLIC: Get Metrics Batch
// ===================================================================
export async function getProductsMetricsBatch(req, env) {
  try {
    const body = await readBody(req) || {};
    const productIds = body.product_ids || body.ids || [];

    if (!Array.isArray(productIds) || productIds.length === 0) {
      return json({ ok: false, error: 'product_ids array is required' }, { status: 400 }, req);
    }

    const ids = productIds.slice(0, 50);
    const results = [];

    for (const id of ids) {
      try {
        const product = await getJSON(env, 'product:' + id, null);
        if (product) {
          results.push({
            product_id: id,
            sold: Number(product.sold || product.sold_count || 0),
            rating: Number(product.rating || product.rating_avg || 5.0),
            rating_count: Number(product.rating_count || product.reviews_count || 0)
          });
        }
      } catch (e) {}
    }

    return json({ ok: true, metrics: results }, {}, req);
  } catch (e) {
    console.error('[METRICS BATCH] Error:', e);
    return errorResponse(e, 500, req);
  }
}