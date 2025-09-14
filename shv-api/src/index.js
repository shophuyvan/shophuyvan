/**
 * SHV API - Worker với CORS đầy đủ (setup + login + whoami + alias /admin/me)
 * - Mọi response đều có CORS
 * - OPTIONS (preflight) trả 204
 */

const textEncoder = new TextEncoder();
function toHex(buf) {
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}
async function sha256Hex(str) {
  const data = textEncoder.encode(str);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return toHex(digest);
}

/* ---------- CORS helpers ---------- */
const ALLOWED_ORIGINS = [
  'https://adminshophuyvan.pages.dev', // Admin Pages
  // 'http://localhost:8787',          // mở nếu test local
];

function pickCorsOrigin(req) {
  const origin = req.headers.get('Origin') || '';
  // Cho phép bất kỳ origin nếu muốn: return '*'
  return ALLOWED_ORIGINS.includes(origin) ? origin : (ALLOWED_ORIGINS[0] || '*');
}
function baseCorsHeaders(origin, req) {
  const h = {
    'Access-Control-Allow-Origin': origin,
    'Vary': 'Origin',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
    'Access-Control-Allow-Headers':
      req?.headers.get('Access-Control-Request-Headers') || 'content-type,authorization,x-setup-key',
    'Access-Control-Max-Age': '86400',
    'Cache-Control': 'no-store'
  };
  return h;
}
function jsonResponse(obj, origin, status = 200, extra = {}) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: {
      ...baseCorsHeaders(origin),
      'content-type': 'application/json; charset=utf-8',
      ...extra
    }
  });
}
function textResponse(text, origin, status = 200, extra = {}) {
  return new Response(String(text), {
    status,
    headers: {
      ...baseCorsHeaders(origin),
      'content-type': 'text/plain; charset=utf-8',
      ...extra
    }
  });
}
async function handleOptions(req, origin) {
  return new Response(null, { status: 204, headers: baseCorsHeaders(origin, req) });
}
/* ---------------------------------- */

/* Body reader: chấp nhận JSON là chính; (có thể mở rộng nếu bạn muốn hỗ trợ form) */
async function readJson(req) {
  const ct = req.headers.get('content-type') || '';
  if (!ct.includes('application/json')) return null;
  try { return await req.json(); } catch { return null; }
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const { pathname } = url;
    const origin = pickCorsOrigin(request);

    // 1) Preflight
    if (request.method === 'OPTIONS') {
      return handleOptions(request, origin);
    }

    // 2) /admin/setup  (POST JSON: {u, p})  — giữ nguyên logic cũ, thêm CORS 100%
    if (request.method === 'POST' && pathname === '/admin/setup') {
      const key = request.headers.get('x-setup-key') || '';
      if (!env.SETUP_KEY) {
        return jsonResponse({ ok: false, error: 'SETUP_KEY not configured in Worker env.' }, origin, 500);
      }
      if (key !== env.SETUP_KEY) {
        return jsonResponse({ ok: false, error: 'Forbidden: invalid setup key.' }, origin, 403);
      }
      const data = await readJson(request);
      if (!data || !data.u || !data.p) {
        return jsonResponse({ ok: false, error: 'Body must be JSON: {u, p}' }, origin, 400);
      }
      const username = String(data.u).trim().toLowerCase();
      if (!/^[a-z0-9_\-.]{3,32}$/.test(username)) {
        return jsonResponse({ ok: false, error: 'Username invalid. Use 3-32 chars a-z0-9._-' }, origin, 400);
      }

      const existing = await env.AUTH_KV.get(`admin:${username}`, { type: 'json' });
      if (existing) {
        return jsonResponse({ ok: false, error: 'Admin already exists.' }, origin, 409);
      }

      const salt = crypto.getRandomValues(new Uint8Array(16));
      const saltHex = [...salt].map(b => b.toString(16).padStart(2, '0')).join('');
      const hash = await sha256Hex(saltHex + ':' + data.p);
      const rec = { username, hash, salt: saltHex, createdAt: Date.now() };
      await env.AUTH_KV.put(`admin:${username}`, JSON.stringify(rec));
      return jsonResponse({ ok: true, created: username }, origin);
    }

    // 3) /admin/login  (POST JSON: {u, p}) — nếu dùng GET sẽ trả 405 (có CORS)
    if (pathname === '/admin/login') {
      if (request.method !== 'POST') {
        return textResponse('method not allowed', origin, 405);
      }
      const data = await readJson(request);
      if (!data || !data.u || !data.p) {
        return jsonResponse({ ok: false, error: 'Body must be JSON: {u, p}' }, origin, 400);
      }
      const username = String(data.u).trim().toLowerCase();
      const rec = await env.AUTH_KV.get(`admin:${username}`, { type: 'json' });
      if (!rec) return jsonResponse({ ok: false, error: 'Sai tài khoản hoặc mật khẩu.' }, origin, 401);
      const hash = await sha256Hex(rec.salt + ':' + data.p);
      if (hash !== rec.hash) return jsonResponse({ ok: false, error: 'Sai tài khoản hoặc mật khẩu.' }, origin, 401);

      const rnd = crypto.getRandomValues(new Uint8Array(8));
      const token = (await sha256Hex(rec.username + ':' + rec.createdAt + ':' + Array.from(rnd).join('-'))).slice(0, 32);
      await env.AUTH_KV.put(
        `session:${token}`,
        JSON.stringify({ u: rec.username, t: Date.now() }),
        { expirationTtl: 60 * 60 * 24 * 7 }
      );
      return jsonResponse({ ok: true, token }, origin);
    }

    // 4) /admin/whoami + alias /admin/me
    if (request.method === 'GET' && (pathname === '/admin/whoami' || pathname === '/admin/me')) {
      const token = url.searchParams.get('token') || '';
      const sess = token ? await env.AUTH_KV.get(`session:${token}`, { type: 'json' }) : null;
      if (!sess) return jsonResponse({ ok: false, error: 'Invalid or expired token' }, origin, 401);
      return jsonResponse({ ok: true, user: sess.u }, origin);
    }

    // 5) Fallback — luôn trả CORS (hết lỗi CORS khi gọi sai route)
    return textResponse('not found', origin, 404);
  }
};
