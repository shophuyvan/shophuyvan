// ===================================================================
// modules/orders.js - Orders Module (FINAL)
// ===================================================================

import { json, errorResponse, corsHeaders } from '../lib/response.js';
import { adminOK } from '../lib/auth.js';
import { getJSON, putJSON } from '../lib/kv.js';
import { readBody } from '../lib/utils.js';
import { validate, SCH } from '../lib/validator.js';
import { idemGet, idemSet } from '../lib/idempotency.js';

// -------------------------------------------------------------------
// Helpers
// -------------------------------------------------------------------
const shouldAdjustStock = (status) => {
  const s = String(status || '').toLowerCase();
  // trừ kho cho các trạng thái khác pending/cancel
  return !['cancel', 'cancelled', 'huy', 'huỷ', 'hủy', 'returned', 'return', 'pending'].includes(s);
};
const toNum = (x) => Number(x || 0);

// === normalize order items ===
// Biến item FE -> { id: <variant-id-or-sku>, product_id: <product-id>, qty, sku, name, variant }
function normalizeOrderItems(items) {
  const tryExtractSku = (txt) => {
    if (!txt) return null;
    // bắt các mẫu K239/K-239…
    const m = String(txt).toUpperCase().match(/\bK[\-]?\d+\b/);
    return m ? m[0].replace('-', '') : null;
  };

  return (Array.isArray(items) ? items : []).map(it => {
    const variantSku = tryExtractSku(it.variant || it.name || '');
    const maybeProductId = String(it.id || '').length > 12 ? (it.id) : null;

    return {
      // Ưu tiên id biến thể/variant_id; thiếu thì dùng sku; nếu vẫn thiếu mà bắt được 'Kxxx' thì dùng luôn
      id: it.variant_id ?? it.id ?? it.sku ?? variantSku ?? null,
      product_id: it.product_id ?? it.pid ?? it.productId ?? (it.product && (it.product.id || it.product.key)) ?? maybeProductId ?? null,
      sku: it.sku ?? variantSku ?? null,
      name: it.name ?? it.title ?? '',
      variant: it.variant ?? '',
      qty: Number(it.qty ?? it.quantity ?? 1) || 1
    };
  });
}

/**
 * Giảm/tăng tồn kho theo danh sách items của đơn
 * direction = -1 → trừ kho, +1 → hoàn kho
 */
// Hỗ trợ nhiều field tồn kho cho cả variant & product: stock, ton_kho, quantity, qty_available, ...
async function adjustInventory(items, env, direction = -1) {
  console.log('[INV-DEBUG] adjustInventory START', { itemCount: items?.length, direction });

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
    const variantId = it.id || it.variant_id || it.sku;   // <= fallback sang SKU
    const productId = it.product_id;

    console.log('[INV-DEBUG] Processing item', {
      variantId, productId, qty: it.qty, sku: it.sku, name: it.name, variant: it.variant
    });

    if (!variantId && !productId) { console.warn('[INV-DEBUG] Skip: no ID'); continue; }

    // -- B1: tìm product
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
          const vid   = String(v.id || '');
          const vsku  = String(v.sku || '');
          const vname = String((v.name || v.title || v.option_name || '')).toUpperCase();
          return (
            vid === String(variantId) ||
            vsku === String(variantId) ||
            (it.sku && vsku === String(it.sku)) ||
            (text && vname && text.includes(vname))
          );
        });

        if (ok) { product = p; break; }
      }
    }
    if (!product) { console.warn('[INV-DEBUG] Product not found'); continue; }

    const delta = Number(it.qty || 1) * direction;
    
    // -- B2: trừ tồn kho ở variant nếu có
    let touched = false;
    if (Array.isArray(product.variants) && variantId) {
      const text2 = String(it.variant || it.name || '').toUpperCase();
      const v = product.variants.find(v => {
        const vid   = String(v.id || '');
        const vsku  = String(v.sku || '');
        const vname = String((v.name || v.title || v.option_name || '')).toUpperCase();
        return (
          vid === String(variantId) ||
          vsku === String(variantId) ||
          (it.sku && vsku === String(it.sku)) ||
          (text2 && vname && text2.includes(vname))
        );
      });
    
      if (v) {
        const before = readStock(v);
        const after  = before + delta;
        const keySet = writeStock(v, after);
        console.log('[INV-DEBUG] Variant updated', { key: keySet, before, after, variant: v.id || v.sku });
        touched = true;
    
        // ✅ Cập nhật sold cho biến thể (nếu muốn theo dõi ở variant)
        const vSoldBefore = Number(v.sold || v.sold_count || 0);
        const vSoldAfter  = Math.max(0, vSoldBefore + (direction === -1 ? Number(it.qty || 1) : -Number(it.qty || 1)));
        v.sold = vSoldAfter;
        v.sold_count = vSoldAfter;
      } else {
        console.warn('[INV-DEBUG] Variant not found in product.variants');
      }
    }
    
    // -- B3: nếu chưa chạm variant → trừ trên product-level
    if (!touched) {
      const before = readStock(product);
      const after  = before + delta;
      const keySet = writeStock(product, after);
      console.log('[INV-DEBUG] Product stock updated', { key: keySet, before, after, pid: product.id });
    }
    
    // ✅ Cập nhật sold cho product (đảm bảo FE lấy được)
    const pSoldBefore = Number(product.sold || product.sold_count || 0);
    const pSoldAfter  = Math.max(0, pSoldBefore + (direction === -1 ? Number(it.qty || 1) : -Number(it.qty || 1)));
    product.sold = pSoldAfter;
    product.sold_count = pSoldAfter;
    
    await putJSON(env, 'product:' + product.id, product);
    } // end for (items)

  console.log('[INV-DEBUG] adjustInventory DONE');
}
    
