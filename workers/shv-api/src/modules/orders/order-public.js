import { json, errorResponse, corsHeaders } from '../../lib/response.js';
import { readBody } from '../../lib/utils.js';
import { validate, SCH } from '../../lib/validator.js';
import { idemGet, idemSet } from '../../lib/idempotency.js';
// Xóa dòng import cũ ở đây
import { getJSON, putJSON } from '../../lib/kv.js';
import { 
  authenticateCustomer, normalizePhone, normalizeOrderItems, 
  enrichItemsWithCostAndPrice, addPointsToCustomer, 
  ORDER_STATUS, shouldAdjustStock 
} from './order-helpers.js';
// Giữ lại dòng đầy đủ nhất ở dưới
import { calculateOrderFinancials, saveOrderToD1, adjustInventory } from '../../core/order-core.js';
import { sendToFacebookCAPI, sendOrderNotification, createZaloSignature } from './order-notify.js';
import { cancelWaybill } from '../shipping/waybill.js';

// Preview Price
export async function priceOrderPreview(req, env) {
  try {
    const auth = await authenticateCustomer(req, env).catch(() => ({ customerId: null }));
    const body = await readBody(req) || {};
    let items = normalizeOrderItems(body.items || []);
    items = await enrichItemsWithCostAndPrice(items, env);

    const subtotal = items.reduce((sum, it) => sum + Number(it.price || 0) * Number(it.qty || 1), 0);
    let tempOrder = {
      items, subtotal,
      shipping_fee: Number(body?.totals?.shipping_fee || body.shipping_fee || 0),
      voucher_code: body.voucher_code || body?.totals?.voucher_code || null,
      discount: 0, shipping_discount: 0
    };
    
    tempOrder = await calculateOrderFinancials(tempOrder, env);

    return json({
      ok: true,
      totals: {
        subtotal,
        shipping_fee: tempOrder.shipping_fee,
        discount: tempOrder.discount,
        shipping_discount: tempOrder.shipping_discount,
        total: tempOrder.revenue, // Total = Revenue
        voucher_code: tempOrder.voucher_code
      },
      items
    }, {}, req);
  } catch (e) { return errorResponse(e, 500, req); }
}

// Create Order (Main)
export async function createOrder(req, env, ctx) {
  const idem = await idemGet(req, env);
  if (idem.hit) return new Response(idem.body, { status: 200, headers: corsHeaders(req) });

  const auth = await authenticateCustomer(req, env);
  const body = await readBody(req) || {};

  const validation = validate(SCH.orderCreate, body);
  if (!validation.ok) return json({ ok: false, error: 'VALIDATION_FAILED', details: validation.errors }, { status: 400 }, req);

  const id = body.id || crypto.randomUUID().replace(/-/g, '');
  const createdAt = Date.now();

  let items = normalizeOrderItems(body.items || []);
  items = await enrichItemsWithCostAndPrice(items, env);

  let orderData = {
    items,
    shipping_fee: Number(body?.totals?.shipping_fee || body.shipping_fee || 0),
    voucher_code: body.voucher_code || body.totals?.voucher_code || null,
    discount: Number(body.discount || 0),
    shipping_discount: Number(body.shipping_discount || 0)
  };

  orderData = await calculateOrderFinancials(orderData, env);

  const finalCustomer = { ...(auth.customer || {}), ...(body.customer || {}) };
  if (auth.customerId) finalCustomer.id = auth.customerId;
  if (finalCustomer.phone) finalCustomer.phone = normalizePhone(finalCustomer.phone);

  const order = {
    id, createdAt,
    status: ORDER_STATUS.PENDING,
    customer: finalCustomer,
    items,
    subtotal: orderData.subtotal,
    shipping_fee: orderData.shipping_fee,
    discount: orderData.discount,
    shipping_discount: orderData.shipping_discount,
    revenue: orderData.revenue,
    profit: orderData.profit,
    voucher_code: orderData.voucher_code,
    note: body.note || '',
    source: body.source || 'website',
    shipping_provider: body.shipping_provider || null,
    shipping_service: body.shipping_service || null,
    shipping_option_id: body.shipping_option_id || '1',
    shipping_name: body.shipping_name || null,
    shipping_eta: body.shipping_eta || null,
    weight_gram: Number(body.total_weight_gram || 0),
    total_weight_gram: Number(body.total_weight_gram || 0),
    allow_inspection: body.allow_inspection !== undefined ? body.allow_inspection : true,
    cod_amount: orderData.revenue
  };

  const list = await getJSON(env, 'orders:list', []);
  list.unshift(order);
  await putJSON(env, 'orders:list', list);
  await putJSON(env, 'order:' + id, order);

  try {
    const d1Result = await saveOrderToD1(env, order);
    if (d1Result.ok) {
        if (ctx && ctx.waitUntil) ctx.waitUntil(sendOrderNotification(order, env, ctx));
        else sendOrderNotification(order, env, null);
    }
  } catch (e) { console.error('[ORDER-PUBLIC] Exception D1:', e); }

  if (ctx && ctx.waitUntil) ctx.waitUntil(sendToFacebookCAPI(order, req, env));

  if (shouldAdjustStock(order.status) && !body.skip_stock_adjustment) await adjustInventory(items, env, -1);

  let zalo_mac = null;
  const ZALO_APP_ID = env.ZALO_MINI_APP_ID || '574448931033929374'; 
  const ZALO_PRIVATE_KEY = env.ZALO_PRIVATE_KEY; 

  if (ZALO_APP_ID && ZALO_PRIVATE_KEY) {
    try {
      const zaloItems = items.map(it => ({ id: String(it.id), amount: Number(it.price), quantity: Number(it.qty) }));
      const descStr = `Thanh toán đơn hàng #${id}`;
      const extraStr = JSON.stringify({ internal_order_id: id, source: 'mini_app' });
      const methodStr = JSON.stringify({ id: 'COD_MOBILE', isCustom: false });
      const dataStr = `appId=${ZALO_APP_ID}&item=${JSON.stringify(zaloItems)}&amount=${Math.floor(order.revenue)}&description=${descStr}&extradata=${extraStr}&method=${methodStr}`;
      zalo_mac = await createZaloSignature(dataStr, ZALO_PRIVATE_KEY);
    } catch (e) {}
  }

  const response = json({ ok: true, id, status: order.status, mac: zalo_mac, zalo_mac }, {}, req);
  await idemSet(idem.key, env, response);
  return response;
}

