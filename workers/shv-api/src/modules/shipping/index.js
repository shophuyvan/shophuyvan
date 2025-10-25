import { json } from '../../lib/response.js';
import * as areas from './areas.js';
import * as warehouses from './warehouses.js';
import * as pricing from './pricing.js';
import { createWaybill } from './waybill.js';
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
  if (path === '/shipping/price' || 
      path === '/shipping/quote' ||
      path === '/api/shipping/quote' ||
      path === '/v1/platform/orders/price') {
    return pricing.handle(req, env, ctx);
  }

  // Waybill creation
  if ((path === '/admin/shipping/create' || path === '/shipping/create') && req.method === 'POST') {
    return createWaybill(req, env);
  }

  return json({ ok: false, error: 'Not found' }, { status: 404 }, req);
}