// ===================================================================
// Router entry
// ===================================================================
export async function handle(req, env, ctx) {
  const url = new URL(req.url);
  const path = url.pathname;
  const method = req.method;

  // PUBLIC
  if (path === '/api/orders' && method === 'POST') return createOrder(req, env);
  if (path === '/public/orders/create' && method === 'POST') return createOrderPublic(req, env);
  if (path === '/public/order-create' && method === 'POST') return createOrderLegacy(req, env);
  if (path === '/orders/my' && method === 'GET') return getMyOrders(req, env);  // ← THÊM DÒNG NÀY

  // ADMIN
  if (path === '/api/orders' && method === 'GET') return listOrders(req, env);
  if (path === '/admin/orders' && method === 'GET') return listOrdersAdmin(req, env);
  if (path === '/admin/orders/upsert' && method === 'POST') return upsertOrder(req, env);
  if (path === '/admin/orders/delete' && method === 'POST') return deleteOrder(req, env);
  if (path === '/admin/orders/print' && method === 'GET') return printOrder(req, env);
  if (path === '/admin/stats' && method === 'GET') return getStats(req, env);

  return errorResponse('Route not found', 404, req);
}

// ===================================================================
// PUBLIC: Create Order
// ===================================================================
async function createOrder(req, env) {
  const idem = await idemGet(req, env);
  if (idem.hit) return new Response(idem.body, { status: 200, headers: corsHeaders(req) });

  const body = await readBody(req) || {};
  console.log('[INV-TRACE] orders.create: payload', {
    items: Array.isArray(body?.items) ? body.items.map(i => ({
      id: i.product_id || i.id || i.sku, sku: i.sku, qty: i.qty
    })) : body?.items,
    customerId: body?.customer?.phone || body?.customer?.name || null
  });

  // Validate
  const validation = validate(SCH.orderCreate, body);
  if (!validation.ok) {
    return json({ ok: false, error: 'VALIDATION_FAILED', details: validation.errors }, { status: 400 }, req);
  }

  const id = body.id || crypto.randomUUID().replace(/-/g, '');
  const createdAt = Date.now();

  // Build totals
  // ✅ ENRICH ITEMS WITH COST
  const items = Array.isArray(body.items) ? body.items : [];
  
  for (const item of items) {
    if (!item.cost || item.cost === 0) {
      const variantId = item.id || item.sku;
      if (variantId) {
        console.log('[ORDER] Looking for cost:', variantId);
        const allProducts = await getJSON(env, 'products:list', []);
        
        for (const summary of allProducts) {
          const product = await getJSON(env, 'product:' + summary.id, null);
          if (!product || !Array.isArray(product.variants)) continue;
          
          const variant = product.variants.find(v => 
            String(v.id || v.sku || '') === String(variantId) ||
            String(v.sku || '') === String(item.sku || '')
          );
          
          if (variant) {
            const keys = ['cost', 'cost_price', 'import_price', 'gia_von', 'buy_price', 'price_import'];
            for (const key of keys) {
              if (variant[key] != null) {
                item.cost = Number(variant[key] || 0);
                console.log('[ORDER] ✅ Found cost:', { id: variantId, cost: item.cost });
                break;
              }
            }
            break;
          }
        }
      }
    }
  }
  
  // Build totals
  const subtotal = items.reduce((sum, item) =>
    sum + Number(item.price || 0) * Number(item.qty || 1), 0
  );
  const shipping_fee = Number(body?.totals?.shipping_fee || body.shipping_fee || 0);
  const discount = Number(body?.totals?.discount || body.discount || 0);
  const shipping_discount = Number(body?.totals?.shipping_discount || body.shipping_discount || 0);
  const revenue = Math.max(0, subtotal + shipping_fee - (discount + shipping_discount));
  const profit = items.reduce((sum, item) =>
    sum + (Number(item.price || 0) - Number(item.cost || 0)) * Number(item.qty || 1), 0
  ) - discount;

  const order = {
    id, createdAt,
    status: 'confirmed',
    customer: body.customer,
    items,
    subtotal, shipping_fee, discount, shipping_discount, revenue, profit,
    note: body.note || '',
    source: 'fe'
  };

  // Save order
  const list = await getJSON(env, 'orders:list', []);
  list.unshift(order);
  await putJSON(env, 'orders:list', list);
  await putJSON(env, 'order:' + id, order);

  // Trừ kho
  if (shouldAdjustStock(order.status)) {
    await adjustInventory(normalizeOrderItems(order.items), env, -1);
  }

  const response = json({ ok: true, id }, {}, req);
  await idemSet(idem.key, env, response);
  return response;
}

