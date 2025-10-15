// ===================================================================
// workers/shv-api/src/index.js - Main Router (Modularized)
// ===================================================================

import { json, corsHeaders } from './lib/response.js';
import * as categories from './modules/categories.js';
// Import thêm các module khác khi đã tách xong:
import * as products from './modules/products.js';
import * as orders from './modules/orders.js';
import * as shipping from './modules/shipping/index.js';
import * as auth from './modules/auth.js';
import * as settings from './modules/settings.js';

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
    // Log request
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
      // =====================================================
      // MODULAR ROUTES (đã tách)
      // =====================================================
      
      // Categories module
      if (path.startsWith('/admin/categories') || 
          path.startsWith('/public/categories')) {
        return categories.handle(req, env, ctx);
      }

      // TODO: Uncomment khi đã tách module
      // Products module
      if (p.startsWith('/products') || 
        p.startsWith('/public/products') ||
        p.startsWith('/admin/products') ||
        p.startsWith('/product') ||
        (p === '/products' && req.method === 'GET')) {
      return products.handle(req, env, ctx);
    }

      // Orders module
      if (p.startsWith('/api/orders') || 
    p.startsWith('/admin/orders') ||
    p.startsWith('/public/orders') ||
    p.startsWith('/public/order-create') ||
    p === '/admin/stats') {
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

      // Auth module
      if (path === '/admin/login' || path === '/login') {
         return auth.handle(req, env, ctx);
       }

      // Settings module
      if (path.startsWith('/admin/settings') || 
           path.startsWith('/public/settings')) {
         return settings.handle(req, env, ctx);
       }

      // =====================================================
      // LEGACY ROUTES (chưa tách - giữ nguyên từ file cũ)
      // =====================================================
      
      // Root endpoint
      if (path === '/' || path === '') {
        return json({
          ok: true,
          msg: 'SHV API v3.1 (Modularized)',
          hint: 'GET /products, /orders, /shipping',
          modules: {
            categories: '✅ Modularized',
            products: '⏳ In progress',
            orders: '⏳ In progress',
            shipping: '⏳ In progress'
          }
        }, {}, req);
      }

      // Health check
      if (path === '/me' && req.method === 'GET') {
        return json({ ok: true, msg: 'Worker alive' }, {}, req);
      }

      // =====================================================
      // TEMPORARY: Import old handlers cho routes chưa tách
      // =====================================================
      // NOTE: Dùng tạm để app không bị break, sẽ xóa dần khi tách xong
      
      // Nếu không match route nào ở trên, gọi legacy handler
      return handleLegacyRoutes(req, env, ctx);

    } catch (e) {
      console.error('Worker error:', e);
      return json({
        ok: false,
        error: String(e?.message || e)
      }, { status: 500 }, req);
    }
  }
};

/**
 * Legacy route handler (giữ nguyên code cũ cho đến khi tách xong)
 * TODO: Xóa function này khi đã tách hết tất cả modules
 */
async function handleLegacyRoutes(req, env, ctx) {
  // Paste toàn bộ code xử lý routes từ file index.js cũ vào đây
  // (tạm thời để app không bị break)
  
  // VD: Products routes
  const url = new URL(req.url);
  const path = url.pathname;
  
  if (path.startsWith('/products')) {
    // Copy code xử lý /products từ file cũ
    // ...
  }
  
  if (path.startsWith('/orders')) {
    // Copy code xử lý /orders từ file cũ
    // ...
  }
  
  // ... các routes khác
  
  return json({
    ok: false,
    error: 'Route not found (legacy handler)'
  }, { status: 404 }, req);
}

// ===================================================================
// Export helper cho testing
// ===================================================================

export { logEntry };