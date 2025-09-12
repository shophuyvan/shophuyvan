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
const cors = () => ({
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
});

const json = (status, data, headers) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...(headers || {}) },
  });

function requireAdmin(req, env, urlObj) {
  const url = urlObj || new URL(req.url);
  const tokenFromQuery = url.searchParams.get('token') || '';
  const auth = req.headers.get('Authorization') || '';
  const tokenFromHeader = auth.replace(/^Bearer\s+/i, '').trim();
  const token = tokenFromQuery || tokenFromHeader;
  if (!token || token !== env.ADMIN_TOKEN) {
    throw json(401, { error: 'Unauthorized' });
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

  const parts = url.pathname.split('/').filter(Boolean);
  const idFromPath = parts.length >= 3 ? parts[2] : null;
  const pid = idFromPath || url.searchParams.get('id') || null;

  if (req.method === 'GET') {
    if (pid) {
      const item = await fire.get('products', pid);
      if (!item) return json(404, { error: 'not_found' });
      res = json(200, { item });
    } else {
      const limit  = Math.min(Number(url.searchParams.get('limit') || 50), 200);
      const cursor = url.searchParams.get('cursor') || '';
      const rs = await fire.list('products', { orderBy: ['created_at','desc'], limit, cursor });
      res = json(200, { items: rs.items || [], nextCursor: rs.nextCursor || null });
    }
  }
  else if (req.method === 'POST' || req.method === 'PUT') {
    const body = await req.json().catch(() => ({}));
    const id = (body.id || pid || crypto.randomUUID()).toString();
    const now = new Date().toISOString();
    const prev = await fire.get('products', id);

    const item = {
      ...(prev || {}),
      id,
      name: body.name ?? prev?.name ?? '',
      description: body.description ?? prev?.description ?? '',
      category: body.category ?? prev?.category ?? 'default',
      price: Number(body.price ?? prev?.price ?? 0),
      sale_price: Number(body.sale_price ?? prev?.sale_price ?? 0),
      stock: Number(body.stock ?? prev?.stock ?? 0),
      weight: Number(body.weight ?? prev?.weight ?? 0),
      images: Array.isArray(body.images) ? body.images : (prev?.images || []),
      videos: Array.isArray(body.videos) ? body.videos : (prev?.videos || []),
      alt_images: Array.isArray(body.alt_images) ? body.alt_images : (prev?.alt_images || []),
      variants: Array.isArray(body.variants) ? body.variants : (prev?.variants || []),
      seo: body.seo ?? prev?.seo ?? {},
      faq: Array.isArray(body.faq) ? body.faq : (prev?.faq || []),
      reviews: Array.isArray(body.reviews) ? body.reviews : (prev?.reviews || []),
      is_active: body.is_active != null ? !!body.is_active : !!prev?.is_active,
      created_at: prev?.created_at || now,
      updated_at: now,
    };
    await fire.set('products', id, item);
    res = json(200, { ok: true, item });
  }
  else if (req.method === 'DELETE') {
    const body = await req.json().catch(() => ({}));
    const id = pid || body.id;
    if (!id) return json(400, { error: 'missing_id' });
    await fire.remove('products', id);
    res = json(200, { ok: true });
  }
  else {
    res = json(405, { error: 'Method Not Allowed' });
  }
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
        const rs = await fire.list('products', {
          where: ['is_active', '==', true],
          orderBy: ['created_at', 'desc'],
          limit,
          cursor,
        });
        res = json(200, { items: rs.items || [], nextCursor: rs.nextCursor || null });
      }
      else if (url.pathname.startsWith('/products/') && req.method === 'GET') {
        const id = url.pathname.split('/').pop();
        const item = await fire.get('products', id);
        if (!item || !item.is_active) {
          res = json(404, { error: 'Not Found' });
        } else {
          res = json(200, { item });
        }
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
