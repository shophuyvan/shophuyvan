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

const json = (status, data, headers={}) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json', ...cors(), ...headers } });
const cors = () => ({ 'access-control-allow-origin': '*', 'access-control-allow-headers': 'authorization,content-type', 'access-control-allow-methods': 'GET,POST,DELETE,OPTIONS' });

function requireAdmin(req, env) {
  const auth = req.headers.get('authorization') || '';
  const token = auth.replace(/^Bearer\s+/i, '').trim();
  if (!env.ADMIN_TOKEN || token !== env.ADMIN_TOKEN) throw new Response('Unauthorized', { status: 401, headers: cors() });
}

export default {
  async fetch(req, env, ctx) {
    if (req.method === 'OPTIONS') return new Response('', { headers: cors() });
    const url = new URL(req.url);
    const fire = new Fire(env);
    try {
      if (url.pathname === '/ai/health' && req.method === 'GET') return json(200, { ok: true });
      if (url.pathname === '/ai/suggest' && req.method === 'POST') return handleAI(req, env);

      if (url.pathname === '/upload/signature' && req.method === 'POST') { requireAdmin(req, env); return handleUpload(req, env); }

      if (url.pathname.startsWith('/admin/banners')) { requireAdmin(req, env); return handleBanners(req, env, fire); }
      if (url.pathname.startsWith('/admin/vouchers')) { requireAdmin(req, env); return handleVouchers(req, env, fire); }
      if (url.pathname.startsWith('/admin/users')) { requireAdmin(req, env); return handleUsers(req, env, fire); }

      if (url.pathname === '/pricing/preview' && req.method === 'POST') return handlePricing(req, env);

      if (url.pathname === '/orders' && req.method === 'POST') return handleOrders(req, env, fire);

      if (url.pathname.startsWith('/shipping/')) return handleShipping(req, env, fire, requireAdmin);

      // Demo public endpoints for FE catalog (list/one) — adjust as needed.
      if (url.pathname === '/products' && req.method === 'GET') {
        // TODO: replace with Firestore query
        return json(200, { items: [], nextCursor: null });
      }
      if (url.pathname.startsWith('/products/') && req.method === 'GET') {
        const id = url.pathname.split('/').pop();
        return json(200, { item: { id, name: 'Demo', description: 'Mô tả', price: 100000, sale_price: null, stock: 10, category: 'default', images: [], image_alts: [], weight_grams: 0 } });
      }

      return json(404, { error: 'Not Found' });
    } catch (e) {
      if (e instanceof Response) return e;
      console.error(e);
      return json(500, { error: e.message || 'Server error' });
    }
  },
  async scheduled(controller, env, ctx) {
    await scheduledCron(env);
  }
}
