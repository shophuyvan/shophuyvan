// shv-api/src/index.js
import { handleAI } from './modules/gemini.js';
import { handleBanners } from './modules/banners.js';
import { handleVouchers } from './modules/vouchers.js';
import { handleOrders } from './modules/orders.js';
import { handleUsers } from './modules/users.js';
import { handleUpload } from './modules/cloudinary.js';
import { handlePricing } from './modules/pricing.js';
import { handleShipping } from './modules/shipping/index.js';
import { scheduledCron } from './modules/cron.js';
import { Fire } from './modules/firestore.js';

// Admin products
import { handleProducts } from './modules/products.js';

// ---- helpers ----
const cors = (origin = '*') => ({
  'Access-Control-Allow-Origin': origin,
  'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization,Content-Type,x-token',
  'Vary': 'Origin',
});

const json = (status, data, headers) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...(headers || {}) },
  });

function getAdminToken(req, url){
  const auth   = req.headers.get('Authorization') || '';
  const bearer = auth.replace(/^Bearer\s+/i, '').trim();
  const x      = req.headers.get('x-token') || '';
  const q      = (url && url.searchParams.get('token')) || '';
  return x || bearer || q || '';
}
function requireAdmin(req, env, url) {
  const token = getAdminToken(req, url);
  if (!token || token !== env.ADMIN_TOKEN) {
    throw json(401, { error: 'Unauthorized' });
  }
}


// --- Response cache for GET endpoints (Cloudflare caches.default) ---
async function cacheJSON(keyReq, builder, ttlSec = Number(env.CACHE_TTL || 60)) {
  try {
    const cache = caches.default;
    const cached = await cache.match(keyReq);
    if (cached) return cached;
    const { status = 200, data = {}, headers = {} } = await builder();
    const h = new Headers({ 'Content-Type': 'application/json',
                            'Cache-Control': `public, max-age=${ttlSec}`,
                            ...headers });
    const res = new Response(JSON.stringify(data), { status, headers: h });
    await cache.put(keyReq, res.clone());
    return res;
  } catch (e) {
    const { status = 200, data = {}, headers = {} } = await builder();
    const h = new Headers({ 'Content-Type': 'application/json', ...headers });
    return new Response(JSON.stringify(data), { status, headers: h });
  }
}

export default {
  async fetch(req, env, ctx) {
    const origin = req.headers.get('Origin') || '*';
    const url = new URL(req.url);

    // Preflight cho tất cả
    if (req.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors(origin) });
    }

    const fire = new Fire(env);

    try {
      let res;

      // ---- health & AI ----
      if (url.pathname === '/ai/health' && req.method === 'GET') {
        res = json(200, { ok: true });
      }
      else if (url.pathname === '/ai/suggest' && req.method === 'POST') {
        res = await handleAI(req, env);
      }

      // ---- upload signature (admin) ----
      else if (url.pathname === '/upload/signature' && req.method === 'POST') {
        requireAdmin(req, env, url);
        res = await handleUpload(req, env);
      }

      // ---- PUBLIC banners ----
      else if (url.pathname === '/banners' && req.method === 'GET') {
        const rs = await fire.list('banners', {
          where: ['is_active', '==', true],
          orderBy: ['order', 'asc'],
          limit: 20,
        });
        res = json(200, { items: rs.items || [] });
      }

      // ---- ADMIN modules (cần token) ----
      else if (url.pathname.startsWith('/admin/banners')) {
        requireAdmin(req, env, url);
        res = await handleBanners(req, env, fire);
      }
      else if (url.pathname.startsWith('/admin/vouchers')) {
        requireAdmin(req, env, url);
        res = await handleVouchers(req, env, fire);
      }
      else if (url.pathname.startsWith('/admin/users')) {
        requireAdmin(req, env, url);
        res = await handleUsers(req, env, fire);
      }
      else if (url.pathname.startsWith('/admin/products')) {
        requireAdmin(req, env, url);
        res = await handleProducts(req, env, fire);
      }

      // ---- pricing / orders / shipping ----
      else if (url.pathname === '/pricing/preview' && req.method === 'POST') {
        res = await handlePricing(req, env);
      }
      else if (url.pathname.startsWith('/orders')) {
        res = await handleOrders(req, env, fire, requireAdmin);
      }
      else if (url.pathname.startsWith('/shipping/')) {
        res = await handleShipping(req, env, fire, requireAdmin);
      }

      // ---- PUBLIC products (đọc Fire) ----
      else if (url.pathname === '/products' && req.method === 'GET') {
        const limit  = Math.min(Number(url.searchParams.get('limit') || 50), 200);
        const cursor = url.searchParams.get('cursor') || '';
        res = await cacheJSON(req, async () => {
          const rs = await fire.list('products', {
            where: ['is_active', '==', true],
            orderBy: ['created_at', 'desc'],
            limit,
            cursor,
          });
          return { status: 200, data: { items: rs.items || [], nextCursor: rs.nextCursor || null } };
        });
      }
      else if (url.pathname.startsWith('/products/') && req.method === 'GET') {
        const id = url.pathname.split('/').pop();
        res = await cacheJSON(req, async () => {
          const item = await fire.get('products', id);
          if (!item || !item.is_active) {
            return { status: 404, data: { error: 'Not Found' } };
          }
          return { status: 200, data: { item } };
        });
      }

      // ---- 404 ----
      else {
        res = json(404, { error: 'Not Found' });
      }

      // Gắn CORS cho mọi response
      const headers = new Headers(res.headers);
      Object.entries(cors(origin)).forEach(([k, v]) => headers.set(k, v));
      return new Response(res.body, { status: res.status, headers });

    } catch (e) {
      if (e instanceof Response) {
        const headers = new Headers(e.headers);
        Object.entries(cors(origin)).forEach(([k, v]) => headers.set(k, v));
        return new Response(e.body, { status: e.status, headers });
      }
      console.error(e);
      const r = json(500, { error: e.message || 'Server error' });
      const h = new Headers(r.headers);
      Object.entries(cors(origin)).forEach(([k, v]) => h.set(k, v));
      return new Response(r.body, { status: r.status, headers: h });
    }
  },

  // Cron
  async scheduled(event, env, ctx) {
    try {
      await scheduledCron(env, ctx);
    } catch (e) {
      console.error('scheduled error:', e);
    }
  },
};
