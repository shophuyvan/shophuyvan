import { getJSON, putJSON } from '../../lib/kv.js';
import { getBaseProduct } from '../../core/product-core.js';
import { addPoints } from '../admin.js'; // Module admin gốc

// Constants
export const ORDER_STATUS = {
  PENDING: 'pending',
  CONFIRMED: 'confirmed',
  SHIPPING: 'shipping',
  DELIVERED: 'delivered',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
  RETURNED: 'returned'
};

const CANCEL_STATUSES = ['cancel', 'cancelled', 'huy', 'huỷ', 'hủy', 'returned', 'return', 'pending'];

export const shouldAdjustStock = (status) => {
  const s = String(status || '').toLowerCase();
  return !CANCEL_STATUSES.includes(s);
};

// Normalize phone number
export function normalizePhone(phone) {
  if (!phone) return '';
  let x = String(phone).replace(/[\s\.\-\(\)]/g, '');
  if (x.startsWith('+84')) x = '0' + x.slice(3);
  if (x.startsWith('84') && x.length > 9) x = '0' + x.slice(2);
  return x;
}

// Format price
export function formatPrice(n) {
  try { return new Intl.NumberFormat('vi-VN').format(Number(n || 0)) + '₫'; } 
  catch { return (n || 0) + '₫'; }
}

// Authenticate Customer
export async function authenticateCustomer(req, env) {
  function parseCookie(str) {
    const out = {}; (str || '').split(';').forEach(p => { const i = p.indexOf('='); if (i > -1) out[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1).trim()); }); return out;
  }
  async function kvGet(k) { try { return await getJSON(env, k, null); } catch { return null; } }

  async function tryKeys(tok) {
    if (!tok) return null;
    const keys = [tok, 'cust:' + tok, 'customerToken:' + tok, 'token:' + tok, 'customer_token:' + tok, 'auth:' + tok, 'customer:' + tok, 'session:' + tok, 'shv_session:' + tok];
    for (const k of keys) {
      const val = await kvGet(k);
      if (!val) continue;
      if (k.includes('session:') && (val.customer || val.user)) return val.customer || val.user;
      if (typeof val === 'object' && val !== null) return val;
      if (typeof val === 'string') {
        const cid = String(val).trim();
        const obj = (await kvGet('customer:' + cid)) || (await kvGet('customer:id:' + cid));
        if (obj) return obj;
      }
      if (val && (val.customer_id || val.customerId)) {
        const cid = val.customer_id || val.customerId;
        const obj = (await kvGet('customer:' + cid)) || (await kvGet('customer:id:' + cid));
        if (obj) return obj;
      }
    }
    return null;
  }

  let token = req.headers.get('x-customer-token') || req.headers.get('x-token') || '';
  if (!token) { const m = (req.headers.get('authorization') || '').match(/^Bearer\s+(.+)$/i); if (m) token = m[1]; }
  if (!token) { const c = parseCookie(req.headers.get('cookie') || ''); token = c['customer_token'] || c['x-customer-token'] || c['token'] || ''; }
  token = String(token || '').trim().replace(/^"+|"+$/g, '');

  let customer = await tryKeys(token);
  let decodedTokenId = '';

  if (!customer && token) {
    try {
      let b64 = token.replace(/-/g, '+').replace(/_/g, '/');
      while (b64.length % 4) b64 += '=';
      const decoded = atob(b64);
      if (decoded && decoded.includes(':')) {
        const customerId = decoded.split(':')[0];
        if (customerId) { decodedTokenId = customerId; customer = (await kvGet('customer:' + customerId)) || (await kvGet('customer:id:' + customerId)); }
      } else if (decoded && decoded !== token) {
        decodedTokenId = decoded; customer = await tryKeys(decoded);
        if (!customer) customer = (await kvGet('customer:' + decoded)) || (await kvGet('customer:id:' + decoded));
      }
    } catch { /* ignore */ }
  }

  if (!customer && token && token.split('.').length === 3) {
    try {
      const p = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
      const cid = p.customer_id || p.customerId || p.sub || p.id || '';
      if (cid) { customer = (await kvGet('customer:' + cid)) || (await kvGet('customer:id:' + cid)); if (!customer) decodedTokenId = String(cid); }
    } catch { /* ignore */ }
  }

  return { customer, customerId: customer?.id || customer?.customer_id || decodedTokenId || null, token };
}

// Normalize Order Items
export function normalizeOrderItems(items) {
  const tryExtractSku = (txt) => { if (!txt) return null; const m = String(txt).toUpperCase().match(/\bK[\-]?\d+\b/); return m ? m[0].replace('-', '') : null; };
  return (Array.isArray(items) ? items : []).map(it => {
    const variantSku = tryExtractSku(it.variant || it.name || '');
    const maybeProductId = String(it.id || '').length > 12 ? it.id : null;
    const rawImage = it.image ?? it.img ?? it.thumbnail ?? it.variant_image ?? it.product_image ?? (Array.isArray(it.images) && it.images.length ? it.images[0] : null) ?? (it.product && Array.isArray(it.product.images) && it.product.images.length ? it.product.images[0] : null) ?? it.product?.image ?? it.product?.img ?? null;
    return {
      id: it.variant_id ?? it.id ?? it.sku ?? variantSku ?? null,
      product_id: it.product_id ?? it.pid ?? it.productId ?? (it.product?.id || it.product?.key) ?? maybeProductId ?? null,
      sku: it.sku ?? variantSku ?? null,
      name: it.name ?? it.title ?? '',
      variant: it.variant ?? '',
      qty: Number(it.qty ?? it.quantity ?? 1) || 1,
      price: Number(it.price || 0),
      cost: Number(it.cost || 0),
      image: rawImage || null,
    };
  });
}

// Adjust Inventory (D1) -> MOVED TO order-core.js

// Enrich Items from Product Core
export async function enrichItemsWithCostAndPrice(items, env) {
  for (const item of items) {
    if (!item.product_id) continue;
    try {
      const product = await getBaseProduct(env, item.product_id);
      if (!product || !product.variants) continue;
      const variantId = item.variant_id || item.id;
      const variant = product.variants.find(v => String(v.id) === String(variantId) || String(v.sku) === String(item.sku));
      if (variant) {
        item.product_id = product.id; item.variant_id = variant.id; item.id = variant.id;
        const dbPrice = Number(variant.price_sale || variant.price || 0);
        if (dbPrice > 0) item.price = dbPrice;
        item.cost = Number(variant.price_wholesale || variant.cost || 0);
        const variantImage = variant.image;
        const productImages = typeof product.images === 'string' ? JSON.parse(product.images) : (product.images || []);
        item.image = variantImage || productImages[0] || item.image || null;
      }
    } catch (e) { /* ignore */ }
  }
  return items;
}

// Add Points
export async function addPointsToCustomer(customer, revenue, env) {
  if (!customer || !customer.id) return { upgraded: false, points: 0 };
  try {
    const customerKey = `customer:${customer.id}`;
    let custData = await env.SHV.get(customerKey);
    if (!custData) return { upgraded: false, points: 0 };
    const cust = JSON.parse(custData);
    const pointsToAdd = Math.floor(revenue);
    const tierResult = addPoints(cust, pointsToAdd);
    await env.SHV.put(customerKey, JSON.stringify(cust));
    if (cust.email) await env.SHV.put(`customer:email:${cust.email}`, JSON.stringify(cust));
    return { upgraded: tierResult.upgraded, oldTier: tierResult.oldTier, newTier: tierResult.newTier, points: cust.points };
  } catch (e) { return { upgraded: false, points: 0 }; }
}