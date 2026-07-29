const encoder = new TextEncoder();
const decoder = new TextDecoder();
const ONE_DAY = 24 * 60 * 60 * 1000;
const MAX_MEDIA_BYTES = 30 * 1024 * 1024;

function json(request, payload, status = 200, headers = {}) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', ...cors(request), ...headers }
  });
}

function cors(request) {
  const origin = request.headers.get('origin') || '';
  const allowed = new Set([
    'https://shophuyvan.vn',
    'https://www.shophuyvan.vn',
    'https://admin.shophuyvan.vn',
    'https://shophuyvan.pages.dev',
    'https://adminshophuyvan.pages.dev'
  ]).has(origin) || /^https:\/\/[-a-z0-9]+\.(shophuyvan|adminshophuyvan)\.pages\.dev$/i.test(origin) || /^http:\/\/localhost(:\d+)?$/.test(origin);
  return allowed ? { 'access-control-allow-origin': origin, 'access-control-allow-methods': 'GET,POST,PUT,OPTIONS', 'access-control-allow-headers': 'authorization,content-type,x-setup-code', vary: 'origin' } : {};
}

function error(request, code, status = 400) { return json(request, { ok: false, error: code }, status); }
function base64Url(bytes) { return btoa(String.fromCharCode(...new Uint8Array(bytes))).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', ''); }
function fromBase64Url(value) { const source = value.replaceAll('-', '+').replaceAll('_', '/').padEnd(Math.ceil(value.length / 4) * 4, '='); return Uint8Array.from(atob(source), (character) => character.charCodeAt(0)); }
function constantTimeEqual(left, right) { if (left.length !== right.length) return false; let same = 0; for (let i = 0; i < left.length; i += 1) same |= left.charCodeAt(i) ^ right.charCodeAt(i); return same === 0; }
function randomBase64(bytes = 24) { const value = new Uint8Array(bytes); crypto.getRandomValues(value); return base64Url(value); }

async function hashPassword(password, salt) {
  const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: fromBase64Url(salt), iterations: 60000 }, key, 256);
  return base64Url(bits);
}

async function sign(value, secret) {
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return base64Url(await crypto.subtle.sign('HMAC', key, encoder.encode(value)));
}

async function createSession(user, secret) {
  const payload = base64Url(encoder.encode(JSON.stringify({ sub: user.id, email: user.email, exp: Date.now() + ONE_DAY })));
  return `${payload}.${await sign(payload, secret)}`;
}

async function requireUser(request, env) {
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || '';
  const [payload, signature] = token.split('.');
  if (!payload || !signature || !env.JWT_SECRET || !constantTimeEqual(signature, await sign(payload, env.JWT_SECRET))) return null;
  try {
    const data = JSON.parse(decoder.decode(fromBase64Url(payload)));
    if (!data?.sub || !data?.email || Number(data.exp) < Date.now()) return null;
    const user = await env.DB.prepare('SELECT id, email FROM website_admin_users WHERE id = ? AND email = ?').bind(data.sub, data.email).first();
    return user || null;
  } catch { return null; }
}

async function parseBody(request) {
  const contentType = request.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    const raw = await request.text();
    try { return raw ? JSON.parse(raw) : {}; } catch { return {}; }
  }
  return {};
}

function validEmail(email) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email); }
function cleanText(value, max = 12000) { return String(value ?? '').trim().slice(0, max); }
function sanitizeOverride(input) {
  return {
    display_title: cleanText(input.display_title, 240),
    category: cleanText(input.category, 120),
    display_price: cleanText(input.display_price, 40),
    primary_image: cleanText(input.primary_image, 2000),
    video_url: cleanText(input.video_url, 2000),
    variants: cleanText(input.variants, 5000),
    short_description: cleanText(input.short_description, 1500),
    description: cleanText(input.description, 20000),
    published: input.published !== false
  };
}

async function setupStatus(request, env) {
  const row = await env.DB.prepare('SELECT COUNT(*) AS count FROM website_admin_users').first();
  return json(request, { ok: true, needs_setup: Number(row?.count || 0) === 0 });
}

async function setup(request, env) {
  if (!env.SETUP_CODE) return error(request, 'setup_not_configured', 503);
  if (!constantTimeEqual(request.headers.get('x-setup-code') || '', env.SETUP_CODE.trim())) return error(request, 'invalid_setup_code', 401);
  const current = await env.DB.prepare('SELECT COUNT(*) AS count FROM website_admin_users').first();
  if (Number(current?.count || 0) > 0) return error(request, 'setup_already_completed', 409);
  const body = await parseBody(request);
  const email = cleanText(body.email, 160).toLowerCase();
  const password = String(body.password || '');
  if (!validEmail(email) || password.length < 12) return error(request, 'invalid_email_or_password', 422);
  const salt = randomBase64(16);
  const hash = await hashPassword(password, salt);
  await env.DB.prepare('INSERT INTO website_admin_users (email, password_salt, password_hash) VALUES (?, ?, ?)').bind(email, salt, hash).run();
  return json(request, { ok: true }, 201);
}