// ===================================================================
// PUBLIC: Create Order (alt)
// ===================================================================
async function createOrderPublic(req, env) {
  const idem = await idemGet(req, env);
  if (idem.hit) return new Response(idem.body, { status: 200, headers: corsHeaders(req) });

  const body = await readBody(req) || {};
  const id = body.id || crypto.randomUUID().replace(/-/g, '');

  const createdAt = body.createdAt || body.created_at || Date.now();
  const status = body.status || 'pending';
  const customer = body.customer || {};
  // ✅ ENRICH ITEMS WITH COST
  const items = Array.isArray(body.items) ? body.items : [];
  
  for (const item of items) {
    if (!item.cost || item.cost === 0) {
      const variantId = item.id || item.sku;
      if (variantId) {
        console.log('[ORDER-PUBLIC] Looking for cost:', variantId);
        const allProducts = await getJSON(env, 'products:list', []);
        
        for (const summary of allProducts) {
          const product = await getJSON(env, 'product:' + summary.id, null);
          if (!product || !Array.isArray(product.variants)) continue;
          
          const variant = product.variants.find(v => 
            String(v.id || v.sku || '') === String(variantId) ||
            String(v.sku || '') === String(item.sku || '')
          );
          
          if (variant) {
            const keys = ['cost', 'cost_price', 'import_price', 'gia_von', 'buy_price', 'price_import'];
            for (const key of keys) {
              if (variant[key] != null) {
                item.cost = Number(variant[key] || 0);
                console.log('[ORDER-PUBLIC] ✅ Found cost:', { id: variantId, cost: item.cost });
                break;
              }
            }
            break;
          }
        }
      }
    }
  }

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
    id, createdAt, status, customer, items,
    shipping_fee, discount, shipping_discount,
    subtotal, revenue, profit,
    shipping_name: body.shipping_name || null,
    shipping_eta: body.shipping_eta || null,
    shipping_provider: body.shipping_provider || null,
    shipping_service: body.shipping_service || null,
    note: body.note || '',
    source: body.source || 'fe'
  };

  const list = await getJSON(env, 'orders:list', []);
  list.unshift(order);
  await putJSON(env, 'orders:list', list);
  await putJSON(env, 'order:' + id, order);

  if (shouldAdjustStock(order.status)) {
    await adjustInventory(normalizeOrderItems(order.items), env, -1);
  }

  const response = json({ ok: true, id }, {}, req);
  await idemSet(idem.key, env, response);
  return response;
}

