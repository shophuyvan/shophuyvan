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
import { applyVoucher, markVoucherUsed } from './vouchers.js';
import { saveOrderToD1 } from '../core/order-core.js';
import { getBaseProduct } from '../core/product-core.js'; // ✅ CORE: Dùng Product Core làm chuẩn
import { lookupProvinceCode, lookupDistrictCode, chargeableWeightGrams } from './shipping/helpers.js';

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
 * Adjust inventory (stock) by items - D1 VERSION
 * @param {Array} items - Normalized order items
 * @param {object} env - Cloudflare env
 * @param {number} direction - -1 to decrease, +1 to increase
 */
async function adjustInventory(items, env, direction = -1) {
  console.log('[INV] Adjusting inventory D1', { itemCount: items?.length, direction });

  for (const it of (items || [])) {
    const variantId = it.id || it.variant_id;
    const sku = it.sku;

    if (!variantId && !sku) {
      console.warn('[INV] Skip item: no variant ID or SKU', it);
      continue;
    }

    try {
      // Tìm variant trong D1
      let variant = null;
      
      if (variantId) {
        variant = await env.DB.prepare(`
          SELECT * FROM variants WHERE id = ?
        `).bind(variantId).first();
      }
      
      if (!variant && sku) {
        variant = await env.DB.prepare(`
          SELECT * FROM variants WHERE sku = ?
        `).bind(sku).first();
      }

      if (!variant) {
        console.warn('[INV] Variant not found:', { variantId, sku });
        continue;
      }

      const delta = Number(it.qty || 1) * direction;
      const oldStock = Number(variant.stock || 0);
      const newStock = Math.max(0, oldStock + delta);

      // Update stock trong D1
      await env.DB.prepare(`
        UPDATE variants SET stock = ?, updated_at = ? WHERE id = ?
      `).bind(newStock, Date.now(), variant.id).run();

      console.log('[INV] ✅ Variant stock updated:', {
        variantId: variant.id,
        sku: variant.sku,
        before: oldStock,
        after: newStock,
        delta
      });

      // ✅ Log stock change vào stock_logs
      await env.DB.prepare(`
        INSERT INTO stock_logs (
          variant_id, old_stock, new_stock, change,
          reason, channel, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `).bind(
        variant.id,
        oldStock,
        newStock,
        delta,
        direction === -1 ? 'order' : 'return',
        it.channel || 'website',
        Date.now()
      ).run();

    } catch (err) {
      console.error('[INV] Error adjusting variant:', err);
      continue;
    }
  }

  console.log('[INV] Adjustment complete (D1)');
}

