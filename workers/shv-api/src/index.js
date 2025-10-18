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
        return admin.handle(req, env, ctx);
      }
      
      // Admin management routes
      if (path.startsWith('/admin/setup') ||
          path.startsWith('/admin/auth') ||
          path.startsWith('/admin/users') ||
          path.startsWith('/admin/roles')) {
        return admin.handle(req, env, ctx);
      }

      // ============================================
      // EXISTING ROUTES
      // ============================================

      // Auth module (OLD - để tương thích backward)
      if (path === '/admin/me') {
        return auth.handle(req, env, ctx);
      }

      // Categories module
      if (path.startsWith('/admin/categories') ||
          path.startsWith('/public/categories')) {
        return categories.handle(req, env, ctx);
      }

      // Products module
      if (path.startsWith('/products') ||
          path.startsWith('/public/products') ||
          path.startsWith('/admin/products') ||
          path === '/product') {
        return products.handle(req, env, ctx);
      }

      // Orders module
      if (path.startsWith('/api/orders') ||
          path.startsWith('/admin/orders') ||
          path.startsWith('/public/orders') ||
          path.startsWith('/public/order-create') ||
          path === '/admin/stats') {
        return orders.handle(req, env, ctx);
      }

      // Shipping module
      if (path.startsWith('/shipping') ||
          path.startsWith('/admin/shipping') ||
          path.startsWith('/api/addresses') ||
          path.startsWith('/v1/platform/areas') ||
          path.startsWith('/v1/platform/orders/price')) {
        return shipping.handle(req, env, ctx);
      }

      // Cart Sync module
      if (path.startsWith('/api/cart/sync')) {
        return handleCartSync(req, env);
      }

      // Settings module
      if (path.startsWith('/public/settings') ||
          path.startsWith('/admin/settings')) {
        return settings.handle(req, env, ctx);
      }

      // Banners module
      if (path === '/banners' ||
          path.startsWith('/admin/banners') ||
          path.startsWith('/admin/banner')) {
        return banners.handle(req, env, ctx);
      }

      // Vouchers module
      if (path === '/vouchers' ||
          path.startsWith('/admin/vouchers')) {
        return vouchers.handle(req, env, ctx);
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