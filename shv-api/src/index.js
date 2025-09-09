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

// >>> admin products
import { handleProducts } from './modules/products.js';

// ---- helpers ----
const cors = (origin = '*') => ({
  'Access-Control-Allow-Origin': origin,
  'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization,Content-Type',
  'Vary': 'Origin',
});

const json = (status, data, headers) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...(headers || {}) },
  });

function requireAdmin(req, env) {
  const auth = req.headers.get('Authorization') || '';
  const token = auth.replace(/^Bearer\s+/i, '').trim();
  if (!token || token !== env.ADMIN_TOKEN) {
    throw json(401, { error: 'Unauthorized' });
  }
}

export default {
  async fetch(req, env, ctx) {
    const origin = req.headers.get('Origin') || '*';
    const url = new URL(req.url);

    // ✅ Preflight cho tất cả (đặc biệt /admin/*)
    if (req.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors(origin) });
    }

    const fire = new Fire(env);

    try {
      let res; // gom tất cả các return vào biến res

      // ---- health & AI ----
      if (url.pathname === '/ai/health' && req.method === 'GET') {
        res = json(200, { ok: true });
      }
      else if (url.pathname === '/ai/suggest' && req.method === 'POST') {
        res = await handleAI(req, env);
      }

      // ---- upload signature (admin) ----
      else if (url.pathname === '/upload/signature' && req.method === 'POST') {
        requireAdmin(req, env);
        res = await handleUpload(req, env);
      }

      // ---- PUBLIC banners cho FE ----
      else if (url.pathname === '/banners' && req.method === 'GET') {
        const rs = await fire.list('banners', {
          where: ['is_active', '==', true],
          orderBy: ['order', 'asc'],
          limit: 20,
        });
        res = json(200, { items: rs.items || [] });
      }

      // ---- admin modules (yêu cầu token) ----
      else if (url.pathname.startsWith('/admin/banners')) {
        requireAdmin(req, env);
        res = await handleBanners(req, env, fire);
      }
      else if (url.pathname.startsWith('/admin/vouchers')) {
        requireAdmin(req, env);
        res = await handleVouchers(req, env, fire);
      }
      else if (url.pathname.startsWith('/admin/users')) {
        requireAdmin(req, env);
        res = await handleUsers(req, env, fire);
      }
      // >>> admin products
      else if (url.pathname.startsWith('/admin/products')) {
        requireAdmin(req, env);
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

      // ---- PUBLIC products (đọc từ Fire + hỗ trợ q, category, paging) ----
      else if (url.pathname === '/products' && req.method === 'GET') {
        const limit = Math.max(1, Math.min(200, Number(url.searchParams.get('limit') || 50)));
        const cursor = url.searchParams.get('cursor') || null;
        const category = (url.searchParams.get('category') || '').trim();
        const q = (url.searchParams.get('q') || '').trim().toLowerCase();

        const where = [['is_active', '==', true]];
        if (category) where.push(['category', '==', category]);

        let rs;
        if (q && typeof fire.search === 'function') {
          rs = await fire.search('products', {
            q, where, limit, cursor, orderBy: ['updated_at', 'desc']
          });
        } else {
          rs = await fire.list('products', {
            where, orderBy: ['updated_at', 'desc'], limit, cursor
          });
          if (q) {
            const ql = q.toLowerCase();
            const contains = (s) => (String(s || '').toLowerCase().includes(ql));
            rs.items = (rs.items || []).filter(it =>
              contains(it.name) ||
              contains(it.description) ||
              contains(it.brand) ||
              contains(it.origin)
            );
          }
        }

        res = json(200, {
          items: (rs.items || []).map(it => ({
            id: it.id,
            name: it.name,
            description: it.description,
            price: it.price,
            sale_price: it.sale_price ?? null,
            stock: it.stock,
            category: it.category,
            weight_grams: it.weight_grams,
            images: it.images || [],
            image_alts: it.image_alts || [],
            is_active: it.is_active === true,
            brand: it.brand || '',
            origin: it.origin || '',
            variants: it.variants || [],
            seo: it.seo || { title: '', description: '', keywords: '' },
            created_at: it.created_at,
            updated_at: it.updated_at,
          })),
          nextCursor: rs.nextCursor ?? null,
        });
      }
      else if (url.pathname.startsWith('/products/') && req.method === 'GET') {
        const id = url.pathname.split('/').pop();

        const item = await (typeof fire.get === 'function'
          ? fire.get('products', id)
          : (await fire.list('products', { where: [['id', '==', id]], limit: 1 }))?.items?.[0]);

        if (!item || item.is_active !== true) {
          res = json(404, { error: 'Not Found' });
        } else {
          res = json(200, {
            item: {
              id: item.id,
              name: item.name,
              description: item.description,
              price: item.price,
              sale_price: item.sale_price ?? null,
              stock: item.stock,
              category: item.category,
              weight_grams: item.weight_grams,
              images: item.images || [],
              image_alts: item.image_alts || [],
              is_active: true,
              brand: item.brand || '',
              origin: item.origin || '',
              variants: item.variants || [],
              seo: item.seo || { title: '', description: '', keywords: '' },
              created_at: item.created_at,
              updated_at: item.updated_at,
            }
          });
        }
      }
      else {
        res = json(404, { error: 'Not Found' });
      }

      // 🔗 Gắn CORS cho mọi response
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

  // Cron của bạn
  async scheduled(event, env, ctx) {
    try {
      await scheduledCron(env, ctx);
    } catch (e) {
      console.error('scheduled error:', e);
    }
  },
};