// Create Order Legacy
export async function createOrderLegacy(req, env) {
  const body = await readBody(req) || {};
  const id = body.id || crypto.randomUUID().replace(/-/g, '');
  const createdAt = Date.now();
  let items = normalizeOrderItems(body.items || []);
  items = await enrichItemsWithCostAndPrice(items, env);

  let orderData = { items, shipping_fee: Number(body.shipping_fee || body.shippingFee || 0), discount: 0, shipping_discount: 0 };
  orderData = await calculateOrderFinancials(orderData, env);

  const order = {
    id, status: body.status || 'mới',
    name: body.name, phone: normalizePhone(body.phone), address: body.address,
    note: body.note || body.notes,
    items, subtotal: orderData.subtotal, shipping_fee: orderData.shipping_fee,
    total: orderData.revenue, revenue: orderData.revenue, profit: orderData.profit, createdAt
  };

  const list = await getJSON(env, 'orders:list', []);
  list.unshift(order);
  await putJSON(env, 'orders:list', list);
  await putJSON(env, 'order:' + id, order);

  if (shouldAdjustStock(order.status)) await adjustInventory(items, env, -1);
  return json({ ok: true, id, data: order }, {}, req);
}

// Create Order Public (Alternative)
export async function createOrderPublic(req, env, ctx) {
  return createOrder(req, env, ctx);
}

// Get My Orders
export async function getMyOrders(req, env) {
  const auth = await authenticateCustomer(req, env);
  const url = new URL(req.url);
  const phoneFallback = (url.searchParams.get('phone') || req.headers.get('x-customer-phone') || '').trim();

  if (!auth.customerId && !phoneFallback) return json({ ok: false, error: 'Unauthorized' }, { status: 401 }, req);

  let allOrders = await getJSON(env, 'orders:list', []);
  const enriched = [];
  for (const order of allOrders) {
    if (!order.items) { const full = await getJSON(env, 'order:' + order.id, null); enriched.push(full || order); }
    else { enriched.push(order); }
  }
  allOrders = enriched;

  const pPhone = normalizePhone(phoneFallback || auth.customer?.phone || auth.customer?.mobile || '');
  const pId = auth.customerId;
  const pEmail = auth.customer?.email || '';

  const myOrders = allOrders.filter(order => {
    const oc = order.customer || {};
    const oPhone = normalizePhone(oc.phone || order.phone || '');
    const oId = oc.id || oc.customer_id || '';
    const oEmail = String(oc.email || order.email || '').toLowerCase();
    const eq = (a, b) => String(a).toLowerCase() === String(b).toLowerCase();
    return (pPhone && oPhone === pPhone) || (pId && oId && eq(oId, pId)) || (pEmail && oEmail && eq(oEmail, pEmail));
  });

  myOrders.sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0));
  return json({ ok: true, orders: myOrders, count: myOrders.length, customer: auth.customer || null }, {}, req);
}

// Cancel Order
export async function cancelOrderCustomer(req, env) {
  try {
    const body = await readBody(req) || {};
    const orderId = body.order_id;
    if (!orderId) return json({ ok: false, error: 'Missing order_id' }, { status: 400 }, req);

    const order = await getJSON(env, 'order:' + orderId, null);
    if (!order) return json({ ok: false, error: 'Order not found' }, { status: 404 }, req);

    const status = String(order.status || '').toLowerCase();
    if (!status.includes('pending') && !status.includes('confirmed') && !status.includes('cho')) {
      return json({ ok: false, error: 'Không thể hủy đơn hàng này' }, { status: 400 }, req);
    }

    order.status = ORDER_STATUS.CANCELLED;
    order.cancelled_at = Date.now();
    order.cancelled_by = 'customer';

    if (shouldAdjustStock(status)) await adjustInventory(normalizeOrderItems(order.items), env, +1);
    
    if (order.superai_code || order.tracking_code) {
      try {
        await cancelWaybill({ body: JSON.stringify({ superai_code: order.superai_code || order.tracking_code }), headers: req.headers }, env);
        order.tracking_code = 'CANCELLED';
      } catch (e) {}
    }

    await putJSON(env, 'order:' + orderId, order);
    const list = await getJSON(env, 'orders:list', []);
    const index = list.findIndex(o => o.id === orderId);
    if (index > -1) { list[index] = order; await putJSON(env, 'orders:list', list); }
    await saveOrderToD1(env, order);

    return json({ ok: true, message: 'Đã hủy đơn hàng' }, {}, req);
  } catch (e) { return json({ ok: false, error: e.message }, { status: 500 }, req); }
}