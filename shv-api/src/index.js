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

// >>> thêm module products
import { handleProducts } from './modules/products.js';

// -- headers helper (viết hoa chuẩn, có Vary: Origin)
const cors = (origin='*') => ({
  'Access-Control-Allow-Origin': origin,
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
  'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS',
  'Access-Control-Max-Age': '86400',
  'Vary': 'Origin',
});
const json = (status, data, headers={}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers }
  });

function requireAdmin(req, env) {
  const auth = req.headers.get('authorization') || '';
  const token = auth.replace(/^Bearer\s+/i, '').trim();
  if (!env.ADMIN_TOKEN || token !== env.ADMIN_TOKEN) {
    throw new Response('Unauthorized', { status: 401 });
  }
}

export default {
  async fetch(req, env, ctx) {
    const origin = req.headers.get('Origin') || '*';

    // 1) CORS preflight
    if (req.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors(origin) });
    }

    const url  = new URL(req.url);
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

      // ---- PUBLIC banners cho FE (không cần token) ----
      else if (url.pathname === '/banners' && req.method === 'GET') {
        const rs = await fire.list('banners', {
          where: ['is_active', '==', true],
          orderBy: ['order', 'asc'],
          limit: 20
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
      // >>> thêm route admin products
      else if (url.pathname.startsWith('/admin/products')) {
        requireAdmin(req, env);
        res = await handleProducts(req, env, fire);
      }

      // ---- pricing / orders / shipping ----
      else if (url.pathname === '/pricing/preview' && req.method === 'POST') {
        res = await handlePricing(req, env);
      }
      else if (url.pathname === '/orders' && req.method === 'POST') {
        res = await handleOrders(req, env, fire);
      }
      else if (url.pathname.startsWith('/shipping/')) {
        res = await handleShipping(req, env, fire, requireAdmin);
      }

      // ---- demo products public (giữ nguyên như bạn đang dùng) ----
      else if (url.pathname === '/products' && req.method === 'GET') {
        // demo
        res = json(200, { items: [], nextCursor: null });
      }
      else if (url.pathname.startsWith('/products/') && req.method === 'GET') {
        const id = url.pathname.split('/').pop();
        res = json(200, {
          item: {
            id,
            name: 'Demo',
            description: 'Mô tả',
            price: 100000,
            sale_price: null,
            stock: 10,
            category: 'default',
            images: [],
            image_alts: [],
            weight_grams: 0
          }
        });
      }
      else {
        res = json(404, { error: 'Not Found' });
      }

      // 2) GẮN CORS CHO MỌI RESPONSE
      const headers = new Headers(res.headers);
      Object.entries(cors(origin)).forEach(([k, v]) => headers.set(k, v));
      return new Response(res.body, { status: res.status, headers });

    } catch (e) {
      if (e instanceof Response) {
        // thêm CORS cho error Response
        const headers = new Headers(e.headers);
        Object.entries(cors(req.headers.get('Origin') || '*')).forEach(([k, v]) => headers.set(k, v));
        return new Response(e.body, { status: e.status, headers });
      }
      console.error(e);
      const r = json(500, { error: e.message || 'Server error' });
      const h = new Headers(r.headers);
      Object.entries(cors(origin)).forEach(([k, v]) => h.set(k, v));
      return new Response(r.body, { status: r.status, headers: h });
    }
  },

  async scheduled(controller, env, ctx) {
    await scheduledCron(env);
  }
};
