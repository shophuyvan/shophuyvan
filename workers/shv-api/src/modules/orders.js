// ===================================================================
// modules/orders.js - Orders Module (Complete)
// ===================================================================

import { json, errorResponse, corsHeaders } from '../lib/response.js';
import { adminOK } from '../lib/auth.js';
import { getJSON, putJSON } from '../lib/kv.js';
import { readBody } from '../lib/utils.js';
import { validate, SCH } from '../lib/validator.js';
import { idemGet, idemSet } from '../lib/idempotency.js';

/**
 * Main handler for all order routes
 */
export async function handle(req, env, ctx) {
  const url = new URL(req.url);
  const path = url.pathname;
  const method = req.method;

  // ===== PUBLIC ROUTES =====
  
  // Public: Create order (from FE)
  if (path === '/api/orders' && method === 'POST') {
    return createOrder(req, env);
  }

  if (path === '/public/orders/create' && method === 'POST') {
    return createOrderPublic(req, env);
  }

  if (path === '/public/order-create' && method === 'POST') {
    return createOrderLegacy(req, env);
  }

  // ===== ADMIN ROUTES =====

  // Admin: List orders
  if (path === '/api/orders' && method === 'GET') {
    return listOrders(req, env);
  }

  if (path === '/admin/orders' && method === 'GET') {
    return listOrdersAdmin(req, env);
  }

  // Admin: Upsert order
  if (path === '/admin/orders/upsert' && method === 'POST') {
    return upsertOrder(req, env);
  }

  // Admin: Delete order
  if (path === '/admin/orders/delete' && method === 'POST') {
    return deleteOrder(req, env);
  }

  // Admin: Print order
  if (path === '/admin/orders/print' && method === 'GET') {
    return printOrder(req, env);
  }

  // Admin: Stats
  if (path === '/admin/stats' && method === 'GET') {
    return getStats(req, env);
  }

  return errorResponse('Route not found', 404, req);
}

// ===================================================================
// PUBLIC: Create Order (with validation)
// ===================================================================

async function createOrder(req, env) {
  // Idempotency check
  const idem = await idemGet(req, env);
  if (idem.hit) {
    return new Response(idem.body, { 
      status: 200, 
      headers: corsHeaders(req) 
    });
  }

  const body = await readBody(req) || {};
  
  // Validate
  const validation = validate(SCH.orderCreate, body);
  if (!validation.ok) {
    return json({
      ok: false,
      error: 'VALIDATION_FAILED',
      details: validation.errors
    }, { status: 400 }, req);
  }

  const id = body.id || crypto.randomUUID().replace(/-/g, '');
  const createdAt = Date.now();
  
  // Calculate totals
  const items = Array.isArray(body.items) ? body.items : [];
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

  // Build order object
  const order = {
    id,
    createdAt,
    status: 'confirmed',
    customer: body.customer,
    items,
    subtotal,
    shipping_fee,
    discount,
    shipping_discount,
    revenue,
    profit,
    note: body.note || '',
    source: 'fe'
  };

  // Save to KV
  await putJSON(env, 'order:' + id, order);
  
  // Update orders list
  const list = await getJSON(env, 'orders:list', []);
  list.unshift(order);
  await putJSON(env, 'orders:list', list);

  // Response with idempotency
  const response = json({ ok: true, id, order }, {}, req);
  await idemSet(idem.key, env, response);
  
  return response;
}

// ===================================================================
// PUBLIC: Create Order (alternative endpoint)
// ===================================================================

async function createOrderPublic(req, env) {
  const idem = await idemGet(req, env);
  if (idem.hit) {
    return new Response(idem.body, { 
      status: 200, 
      headers: corsHeaders(req) 
    });
  }

  const body = await readBody(req) || {};
  const id = body.id || crypto.randomUUID().replace(/-/g, '');

  // Normalize fields
  const createdAt = body.createdAt || body.created_at || Date.now();
  const status = body.status || 'pending';
  const customer = body.customer || {};
  const items = Array.isArray(body.items) ? body.items : [];

  // Calculate totals
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
    customer,
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
    source: body.source || 'fe'
  };

  await putJSON(env, 'order:' + id, order);
  
  const list = await getJSON(env, 'orders:list', []);
  list.unshift(order);
  await putJSON(env, 'orders:list', list);

  const response = json({ ok: true, id }, {}, req);
  await idemSet(idem.key, env, response);
  
  return response;
}

// ===================================================================
// PUBLIC: Create Order (legacy endpoint)
// ===================================================================

async function createOrderLegacy(req, env) {
  const body = await readBody(req) || {};
  const id = body.id || crypto.randomUUID().replace(/-/g, '');
  const createdAt = Date.now();
  
  const items = Array.isArray(body.items) ? body.items : [];
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

  return json({ ok: true, id, data: order }, {}, req);
}

// ===================================================================
// ADMIN: List Orders
// ===================================================================

async function listOrders(req, env) {
  if (!(await adminOK(req, env))) {
    return errorResponse('Unauthorized', 401, req);
  }

  const list = await getJSON(env, 'orders:list', []);
  return json({ ok: true, items: list }, {}, req);
}

async function listOrdersAdmin(req, env) {
  if (!(await adminOK(req, env))) {
    return errorResponse('Unauthorized', 401, req);
  }

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

  // Filter by date range
  if (from || to) {
    list = list.filter(order => {
      const timestamp = Number(order.createdAt || 0);
      if (from && timestamp < from) return false;
      if (to && timestamp > to) return false;
      return true;
    });
  }

  return json({ ok: true, items: list }, {}, req);
}

