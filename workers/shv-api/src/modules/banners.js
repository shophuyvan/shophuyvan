// ===================================================================
// modules/banners.js - Banners Module
// ===================================================================

import { json, errorResponse } from '../lib/response.js';
import { adminOK } from '../lib/auth.js';
import { getJSON, putJSON } from '../lib/kv.js';
import { readBody } from '../lib/utils.js';

/**
 * Main handler for banner routes
 */
export async function handle(req, env, ctx) {
  const url = new URL(req.url);
  const path = url.pathname;
  const method = req.method;

  // Public: Get active banners
   if ((path === '/banners' || path === '/public/banners') && method === 'GET') {
     return getPublicBanners(req, env);
   }

  // Admin: List all banners
  if (path === '/admin/banners' && method === 'GET') {
    return listAdminBanners(req, env);
  }

  // Admin: Upsert banner
  if ((path === '/admin/banners/upsert' || 
       path === '/admin/banner' || 
       path === '/admin/banners') && method === 'POST') {
    return upsertBanner(req, env);
  }

  // Admin: Delete banner
  if ((path === '/admin/banners/delete' || 
       path === '/admin/banner/delete') && method === 'POST') {
    return deleteBanner(req, env);
  }

  return errorResponse('Route not found', 404, req);
}

/**
 * Public: Get active banners only
 */
async function getPublicBanners(req, env) {
  try {
    const list = await getJSON(env, 'banners:list', []);
    const active = list.filter(banner => banner.on !== false);
    
    return json({ ok: true, items: active }, {}, req);
  } catch (e) {
    return errorResponse(e, 500, req);
  }
}

/**
 * Admin: List all banners
 */
async function listAdminBanners(req, env) {
  if (!(await adminOK(req, env))) {
    return errorResponse('Unauthorized', 401, req);
  }

  try {
    const list = await getJSON(env, 'banners:list', []);
    return json({ ok: true, items: list }, {}, req);
  } catch (e) {
    return errorResponse(e, 500, req);
  }
}

/**
 * Admin: Create or update banner
 */
async function upsertBanner(req, env) {
  if (!(await adminOK(req, env))) {
    return errorResponse('Unauthorized', 401, req);
  }

  try {
    const banner = await readBody(req) || {};
    banner.id = banner.id || crypto.randomUUID().replace(/-/g, '');

    const list = await getJSON(env, 'banners:list', []);
    const index = list.findIndex(b => b.id === banner.id);

    if (index >= 0) {
      list[index] = banner;
    } else {
      list.unshift(banner);
    }

    await putJSON(env, 'banners:list', list);
    return json({ ok: true, data: banner }, {}, req);
  } catch (e) {
    return errorResponse(e, 500, req);
  }
}

/**
 * Admin: Delete banner
 */
async function deleteBanner(req, env) {
  if (!(await adminOK(req, env))) {
    return errorResponse('Unauthorized', 401, req);
  }

  try {
    const body = await readBody(req) || {};
    const id = body.id;

    if (!id) {
      return errorResponse('Banner ID is required', 400, req);
    }

    const list = await getJSON(env, 'banners:list', []);
    const newList = list.filter(b => b.id !== id);

    await putJSON(env, 'banners:list', newList);
    return json({ ok: true, deleted: id }, {}, req);
  } catch (e) {
    return errorResponse(e, 500, req);
  }
}