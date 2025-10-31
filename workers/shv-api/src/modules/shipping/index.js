import { json } from '../../lib/response.js';
import * as areas from './areas.js';
import * as warehouses from './warehouses.js';
import * as pricing from './pricing.js';
import { createWaybill, printWaybill } from './waybill.js';
import { superToken } from './helpers.js';

export async function handle(req, env, ctx) {
  const url = new URL(req.url);
  const path = url.pathname;

  // Areas (provinces/districts/wards) - ✅ THÊM /public/shipping/areas
  if (path.startsWith('/shipping/provinces') || 
      path.startsWith('/shipping/districts') ||
      path.startsWith('/shipping/wards') ||
      path.startsWith('/shipping/areas') ||
      path.startsWith('/public/shipping/areas') ||  // ← ✅ THÊM DÒNG NÀY
      path.startsWith('/api/addresses') ||
      path.startsWith('/v1/platform/areas')) {
    return areas.handle(req, env, ctx);
  }

    // Warehouses
  if (path === '/shipping/warehouses') {
    return warehouses.handle(req, env, ctx);
  }

  // Pricing/Quote
  if (path === '/v1/platform/orders/price') {
    // dùng mini proxy gọi thẳng SuperAI (alias weight/value đã map trong pricing.getMiniPrice)
    return pricing.getMiniPrice(req, env, ctx);
  }

  // NEW: total weight (tính cân nặng thật)
  if (path === '/shipping/weight' && req.method === 'POST') {
    return pricing.handle(req, env, ctx);
  }

  if (path === '/shipping/price' || 
      path === '/shipping/quote' ||
      path === '/api/shipping/quote') {
    return pricing.handle(req, env, ctx);
  }

   // Waybill creation
  if ((path === '/admin/shipping/create' || path === '/shipping/create') && req.method === 'POST') {
    return createWaybill(req, env);
  }

  // Waybill printing
  if (path === '/shipping/print' && req.method === 'POST') {
    return printWaybill(req, env);
  }

  return json({ ok: false, error: 'Not found' }, { status: 404 }, req);
}