async function login(request, env) {
  if (!env.JWT_SECRET) return error(request, 'auth_not_configured', 503);
  const body = await parseBody(request);
  const email = cleanText(body.email, 160).toLowerCase();
  const password = String(body.password || '');
  const user = await env.DB.prepare('SELECT * FROM website_admin_users WHERE email = ?').bind(email).first();
  if (!user || !constantTimeEqual(await hashPassword(password, user.password_salt), user.password_hash)) return error(request, 'invalid_credentials', 401);
  const safeUser = { id: user.id, email: user.email };
  return json(request, { ok: true, user: safeUser, token: await createSession(safeUser, env.JWT_SECRET) });
}

async function changePassword(request, env, user) {
  const body = await parseBody(request);
  const oldPassword = String(body.old_password || '');
  const newPassword = String(body.new_password || '');
  if (newPassword.length < 12) return error(request, 'password_too_short', 422);
  const stored = await env.DB.prepare('SELECT * FROM website_admin_users WHERE id = ?').bind(user.id).first();
  if (!stored || !constantTimeEqual(await hashPassword(oldPassword, stored.password_salt), stored.password_hash)) return error(request, 'invalid_credentials', 401);
  const salt = randomBase64(16);
  await env.DB.prepare('UPDATE website_admin_users SET password_salt = ?, password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').bind(salt, await hashPassword(newPassword, salt), user.id).run();
  return json(request, { ok: true });
}

async function getOverride(request, env, id) {
  const row = await env.DB.prepare('SELECT payload, updated_at FROM website_product_overrides WHERE source_id = ?').bind(id).first();
  return json(request, { ok: true, item: row ? { ...JSON.parse(row.payload), updated_at: row.updated_at } : {} });
}

async function putOverride(request, env, id) {
  const body = await parseBody(request);
  const item = sanitizeOverride(body);
  await env.DB.prepare(`INSERT INTO website_product_overrides (source_id, payload, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(source_id) DO UPDATE SET payload = excluded.payload, updated_at = CURRENT_TIMESTAMP`).bind(id, JSON.stringify(item)).run();
  return json(request, { ok: true, item });
}

function sanitizeBanner(input, index) {
  return {
    title: cleanText(input.title, 180),
    accent: cleanText(input.accent, 180),
    description: cleanText(input.description, 600),
    desktop_image: cleanText(input.desktop_image, 2000),
    mobile_image: cleanText(input.mobile_image, 2000),
    source_id: cleanText(input.source_id, 300),
    enabled: input.enabled !== false,
    sort_order: Number.isInteger(Number(input.sort_order)) ? Number(input.sort_order) : index + 1
  };
}

async function getBanners(request, env) {
  const result = await env.DB.prepare('SELECT id, sort_order, enabled, payload, updated_at FROM website_banners ORDER BY sort_order ASC, id ASC').all();
  return json(request, { ok: true, items: (result.results || []).map((row) => ({ id: row.id, ...JSON.parse(row.payload), enabled: Boolean(row.enabled), sort_order: row.sort_order, updated_at: row.updated_at })) });
}

async function putBanners(request, env) {
  const body = await parseBody(request);
  const input = Array.isArray(body.items) ? body.items.slice(0, 8) : null;
  if (!input) return error(request, 'invalid_banner_list', 422);
  const retained = [];
  for (let index = 0; index < input.length; index += 1) {
    const banner = sanitizeBanner(input[index], index);
    const existingId = Number(input[index].id);
    if (Number.isInteger(existingId) && existingId > 0) {
      await env.DB.prepare('UPDATE website_banners SET sort_order = ?, enabled = ?, payload = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').bind(banner.sort_order, banner.enabled ? 1 : 0, JSON.stringify(banner), existingId).run();
      retained.push(existingId);
    } else {
      const result = await env.DB.prepare('INSERT INTO website_banners (sort_order, enabled, payload) VALUES (?, ?, ?)').bind(banner.sort_order, banner.enabled ? 1 : 0, JSON.stringify(banner)).run();
      retained.push(Number(result.meta.last_row_id));
    }
  }
  if (retained.length) {
    const marks = retained.map(() => '?').join(',');
    await env.DB.prepare(`DELETE FROM website_banners WHERE id NOT IN (${marks})`).bind(...retained).run();
  } else {
    await env.DB.prepare('DELETE FROM website_banners').run();
  }
  return getBanners(request, env);
}

const SETTINGS_KEYS = new Set(['brand_name', 'slogan', 'address', 'hotline', 'zalo']);

async function getSettings(request, env) {
  const result = await env.DB.prepare('SELECT key, value FROM website_settings').all();
  return json(request, { ok: true, settings: Object.fromEntries((result.results || []).map((row) => [row.key, JSON.parse(row.value)])) });
}

async function putSettings(request, env) {
  const body = await parseBody(request);
  const settings = body.settings && typeof body.settings === 'object' ? body.settings : null;
  if (!settings) return error(request, 'invalid_settings', 422);
  for (const [key, value] of Object.entries(settings)) {
    if (!SETTINGS_KEYS.has(key)) continue;
    await env.DB.prepare(`INSERT INTO website_settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP`).bind(key, JSON.stringify(cleanText(value, 600))).run();
  }
  return getSettings(request, env);
}

