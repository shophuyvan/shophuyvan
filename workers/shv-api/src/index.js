// workers/shv-api/src/index.js
// src/index.js - Main Router (với Admin Module)
// ===================================================================

import { json, corsHeaders } from './lib/response.js';
import * as categories from './modules/categories.js';
import * as Orders from './modules/orders.js';
import * as Products from './modules/products.js';
import * as WebhookHandler from './modules/webhook-handler.js'; // THÊM DÒNG NÀY
import * as shipping from './modules/shipping/index.js';
import * as settings from './modules/settings.js';
import * as banners from './modules/banners.js';
import * as vouchers from './modules/vouchers.js';
import * as auth from './modules/auth.js';
import * as admin from './modules/admin.js'; // NEW
import * as costs from './modules/costs.js'; // THÊM MODULE CHI PHÍ
import * as flashSales from './modules/flash-sales.js'; // THÊM MODULE FLASH SALE
import * as TopNew from './modules/products-top-new.js'; // ✅ API Bestsellers/Newest (FE + Mini)
import { handleCartSync } from './modules/cart-sync-handler.js';
import { printWaybill, cancelWaybill, printWaybillsBulk, cancelWaybillsBulk } from './modules/shipping/waybill.js'; // SỬA: THÊM HỦY & IN HÀNG LOẠT

console.log('[Index] ✅ Module Products đã import:', typeof Products, Products ? Object.keys(Products) : 'undefined'); // LOG KIỂM TRA IMPORT

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
    console.log('--- Worker Request v1.1 ---'); // THÊM LOG NÀY
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
	  // ✅ THÊM ĐOẠN NÀY - BẮT ĐẦU
      // ============================================
      // CUSTOMER API ROUTES (PUBLIC)
      // ============================================
      if (path.startsWith('/admin/customers') ||
          path === '/api/customers/register' ||
          path === '/api/customers/login' ||
          path === '/api/customers/me' ||
          path.startsWith('/api/addresses')) {  // 👈 THÊM DÒNG NÀY
        return admin.handle(req, env, ctx);
      }
      // ✅ THÊM ĐOẠN NÀY - KẾT THÚC

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
	  
	  // Top & New products (shared for FE & Mini) — bắt EXACT trước khi rơi vào Products.handle
      if (path === '/products/bestsellers' || path === '/products/newest') {
        const handled = await TopNew.handle(req, env, ctx);
        if (handled) return handled;
      }

      // Products module
      if (path.startsWith('/products') ||
          path.startsWith('/public/products') ||
          path === '/admin/products' || // EXACT match
          path === '/admin/products/list' || // EXACT match for list
          path.startsWith('/admin/products/') || // Specific actions like /get, /upsert
          path === '/product') {
        console.log('[Index] ➡️ Đang gọi Products.handle cho path:', path, 'Module Products có tồn tại:', typeof Products); // LOG KIỂM TRA TRƯỚC KHI GỌI
        return Products.handle(req, env, ctx);
      }

       // [INV-TRACE] router marker for Orders
      if (path.startsWith('/api/orders') ||
          path.startsWith('/admin/orders') ||
          path.startsWith('/public/orders') ||
          path.startsWith('/public/order-create') ||
          path.startsWith('/orders/')) {  // ✅ THÊM dòng này
        console.log('[INV-TRACE] router → orders', { path, method: req.method });
      }
      
      // Orders module
      if (path.startsWith('/api/orders') ||
          path.startsWith('/admin/orders') ||
          path.startsWith('/public/orders') ||
          path.startsWith('/public/order-create') ||
          path === '/admin/stats' ||
          path === '/orders/my' ||
          path === '/orders/cancel' ||          // ✅ THÊM
          path === '/orders/update') {          // ✅ THÊM route này
        return Orders.handle(req, env, ctx);
      }

     // THÊM: Route HỦY VẬN ĐƠN
     if (path === '/shipping/cancel' && req.method === 'POST') {
       return cancelWaybill(req, env);
     }

     // THÊM: Route IN HÀNG LOẠT
     if (path === '/shipping/print-bulk' && req.method === 'POST') {
       return printWaybillsBulk(req, env);
     }

     // THÊM: Route HỦY HÀNG LOẠT
     if (path === '/shipping/cancel-bulk' && req.method === 'POST') {
       return cancelWaybillsBulk(req, env);
     }

      // Shipping module (ensure Token header for SuperAI v1 routes)
     if (path.startsWith('/shipping') ||
         path.startsWith('/admin/shipping') ||
         path.startsWith('/api/addresses') ||
         path.startsWith('/v1/platform/areas') ||
         path.startsWith('/v1/platform/orders/price') ||
         path.startsWith('/v1/platform/orders/optimize') ||
         path.startsWith('/v1/platform/orders/label') ||
         path.startsWith('/v1/platform/orders/token') ||
         path.startsWith('/v1/platform/carriers') ||
         path.startsWith('/v1/platform/warehouses')) {
     
       let r = req;
     
       // SuperAI v1 endpoints: auto inject headers if missing
       if (path.startsWith('/v1/platform/')) {
         const h = new Headers(req.headers);
         if (!h.get('Token')) {
           h.set('Token', env.SUPER_KEY || 'FxXOoDz2qlTN5joDCsBGQFqKmm1UNvOw7YPwkzm5');
         }
         if (!h.get('Accept')) h.set('Accept', 'application/json');
         if (req.method !== 'GET' && !h.get('Content-Type')) {
           h.set('Content-Type', 'application/json');
         }
         r = new Request(req, { headers: h });
       }
     
       return shipping.handle(r, env, ctx);
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
          path === '/vouchers/apply' ||
          path.startsWith('/admin/vouchers')) {
        return vouchers.handle(req, env, ctx);
      }

      // THÊM: Routes cho Quản lý Chi Phí
      if (path.startsWith('/admin/costs')) {
        return costs.handle(req, env, ctx);
      }

      // THÊM: Routes cho Flash Sale
      if (path.startsWith('/flash-sales') ||
          path.startsWith('/admin/flash-sales')) {
        return flashSales.handle(req, env, ctx);
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

      // THÊM ROUTE WEBHOOK Ở ĐÂY
      else if (path === '/webhook/superai' && req.method === 'POST') {
         return WebhookHandler.handleSuperAIWebhook(req, env);
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