// ===================================================================
// PUBLIC: Create Order (legacy)
// ===================================================================
async function createOrderLegacy(req, env) {
  const body = await readBody(req) || {};
  const id = body.id || crypto.randomUUID().replace(/-/g, '');
  const createdAt = Date.now();

  // ✅ ENRICH ITEMS WITH COST
  const items = Array.isArray(body.items) ? body.items : [];
  
  for (const item of items) {
    if (!item.cost || item.cost === 0) {
      const variantId = item.id || item.sku;
      if (variantId) {
        console.log('[ORDER-LEGACY] Looking for cost:', variantId);
        const allProducts = await getJSON(env, 'products:list', []);
        
        for (const summary of allProducts) {
          const product = await getJSON(env, 'product:' + summary.id, null);
          if (!product || !Array.isArray(product.variants)) continue;
          
          const variant = product.variants.find(v => 
            String(v.id || v.sku || '') === String(variantId) ||
            String(v.sku || '') === String(item.sku || '')
          );
          
          if (variant) {
            const keys = ['cost', 'cost_price', 'import_price', 'gia_von', 'buy_price', 'price_import'];
            for (const key of keys) {
              if (variant[key] != null) {
                item.cost = Number(variant[key] || 0);
                console.log('[ORDER-LEGACY] ✅ Found cost:', { id: variantId, cost: item.cost });
                break;
              }
            }
            break;
          }
        }
      }
    }
  }
  
  const shipping_fee = Number(body.shipping_fee || body.shippingFee || 0);

  const subtotal = items.reduce((sum, item) =>
    sum + Number(item.price || 0) * Number(item.qty || item.quantity || 1), 0
  );
  const cost = items.reduce((sum, item) =>
    sum + Number(item.cost || 0) * Number(item.qty || item.quantity || 1), 0
  );

  const revenue = subtotal - shipping_fee;
  const profit = revenue - cost;

  const order = {
    id,
    status: body.status || 'mới',
    name: body.name,
    phone: body.phone,
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
    await adjustInventory(normalizeOrderItems(order.items), env, -1);
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
// ADMIN: Upsert / Delete / Print / Stats
// ===================================================================
async function upsertOrder(req, env) {
  if (!(await adminOK(req, env))) return errorResponse('Unauthorized', 401, req);

  const order = await readBody(req) || {};
  order.id = order.id || crypto.randomUUID().replace(/-/g, '');
  order.createdAt = order.createdAt || Date.now();

  const list = await getJSON(env, 'orders:list', []);

  const items = order.items || [];
  const subtotal = items.reduce((sum, item) => sum + Number(item.price || 0) * Number(item.qty || 1), 0);
  const cost = items.reduce((sum, item) => sum + Number(item.cost || 0) * Number(item.qty || 1), 0);

  order.subtotal = subtotal;
  order.revenue  = subtotal - Number(order.shipping_fee || 0);
  order.profit   = order.revenue - cost;

  const index = list.findIndex(o => o.id === order.id);
  if (index >= 0) list[index] = order; else list.unshift(order);

  await putJSON(env, 'orders:list', list);
  await putJSON(env, 'order:' + order.id, order);

  return json({ ok: true, id: order.id, data: order }, {}, req);
}

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

  const fmt = (n) => { try { return new Intl.NumberFormat('vi-VN').format(Number(n || 0)); } catch { return (n || 0); } };

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
      <td style="text-align:right">${fmt(item.qty || 1)}</td>
      <td style="text-align:right">${fmt(item.price || 0)}</td>
      <td style="text-align:right">${fmt(item.cost || 0)}</td>
      <td style="text-align:right">${fmt((item.price || 0) * (item.qty || 1))}</td>
    </tr>
  `).join('') || `<tr><td colspan="6" style="color:#6b7280">Không có dòng hàng</td></tr>`;

  const customer = order.customer || {};
  const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>In đơn ${id}</title>
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
    <div><span>Tổng hàng</span><b>${fmt(subtotal)}đ</b></div>
    <div><span>Phí vận chuyển</span><b>${fmt(shipping)}đ</b></div>
    ${discount ? (`<div><span>Giảm</span><b>-${fmt(discount)}đ</b></div>`) : ''}
    <div style="font-size:16px"><span>Tổng thanh toán</span><b>${fmt(total)}đ</b></div>
  </div>
  <script>window.onload = () => setTimeout(() => window.print(), 200);</script>
</body>
</html>`;
  return json({ ok: true, html }, {}, req);
}

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
      from = todayStart; to = todayStart + 86400000;
    } else if (granularity === 'week') {
      const weekday = (new Date(todayStart + 7 * 3600 * 1000).getDay() + 6) % 7;
      const start = todayStart - weekday * 86400000;
      from = start; to = start + 7 * 86400000;
    } else if (granularity === 'month') {
      const dt = new Date(todayStart + 7 * 3600 * 1000);
      const start = Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth(), 1) - 7 * 3600 * 1000;
      const end   = Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth() + 1, 1) - 7 * 3600 * 1000;
      from = start; to = end;
    } else {
      from = todayStart; to = todayStart + 86400000;
    }
  } else {
    from = Number(from); to = Number(to);
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

  // cost helper - ƯU TIÊN VARIANT, fallback theo SKU/ID, cuối cùng là so khớp TÊN biến thể
  async function getCost(item) {
    const variantIdOrSku = item && (item.id || item.sku);
    const text = String(item?.variant || item?.name || '').toUpperCase(); // <-- thêm fallback theo tên biến thể
    const keys = ['cost', 'cost_price', 'import_price', 'gia_von', 'buy_price', 'price_import'];

    if (!variantIdOrSku && !text) return 0;

    const all = await getJSON(env, 'products:list', []);
    for (const s of all) {
      const p = await getJSON(env, 'product:' + s.id, null);
      if (!p || !Array.isArray(p.variants)) continue;

      const v = p.variants.find(v => {
        const vid   = String(v.id || '').toUpperCase();
        const vsku  = String(v.sku || '').toUpperCase();
        const vname = String(v.name || v.title || v.option_name || '').toUpperCase();

        // 1) khớp id/sku
        if (variantIdOrSku && (vid === String(variantIdOrSku).toUpperCase() || vsku === String(variantIdOrSku).toUpperCase())) {
          return true;
        }
        if (item?.sku && vsku === String(item.sku).toUpperCase()) return true;

        // 2) fallback: tên biến thể có chứa/khớp text FE gửi
        if (text && vname && (vname === text || text.includes(vname) || vname.includes(text))) {
          return true;
        }
        return false;
      });

      if (v) {
        for (const k of keys) {
          if (v[k] != null) return Number(v[k] || 0);
        }
      }
    }
    return 0;
  }

  let orderCount = 0;
  let revenue = 0;
  let goodsCost = 0;
  const topMap = {};

  for (const order of list) {
    const ts = Number(order.createdAt || order.created_at || 0);
    if (!ts || ts < from || ts >= to) continue;

    orderCount += 1;

    const items = Array.isArray(order.items) ? order.items : [];
    const subtotal = items.reduce((sum, item) => sum + Number(item.price || 0) * Number(item.qty || 1), 0);

    const shipping = Number(order.shipping_fee || 0);
    const discount = Number(order.discount || 0) + Number(order.shipping_discount || 0);
    const orderRevenue = Math.max(0, order.revenue != null ? Number(order.revenue) : (subtotal + shipping - discount));
    revenue += orderRevenue;

    for (const item of items) {
      const cost = await getCost(item);  // ✅ LUÔN GỌI getCost()
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
  cost_price: goodsCost,   // << thêm
  goods_cost: goodsCost,   // << thêm (alias)
  top_products: topProducts,
  from, to, granularity
}, {}, req);
}

