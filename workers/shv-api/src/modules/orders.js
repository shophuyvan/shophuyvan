// ===================================================================
// modules/orders.js - Orders Module (OPTIMIZED & FIXED)
// ===================================================================

import { json, errorResponse, corsHeaders } from '../lib/response.js';
import { adminOK } from '../lib/auth.js';
import { getJSON, putJSON } from '../lib/kv.js';
import { readBody } from '../lib/utils.js';
import { validate, SCH } from '../lib/validator.js';
import { idemGet, idemSet } from '../lib/idempotency.js';
import { calculateTier, getTierInfo, updateCustomerTier, addPoints } from './admin.js';
import { autoCreateWaybill, printWaybill, cancelWaybill, printWaybillsBulk, cancelWaybillsBulk } from './shipping/waybill.js';
import { applyVoucher, markVoucherUsed } from './vouchers.js'; // ✅ FIX: Thêm markVoucherUsed

// ===================================================================
// Constants & Helpers
// ===================================================================

const ORDER_STATUS = {
  PENDING: 'pending',
  CONFIRMED: 'confirmed',
  SHIPPING: 'shipping',
  DELIVERED: 'delivered',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
  RETURNED: 'returned'
};

const CANCEL_STATUSES = ['cancel', 'cancelled', 'huy', 'huỷ', 'hủy', 'returned', 'return', 'pending'];

const shouldAdjustStock = (status) => {
  const s = String(status || '').toLowerCase();
  return !CANCEL_STATUSES.includes(s);
};

const toNum = (x) => Number(x || 0);

/**
 * Normalize phone number (Vietnam format)
 */
function normalizePhone(phone) {
  if (!phone) return '';
  let x = String(phone).replace(/[\s\.\-\(\)]/g, '');
  if (x.startsWith('+84')) x = '0' + x.slice(3);
  if (x.startsWith('84') && x.length > 9) x = '0' + x.slice(2);
  return x;
}

/**
 * Format price for display
 */
function formatPrice(n) {
  try {
    return new Intl.NumberFormat('vi-VN').format(Number(n || 0)) + '₫';
  } catch {
    return (n || 0) + '₫';
  }
}

// ===================================================================
// Customer Authentication Helper (REFACTORED - DRY)
// ===================================================================

/**
 * Extract customer from token (header/cookie/Authorization)
 * Returns { customer, customerId, token } or null
 */