async function listMedia(request, env) {
  const result = await env.DB.prepare('SELECT id, media_key, media_type, filename, content_type, size_bytes, created_at FROM website_media ORDER BY id DESC LIMIT 100').all();
  const origin = new URL(request.url).origin;
  return json(request, { ok: true, items: (result.results || []).map((row) => ({ ...row, url: `${origin}/media/${encodeURIComponent(row.media_key)}` })) });
}

async function listPublicContent(request, env) {
  const [settings, banners, overrides] = await Promise.all([
    env.DB.prepare('SELECT key, value FROM website_settings').all(),
    env.DB.prepare('SELECT id, sort_order, payload FROM website_banners WHERE enabled = 1 ORDER BY sort_order ASC, id ASC').all(),
    env.DB.prepare('SELECT source_id, payload FROM website_product_overrides WHERE COALESCE(json_extract(payload, "$.published"), 1) = 1').all()
  ]);
  const settingMap = Object.fromEntries((settings.results || []).map((row) => [row.key, JSON.parse(row.value)]));
  const overrideMap = Object.fromEntries((overrides.results || []).map((row) => [row.source_id, JSON.parse(row.payload)]));
  return json(request, { ok: true, settings: settingMap, banners: (banners.results || []).map((row) => ({ id: row.id, ...JSON.parse(row.payload) })), product_overrides: overrideMap }, 200, { 'cache-control': 'public, max-age=60' });
}

async function uploadMedia(request, env) {
  if (!env.MEDIA) return error(request, 'media_storage_not_configured', 503);
  const form = await request.formData();
  const file = form.get('file');
  if (!(file instanceof File)) return error(request, 'file_required', 422);
  if (!/^image\/(png|jpeg|webp)$|^video\/(mp4|webm)$/.test(file.type) || file.size > MAX_MEDIA_BYTES) return error(request, 'unsupported_or_oversized_file', 422);
  const extension = file.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'bin';
  const key = `website-content/${new Date().toISOString().slice(0, 7)}/${crypto.randomUUID()}.${extension}`;
  await env.MEDIA.put(key, file.stream(), { httpMetadata: { contentType: file.type, cacheControl: 'public, max-age=31536000, immutable' }, customMetadata: { filename: file.name } });
  await env.DB.prepare('INSERT INTO website_media (media_key, media_type, filename, content_type, size_bytes) VALUES (?, ?, ?, ?, ?)').bind(key, file.type.startsWith('video/') ? 'video' : 'image', file.name.slice(0, 240), file.type, file.size).run();
  return json(request, { ok: true, item: { key, url: new URL(`/media/${key}`, request.url).toString(), type: file.type, filename: file.name } }, 201);
}

async function serveMedia(request, env, key) {
  if (!env.MEDIA) return error(request, 'media_storage_not_configured', 503);
  const object = await env.MEDIA.get(key);
  if (!object) return error(request, 'media_not_found', 404);
  const headers = new Headers(cors(request));
  object.writeHttpMetadata(headers);
  headers.set('etag', object.httpEtag);
  headers.set('cache-control', 'public, max-age=31536000, immutable');
  return new Response(object.body, { headers });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/$/, '') || '/';
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(request) });
    try {
      if (path === '/health') return json(request, { ok: true, service: 'shophuyvan-content-api' });
      if (path === '/v1/setup/status' && request.method === 'GET') return setupStatus(request, env);
      if (path === '/v1/setup' && request.method === 'POST') return setup(request, env);
      if (path === '/v1/session' && request.method === 'POST') return login(request, env);
      if (path === '/v1/public/content' && request.method === 'GET') return listPublicContent(request, env);
      if (path.startsWith('/media/') && request.method === 'GET') return serveMedia(request, env, decodeURIComponent(path.slice(7)));
      const user = await requireUser(request, env);
      if (!user) return error(request, 'unauthorized', 401);
      if (path === '/v1/session/me' && request.method === 'GET') return json(request, { ok: true, user });
      if (path === '/v1/password' && request.method === 'PUT') return changePassword(request, env, user);
      if (path === '/v1/media' && request.method === 'POST') return uploadMedia(request, env);
      if (path === '/v1/site/banners' && request.method === 'GET') return getBanners(request, env);
      if (path === '/v1/site/banners' && request.method === 'PUT') return putBanners(request, env);
      if (path === '/v1/site/settings' && request.method === 'GET') return getSettings(request, env);
      if (path === '/v1/site/settings' && request.method === 'PUT') return putSettings(request, env);
      if (path === '/v1/site/media' && request.method === 'GET') return listMedia(request, env);
      const match = path.match(/^\/v1\/site\/products\/(.+)$/);
      if (match && request.method === 'GET') return getOverride(request, env, decodeURIComponent(match[1]));
      if (match && request.method === 'PUT') return putOverride(request, env, decodeURIComponent(match[1]));
      return error(request, 'not_found', 404);
    } catch {
      return error(request, 'internal_error', 500);
    }
  }
};
