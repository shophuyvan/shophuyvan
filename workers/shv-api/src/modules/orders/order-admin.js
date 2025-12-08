import { json, errorResponse, corsHeaders } from '../../lib/response.js';
import { adminOK } from '../../lib/auth.js';
import { getJSON, putJSON } from '../../lib/kv.js';
import { readBody } from '../../lib/utils.js';
import { calculateOrderFinancials, saveOrderToD1, getOrders, deleteOrder as coreDeleteOrder, adjustInventory } from '../../core/order-core.js';
import { autoCreateWaybill, cancelWaybill } from '../shipping/waybill.js';
import { markVoucherUsed } from '../vouchers.js';
import { lookupProvinceCode, lookupDistrictCode, chargeableWeightGrams } from '../shipping/helpers.js';
import { 
  addPointsToCustomer, formatPrice, shouldAdjustStock, ORDER_STATUS 
} from './order-helpers.js';

// List Orders D1 (Refactored to Core)
export async function listOrdersFromD1(req, env) {
  if (!(await adminOK(req, env))) return errorResponse('Unauthorized', 401, req);
  try {
    const items = await getOrders(env, 500); // Call Core
    return json({ ok: true, items }, {}, req);
  } catch (error) {
    return json({ ok: false, error: 'Failed to load orders', message: error.message }, { status: 500 }, req);
  }   
}

// Alias for compatibility
export async function listOrdersAdmin(req, env) { return listOrdersFromD1(req, env); }

// Legacy KV List
export async function listOrders(req, env) {
  if (!(await adminOK(req, env))) return errorResponse('Unauthorized', 401, req);
  const url = new URL(req.url);
  const from = Number(url.searchParams.get('from') || 0);
  const to = Number(url.searchParams.get('to') || 0);
  let list = await getJSON(env, 'orders:list', []);
  const enriched = [];
  for (const order of list) {
    if (!order.items) { const full = await getJSON(env, 'order:' + order.id, null); enriched.push(full || order); }
    else { enriched.push(order); }
  }
  list = enriched;
  if (from || to) { list = list.filter(order => { const ts = Number(order.createdAt || 0); if (from && ts < from) return false; if (to && ts > to) return false; return true; }); }
  return json({ ok: true, items: list }, {}, req);
}

// Upsert Order
export async function upsertOrder(req, env) {
  if (!(await adminOK(req, env))) return errorResponse('Unauthorized', 401, req);
  const body = await readBody(req) || {};
  const id = body.id || crypto.randomUUID().replace(/-/g, '');
  const list = await getJSON(env, 'orders:list', []);
  const index = list.findIndex(o => o.id === id);

  let oldOrder = index >= 0 ? list[index] : null;
  if (!oldOrder) oldOrder = await getJSON(env, 'order:' + id, null);
  if (!oldOrder && id) {
    try {
      const dbOrder = await env.DB.prepare('SELECT * FROM orders WHERE order_number = ? OR id = ?').bind(id, id).first();
      if (dbOrder) {
        const dbItems = await env.DB.prepare('SELECT * FROM order_items WHERE order_id = ?').bind(dbOrder.id).all();
        oldOrder = { ...dbOrder, items: dbItems.results || [] };
      }
    } catch (e) {}
  }

  const oldStatus = String(oldOrder?.status || 'pending').toLowerCase();
  const newStatus = String(body.status || '').toLowerCase();
  const isConfirming = (newStatus === 'processing' && (!oldOrder || !oldOrder.tracking_code || oldOrder.tracking_code === 'CANCELLED' || oldOrder.tracking_code === ''));

  let order = { ...(oldOrder || {}), ...body, id, createdAt: (oldOrder && oldOrder.createdAt) ? oldOrder.createdAt : (body.createdAt || Date.now()), updated_at: Date.now() };
  
  order = await calculateOrderFinancials(order, env);

  if (index >= 0) list[index] = order; else list.unshift(order);
  await putJSON(env, 'orders:list', list);
  await putJSON(env, 'order:' + id, order);
  try { await saveOrderToD1(env, order); } catch (e) {}

  if (isConfirming) {
    try {
      if (!order.receiver_province_code && order.shipping_province) order.receiver_province_code = await lookupProvinceCode(env, order.shipping_province);
      if (!order.receiver_district_code && order.shipping_district && order.receiver_province_code) order.receiver_district_code = await lookupDistrictCode(env, order.receiver_province_code, order.shipping_district);
      if (!order.receiver_province_code && order.receiver_district_code) { const districtNum = parseInt(order.receiver_district_code); if (districtNum >= 760 && districtNum <= 783) order.receiver_province_code = '79'; }
      if (!order.total_weight_gram || order.total_weight_gram === 0) order.total_weight_gram = chargeableWeightGrams(order, order);

      const waybillResult = await autoCreateWaybill(order, env);
      if (waybillResult.ok && waybillResult.carrier_code) {
        order.tracking_code = waybillResult.carrier_code;
        order.shipping_tracking = waybillResult.carrier_code;
        order.superai_code = waybillResult.superai_code;
        order.carrier_id = waybillResult.carrier_id;
        order.carrier_name = waybillResult.carrier_name;
        order.shipping_provider = waybillResult.carrier_name;
        order.status = 'processing';
        order.waybill_data = waybillResult.raw;
        await putJSON(env, 'order:' + id, order);
        if (index >= 0) list[index] = order;
        await putJSON(env, 'orders:list', list);
        await saveOrderToD1(env, order);
      }
    } catch (e) {}
  }

  if (newStatus === ORDER_STATUS.COMPLETED && oldStatus !== ORDER_STATUS.COMPLETED) {
    if (order.voucher_code) try { await markVoucherUsed(env, order.voucher_code, order.customer?.id || null); } catch (e) {}
    await addPointsToCustomer(order.customer, order.revenue, env);
  }

  return json({ ok: true, id: order.id, data: order }, {}, req);
}