async function authenticateCustomer(req, env) {
  function parseCookie(str) {
    const out = {};
    (str || '').split(';').forEach(p => {
      const i = p.indexOf('=');
      if (i > -1) out[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1).trim());
    });
    return out;
  }

  async function kvGet(k) {
    try { return await getJSON(env, k, null); } catch { return null; }
  }

  async function tryKeys(tok) {
    if (!tok) return null;
    const keys = [
      tok, 'cust:' + tok, 'customerToken:' + tok, 'token:' + tok,
      'customer_token:' + tok, 'auth:' + tok, 'customer:' + tok,
      'session:' + tok, 'shv_session:' + tok
    ];

    for (const k of keys) {
      const val = await kvGet(k);
      if (!val) continue;

      if (k.includes('session:') && (val.customer || val.user)) {
        return val.customer || val.user;
      }

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

  // 1. Extract token from headers/cookie
  let token = req.headers.get('x-customer-token') || req.headers.get('x-token') || '';

  if (!token) {
    const m = (req.headers.get('authorization') || '').match(/^Bearer\s+(.+)$/i);
    if (m) token = m[1];
  }

  if (!token) {
    const c = parseCookie(req.headers.get('cookie') || '');
    token = c['customer_token'] || c['x-customer-token'] || c['token'] || '';
  }

  token = String(token || '').trim().replace(/^"+|"+$/g, '');

  // 2. Try to find customer with raw token
  let customer = await tryKeys(token);
  let decodedTokenId = '';

  // 3. Try base64 decode
  if (!customer && token) {
    try {
      let b64 = token.replace(/-/g, '+').replace(/_/g, '/');
      while (b64.length % 4) b64 += '=';
      const decoded = atob(b64);

      if (decoded && decoded.includes(':')) {
        const customerId = decoded.split(':')[0];
        if (customerId) {
          decodedTokenId = customerId;
          customer = (await kvGet('customer:' + customerId)) || (await kvGet('customer:id:' + customerId));
        }
      } else if (decoded && decoded !== token) {
        decodedTokenId = decoded;
        customer = await tryKeys(decoded);
        if (!customer) {
          customer = (await kvGet('customer:' + decoded)) || (await kvGet('customer:id:' + decoded));
        }
      }
    } catch { /* ignore */ }
  }

  // 4. Try JWT decode
  if (!customer && token && token.split('.').length === 3) {
    try {
      const p = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
      const cid = p.customer_id || p.customerId || p.sub || p.id || '';
      if (cid) {
        customer = (await kvGet('customer:' + cid)) || (await kvGet('customer:id:' + cid));
        if (!customer) decodedTokenId = String(cid);
      }
    } catch { /* ignore */ }
  }

  return {
    customer,
    customerId: customer?.id || customer?.customer_id || decodedTokenId || null,
    token
  };
}

// ===================================================================
// Inventory Management (REFACTORED)
// ===================================================================

/**
 * Normalize order items to consistent format
 * ✅ GIỮ LUÔN ẢNH BIẾN THỂ/PRODUCT TỪ FE/MINI (đưa về field image)
 */
function normalizeOrderItems(items) {
  const tryExtractSku = (txt) => {
    if (!txt) return null;
    const m = String(txt).toUpperCase().match(/\bK[\-]?\d+\b/);
    return m ? m[0].replace('-', '') : null;
  };

  return (Array.isArray(items) ? items : []).map(it => {
    const variantSku = tryExtractSku(it.variant || it.name || '');
    const maybeProductId = String(it.id || '').length > 12 ? it.id : null;

    // ƯU TIÊN ảnh gửi từ FE/Mini
    const rawImage =
      it.image ??
      it.img ??
      it.thumbnail ??
      it.variant_image ??
      it.product_image ??
      (Array.isArray(it.images) && it.images.length ? it.images[0] : null) ??
      (it.product && Array.isArray(it.product.images) && it.product.images.length ? it.product.images[0] : null) ??
      it.product?.image ??
      it.product?.img ??
      null;

    return {
      id: it.variant_id ?? it.id ?? it.sku ?? variantSku ?? null,
      product_id: it.product_id ?? it.pid ?? it.productId ?? (it.product?.id || it.product?.key) ?? maybeProductId ?? null,
      sku: it.sku ?? variantSku ?? null,
      name: it.name ?? it.title ?? '',
      variant: it.variant ?? '',
      qty: Number(it.qty ?? it.quantity ?? 1) || 1,
      price: Number(it.price || 0),
      cost: Number(it.cost || 0),
      // ✅ Chuẩn hóa về 1 field image để admin + mini xài chung
      image: rawImage || null,
    };
  });
}


/**
 * Adjust inventory (stock) by items
 * @param {Array} items - Normalized order items
 * @param {object} env - Cloudflare env
 * @param {number} direction - -1 to decrease, +1 to increase
 */
async function adjustInventory(items, env, direction = -1) {
  console.log('[INV] Adjusting inventory', { itemCount: items?.length, direction });

  const STOCK_KEYS = ['stock', 'ton_kho', 'quantity', 'qty_available', 'so_luong'];

  const readStock = (obj) => {
    for (const k of STOCK_KEYS) {
      if (obj && obj[k] != null) return Number(obj[k] || 0);
    }
    return 0;
  };

  const writeStock = (obj, value) => {
    for (const k of STOCK_KEYS) {
      if (obj && Object.prototype.hasOwnProperty.call(obj, k)) {
        obj[k] = Math.max(0, Number(value || 0));
        return k;
      }
    }
    obj['stock'] = Math.max(0, Number(value || 0));
    return 'stock';
  };

  for (const it of (items || [])) {
    const variantId = it.id || it.variant_id || it.sku;
    const productId = it.product_id;

    if (!variantId && !productId) {
      console.warn('[INV] Skip item: no ID', it);
      continue;
    }

    // Find product
    let product = null;
    if (productId) {
      product = await getJSON(env, 'product:' + productId, null);
      if (!product) product = await getJSON(env, 'products:' + productId, null);
    }

    if (!product && variantId) {
      const list = await getJSON(env, 'products:list', []);
      for (const s of list) {
        const p = await getJSON(env, 'product:' + s.id, null);
        if (!p || !Array.isArray(p.variants)) continue;

        const text = String(it.variant || it.name || '').toUpperCase();
        const ok = p.variants.some(v => {
          const vid = String(v.id || '');
          const vsku = String(v.sku || '');
          const vname = String(v.name || v.title || v.option_name || '').toUpperCase();
          return (
            vid === String(variantId) ||
            vsku === String(variantId) ||
            (it.sku && vsku === String(it.sku)) ||
            (text && vname && text.includes(vname))
          );
        });

        if (ok) {
          product = p;
          break;
        }
      }
    }

    if (!product) {
      console.warn('[INV] Product not found for item', it);
      continue;
    }

    const delta = Number(it.qty || 1) * direction;
    let touched = false;

    // Adjust variant stock
    if (Array.isArray(product.variants) && variantId) {
      const text2 = String(it.variant || it.name || '').toUpperCase();
      const v = product.variants.find(v => {
        const vid = String(v.id || '');
        const vsku = String(v.sku || '');
        const vname = String(v.name || v.title || v.option_name || '').toUpperCase();
        return (
          vid === String(variantId) ||
          vsku === String(variantId) ||
          (it.sku && vsku === String(it.sku)) ||
          (text2 && vname && text2.includes(vname))
        );
      });

      if (v) {
        const before = readStock(v);
        const after = before + delta;
        const keySet = writeStock(v, after);
        console.log('[INV] Variant updated', { key: keySet, before, after, variantId });
        touched = true;

        // Update sold count
        const vSoldBefore = Number(v.sold || v.sold_count || 0);
        const vSoldAfter = Math.max(0, vSoldBefore + (direction === -1 ? Number(it.qty || 1) : -Number(it.qty || 1)));
        v.sold = vSoldAfter;
        v.sold_count = vSoldAfter;
      }
    }

    // Adjust product-level stock if variant not touched
    if (!touched) {
      const before = readStock(product);
      const after = before + delta;
      const keySet = writeStock(product, after);
      console.log('[INV] Product stock updated', { key: keySet, before, after, productId: product.id });
    }

    // Update product sold count
    const pSoldBefore = Number(product.sold || product.sold_count || 0);
    const pSoldAfter = Math.max(0, pSoldBefore + (direction === -1 ? Number(it.qty || 1) : -Number(it.qty || 1)));
    product.sold = pSoldAfter;
    product.sold_count = pSoldAfter;

    await putJSON(env, 'product:' + product.id, product);
  }

  console.log('[INV] Adjustment complete');
}

// ===================================================================
// Cost Enrichment Helper (REFACTORED - DRY)
// ===================================================================
/**
 * Enrich items with cost & price from product variants
 * Modifies items array in-place
 * ✅ Đồng thời map luôn ảnh biến thể → item.image (nếu chưa có)
 */
async function enrichItemsWithCostAndPrice(items, env) {
  const allProducts = await getJSON(env, 'products:list', []);

  for (const item of items) {
    const variantId = item.id || item.sku;
    if (!variantId) continue;

    let variantFound = null;
    let productFound = null;

    // Search all products for matching variant
    for (const summary of allProducts) {
      const product = await getJSON(env, 'product:' + summary.id, null);
      if (!product || !Array.isArray(product.variants)) continue;

      const variant = product.variants.find(v =>
        String(v.id || v.sku || '') === String(variantId) ||
        String(v.sku || '') === String(item.sku || '')
      );

      if (variant) {
        variantFound = variant;
        productFound = product;
        break;
      }
    }

    if (!variantFound) continue;

    // ✅ Enforce variant price (always use variant price, not FE-sent price)
    const priceKeys = ['price', 'sale_price', 'list_price', 'gia_ban'];
    for (const key of priceKeys) {
      if (variantFound[key] != null) {
        item.price = Number(variantFound[key] || 0);
        console.log('[ENRICH] ✅ Set price from variant:', { id: variantId, price: item.price });
        break;
      }
    }

    // Set cost if not provided by FE
    if (!item.cost || item.cost === 0) {
      const costKeys = ['cost', 'cost_price', 'import_price', 'gia_von', 'buy_price', 'price_import'];
      for (const key of costKeys) {
        if (variantFound[key] != null) {
          item.cost = Number(variantFound[key] || 0);
          console.log('[ENRICH] ✅ Set cost from variant:', { id: variantId, cost: item.cost });
          break;
        }
      }
    }

    // ✅ NEW: map ảnh từ variant/product → item.image nếu chưa có
    if (!item.image && !item.img && !item.thumbnail) {
      const variantImage =
        variantFound.image ||
        variantFound.img ||
        variantFound.thumbnail ||
        (Array.isArray(variantFound.images) && variantFound.images.length
          ? variantFound.images[0]
          : null);

      const productImage =
        (productFound && Array.isArray(productFound.images) && productFound.images.length
          ? productFound.images[0]
          : null) ||
        productFound?.image ||
        productFound?.img ||
        null;

      const finalImage = variantImage || productImage || null;
      if (finalImage) {
        item.image = finalImage;
        console.log('[ENRICH] ✅ Set image from variant/product:', { id: variantId });
      }
    }
  }

  return items;
}

// ===================================================================
// Tier & Points Management
// ===================================================================

/**
 * Add points to customer when order is completed
 * @param {object} customer - Customer object from order
 * @param {number} revenue - Order revenue (after discount)
 * @param {object} env - Cloudflare env
 * @returns {object} - { upgraded, oldTier, newTier, points }
 */
async function addPointsToCustomer(customer, revenue, env) {
  if (!customer || !customer.id) {
    console.log('[TIER] No customer info, skip points');
    return { upgraded: false, points: 0 };
  }

  try {
    const customerKey = `customer:${customer.id}`;
    let custData = await env.SHV.get(customerKey);

    if (!custData) {
      console.log('[TIER] Customer not found in KV:', customer.id);
      return { upgraded: false, points: 0 };
    }

    const cust = JSON.parse(custData);
    const pointsToAdd = Math.floor(revenue);

    const tierResult = addPoints(cust, pointsToAdd);

    await env.SHV.put(customerKey, JSON.stringify(cust));
    if (cust.email) {
      await env.SHV.put(`customer:email:${cust.email}`, JSON.stringify(cust));
    }

    console.log('[TIER] Points added', {
      customerId: customer.id,
      pointsAdded: pointsToAdd,
      totalPoints: cust.points,
      upgraded: tierResult.upgraded,
      oldTier: tierResult.oldTier,
      newTier: tierResult.newTier
    });

    return {
      upgraded: tierResult.upgraded,
      oldTier: tierResult.oldTier,
      newTier: tierResult.newTier,
      points: cust.points
    };
  } catch (e) {
    console.error('[TIER] Error adding points:', e);
    return { upgraded: false, points: 0 };
  }
}

// ===================================================================
// Router Entry
// ===================================================================

export async function handle(req, env, ctx) {
  const url = new URL(req.url);
  const path = url.pathname;
  const method = req.method;

  // PUBLIC
  if (path === '/api/orders' && method === 'POST') return createOrder(req, env);
  if (path === '/public/orders/create' && method === 'POST') return createOrderPublic(req, env);
  if (path === '/public/order-create' && method === 'POST') return createOrderLegacy(req, env);
  if (path === '/orders/my' && method === 'GET') return getMyOrders(req, env);
  if (path === '/orders/cancel' && method === 'POST') return cancelOrderCustomer(req, env);

  // ADMIN
  if (path === '/api/orders' && method === 'GET') return listOrders(req, env);
  if (path === '/admin/orders' && method === 'GET') return listOrdersAdmin(req, env);
  if (path === '/admin/orders/upsert' && method === 'POST') return upsertOrder(req, env);
  if (path === '/admin/orders/delete' && method === 'POST') return deleteOrder(req, env);
  if (path === '/admin/orders/print' && method === 'GET') return printOrder(req, env);
  if (path === '/admin/stats' && method === 'GET') return getStats(req, env);

  // Shipping Waybill
  if (path === '/shipping/print' && method === 'POST') return printWaybill(req, env);
  if (path === '/shipping/cancel' && method === 'POST') return cancelWaybill(req, env);
  if (path === '/shipping/print-bulk' && method === 'POST') return printWaybillsBulk(req, env);
  if (path === '/shipping/cancel-bulk' && method === 'POST') return cancelWaybillsBulk(req, env);

  return errorResponse('Route not found', 404, req);
}

// ===================================================================
// PUBLIC: Create Order (Main Endpoint)
// ===================================================================

async function createOrder(req, env) {
  // Check idempotency
  const idem = await idemGet(req, env);
  if (idem.hit) return new Response(idem.body, { status: 200, headers: corsHeaders(req) });

  // Authenticate customer
  const auth = await authenticateCustomer(req, env);

  const body = await readBody(req) || {};
  console.log('[ORDER] Creating order', {
    items: body?.items?.length || 0,
    customerId: auth.customerId
  });

  // Validate request body
  const validation = validate(SCH.orderCreate, body);
  if (!validation.ok) {
    return json({ ok: false, error: 'VALIDATION_FAILED', details: validation.errors }, { status: 400 }, req);
  }

  const id = body.id || crypto.randomUUID().replace(/-/g, '');
  const createdAt = Date.now();

  // Normalize & enrich items
  let items = normalizeOrderItems(body.items || []);
  items = await enrichItemsWithCostAndPrice(items, env);

  // Calculate subtotal
  const subtotal = items.reduce((sum, item) =>
    sum + Number(item.price || 0) * Number(item.qty || 1), 0
  );

  // ✅ FIX: Extract shipping info correctly
  const shipping = body.shipping || {};
  const shipping_fee = Number(body?.totals?.shipping_fee || body.shipping_fee || 0);

  // ✅ FIX: Get voucher code from correct source
  const voucher_code_input = body.voucher_code || body.totals?.voucher_code || null;

  let validated_voucher_code = null;
  let validated_discount = 0;
  let validated_ship_discount = 0;

  // Re-validate voucher if provided
  if (voucher_code_input) {
    console.log('[ORDER] Re-validating voucher:', voucher_code_input);
    try {
      // Merge customer info
      const finalCustomer = {
        ...(auth.customer || {}),
        ...(body.customer || {})
      };
      if (auth.customerId) finalCustomer.id = auth.customerId;

      const fakeReq = new Request(req.url, {
        method: 'POST',
        headers: req.headers,
        body: JSON.stringify({
          code: voucher_code_input,
          customer_id: finalCustomer.id || null,
          subtotal: subtotal
        })
      });

      const applyResultResponse = await applyVoucher(fakeReq, env);
      const applyData = await applyResultResponse.json();

      if (applyResultResponse.status === 200 && applyData.ok && applyData.valid) {
        validated_voucher_code = applyData.code;
        validated_discount = applyData.discount || 0;
        validated_ship_discount = applyData.ship_discount || 0;
        console.log('[ORDER] Voucher validation SUCCESS:', {
          code: validated_voucher_code,
          discount: validated_discount,
          ship_discount: validated_ship_discount
        });
      } else {
        console.warn('[ORDER] Voucher validation FAILED:', applyData.message || applyData.error);
      }
    } catch (e) {
      console.error('[ORDER] EXCEPTION calling applyVoucher:', e);
    }
  }

  // Calculate final totals
  const final_discount = validated_discount;
  const final_ship_discount = validated_ship_discount;
  
  // ✅ FIX: Khi miễn ship (shipping_discount >= shipping_fee), revenue = subtotal - discount
  const actualShippingFee = Math.max(0, shipping_fee - final_ship_discount);
  const revenue = Math.max(0, subtotal - final_discount + actualShippingFee);
  
  const profit = items.reduce((sum, item) =>
    sum + (Number(item.price || 0) - Number(item.cost || 0)) * Number(item.qty || 1), 0
  ) - final_discount;

  // ✅ FIX: Merge customer info correctly
  const finalCustomer = {
    ...(auth.customer || {}),
    ...(body.customer || {})
  };
  if (auth.customerId) finalCustomer.id = auth.customerId;

  // Normalize customer phone
  if (finalCustomer.phone) {
    finalCustomer.phone = normalizePhone(finalCustomer.phone);
  }

  // Create order object
  const order = {
    id,
    createdAt,
    status: ORDER_STATUS.PENDING,
    customer: finalCustomer,
    items,
    subtotal,
    shipping_fee,
    discount: final_discount,
    shipping_discount: final_ship_discount,
    revenue,
    profit,
    voucher_code: validated_voucher_code,
    note: body.note || '',
    source: body.source || 'website',
    // ✅ FIX LỖI 1: Ưu tiên body (từ FE/Mini) trước
    shipping_provider: body.shipping_provider || shipping.provider || null,
    shipping_service: body.shipping_service || shipping.service_code || null,
    shipping_name: body.shipping_name || shipping.name || null,
    shipping_eta: body.shipping_eta || shipping.eta || null,
    // ✅ FIX LỖI 2: Lưu cân nặng từ FE/Mini vào order
    weight_gram: Number(body.total_weight_gram || body.totalWeightGram || 0),
    total_weight_gram: Number(body.total_weight_gram || body.totalWeightGram || 0),
    // ✅ Thêm allow_inspection và cod_amount
    allow_inspection: body.allow_inspection !== undefined ? body.allow_inspection : true,
    // ✅ FIX: cod_amount phải bằng revenue (tổng thực tế khách phải trả)
    cod_amount: revenue
  };

  // Save order
  const list = await getJSON(env, 'orders:list', []);
  list.unshift(order);
  await putJSON(env, 'orders:list', list);
  await putJSON(env, 'order:' + id, order);

  // ✅ FIX: Adjust inventory + sold_count NGAY KHI ĐẶT HÀNG
  if (shouldAdjustStock(order.status)) {
    await adjustInventory(items, env, -1);
    console.log('[ORDER] ✅ Đã trừ stock + tăng sold_count');
  }

  // ✅ REMOVED: Không tự động tạo vận đơn, đợi admin xác nhận
  console.log('[ORDER] ⏳ Đơn hàng đang chờ admin xác nhận');

  const response = json({ ok: true, id, status: order.status, tracking_code: order.tracking_code || null }, {}, req);
  await idemSet(idem.key, env, response);
  return response;
}

// ===================================================================
// PUBLIC: Create Order (Alternative Endpoint)
// ===================================================================

async function createOrderPublic(req, env) {
  const idem = await idemGet(req, env);
  if (idem.hit) return new Response(idem.body, { status: 200, headers: corsHeaders(req) });

  const auth = await authenticateCustomer(req, env);
  const body = await readBody(req) || {};

  const id = body.id || crypto.randomUUID().replace(/-/g, '');
  const createdAt = body.createdAt || body.created_at || Date.now();
  const status = body.status || ORDER_STATUS.PENDING;

  // Merge customer info
  const finalCustomer = {
    ...(auth.customer || {}),
    ...(body.customer || {})
  };
  if (auth.customerId) finalCustomer.id = auth.customerId;
  if (finalCustomer.phone) finalCustomer.phone = normalizePhone(finalCustomer.phone);

  // Normalize & enrich items
  let items = normalizeOrderItems(body.items || []);
  items = await enrichItemsWithCostAndPrice(items, env);

  const totals = body.totals || {};
  const shipping_fee = Number(body.shipping_fee ?? totals.ship ?? totals.shipping_fee ?? 0);
  const discount = Number(body.discount ?? totals.discount ?? 0);
  const shipping_discount = Number(body.shipping_discount ?? totals.shipping_discount ?? 0);

  const subtotal = items.reduce((sum, item) =>
    sum + Number(item.price || 0) * Number(item.qty || 1), 0
  );
  const revenue = Math.max(0, subtotal + shipping_fee - (discount + shipping_discount));
  const profit = items.reduce((sum, item) =>
    sum + (Number(item.price || 0) - Number(item.cost || 0)) * Number(item.qty || 1), 0
  ) - discount;

  const order = {
    id,
    createdAt,
    status,
    customer: finalCustomer,
    items,
    shipping_fee,
    discount,
    shipping_discount,
    subtotal,
    revenue,
    profit,
    shipping_name: body.shipping_name || null,
    shipping_eta: body.shipping_eta || null,
    shipping_provider: body.shipping_provider || null,
    shipping_service: body.shipping_service || null,
    note: body.note || '',
    source: body.source || 'website'
  };

  const list = await getJSON(env, 'orders:list', []);
  list.unshift(order);
  await putJSON(env, 'orders:list', list);
  await putJSON(env, 'order:' + id, order);

  if (shouldAdjustStock(order.status)) {
    await adjustInventory(items, env, -1);
  }

  // ✅ FIX: Only add points when order is COMPLETED, not just confirmed
  if (order.status === ORDER_STATUS.COMPLETED) {
    const tierInfo = await addPointsToCustomer(order.customer, revenue, env);
    console.log('[ORDER-PUBLIC] Tier update:', tierInfo);
  }

  const response = json({ ok: true, id }, {}, req);
  await idemSet(idem.key, env, response);
  return response;
}

// ===================================================================
// PUBLIC: Create Order (Legacy Endpoint)
// ===================================================================

async function createOrderLegacy(req, env) {
  const body = await readBody(req) || {};
  const id = body.id || crypto.randomUUID().replace(/-/g, '');
  const createdAt = Date.now();

  let items = normalizeOrderItems(body.items || []);
  items = await enrichItemsWithCostAndPrice(items, env);

  const shipping_fee = Number(body.shipping_fee || body.shippingFee || 0);

  const subtotal = items.reduce((sum, item) =>
    sum + Number(item.price || 0) * Number(item.qty || item.quantity || 1), 0
  );
  const cost = items.reduce((sum, item) =>
    sum + Number(item.cost || 0) * Number(item.qty || item.quantity || 1), 0
  );

  const revenue = subtotal + shipping_fee;
  const profit = revenue - cost;

  const order = {
    id,
    status: body.status || 'mới',
    name: body.name,
    phone: normalizePhone(body.phone),
    address: body.address,
    note: body.note || body.notes,
    items,
    subtotal,
    shipping_fee,
    total: subtotal + shipping_fee,
    revenue,
    profit,
    createdAt
  };

  const list = await getJSON(env, 'orders:list', []);
  list.unshift(order);
  await putJSON(env, 'orders:list', list);
  await putJSON(env, 'order:' + id, order);

  if (shouldAdjustStock(order.status)) {
    await adjustInventory(items, env, -1);
  }

  return json({ ok: true, id, data: order }, {}, req);
}

// ===================================================================
// ADMIN: List Orders
// ===================================================================

async function listOrders(req, env) {
  if (!(await adminOK(req, env))) return errorResponse('Unauthorized', 401, req);
  const list = await getJSON(env, 'orders:list', []);
  return json({ ok: true, items: list }, {}, req);
}

async function listOrdersAdmin(req, env) {
  if (!(await adminOK(req, env))) return errorResponse('Unauthorized', 401, req);

  const url = new URL(req.url);
  const from = Number(url.searchParams.get('from') || 0);
  const to = Number(url.searchParams.get('to') || 0);

  let list = await getJSON(env, 'orders:list', []);

  // Enrich orders missing items
  const enriched = [];
  for (const order of list) {
    if (!order.items) {
      const full = await getJSON(env, 'order:' + order.id, null);
      enriched.push(full || order);
    } else {
      enriched.push(order);
    }
  }
  list = enriched;

  if (from || to) {
    list = list.filter(order => {
      const ts = Number(order.createdAt || 0);
      if (from && ts < from) return false;
      if (to && ts > to) return false;
      return true;
    });
  }

  return json({ ok: true, items: list }, {}, req);
}

// ===================================================================
// ADMIN: Upsert Order
// ===================================================================

async function upsertOrder(req, env) {
  if (!(await adminOK(req, env))) return errorResponse('Unauthorized', 401, req);

  const body = await readBody(req) || {};
  const id = body.id || crypto.randomUUID().replace(/-/g, '');

  const list = await getJSON(env, 'orders:list', []);
  const index = list.findIndex(o => o.id === id);

  // Get old order data for status change detection
  const oldOrder = index >= 0 ? list[index] : null;
  const oldStatus = String(oldOrder?.status || '').toLowerCase();
  const newStatus = String(body.status || '').toLowerCase();

  // ✅ FIX: Khi admin chuyển PENDING → CONFIRMED, tự động tạo vận đơn
  const isConfirming = (oldStatus === 'pending' && newStatus === 'confirmed');

  // Create/update order
  const order = {
    ...body,
    id,
    createdAt: body.createdAt || Date.now()
  };

  // Recalculate totals
  const items = order.items || [];
  const subtotal = items.reduce((sum, item) => sum + Number(item.price || 0) * Number(item.qty || 1), 0);
  const cost = items.reduce((sum, item) => sum + Number(item.cost || 0) * Number(item.qty || 1), 0);

  order.subtotal = subtotal;
  order.revenue = subtotal + Number(order.shipping_fee || 0) - Number(order.discount || 0) - Number(order.shipping_discount || 0);
  order.profit = order.revenue - cost;

  // Update list
  if (index >= 0) {
    list[index] = order;
  } else {
    list.unshift(order);
  }

  await putJSON(env, 'orders:list', list);
  await putJSON(env, 'order:' + id, order);

  // ✅ FIX: Auto-create waybill when admin confirms order
  if (isConfirming && order.shipping_provider) {
    try {
      console.log('[ORDER-UPSERT] Admin xác nhận đơn, đang tạo vận đơn...');
      const waybillResult = await autoCreateWaybill(order, env);

      if (waybillResult.ok && waybillResult.carrier_code) {
        order.tracking_code = waybillResult.carrier_code;
        order.shipping_tracking = waybillResult.carrier_code;
        order.superai_code = waybillResult.superai_code;
        order.carrier_id = waybillResult.carrier_id;
        order.status = ORDER_STATUS.SHIPPING;
        order.waybill_data = waybillResult.raw;

        await putJSON(env, 'order:' + id, order);
        list[index] = order;
        await putJSON(env, 'orders:list', list);

        console.log('[ORDER-UPSERT] ✅ Đã tạo vận đơn:', waybillResult.carrier_code);
      } else {
        console.warn('[ORDER-UPSERT] ⚠️ Tạo vận đơn thất bại:', waybillResult.message);
      }
    } catch (e) {
      console.error('[ORDER-UPSERT] ❌ Lỗi tạo vận đơn:', e.message);
    }
  }

  // ✅ FIX: Handle voucher usage when order becomes completed
  if (newStatus === ORDER_STATUS.COMPLETED && oldStatus !== ORDER_STATUS.COMPLETED && order.voucher_code) {
    console.log('[ORDER-UPSERT] Marking voucher as used:', order.voucher_code);
    try {
      await markVoucherUsed(env, order.voucher_code, order.customer?.id || null);
    } catch (e) {
      console.error('[ORDER-UPSERT] Failed to mark voucher as used:', e);
    }
  }

  // ✅ FIX: Add points when order is completed
  if (newStatus === ORDER_STATUS.COMPLETED && oldStatus !== ORDER_STATUS.COMPLETED) {
    const tierInfo = await addPointsToCustomer(order.customer, order.revenue, env);
    console.log('[ORDER-UPSERT] Tier update:', tierInfo);
  }

  return json({ ok: true, id: order.id, data: order }, {}, req);
}

// ===================================================================
// ADMIN: Delete Order
// ===================================================================

async function deleteOrder(req, env) {
  if (!(await adminOK(req, env))) return errorResponse('Unauthorized', 401, req);

  const body = await readBody(req) || {};
  const id = body.id;
  if (!id) return errorResponse('ID is required', 400, req);

  const list = await getJSON(env, 'orders:list', []);
  const newList = list.filter(order => order.id !== id);
  await putJSON(env, 'orders:list', newList);

  return json({ ok: true, deleted: id }, {}, req);
}

// ===================================================================
// ADMIN: Print Order
// ===================================================================

async function printOrder(req, env) {
  if (!(await adminOK(req, env))) return errorResponse('Unauthorized', 401, req);

  const url = new URL(req.url);
  const id = url.searchParams.get('id');
  if (!id) return errorResponse('Missing order ID', 400, req);

  let order = await getJSON(env, 'order:' + id, null);
  if (!order) {
    const list = await getJSON(env, 'orders:list', []);
    order = list.find(o => String(o.id) === String(id)) || null;
  }
  if (!order) return errorResponse('Order not found', 404, req);

  const items = Array.isArray(order.items) ? order.items : [];
  const subtotal = items.reduce((s, it) => s + Number(it.price || 0) * Number(it.qty || 1), 0);
  const shipping = Number(order.shipping_fee || 0);
  const discount = Number(order.discount || 0) + Number(order.shipping_discount || 0);
  const total = Math.max(0, subtotal + shipping - discount);
  const createdDate = order.createdAt ? new Date(Number(order.createdAt)).toLocaleString('vi-VN') : '';

  const rows = items.map(item => `
    <tr>
      <td>${item.sku || item.id || ''}</td>
      <td>${(item.name || '') + (item.variant ? (' - ' + item.variant) : '')}</td>
      <td style="text-align:right">${formatPrice(item.qty || 1)}</td>
      <td style="text-align:right">${formatPrice(item.price || 0)}</td>
      <td style="text-align:right">${formatPrice(item.cost || 0)}</td>
      <td style="text-align:right">${formatPrice((item.price || 0) * (item.qty || 1))}</td>
    </tr>
  `).join('') || `<tr><td colspan="6" style="color:#6b7280">Không có dòng hàng</td></tr>`;

  const customer = order.customer || {};
  const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>Đơn hàng ${id}</title>
  <style>
    body{font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;margin:24px;color:#111827}
    .row{display:flex;justify-content:space-between;margin-bottom:12px}
    table{width:100%;border-collapse:collapse;margin-top:8px}
    th,td{border:1px solid #e5e7eb;padding:6px 8px;font-size:13px}
    th{background:#f9fafb;text-align:left}
    .totals{margin-top:12px}
    .totals div{display:flex;justify-content:space-between;padding:2px 0}
  </style>
</head>
<body>
  <div class="row">
    <div>
      <div><b>Đơn hàng:</b> ${id}</div>
      <div><b>Ngày tạo:</b> ${createdDate}</div>
      <div><b>Khách:</b> ${customer.name || order.customer_name || order.name || ''} ${customer.phone ? ('• ' + customer.phone) : ''}</div>
      ${order.address || customer.address ? (`<div><b>Địa chỉ:</b> ${order.address || customer.address}</div>`) : ''}
      ${order.shipping_name ? (`<div><b>Vận chuyển:</b> ${order.shipping_name} ${order.shipping_eta ? (' • ' + order.shipping_eta) : ''}</div>`) : ''}
    </div>
  </div>
  <table>
    <thead>
      <tr>
        <th>Mã SP</th>
        <th>Tên/Phân loại</th>
        <th>SL</th>
        <th>Giá bán</th>
        <th>Giá vốn</th>
        <th>Thành tiền</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
  <div class="totals">
    <div><span>Tổng hàng</span><b>${formatPrice(subtotal)}</b></div>
    <div><span>Phí vận chuyển</span><b>${formatPrice(shipping)}</b></div>
    ${discount ? (`<div><span>Giảm</span><b>-${formatPrice(discount)}</b></div>`) : ''}
    <div style="font-size:16px"><span>Tổng thanh toán</span><b>${formatPrice(total)}</b></div>
  </div>
  <script>window.onload = () => setTimeout(() => window.print(), 200);</script>
</body>
</html>`;
  
  return new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      ...corsHeaders(req)
    }
  });
}

// ===================================================================
// ADMIN: Get Stats
// ===================================================================

async function getStats(req, env) {
  if (!(await adminOK(req, env))) return errorResponse('Unauthorized', 401, req);

  const url = new URL(req.url);
  const granularity = (url.searchParams.get('granularity') || 'day').toLowerCase();
  let from = url.searchParams.get('from');
  let to = url.searchParams.get('to');

  // VN timezone base
  const now = new Date(Date.now() + 7 * 3600 * 1000);
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  const day = now.getUTCDate();
  const todayStart = Date.UTC(year, month, day) - 7 * 3600 * 1000;

  if (!from || !to) {
    if (granularity === 'day') {
      from = todayStart;
      to = todayStart + 86400000;
    } else if (granularity === 'week') {
      const weekday = (new Date(todayStart + 7 * 3600 * 1000).getDay() + 6) % 7;
      const start = todayStart - weekday * 86400000;
      from = start;
      to = start + 7 * 86400000;
    } else if (granularity === 'month') {
      const dt = new Date(todayStart + 7 * 3600 * 1000);
      const start = Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth(), 1) - 7 * 3600 * 1000;
      const end = Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth() + 1, 1) - 7 * 3600 * 1000;
      from = start;
      to = end;
    } else {
      from = todayStart;
      to = todayStart + 86400000;
    }
  } else {
    from = Number(from);
    to = Number(to);
  }

  // Load & enrich
  let list = await getJSON(env, 'orders:list', []);
  const enriched = [];
  for (const order of list) {
    if (!order.items) {
      const full = await getJSON(env, 'order:' + order.id, null);
      enriched.push(full || order);
    } else {
      enriched.push(order);
    }
  }
  list = enriched;

  let orderCount = 0;
  let revenue = 0;
  let goodsCost = 0;
  const topMap = {};

  for (const order of list) {
    const ts = Number(order.createdAt || order.created_at || 0);
    if (!ts || ts < from || ts >= to) continue;

    orderCount += 1;

    const orderRevenue = Number(order.revenue || 0);
    revenue += orderRevenue;

    const items = Array.isArray(order.items) ? order.items : [];
    for (const item of items) {
      const cost = Number(item.cost || 0);
      goodsCost += cost * Number(item.qty || 1);

      const name = item.name || item.title || item.id || 'unknown';
      if (!topMap[name]) topMap[name] = { name, qty: 0, revenue: 0 };
      topMap[name].qty += Number(item.qty || 1);
      topMap[name].revenue += Number(item.price || 0) * Number(item.qty || 1);
    }
  }

  const tax = revenue * 0.015;
  const ads = revenue * 0.15;
  const labor = revenue * 0.10;
  const profit = Math.max(0, revenue - goodsCost - tax - ads - labor);

  const topProducts = Object.values(topMap)
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 20);

  return json({
    ok: true,
    orders: orderCount,
    revenue,
    profit,
    cost_price: goodsCost,
    goods_cost: goodsCost,
    top_products: topProducts,
    from,
    to,
    granularity
  }, {}, req);
}

// ===================================================================
// PUBLIC: Get My Orders (Customer)
// ===================================================================

async function getMyOrders(req, env) {
  console.log('[GET-MY-ORDERS] Request received');

  const auth = await authenticateCustomer(req, env);

  // Allow phone fallback from query params
  const url = new URL(req.url);
  const phoneFallback = (url.searchParams.get('phone') || req.headers.get('x-customer-phone') || '').trim();

  if (!auth.customerId && !phoneFallback) {
    return json({
      ok: false,
      error: 'Unauthorized',
      message: 'Vui lòng đăng nhập'
    }, { status: 401 }, req);
  }

  // Load all orders
  let allOrders = await getJSON(env, 'orders:list', []);

  // Enrich orders missing items
  const enriched = [];
  for (const order of allOrders) {
    if (!order.items) {
      const full = await getJSON(env, 'order:' + order.id, null);
      enriched.push(full || order);
    } else {
      enriched.push(order);
    }
  }
  allOrders = enriched;

  console.log('[GET-MY-ORDERS] Total orders before filter:', allOrders.length);

  // Prepare filter criteria
  const pPhone = normalizePhone(phoneFallback || auth.customer?.phone || auth.customer?.mobile || '');
  const pId = auth.customerId;
  const pEmail = auth.customer?.email || '';

  // Filter orders
  const myOrders = allOrders.filter(order => {
    const oc = order.customer || {};
    const orderPhone = normalizePhone(oc.phone || order.phone || '');
    const orderId = oc.id || oc.customer_id || '';
    const orderEmail = String(oc.email || order.email || '').toLowerCase();

    const eq = (a, b) => String(a).toLowerCase() === String(b).toLowerCase();

    return (
      (pPhone && orderPhone && orderPhone === pPhone) ||
      (pId && orderId && eq(orderId, pId)) ||
      (pEmail && orderEmail && eq(orderEmail, pEmail))
    );
  });

  myOrders.sort((a, b) => Number(b.createdAt || b.created_at || 0) - Number(a.createdAt || a.created_at || 0));

  console.log('[GET-MY-ORDERS] Filtered orders count:', myOrders.length);

  return json({
    ok: true,
    orders: myOrders,
    count: myOrders.length,
    customer: auth.customer || null
  }, {}, req);
}

// ===================================================================
// PUBLIC: Cancel Order (Customer)
// ===================================================================

async function cancelOrderCustomer(req, env) {
  try {
    const body = await readBody(req) || {};
    const orderId = body.order_id;

    if (!orderId) {
      return json({ ok: false, error: 'Missing order_id' }, { status: 400 }, req);
    }

    // Get order
    const order = await getJSON(env, 'order:' + orderId, null);
    if (!order) {
      return json({ ok: false, error: 'Order not found' }, { status: 404 }, req);
    }

    // Check status: only allow cancel for pending/confirmed
    const status = String(order.status || '').toLowerCase();
    if (!status.includes('pending') && !status.includes('confirmed') && !status.includes('cho')) {
      return json({ ok: false, error: 'Không thể hủy đơn hàng này' }, { status: 400 }, req);
    }

    // Update status
    order.status = ORDER_STATUS.CANCELLED;
    order.cancelled_at = Date.now();
    order.cancelled_by = 'customer';

    // Restore inventory if needed
    if (shouldAdjustStock(status)) {
      await adjustInventory(normalizeOrderItems(order.items), env, +1);
    }

    // Cancel waybill if exists
    if (order.superai_code || order.tracking_code) {
      try {
        await cancelWaybill({
          body: JSON.stringify({ superai_code: order.superai_code || order.tracking_code }),
          headers: req.headers
        }, env);
        order.tracking_code = 'CANCELLED';
      } catch (e) {
        console.warn('[CANCEL-ORDER] Failed to cancel waybill:', e.message);
      }
    }

    // Save
    await putJSON(env, 'order:' + orderId, order);

    const list = await getJSON(env, 'orders:list', []);
    const index = list.findIndex(o => o.id === orderId);
    if (index > -1) {
      list[index] = order;
      await putJSON(env, 'orders:list', list);
    }

    return json({ ok: true, message: 'Đã hủy đơn hàng' }, {}, req);

  } catch (e) {
    console.error('[CANCEL-ORDER] Error:', e);
    return json({ ok: false, error: e.message }, { status: 500 }, req);
  }
}