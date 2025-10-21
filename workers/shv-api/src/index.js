// ===================================================================
// src/index.js - Main Router (với Admin Module)
// ===================================================================

import { json, corsHeaders } from './lib/response.js';
import * as categories from './modules/categories.js';
import * as orders from './modules/orders.js';
import * as products from './modules/products.js';
import * as shipping from './modules/shipping/index.js';
import * as settings from './modules/settings.js';
import * as banners from './modules/banners.js';
import * as vouchers from './modules/vouchers.js';
import * as auth from './modules/auth.js';
import * as admin from './modules/admin.js'; // NEW
import { handleCartSync } from './modules/cart-sync-handler.js';

// ---- CORS wrapper: đảm bảo mọi Response đều có CORS ----
function withCors(res, req) {
  const h = new Headers(res.headers);
  const origin = req.headers.get('Origin') || '*';
  const reqHdr = req.headers.get('Access-Control-Request-Headers') || 'authorization,content-type,x-token,x-requested-with';
  h.set('Access-Control-Allow-Origin', origin);
  h.set('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  h.set('Access-Control-Allow-Headers', reqHdr);
  h.set('Access-Control-Max-Age', '86400');
  h.set('Access-Control-Allow-Credentials', 'true');
  h.set('Access-Control-Expose-Headers', 'x-token');
  h.set('Vary', 'Origin');
  if (!h.has('content-type')) h.set('content-type', 'application/json; charset=utf-8');
  return new Response(res.body, { status: res.status, headers: h });
}

/**
 * Logger middleware
 */
function logEntry(req) {
  try {
    const url = new URL(req.url);
    console.log(JSON.stringify({
      t: Date.now(),
      method: req.method,
      path: url.pathname
    }));
  } catch (e) {
    console.error('Log error:', e);
  }
}

/**
 * Main Worker handler
 */
export default {
  async fetch(req, env, ctx) {
    logEntry(req);

    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: corsHeaders(req)
      });
    }

    const url = new URL(req.url);
    const path = url.pathname;

    try {
      // ============================================
      // ADMIN ROUTES (NEW) - ƯU TIÊN TRƯỚC
      // ============================================
      
      // Admin login routes - PHẢI ĐẶT TRƯỚC auth module
      if (path === '/admin/login' ||
          path === '/login' ||
          path === '/admin_auth/login') {
        return withCors(await admin.handle(req, env, ctx), req);
      }
      
      // Admin management routes
      if (path.startsWith('/admin/setup') ||
          path.startsWith('/admin/auth') ||
          path.startsWith('/admin/users') ||
          path.startsWith('/admin/roles')) {
        return withCors(await admin.handle(req, env, ctx), req);
      }
	  // ✅ THÊM ĐOẠN NÀY - BẮT ĐẦU
      // ============================================
      // CUSTOMER API ROUTES (PUBLIC)
      // ============================================
      if (path.startsWith('/admin/customers') ||
          path === '/api/customers/register' ||
          path === '/api/customers/login' ||
          path === '/api/customers/me') {
        return withCors(await admin.handle(req, env, ctx), req);
      }
      // ✅ THÊM ĐOẠN NÀY - KẾT THÚC

      // ============================================
      // EXISTING ROUTES
      // ============================================

      // Auth module (OLD - để tương thích backward)
      if (path === '/admin/me') {
        return withCors(await admin.handle(req, env, ctx), req);
      }

      // Categories module
      if (path.startsWith('/admin/categories') ||
          path.startsWith('/public/categories')) {
        return withCors(await categories.handle(req, env, ctx), req);
}

      // Products module - PUBLIC ONLY
      if (path.startsWith('/products') ||
          path.startsWith('/public/products') ||
          path === '/product') {
        return withCors(await products.handle(req, env, ctx), req);
      }
      
      // Products module - ADMIN
      if (path.startsWith('/admin/products')) {
        return withCors(await products.handle(req, env, ctx), req);
      }

      // Orders module
      if (path.startsWith('/api/orders') ||
          path.startsWith('/admin/orders') ||
          path.startsWith('/public/orders') ||
          path.startsWith('/public/order-create') ||
          path === '/admin/stats') {
        return withCors(await admin.handle(req, env, ctx), req);
      }

      // Shipping module
      if (path.startsWith('/shipping') ||
          path.startsWith('/admin/shipping') ||
          path.startsWith('/api/addresses') ||
          path.startsWith('/v1/platform/areas') ||
          path.startsWith('/v1/platform/orders/price')) {
        return withCors(await admin.handle(req, env, ctx), req);
      }

      // Cart Sync module
       if (path.startsWith('/api/cart/sync')) {
         return withCors(await handleCartSync(req, env), req);
       }

      // Settings module
      if (path.startsWith('/admin/settings') ||
          path.startsWith('/public/settings') ||
          path === '/settings') {
        return withCors(await settings.handle(req, env, ctx), req);
      }

      // Banners module
      if (path === '/banners' ||
          path === '/public/banners' || // thêm public
          path.startsWith('/admin/banners') ||
          path.startsWith('/admin/banner')) {
        return withCors(await banners.handle(req, env, ctx), req);
      }

      // Vouchers module
      if (path === '/vouchers' ||
          path.startsWith('/admin/vouchers')) {
        return withCors(await admin.handle(req, env, ctx), req);
      }

      // ============================================
      // ROOT ENDPOINTS
      // ============================================

      if (path === '/' || path === '') {
        return json({
          ok: true,
          msg: 'SHV API v4.2 (Admin System Integrated)',
          hint: 'All routes modularized + Cart Sync + Admin Management',
          modules: {
            admin: '✅ Added',
            auth: '✅ Complete',
            categories: '✅ Complete',
            products: '✅ Complete',
            orders: '✅ Complete',
            shipping: '✅ Complete',
            settings: '✅ Complete',
            banners: '✅ Complete',
            vouchers: '✅ Complete',
            cart_sync: '✅ Complete'
          }
        }, {}, req);
      }

      if (path === '/me' && req.method === 'GET') {
        return json({
          ok: true,
          msg: 'Worker alive',
          version: 'v4.2'
        }, {}, req);
      }

      // Not found
      return json({
        ok: false,
        error: 'Route not found'
      }, { status: 404 }, req);

    } catch (e) {
      console.error('Worker error:', e);
      return json({
        ok: false,
        error: String(e?.message || e)
      }, { status: 500 }, req);
    }
  }
};