// ===================================================================
// ADMIN: Upsert Order
// ===================================================================

async function upsertOrder(req, env) {
  if (!(await adminOK(req, env))) {
    return errorResponse('Unauthorized', 401, req);
  }

  const order = await readBody(req) || {};
  order.id = order.id || crypto.randomUUID().replace(/-/g, '');
  order.createdAt = order.createdAt || Date.now();

  const list = await getJSON(env, 'orders:list', []);

  // Compute totals
  const items = order.items || [];
  const subtotal = items.reduce((sum, item) => 
    sum + Number(item.price || 0) * Number(item.qty || 1), 0
  );
  
  const cost = items.reduce((sum, item) => 
    sum + Number(item.cost || 0) * Number(item.qty || 1), 0
  );

  order.subtotal = subtotal;
  order.revenue = subtotal - Number(order.shipping_fee || 0);
  order.profit = order.revenue - cost;

  // Update or insert
  const index = list.findIndex(o => o.id === order.id);
  if (index >= 0) {
    list[index] = order;
  } else {
    list.unshift(order);
  }

  await putJSON(env, 'orders:list', list);
  await putJSON(env, 'order:' + order.id, order);

  return json({ ok: true, id: order.id, data: order }, {}, req);
}

// ===================================================================
// ADMIN: Delete Order
// ===================================================================

async function deleteOrder(req, env) {
  if (!(await adminOK(req, env))) {
    return errorResponse('Unauthorized', 401, req);
  }

  const body = await readBody(req) || {};
  const id = body.id;

  if (!id) {
    return errorResponse('ID is required', 400, req);
  }

  const list = await getJSON(env, 'orders:list', []);
  const newList = list.filter(order => order.id !== id);

  await putJSON(env, 'orders:list', newList);

  return json({ ok: true, deleted: id }, {}, req);
}

// ===================================================================
// ADMIN: Print Order
// ===================================================================

async function printOrder(req, env) {
  if (!(await adminOK(req, env))) {
    return errorResponse('Unauthorized', 401, req);
  }

  const url = new URL(req.url);
  const id = url.searchParams.get('id');

  if (!id) {
    return errorResponse('Missing order ID', 400, req);
  }

  // Get order
  let order = await getJSON(env, 'order:' + id, null);
  if (!order) {
    const list = await getJSON(env, 'orders:list', []);
    order = list.find(o => String(o.id) === String(id)) || null;
  }

  if (!order) {
    return errorResponse('Order not found', 404, req);
  }

  // Format currency
  const fmt = (n) => {
    try {
      return new Intl.NumberFormat('vi-VN').format(Number(n || 0));
    } catch {
      return (n || 0);
    }
  };

  const items = Array.isArray(order.items) ? order.items : [];
  const subtotal = items.reduce((sum, item) => 
    sum + Number(item.price || 0) * Number(item.qty || 1), 0
  );
  
  const shipping = Number(order.shipping_fee || 0);
  const discount = Number(order.discount || 0) + Number(order.shipping_discount || 0);
  const total = Math.max(0, subtotal + shipping - discount);

  const createdDate = order.createdAt 
    ? new Date(Number(order.createdAt)).toLocaleString('vi-VN') 
    : '';

  // Build table rows
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

// ===================================================================
// ADMIN: Get Stats
// ===================================================================

async function getStats(req, env) {
  if (!(await adminOK(req, env))) {
    return errorResponse('Unauthorized', 401, req);
  }

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

  // Calculate date range based on granularity
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

  // Load and enrich orders
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

  // Get cost helper
  async function getCost(item) {
    if (item && item.cost != null) return Number(item.cost || 0);
    
    const productId = item && (item.id || item.sku || item.product_id);
    if (!productId) return 0;

    const product = await getJSON(env, 'product:' + productId, null);
    if (!product) return 0;

    const keys = ['cost', 'cost_price', 'import_price', 'gia_von', 'buy_price', 'price_import'];
    for (const key of keys) {
      if (product[key] != null) return Number(product[key] || 0);
    }

    if (Array.isArray(product.variants)) {
      const variant = product.variants.find(v => 
        String(v.id || v.sku || '') === String(productId) || 
        String(v.sku || '') === String(item.sku || '')
      );
      if (variant) {
        for (const key of keys) {
          if (variant[key] != null) return Number(variant[key] || 0);
        }
      }
    }

    return 0;
  }

  // Calculate stats
  let orderCount = 0;
  let revenue = 0;
  let goodsCost = 0;
  const topMap = {};

  for (const order of list) {
    const timestamp = Number(order.createdAt || order.created_at || 0);
    if (!timestamp || timestamp < from || timestamp >= to) continue;

    orderCount += 1;

    const items = Array.isArray(order.items) ? order.items : [];
    const subtotal = items.reduce((sum, item) => 
      sum + Number(item.price || 0) * Number(item.qty || 1), 0
    );
    
    const shipping = Number(order.shipping_fee || 0);
    const discount = Number(order.discount || 0) + Number(order.shipping_discount || 0);
    const orderRevenue = Math.max(0, 
      order.revenue != null ? Number(order.revenue) : (subtotal + shipping - discount)
    );
    
    revenue += orderRevenue;

    for (const item of items) {
      let cost = Number(item.cost || 0);
      if (!cost) {
        cost = await getCost(item);
      }
      goodsCost += cost * Number(item.qty || 1);

      const name = item.name || item.title || item.id || 'unknown';
      if (!topMap[name]) {
        topMap[name] = { name, qty: 0, revenue: 0 };
      }
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
    top_products: topProducts,
    from,
    to,
    granularity
  }, {}, req);
}