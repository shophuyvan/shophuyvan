import { errorResponse } from '../../lib/response.js';
import * as Public from './order-public.js';
import * as Admin from './order-admin.js';
import * as Stats from './order-stats.js';
import { printWaybill, cancelWaybill, printWaybillsBulk, cancelWaybillsBulk } from '../shipping/waybill.js';
import { notifyZaloPayment } from './order-notify.js';

export async function handle(req, env, ctx) {
  const url = new URL(req.url);
  const path = url.pathname;
  const method = req.method;

  // PUBLIC
  if (path === '/api/orders' && method === 'POST') return Public.createOrder(req, env, ctx);
  if (path === '/public/orders/create' && method === 'POST') return Public.createOrderPublic(req, env, ctx);
  if (path === '/public/order-create' && method === 'POST') return Public.createOrderLegacy(req, env);
  if (path === '/orders/my' && method === 'GET') return Public.getMyOrders(req, env);
  if (path === '/orders/cancel' && method === 'POST') return Public.cancelOrderCustomer(req, env);
  if (path === '/orders/price' && method === 'POST') return Public.priceOrderPreview(req, env);
  if (path === '/zalo/notify' && method === 'POST') return notifyZaloPayment(req, env);

  // ADMIN
  if (path === '/api/orders' && method === 'GET') return Admin.listOrdersFromD1(req, env);
  if (path === '/admin/orders' && method === 'GET') return Admin.listOrdersAdmin(req, env);
  if (path === '/admin/orders/upsert' && method === 'POST') return Admin.upsertOrder(req, env);
  if (path === '/admin/orders/delete' && method === 'POST') return Admin.deleteOrder(req, env);
  if (path === '/admin/orders/print' && method === 'GET') return Admin.printOrder(req, env);
  if (path === '/admin/stats' && method === 'GET') return Stats.getStats(req, env);

  // SHIPPING
  if (path === '/shipping/print' && method === 'POST') return printWaybill(req, env);
  if (path === '/shipping/cancel' && method === 'POST') return cancelWaybill(req, env);
  if (path === '/shipping/print-bulk' && method === 'POST') return printWaybillsBulk(req, env);
  if (path === '/shipping/cancel-bulk' && method === 'POST') return cancelWaybillsBulk(req, env);

  return errorResponse('Route not found', 404, req);
}