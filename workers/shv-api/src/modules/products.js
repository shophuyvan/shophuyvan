// ===================================================================
// modules/products.js - Main Router (Refactored)
// ===================================================================

import { errorResponse, json } from '../lib/response.js';

// Import từ các module con
import * as PublicAPI from './products/pd-public.js';
import * as AdminAPI from './products/pd-admin.js';
import * as FeedAPI from './products/pd-feed.js';

/**
 * Main handler for all product routes
 * Điều hướng request đến đúng module con (Public, Admin, Feed)
 */
export async function handle(req, env, ctx) {
  const url = new URL(req.url);
  const path = url.pathname;
  const method = req.method;

  // 🔍 DEBUG: Inspect Product
  if (path === '/products/inspect' && method === 'GET') {
    const id = url.searchParams.get('id');
    const p = await env.DB.prepare(`SELECT * FROM products WHERE id = ?`).bind(id).first();
    const v = await env.DB.prepare(`SELECT * FROM variants WHERE product_id = ?`).bind(id).all();
    return json({ ok: true, product: p, variants: v.results }, {}, req);
  }

  // ===== PUBLIC ROUTES (Client) =====

  // 1. Get Single Product (Query Param ?id=...)
  if (path === '/products' && method === 'GET') {
    const productId = url.searchParams.get('id');
    if (productId) return PublicAPI.getProductById(req, env, productId);
    return PublicAPI.listPublicProducts(req, env);
  }

  // 2. Bestsellers / Newest / Cheap / Home Sections
  if (path === '/products/bestsellers' && method === 'GET') return PublicAPI.getBestsellers(req, env);
  if (path === '/products/newest' && method === 'GET') return PublicAPI.getNewest(req, env);
  if (path === '/products/home-sections' && method === 'GET') return PublicAPI.getHomeSections(req, env);
  if (path === '/products/cheap' && method === 'GET') return PublicAPI.getCheapProducts(req, env);

  // 3. Get Single Product (Path Param /products/:id)
  if (path.startsWith('/products/') && method === 'GET') {
    const id = decodeURIComponent(path.split('/')[2] || '').trim();
    if (!id) return errorResponse('No product ID provided', 400, req);
    return PublicAPI.getProductById(req, env, id);
  }

  // 4. Product Channels Map
  if (path.match(/^\/api\/products\/[^\/]+\/channels$/) && method === 'GET') {
    const id = decodeURIComponent(path.split('/')[3]);
    return PublicAPI.getProductChannels(req, env, id);
  }

  // 5. Alternate Path /public/products/:id
  if (path.startsWith('/public/products/') && method === 'GET') {
    const id = decodeURIComponent(path.split('/')[3] || '').trim();
    if (!id) return errorResponse('No product ID provided', 400, req);
    return PublicAPI.getProductById(req, env, id);
  }

  // 6. List Products (Filtered)
  if (path === '/public/products' && method === 'GET') {
    const productId = url.searchParams.get('id');
    if (productId) return PublicAPI.getProductById(req, env, productId);
    return PublicAPI.listPublicProductsFiltered(req, env);
  }

  // ===== METRICS & FEED ROUTES =====
  
  if (path === '/api/products/metrics' && method === 'POST') return FeedAPI.getProductsMetricsBatch(req, env);
  if (path.match(/^\/api\/products\/[^\/]+\/metrics$/) && method === 'GET') {
    const id = decodeURIComponent(path.split('/')[3]);
    return FeedAPI.getProductMetrics(req, env, id);
  }
  
  // Export Facebook Feed
  if (path === '/meta/facebook-feed.csv' || path === '/facebook-feed.csv') {
    return FeedAPI.exportFacebookFeedCsv(req, env);
  }

  // ===== ADMIN ROUTES =====

  if (path === '/admin/products/summary' && method === 'GET') return AdminAPI.listAllProductsWithVariants(req, env);
  if (path === '/admin/products/batch' && method === 'POST') return AdminAPI.getProductsBatch(req, env);
  
  // List Admin Products
  if ((path === '/admin/products' || path === '/admin/products/list') && method === 'GET') {
    return AdminAPI.listAdminProducts(req, env);
  }

  // Get/Upsert/Delete
  if ((path === '/admin/products/get' || path === '/product') && method === 'GET') return AdminAPI.getAdminProduct(req, env);
  if ((path === '/admin/products/upsert' || path === '/admin/product') && method === 'POST') return AdminAPI.upsertProduct(req, env);
  if (path === '/admin/products/delete' && method === 'POST') return AdminAPI.deleteProduct(req, env);

  // Sync Search
  if (path === '/admin/products/sync-search') return AdminAPI.syncSearchText(req, env);

  return errorResponse('Route not found', 404, req);
}

// Export function feed để index.js gọi trực tiếp nếu cần (optional)
export const exportFacebookFeedCsv = FeedAPI.exportFacebookFeedCsv;