// ===================================================================
// Cost Enrichment Helper (OPTIMIZED via Product Core)
// ===================================================================
async function enrichItemsWithCostAndPrice(items, env) {
  // Duyệt qua từng item và lấy dữ liệu trực tiếp từ D1 qua Product Core
  // Không dùng vòng lặp KV chậm chạp nữa
  for (const item of items) {
    if (!item.product_id) continue;

    try {
      // 1. Gọi Product Core lấy base product + variants
      const product = await getBaseProduct(env, item.product_id);
      if (!product || !product.variants) continue;

      // 2. Tìm variant khớp
      const variantId = item.variant_id || item.id;
      const variant = product.variants.find(v => 
        String(v.id) === String(variantId) || String(v.sku) === String(item.sku)
      );

      if (variant) {
        // ✅ Chuẩn hóa Giá bán (Ưu tiên giá sale nếu có trong core)
        // Logic: Frontend gửi lên chỉ để tham khảo, Backend chốt giá cuối từ DB
        const dbPrice = Number(variant.price_sale || variant.price || 0);
        if (dbPrice > 0) item.price = dbPrice;

        // ✅ Chuẩn hóa Giá vốn (Cost)
        item.cost = Number(variant.price_wholesale || variant.cost || 0);

        // ✅ Chuẩn hóa Ảnh (Image) - Lấy ảnh variant > ảnh product
        const variantImage = variant.image;
        const productImages = typeof product.images === 'string' ? JSON.parse(product.images) : (product.images || []);
        const productImage = productImages[0] || null;
        
        item.image = variantImage || productImage || item.image || null;

        console.log(`[ENRICH] ✅ Updated Item ${item.sku}: Price=${item.price}, Cost=${item.cost}, Img=${!!item.image}`);
      }
    } catch (e) {
      console.error(`[ENRICH] ❌ Failed for product ${item.product_id}:`, e);
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
  if (path === '/api/orders' && method === 'POST') return createOrder(req, env, ctx); // ✅ Truyền ctx vào
  if (path === '/public/orders/create' && method === 'POST') return createOrderPublic(req, env, ctx); // ✅ Truyền ctx
  if (path === '/public/order-create' && method === 'POST') return createOrderLegacy(req, env);
  if (path === '/orders/my' && method === 'GET') return getMyOrders(req, env);
  if (path === '/orders/cancel' && method === 'POST') return cancelOrderCustomer(req, env);
  if (path === '/orders/price' && method === 'POST') return priceOrderPreview(req, env); // ✅ PREVIEW TỔNG GIÁ

  // ADMIN
  if (path === '/api/orders' && method === 'GET') return listOrdersFromD1(req, env); // ✅ MỚI: Lấy từ D1
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

// ✅ TÍNH GIÁ SERVER-SIDE (voucher + freeship) KHÔNG TẠO ĐƠN
// ✅ TÍNH GIÁ SERVER-SIDE (voucher + freeship) KHÔNG TẠO ĐƠN
async function priceOrderPreview(req, env) {
  try { // <--- [CORE SYNC] Bắt đầu Try để bắt lỗi crash
    // (Optional) auth để lấy customerId nếu có
    const auth = await authenticateCustomer(req, env).catch(() => ({ customerId: null }));

    const body = await readBody(req) || {};
    // ✅ Gọi hàm chuẩn hóa (đã fix lỗi variantFound)
    let items = normalizeOrderItems(body.items || []);
    
    // ✅ Gọi Product Core để lấy giá chuẩn từ DB
    items = await enrichItemsWithCostAndPrice(items, env);

    const subtotal = items.reduce((sum, it) =>
      sum + Number(it.price || 0) * Number(it.qty || it.quantity || 1), 0
    );

    // Lấy phí ship & voucher từ body
    const shipping_fee = Number(body?.totals?.shipping_fee || body.shipping_fee || 0);
    const voucher_code_input = body.voucher_code || body?.totals?.voucher_code || null;

    let validated_voucher_code = null;
    let validated_discount = 0;
    let validated_ship_discount = 0;

    // Validate voucher
    if (voucher_code_input) {
      try {
        const finalCustomer = {
          id: auth?.customerId || body.customer?.id || null,
          phone: body.customer?.phone || ''
        };
        const fakeReq = new Request(req.url, {
          method: 'POST',
          headers: req.headers,
          body: JSON.stringify({
            code: voucher_code_input,
            customer_id: finalCustomer.id || null,
            subtotal: subtotal
          })
        });
        const applyRes = await applyVoucher(fakeReq, env);
        const applyData = await applyRes.json();
        if (applyRes.status === 200 && applyData.ok && applyData.valid) {
          validated_voucher_code = applyData.code;
          validated_discount = Number(applyData.discount || 0);
          validated_ship_discount = Number(applyData.ship_discount || 0);
        }
      } catch (e) { /* ignore */ }
    }

    // Auto Freeship Logic
    let autoShippingDiscount = 0;
    let autoVoucherCode = null;
    try {
      const now = Date.now();
      const list = await getJSON(env, 'vouchers', []);
      const activeAuto = (Array.isArray(list) ? list : [])
        .filter(v => v && v.on === true && v.voucher_type === 'auto_freeship')
        .filter(v => {
          const s = Number(v.starts_at || 0);
          const e = Number(v.expires_at || 0);
          if (s && now < s) return false;
          if (e && now > e) return false;
          return true;
        })
        .sort((a, b) => (Number(b.min_purchase || 0) - Number(a.min_purchase || 0)));
        
      const eligible = activeAuto.find(v => Number(subtotal) >= Number(v.min_purchase || 0));
      if (eligible) {
        autoShippingDiscount = Math.max(0, shipping_fee);
        autoVoucherCode = eligible.code || null;
      }
    } catch (e) { /* ignore */ }

    // Tính toán tổng cuối cùng
    const best_shipping_discount = Math.max(0, Math.max(validated_ship_discount, autoShippingDiscount));
    const final_shipping_fee = Math.max(0, shipping_fee - best_shipping_discount);
    const total = Math.max(0, subtotal - validated_discount + final_shipping_fee);

    const final_voucher_code =
      (autoShippingDiscount >= validated_ship_discount && autoVoucherCode)
        ? autoVoucherCode
        : validated_voucher_code;

    return json({
      ok: true,
      totals: {
        subtotal,
        shipping_fee,
        discount: validated_discount,
        shipping_discount: best_shipping_discount,
        total,
        voucher_code: final_voucher_code
      },
      items
    }, {}, req); // Truyền req để có CORS header

  } catch (e) {
    console.error('[priceOrderPreview] Error:', e);
    // ✅ Trả về lỗi chuẩn JSON + CORS thay vì crash 500
    return errorResponse(e, 500, req);
  }
}

async function createOrder(req, env, ctx) { // ✅ Thêm ctx vào tham số

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
  
  // ✅ DEBUG: Log items để kiểm tra
  console.log('[DEBUG] Items after enrich:', JSON.stringify(items.map(item => ({
    sku: item.sku,
    product_id: item.product_id,
    variant_id: item.variant_id,
    name: item.name
  }))));

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
    shipping_option_id: body.shipping_option_id || '1', // Lưu option_id
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

  // Save order to KV (Legacy Backup)
  const list = await getJSON(env, 'orders:list', []);
  list.unshift(order);
  await putJSON(env, 'orders:list', list);
  await putJSON(env, 'order:' + id, order);

  // [NEW] 🚀 SAVE TO D1 DATABASE (CORE)
  try {
    const d1Result = await saveOrderToD1(env, order);
    if (!d1Result.ok) {
      console.error('[ORDER-PUBLIC] Failed to save to D1:', d1Result.error);
    } else {
      console.log('[ORDER-PUBLIC] Saved to D1 ID:', d1Result.id);
      
      // ✅ FIX: GỬI THÔNG BÁO TELEGRAM NGAY LẬP TỨC
      // (Dùng ctx.waitUntil để không làm chậm phản hồi cho khách)
      if (typeof ctx !== 'undefined' && ctx.waitUntil) {
         ctx.waitUntil(sendOrderNotification(order, env, ctx));
      } else {
         // Fallback nếu không có ctx
         sendOrderNotification(order, env, null);
      }
    }
  } catch (e) { 
    console.error('[ORDER-PUBLIC] Exception D1:', e); 
  }

  // [NEW] 🔥 BẮN ĐƠN SANG FACEBOOK CAPI (SERVER-SIDE)
  // Không dùng await để tránh làm chậm phản hồi về FE
  ctx.waitUntil(sendToFacebookCAPI(order, req, env));

  // ✅ FIX: CHỈ TRỪ STOCK CHO ĐỖN TỪ WEBSITE/MINI
  // Orders từ Shopee (có flag skip_stock_adjustment) KHÔNG TRỪ STOCK
  if (shouldAdjustStock(order.status) && !body.skip_stock_adjustment) {
    await adjustInventory(items, env, -1);
    console.log('[ORDER] ✅ Đã trừ stock (Website/Mini order)');
  } else if (body.skip_stock_adjustment) {
    console.log('[ORDER] ⏭️ SKIP stock adjustment (Shopee order - stock sync from channel)');
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

async function createOrderPublic(req, env, ctx) { // ✅ Nhận ctx
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

  // [NEW] 🚀 SAVE TO D1 DATABASE (CORE)
  try {
    const d1Result = await saveOrderToD1(env, order);
    if (!d1Result.ok) {
      console.error('[ORDER-PUBLIC] Failed to save to D1:', d1Result.error);
    } else {
      console.log('[ORDER-PUBLIC] Saved to D1 ID:', d1Result.id);
      
      // ✅ FIX: GỬI THÔNG BÁO TELEGRAM KHI KHÁCH ĐẶT HÀNG
      if (ctx && ctx.waitUntil) {
        ctx.waitUntil(sendOrderNotification(order, env, ctx));
      } else {
        sendOrderNotification(order, env, null);
      }
    }
  } catch (e) { 
    console.error('[ORDER-PUBLIC] Exception D1:', e); 
  }

  // ✅ CHỈ TRỪ STOCK CHO ĐƠN TỪ WEBSITE/MINI
  if (shouldAdjustStock(order.status) && !body.skip_stock_adjustment) {
    await adjustInventory(items, env, -1);
    console.log('[ORDER-PUBLIC] ✅ Đã trừ stock');
  } else if (body.skip_stock_adjustment) {
    console.log('[ORDER-PUBLIC] ⏭️ SKIP stock adjustment (Channel order)');
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
// ADMIN: List Orders FROM D1 (NEW)
// ===================================================================

async function listOrdersFromD1(req, env) {
  if (!(await adminOK(req, env))) return errorResponse('Unauthorized', 401, req);

  try {
    console.log('[ORDERS-D1] 🚀 Fetching orders with OPTIMIZED JOIN query...');

    // ✅ OPTIMIZED: 1 query duy nhất với JOIN thay vì N+1 queries
    const result = await env.DB.prepare(`
      SELECT 
        o.id as order_id,
        o.order_number, o.channel, o.channel_order_id,
        o.status, o.payment_status, o.fulfillment_status,
        o.customer_name, o.customer_phone, o.customer_email,
        o.shipping_name, o.shipping_phone, o.shipping_address,
        o.shipping_district, o.shipping_city, o.shipping_province, o.shipping_zipcode,
        o.subtotal, o.shipping_fee, o.discount, o.total, o.profit,
        o.commission_fee, o.service_fee, o.seller_transaction_fee,
        o.escrow_amount, o.buyer_paid_amount,
        o.coin_used, o.voucher_seller, o.voucher_shopee,
        o.shop_id, o.shop_name,
        o.payment_method, o.customer_note, o.admin_note,
        o.tracking_number, o.superai_code, o.shipping_carrier, o.carrier_id,
        o.created_at, o.updated_at,
        oi.product_id, oi.variant_id, oi.sku, 
        oi.name as item_name, oi.variant_name, oi.image,
        oi.price, oi.cost, oi.quantity, oi.subtotal as item_subtotal,
        oi.channel_item_id, oi.channel_model_id
      FROM orders o
      LEFT JOIN order_items oi ON o.id = oi.order_id
      ORDER BY o.created_at DESC
      LIMIT 1000
    `).all();

    const rows = result.results || [];
    console.log('[ORDERS-D1] Fetched', rows.length, 'rows from JOIN query');

    // ✅ Group items by order_id
    const ordersMap = new Map();
    
    for (const row of rows) {
      const orderId = row.order_id;
      
      if (!ordersMap.has(orderId)) {
        // Parse shipping_address JSON
        let shippingAddr = {};
        try {
          if (row.shipping_address) {
            shippingAddr = JSON.parse(row.shipping_address);
          }
        } catch (e) {
          console.warn('[ORDERS-D1] Failed to parse shipping_address:', e);
        }

        // Create order object
        ordersMap.set(orderId, {
          id: orderId,
          order_number: row.order_number,
          status: row.status,
          payment_status: row.payment_status,
          
          // Customer info
          customer: {
            name: row.customer_name,
            phone: row.customer_phone,
            email: row.customer_email,
            address: shippingAddr.address || row.shipping_address || '',
            district: shippingAddr.district || row.shipping_district || '',
            city: shippingAddr.city || row.shipping_city || '',
            province: shippingAddr.province || row.shipping_province || '',
            ward: shippingAddr.ward || shippingAddr.commune || ''
          },
          
          customer_name: row.customer_name,
          phone: row.customer_phone,
          
         // Shipping info
          shipping_provider: row.channel === 'shopee' ? 'Shopee' : null,
          shipping_name: row.channel === 'shopee' ? 'Shopee' : null,
          tracking_code: row.channel_order_id || '',
          
          // ✅ SuperAI shipping info
          tracking_number: row.tracking_number || '',
          superai_code: row.superai_code || '',
          shipping_carrier: row.shipping_carrier || '',
          carrier_id: row.carrier_id || '',
          
          // Financial
          items: [],
          subtotal: row.subtotal,
          shipping_fee: row.shipping_fee,
          discount: row.discount,
          revenue: row.total,
          profit: row.profit, // ✅ Trả về lợi nhuận cho Admin
          
          // ✅ Shopee financial details
          commission_fee: row.commission_fee || 0,
          service_fee: row.service_fee || 0,
          seller_transaction_fee: row.seller_transaction_fee || 0,
          escrow_amount: row.escrow_amount || 0,
          buyer_paid_amount: row.buyer_paid_amount || 0,
          coin_used: row.coin_used || 0,
          voucher_seller: row.voucher_seller || 0,
          voucher_shopee: row.voucher_shopee || 0,
          
          // ✅ Shop info
          shop_id: row.shop_id,
          shop_name: row.shop_name,
          
          // Metadata
          source: row.channel,
          channel: row.channel,
          payment_method: row.payment_method,
          note: row.customer_note || '',
          
          // Timestamps
          createdAt: row.created_at,
          created_at: row.created_at,
          updated_at: row.updated_at
        });
      }
      
      // ✅ FIX: Thêm item vào đơn (Chấp nhận cả item thiếu ID để không bị mất dòng)
      if (row.variant_id || row.sku || row.product_id || row.item_name) {
        const order = ordersMap.get(orderId);
        order.items.push({
          id: row.variant_id || row.sku || 'unknown',
          product_id: row.product_id,
          sku: row.sku || '',
          name: row.item_name || 'Sản phẩm',
          variant: row.variant_name || '',
          price: row.price || 0,
          cost: row.cost || 0,
          qty: row.quantity || 1,
          subtotal: row.item_subtotal || 0,
          image: row.image || null,
          // Shopee mapping
          shopee_item_id: row.channel_item_id,
          shopee_model_id: row.channel_model_id
        });
      }
    }

    const ordersWithItems = Array.from(ordersMap.values());

   // ✅ ĐÃ FIX: Tắt tính năng tự động tìm ảnh (Self-Healing) ở danh sách
    // Lý do: Đoạn code cũ chạy enrichItemsWithCostAndPrice cho 1000 đơn hàng cùng lúc
    // gây ra lỗi 503 (CPU Exceeded) và treo Worker.
    // Ảnh sẽ được hiển thị nếu đã có sẵn trong D1, không query lại từ Product Core tại đây.

    console.log('[ORDERS-D1] ✅ Loaded', ordersWithItems.length, 'orders');
    return json({ ok: true, items: ordersWithItems }, {}, req);

  } catch (error) {
    console.error('[ORDERS-D1] ❌ Error:', error);
    return json({ 
      ok: false, 
      error: 'Failed to load orders from D1',
      message: error.message 
    }, { status: 500 }, req);
  }
}

// ===================================================================
// ADMIN: List Orders (KV - LEGACY)
// ===================================================================

async function listOrders(req, env) {
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
  let oldOrder = index >= 0 ? list[index] : null;
  if (!oldOrder) {
    oldOrder = await getJSON(env, 'order:' + id, null);
  }
  
  // ✅ Nếu vẫn không có oldOrder trong KV, query từ D1
  if (!oldOrder && id) {
    try {
      const dbOrder = await env.DB.prepare(`
        SELECT * FROM orders WHERE order_number = ? OR id = ?
      `).bind(id, id).first();
      
      if (dbOrder) {
        // Parse items từ DB
        const dbItems = await env.DB.prepare(`
          SELECT * FROM order_items WHERE order_id = ?
        `).bind(dbOrder.id).all();
        
        oldOrder = {
          ...dbOrder,
          items: dbItems.results || []
        };
        
        console.log('[ORDER-UPSERT] 🔄 Loaded order from D1:', {
          id: dbOrder.id,
          order_number: dbOrder.order_number,
          shipping_province: dbOrder.shipping_province,
          shipping_district: dbOrder.shipping_district,
          receiver_province_code: dbOrder.receiver_province_code,
          receiver_district_code: dbOrder.receiver_district_code,
          items_count: oldOrder.items.length
        });
      }
    } catch (e) {
      console.error('[ORDER-UPSERT] Failed to load from D1:', e);
    }
  }

 const oldStatus = String(oldOrder?.status || 'pending').toLowerCase();
  const newStatus = String(body.status || '').toLowerCase();

  // ✅ FIX: Logic xác nhận đơn (Đơn giản hóa để tránh lỗi)
  // Kích hoạt khi: Trạng thái là 'processing' VÀ (Chưa có mã vận đơn HOẶC Mã bị hủy/lỗi/rỗng)
  const isConfirming = (
    newStatus === 'processing' && 
    (!oldOrder || !oldOrder.tracking_code || oldOrder.tracking_code === 'CANCELLED' || oldOrder.tracking_code === '')
  );
  
  console.log(`[ORDER-UPSERT] Status change: ${oldStatus} -> ${newStatus}. isConfirming=${isConfirming}`);

  // Create/update order (MERGE: Giữ dữ liệu cũ, ghi đè dữ liệu mới)
  const order = {
    ...(oldOrder || {}), 
    ...body,             
    id,
    createdAt: (oldOrder && oldOrder.createdAt) ? oldOrder.createdAt : (body.createdAt || Date.now()),
    updated_at: Date.now()
  };
  
  // ✅ DEBUG: Log order data để kiểm tra
  console.log('[ORDER-UPSERT] 📦 Order data:', JSON.stringify({
    id: id,
    shipping_province: order.shipping_province,
    shipping_district: order.shipping_district,
    shipping_city: order.shipping_city,
    shipping_address: order.shipping_address,
    receiver_province_code: order.receiver_province_code,
    receiver_district_code: order.receiver_district_code,
    items_count: order.items?.length || 0,
    has_customer: !!order.customer
  }, null, 2));

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

  // ✅ Đồng bộ D1
  try {
    await saveOrderToD1(env, order);
    console.log('[ORDER-UPSERT] ✅ Synced to D1:', id);
  } catch (e) {
    console.error('[ORDER-UPSERT] ❌ D1 Sync Failed:', e);
  }

 // ✅ Tự động tạo vận đơn SuperAI khi xác nhận
  if (isConfirming) {
    // Không check cứng shipping_provider ở đây nữa để tránh lỗi logic nếu FE gửi thiếu
    try {
      console.log('[ORDER-UPSERT] 🟢 Admin xác nhận đơn, đang gọi SuperAI tạo vận đơn...');
          
          // ✅ VALIDATE & ENRICH trước khi tạo vận đơn
          // 1. Validate province_code
          if (!order.receiver_province_code && order.shipping_province) {
            console.log('[ORDER-UPSERT] 🔄 Looking up province code for:', order.shipping_province);
            order.receiver_province_code = await lookupProvinceCode(env, order.shipping_province);
          }
          
          // 2. Validate district_code
          if (!order.receiver_district_code && order.shipping_district && order.receiver_province_code) {
            console.log('[ORDER-UPSERT] 🔄 Looking up district code for:', order.shipping_district);
            order.receiver_district_code = await lookupDistrictCode(env, order.receiver_province_code, order.shipping_district);
          }
          
          // 3. Fallback: Auto-fill province từ district (HCM: 760-783 → 79)
          if (!order.receiver_province_code && order.receiver_district_code) {
            const districtNum = parseInt(order.receiver_district_code);
            if (districtNum >= 760 && districtNum <= 783) {
              order.receiver_province_code = '79';
              console.log('[ORDER-UPSERT] ✅ Auto-filled province_code=79 from district:', order.receiver_district_code);
            }
          }
          
          // 4. Validate weight
          if (!order.total_weight_gram || order.total_weight_gram === 0) {
            order.total_weight_gram = chargeableWeightGrams(order, order);
            console.log('[ORDER-UPSERT] 📦 Calculated weight:', order.total_weight_gram, 'g');
          }
          
          // 5. Log final data
          console.log('[ORDER-UPSERT] 📋 Final order data for waybill:', {
            receiver_province_code: order.receiver_province_code,
            receiver_district_code: order.receiver_district_code,
            total_weight_gram: order.total_weight_gram,
            items_count: order.items?.length || 0
          });
          
          // 6. Validate required fields
          const missingFields = [];
          if (!order.receiver_province_code) missingFields.push('receiver_province_code');
          if (!order.receiver_district_code) missingFields.push('receiver_district_code');
          if (!order.total_weight_gram || order.total_weight_gram === 0) missingFields.push('total_weight_gram');
          
          if (missingFields.length > 0) {
            console.error('[ORDER-UPSERT] ❌ Missing required fields:', missingFields);
            throw new Error('Thiếu thông tin: ' + missingFields.join(', '));
          }
          
          console.log('[ORDER-UPSERT] ✅ Validation passed, calling SuperAI...');
          const waybillResult = await autoCreateWaybill(order, env);

          if (waybillResult.ok && waybillResult.carrier_code) {
            // Cập nhật thông tin vận đơn vào order
            order.tracking_code = waybillResult.carrier_code;
            order.shipping_tracking = waybillResult.carrier_code;
            order.superai_code = waybillResult.superai_code;
            order.carrier_id = waybillResult.carrier_id;
            order.carrier_name = waybillResult.carrier_name; // ✅ THÊM DÒNG NÀY
            order.shipping_provider = waybillResult.carrier_name; // ✅ THÊM DÒNG NÀY
            order.status = 'processing';
            order.waybill_data = waybillResult.raw;

            // Lưu lại ngay thông tin vận đơn
            await putJSON(env, 'order:' + id, order);
            if (index >= 0) list[index] = order;
            await putJSON(env, 'orders:list', list);
            
            // Đồng bộ lại D1
            await saveOrderToD1(env, order);

            console.log('[ORDER-UPSERT] ✅ Đã tạo vận đơn SuperAI:', waybillResult.carrier_code);
          } else {
            console.warn('[ORDER-UPSERT] ⚠️ Tạo vận đơn thất bại:', waybillResult.message);
          }
        } catch (e) {
          console.error('[ORDER-UPSERT] ❌ Lỗi code tạo vận đơn:', e.message);
        }
  }

  // ✅ Handle voucher usage when order becomes completed
  if (newStatus === ORDER_STATUS.COMPLETED && oldStatus !== ORDER_STATUS.COMPLETED && order.voucher_code) {
    console.log('[ORDER-UPSERT] Marking voucher as used:', order.voucher_code);
    try {
      await markVoucherUsed(env, order.voucher_code, order.customer?.id || null);
    } catch (e) {
      console.error('[ORDER-UPSERT] Failed to mark voucher as used:', e);
    }
  }

  // ✅ Add points when order is completed
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

  try {
    // 1. Lấy thông tin đơn hàng từ D1 trước khi xóa
    const orderStmt = env.DB.prepare(
      `SELECT * FROM orders WHERE id = ? OR order_number = ?`
    );
    const orderResult = await orderStmt.bind(id, id).first();

    if (!orderResult) {
      return errorResponse('Order not found', 404, req);
    }

    // 2. Restore inventory nếu đơn hàng chưa hủy
    const needRestoreStock = shouldAdjustStock(orderResult.status);
    if (needRestoreStock) {
      try {
        // Lấy order items từ bảng order_items
        const itemsStmt = env.DB.prepare(
          `SELECT * FROM order_items WHERE order_id = ?`
        );
        const itemsResult = await itemsStmt.bind(orderResult.id).all();
        
        if (itemsResult.results && itemsResult.results.length > 0) {
          const items = itemsResult.results.map(item => ({
            id: item.variant_id,
            product_id: item.product_id,
            sku: item.sku,
            name: item.name,
            variant: item.variant_name || '',
            qty: item.quantity,
            price: item.price,
            cost: item.cost || 0
          }));
          
          // Restore inventory (+1 để tăng stock)
          await adjustInventory(items, env, +1);
          console.log(`[deleteOrder] ✅ Đã restore ${items.length} items vào kho`);
        }
      } catch (e) {
        console.error('[deleteOrder] ⚠️ Lỗi restore inventory:', e.message);
      }
    }

    // 3. Hủy vận đơn SuperAI nếu có
    if (orderResult.superai_code) {
      try {
        await cancelWaybill({
          body: JSON.stringify({ superai_code: orderResult.superai_code }),
          headers: req.headers
        }, env);
        console.log(`[deleteOrder] ✅ Đã hủy vận đơn SuperAI: ${orderResult.superai_code}`);
      } catch (e) {
        console.warn('[deleteOrder] ⚠️ Không thể hủy vận đơn:', e.message);
      }
    }

    // 4. Xóa order items trước
    const deleteItemsStmt = env.DB.prepare(
      `DELETE FROM order_items WHERE order_id = ?`
    );
    await deleteItemsStmt.bind(orderResult.id).run();

    // 5. Xóa order khỏi D1
    const deleteOrderStmt = env.DB.prepare(
      `DELETE FROM orders WHERE id = ?`
    );
    const result = await deleteOrderStmt.bind(orderResult.id).run();

    if (result.meta.changes > 0) {
      console.log(`[deleteOrder] ✅ Đã xóa đơn hàng #${id} khỏi D1`);
      return json({ ok: true, deleted: id, message: 'Đã xóa đơn hàng' }, {}, req);
    } else {
      return errorResponse('Không thể xóa đơn hàng', 500, req);
    }

  } catch (e) {
    console.error('[deleteOrder] Exception:', e);
    return errorResponse(e.message, 500, req);
  }
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

// ===================================================================
// EXPORT ALIAS - Fix lỗi listOrdersAdmin is not defined
// ===================================================================

/**
 * List Orders for Admin (D1 version)
 * Export alias để tương thích với index.js
 */
export async function listOrdersAdmin(req, env) {
  return listOrdersFromD1(req, env);
}

// ===================================================================
// FACEBOOK CONVERSION API (CAPI) - SERVER SIDE TRACKING
// ===================================================================

async function sendToFacebookCAPI(order, req, env) {
  try {
    // 1. CẤU HÌNH (Điền Token và Pixel ID của bạn vào đây hoặc set trong .dev.vars/wrangler.toml)
    const PIXEL_ID = env.FB_PIXEL_ID || '1974425449800007'; // Thay ID Pixel của bạn nếu khác
    // 👇 DÁN MÃ TOKEN DÀI NGOẰNG VÀO GIỮA CẶP DẤU NHÁY ĐƠN DƯỚI ĐÂY 👇
    const ACCESS_TOKEN = env.FB_ACCESS_TOKEN || 'EAAMFNp9k5J8BP1pJbzABrkZB53sX4szb62Of0iu5QMetb51Eab2jkaVioGxxyuB6LG3EjXwSjaxZAAifrSLRgjZAh1unL59fjXN7V9CFGZAdT2FjmNNDYnusZCIraTW0Gax8UkpbUkzANmpFmGnG4rCyIGa8urhUipM0Q6G0WOnfOfUD6lb2N5S1JScCsgK13UgZDZD'; 

    // SỬA LẠI DÒNG 38 NHƯ SAU:
    if (!PIXEL_ID || !ACCESS_TOKEN) {
      console.warn('[CAPI] ⚠️ Chưa cấu hình Token/Pixel ID. Bỏ qua bắn đơn.');
      return;
    }

    console.log('[CAPI] 🚀 Đang gửi sự kiện Purchase sang Facebook:', order.id);

    // 2. Xử lý dữ liệu khách hàng (Hash SHA256 theo yêu cầu bảo mật của FB)
    const email = order.customer?.email ? order.customer.email.trim().toLowerCase() : '';
    const phone = order.customer?.phone ? order.customer.phone.replace(/\D/g, '') : ''; // Chỉ lấy số
    
    // Helper hash nhanh
    const hash = async (text) => {
      if (!text) return null;
      const msgBuffer = new TextEncoder().encode(text);
      const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
      return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
    };

    const userData = {
      em: email ? await hash(email) : null,
      ph: phone ? await hash(phone) : null,
      client_ip_address: req.headers.get('cf-connecting-ip') || req.headers.get('x-forwarded-for'),
      client_user_agent: req.headers.get('user-agent'),
      // Nếu FE có gửi fbp/fbc trong cookie, có thể lấy thêm ở đây
    };

    // 3. Chuẩn bị Payload
    const payload = {
      data: [
        {
          event_name: 'Purchase',
          event_time: Math.floor(Date.now() / 1000),
          action_source: 'website',
          event_source_url: 'https://shophuyvan.vn',
          event_id: order.id, // Quan trọng để Deduplication (Khử trùng lặp với Pixel)
          user_data: userData,
          custom_data: {
            currency: 'VND',
            value: Number(order.revenue || 0),
            content_type: 'product',
            content_ids: order.items.map(it => it.id || it.sku || it.product_id),
            num_items: order.items.length,
            order_id: order.id
          }
        }
      ]
    };

    // 4. Gửi Request sang Facebook Graph API
    const fbRes = await fetch(`https://graph.facebook.com/v19.0/${PIXEL_ID}/events?access_token=${ACCESS_TOKEN}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const fbData = await fbRes.json();
    
    if (fbData.events_received) {
      console.log('[CAPI] ✅ Gửi thành công! FB Event ID:', order.id);
    } else {
      console.error('[CAPI] ❌ Lỗi gửi Facebook:', JSON.stringify(fbData));
    }

  } catch (e) {
    console.error('[CAPI] Exception:', e);
  }
}

// ===================================================================
// NOTIFICATION SERVICE (TELEGRAM)
// ===================================================================

async function sendOrderNotification(order, env, ctx) {
  // Format số tiền
  const total = new Intl.NumberFormat('vi-VN').format(order.revenue || 0);
  
  // Nội dung tin nhắn
  const message = 
`📦 <b>ĐƠN HÀNG MỚI #${String(order.id).slice(-6).toUpperCase()}</b>
👤 Khách: ${order.customer.name || 'Khách lẻ'}
📞 SĐT: ${order.customer.phone || 'Không có'}
💰 Tổng thu: <b>${total}đ</b>
-----------------------
${order.items.map(i => `- ${i.name} (x${i.qty})`).join('\n')}
-----------------------
📝 Ghi chú: ${order.note || 'Không'}`;

  const promises = [];

  // Gửi TELEGRAM
  if (env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CHAT_ID) {
    const url = `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`;
    promises.push(
      fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: env.TELEGRAM_CHAT_ID,
          text: message,
          parse_mode: 'HTML'
        })
      }).then(r => console.log('[NOTIFY] Telegram status:', r.status))
        .catch(e => console.error('[NOTIFY] Telegram error:', e))
    );
  }

  // Chạy ngầm (không làm chậm phản hồi đơn hàng)
  if (ctx && ctx.waitUntil) {
    ctx.waitUntil(Promise.all(promises));
  } else {
    Promise.all(promises);
  }
}