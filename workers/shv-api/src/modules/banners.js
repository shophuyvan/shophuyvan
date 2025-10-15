import { json } from '../lib/response.js';
import { adminOK } from '../lib/auth.js';
import { getJSON, putJSON } from '../lib/kv.js';
import { readBody } from '../lib/utils.js';

export async function handle(req, env, ctx) {
  const url = new URL(req.url);
  const path = url.pathname;
  const method = req.method;

  // Admin: List banners
  if (path === '/admin/banners' && method === 'GET') {
    return listBanners(req, env);
  }

  // Admin: Upsert banner
  if ((path === '/admin/banners/upsert' || 
       path === '/admin/banner') && method === 'POST') {
    return upsertBanner(req, env);
  }

  // Admin: Delete banner
  if ((path === '/admin/banners/delete' || 
       path === '/admin/banner/delete') && method === 'POST') {
    return deleteBanner(req, env);
  }

  // Public: Get active banners
  if (path === '/banners' && method === 'GET') {
    return publicBanners(req, env);
  }

  return json({ ok: false, error: 'Not found' }, { status: 404 }, req);
}

async function listBanners(req, env) {
  const list = await getJSON(env, 'banners:list', []);
  return json({ ok: true, items: list }, {}, req);
}

async function upsertBanner(req, env) {
  if (!(await adminOK(req, env))) {
    return json({ ok: false, error: 'Unauthorized' }, { status: 401 }, req);
  }

  const body = await readBody(req) || {};
  body.id = body.id || crypto.randomUUID().replace(/-/g, '');

  const list = await getJSON(env, 'banners:list', []);
  const index = list.findIndex(x => x.id === body.id);

  if (index >= 0) {
    list[index] = body;
  } else {
    list.unshift(body);
  }

  await putJSON(env, 'banners:list', list);
  return json({ ok: true, data: body }, {}, req);
}

async function deleteBanner(req, env) {
  if (!(await adminOK(req, env))) {
    return json({ ok: false, error: 'Unauthorized' }, { status: 401 }, req);
  }

  const body = await readBody(req) || {};
  const id = body.id;

  const list = await getJSON(env, 'banners:list', []);
  const newList = list.filter(x => x.id !== id);

  await putJSON(env, 'banners:list', newList);
  return json({ ok: true, deleted: id }, {}, req);
}

async function publicBanners(req, env) {
  const list = await getJSON(env, 'banners:list', []);
  const active = list.filter(x => x.on !== false);
  return json({ ok: true, items: active }, {}, req);
}