// PUBLIC: Get My Orders (Customer)
// ===================================================================
async function getMyOrders(req, env) {
 // Lấy token từ nhiều nguồn: header + Authorization + Cookie
function parseCookie(str) {
  const out = {};
  (str || '').split(';').forEach(p => {
    const i = p.indexOf('=');
    if (i > -1) out[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1).trim());
  });
  return out;
}

// 1) header ưu tiên x-customer-token, rồi x-token
let token = req.headers.get('x-customer-token') || req.headers.get('x-token') || '';

// 2) Authorization: Bearer ...
if (!token) {
  const m = (req.headers.get('authorization') || '').match(/^Bearer\s+(.+)$/i);
  if (m) token = m[1];
}

// 3) Cookie: customer_token / x-customer-token / token
if (!token) {
  const c = parseCookie(req.headers.get('cookie') || '');
  token = c['customer_token'] || c['x-customer-token'] || c['token'] || '';
}

// Chuẩn hoá token
token = String(token || '').trim().replace(/^"+|"+$/g, '');

if (!token) {
  return json({ ok: false, error: 'Unauthorized', message: 'Vui lòng đăng nhập' }, { status: 401 }, req);
}

  // ===== Resolve customer từ token trên KV =====
  async function kvGet(k) {
    try { return await getJSON(env, k, null); } catch (_) { return null; }
  }

  // 1) Thử nhiều khoá phổ biến
  const keyCandidates = [
    'token:' + token,
    'customer_token:' + token,
    'auth:' + token,
    'customer:' + token,   // có thể lưu thẳng object customer
    'session:' + token,    // { customer: {...} } hoặc { user: {...} }
    'shv_session:' + token // biến thể session khác
  ];

  let customer = null;
  let raw = null;

  for (const k of keyCandidates) {
    raw = await kvGet(k);
    if (!raw) continue;

    // session → lấy đối tượng customer/user bên trong
    if (k.includes('session:') && (raw.customer || raw.user)) {
      customer = raw.customer || raw.user;
      break;
    }

    // Nếu KV đã trả thẳng object customer
    if (typeof raw === 'object' && raw !== null) {
      customer = raw;
      break;
    }

    // Nếu KV trả chuỗi (id/phone) → tra tiếp theo id
    if (typeof raw === 'string') {
      const cid = String(raw).trim();
      customer = await (kvGet('customer:' + cid) || kvGet('customer:id:' + cid));
      if (customer) break;
    }

    // Nếu object có customer_id / customerId → tra tiếp
    if (raw && (raw.customer_id || raw.customerId)) {
      const cid = raw.customer_id || raw.customerId;
      customer = await (kvGet('customer:' + cid) || kvGet('customer:id:' + cid));
      if (customer) break;
    }
  }

  // 2) Fallback: token có thể là JWT → decode lấy id
  if (!customer && token.split('.').length === 3) {
    try {
      const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
      const cid = payload.customer_id || payload.customerId || payload.sub || payload.id || '';
      if (cid) {
        customer = await (kvGet('customer:' + cid) || kvGet('customer:id:' + cid));
      }
    } catch (_) {}
  }

  // 3) Kiểm tra hợp lệ: chấp nhận nếu có phone **hoặc** có id
  const custPhone = customer && (customer.phone || customer.mobile || customer.tel);
  const custId    = customer && (customer.id || customer.customer_id || customer.customerId);

  if (!customer || (!custPhone && !custId)) {
    return json({ ok: false, error: 'Invalid token', message: 'Token không hợp lệ' }, { status: 401 }, req);
  }
  // ===== /Resolve customer =====

  let allOrders = await getJSON(env, 'orders:list', []);
  
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

  const custPhone = customer.phone || customer.mobile || customer.tel || null;
  const custId    = customer.id || customer.customer_id || customer.customerId || null;

  const myOrders = allOrders.filter(order => {
    const oc = order.customer || {};
    const orderPhone = oc.phone || order.phone || null;
    const orderId    = oc.id || oc.customer_id || null;

    return (custPhone && orderPhone && String(orderPhone) === String(custPhone))
        || (custId && orderId && String(orderId) === String(custId));
  });

  myOrders.sort((a, b) => {
    const timeA = Number(a.createdAt || a.created_at || 0);
    const timeB = Number(b.createdAt || b.created_at || 0);
    return timeB - timeA;
  });

  return json({ ok: true, orders: myOrders, count: myOrders.length }, {}, req);
}