// Delete Order (Refactored to Core)
export async function deleteOrder(req, env) {
  if (!(await adminOK(req, env))) return errorResponse('Unauthorized', 401, req);
  const body = await readBody(req) || {};
  const id = body.id;
  if (!id) return errorResponse('ID is required', 400, req);

  try {
    // Gọi Core để xóa DB và hoàn kho
    const result = await coreDeleteOrder(id, env);
    
    // Xử lý phụ: Hủy vận đơn bên ngoài (Admin Service Only)
    if (result.superai_code) {
      try { 
        await cancelWaybill({ body: JSON.stringify({ superai_code: result.superai_code }), headers: req.headers }, env); 
      } catch (e) { console.warn('Failed to cancel waybill external:', e); }
    }

    return json({ ok: true, deleted: id, message: 'Đã xóa đơn hàng' }, {}, req);
  } catch (e) { return errorResponse(e.message, 500, req); }
}

// Print Order
export async function printOrder(req, env) {
  if (!(await adminOK(req, env))) return errorResponse('Unauthorized', 401, req);
  const url = new URL(req.url);
  const id = url.searchParams.get('id');
  if (!id) return errorResponse('Missing order ID', 400, req);

  let order = await getJSON(env, 'order:' + id, null);
  if (!order) { const list = await getJSON(env, 'orders:list', []); order = list.find(o => String(o.id) === String(id)) || null; }
  if (!order) return errorResponse('Order not found', 404, req);

  const items = Array.isArray(order.items) ? order.items : [];
  const subtotal = items.reduce((s, it) => s + Number(it.price || 0) * Number(it.qty || 1), 0);
  const shipping = Number(order.shipping_fee || 0);
  const discount = Number(order.discount || 0) + Number(order.shipping_discount || 0);
  const total = Math.max(0, subtotal + shipping - discount);
  const createdDate = order.createdAt ? new Date(Number(order.createdAt)).toLocaleString('vi-VN') : '';

  const rows = items.map(item => `<tr><td>${item.sku || item.id || ''}</td><td>${(item.name || '') + (item.variant ? (' - ' + item.variant) : '')}</td><td style="text-align:right">${formatPrice(item.qty || 1)}</td><td style="text-align:right">${formatPrice(item.price || 0)}</td><td style="text-align:right">${formatPrice(item.cost || 0)}</td><td style="text-align:right">${formatPrice((item.price || 0) * (item.qty || 1))}</td></tr>`).join('') || `<tr><td colspan="6" style="color:#6b7280">Không có dòng hàng</td></tr>`;
  const customer = order.customer || {};
  const html = `<!doctype html><html><head><meta charset="utf-8"/><title>Đơn hàng ${id}</title><style>body{font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;margin:24px;color:#111827}.row{display:flex;justify-content:space-between;margin-bottom:12px}table{width:100%;border-collapse:collapse;margin-top:8px}th,td{border:1px solid #e5e7eb;padding:6px 8px;font-size:13px}th{background:#f9fafb;text-align:left}.totals{margin-top:12px}.totals div{display:flex;justify-content:space-between;padding:2px 0}</style></head><body><div class="row"><div><div><b>Đơn hàng:</b> ${id}</div><div><b>Ngày tạo:</b> ${createdDate}</div><div><b>Khách:</b> ${customer.name || order.customer_name || order.name || ''} ${customer.phone ? ('• ' + customer.phone) : ''}</div>${order.address || customer.address ? (`<div><b>Địa chỉ:</b> ${order.address || customer.address}</div>`) : ''}${order.shipping_name ? (`<div><b>Vận chuyển:</b> ${order.shipping_name} ${order.shipping_eta ? (' • ' + order.shipping_eta) : ''}</div>`) : ''}</div></div><table><thead><tr><th>Mã SP</th><th>Tên/Phân loại</th><th>SL</th><th>Giá bán</th><th>Giá vốn</th><th>Thành tiền</th></tr></thead><tbody>${rows}</tbody></table><div class="totals"><div><span>Tổng hàng</span><b>${formatPrice(subtotal)}</b></div><div><span>Phí vận chuyển</span><b>${formatPrice(shipping)}</b></div>${discount ? (`<div><span>Giảm</span><b>-${formatPrice(discount)}</b></div>`) : ''}<div style="font-size:16px"><span>Tổng thanh toán</span><b>${formatPrice(total)}</b></div></div><script>window.onload = () => setTimeout(() => window.print(), 200);</script></body></html>`;
  
  return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8', ...corsHeaders(req) } });
}