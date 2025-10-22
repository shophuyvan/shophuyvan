// ===================================================================
// modules/settings.js - Settings Module
// ===================================================================

import { json, errorResponse } from '../lib/response.js';
import { adminOK } from '../lib/auth.js';
import { getJSON, putJSON } from '../lib/kv.js';
import { readBody } from '../lib/utils.js';

/**
 * Main handler for settings routes
 */
export async function handle(req, env, ctx) {
  const url = new URL(req.url);
  const path = url.pathname;
  const method = req.method;

  // Public: Get settings
  if (path === '/public/settings' && method === 'GET') {
    return getPublicSettings(req, env);
  }

  // Admin: Upsert settings
  if (path === '/admin/settings/upsert' && method === 'POST') {
    return upsertSettings(req, env);
  }

  return errorResponse('Route not found', 404, req);
}

/**
 * Public: Get all settings
 */
async function getPublicSettings(req, env) {
  try {
    const settings = await getJSON(env, 'settings', {});
    return json({ ok: true, settings }, {}, req);
  } catch (e) {
    return errorResponse(e, 500, req);
  }
}

/**
 * Admin: Update settings (deep path support)
 */
async function upsertSettings(req, env) {
  if (!(await adminOK(req, env))) {
    return errorResponse('Unauthorized', 401, req);
  }

  try {
    const body = await readBody(req) || {};
    const current = await getJSON(env, 'settings', {});

    // Support deep path setting: {path: 'ads.fb', value: '...'}
    if (body.path) {
      setDeepValue(current, body.path, body.value);
    } 
    // Support direct data merge
    else if (body.data && typeof body.data === 'object') {
      Object.assign(current, body.data);
    }

    await putJSON(env, 'settings', current);
    return json({ ok: true, settings: current }, {}, req);
  } catch (e) {
    return errorResponse(e, 500, req);
  }
}

/**
 * Helper: Set deep object value by path string
 * Example: setDeepValue(obj, 'shipping.sender_name', 'Shop')
 */
function setDeepValue(obj, path, value) {
  const parts = String(path || '').split('.').filter(Boolean);
  let current = obj;

  while (parts.length > 1) {
    const key = parts.shift();
    current[key] = current[key] || {};
    current = current[key];
  }

  if (parts.length) {
    current[parts[0]] = value;
  }

  return obj;
}