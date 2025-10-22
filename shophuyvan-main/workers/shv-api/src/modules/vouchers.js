// ===================================================================
// modules/vouchers.js - Vouchers Module
// ===================================================================

import { json, errorResponse } from '../lib/response.js';
import { adminOK } from '../lib/auth.js';
import { getJSON, putJSON } from '../lib/kv.js';
import { readBody } from '../lib/utils.js';

/**
 * Main handler for voucher routes
 */
export async function handle(req, env, ctx) {
  const url = new URL(req.url);
  const path = url.pathname;
  const method = req.method;

  // Public: Get all vouchers
  if (path === '/vouchers' && method === 'GET') {
    return getPublicVouchers(req, env);
  }

  // Admin: List all vouchers
  if (path === '/admin/vouchers/list' && method === 'GET') {
    return listAdminVouchers(req, env);
  }

  // Admin: Upsert voucher
  if (path === '/admin/vouchers/upsert' && method === 'POST') {
    return upsertVoucher(req, env);
  }

  // Admin: Delete voucher (optional, if needed)
  if (path === '/admin/vouchers/delete' && method === 'POST') {
    return deleteVoucher(req, env);
  }

  return errorResponse('Route not found', 404, req);
}

/**
 * Public: Get all vouchers
 */
async function getPublicVouchers(req, env) {
  try {
    const list = await getJSON(env, 'vouchers', []);
    return json({ items: list }, {}, req);
  } catch (e) {
    return errorResponse(e, 500, req);
  }
}

/**
 * Admin: List all vouchers
 */
async function listAdminVouchers(req, env) {
  try {
    const list = await getJSON(env, 'vouchers', []);
    return json({ items: list }, {}, req);
  } catch (e) {
    return errorResponse(e, 500, req);
  }
}

/**
 * Admin: Create or update voucher
 */
async function upsertVoucher(req, env) {
  try {
    const body = await readBody(req) || {};
    const list = await getJSON(env, 'vouchers', []);

    const code = String(body.code || '').toUpperCase();
    if (!code) {
      return errorResponse('Voucher code is required', 400, req);
    }

    const index = list.findIndex(v => 
      (v.code || '').toUpperCase() === code
    );

    const voucher = {
      code: code,
      off: Number(body.off || 0),
      on: String(body.on || 'ON'),
      description: body.description || '',
      min_order: Number(body.min_order || 0),
      max_discount: Number(body.max_discount || 0),
      expires_at: body.expires_at || null
    };

    if (index >= 0) {
      list[index] = { ...list[index], ...voucher };
    } else {
      list.push(voucher);
    }

    await putJSON(env, 'vouchers', list);
    return json({ ok: true, items: list }, {}, req);
  } catch (e) {
    return errorResponse(e, 500, req);
  }
}

/**
 * Admin: Delete voucher
 */
async function deleteVoucher(req, env) {
  if (!(await adminOK(req, env))) {
    return errorResponse('Unauthorized', 401, req);
  }

  try {
    const body = await readBody(req) || {};
    const code = String(body.code || '').toUpperCase();

    if (!code) {
      return errorResponse('Voucher code is required', 400, req);
    }

    const list = await getJSON(env, 'vouchers', []);
    const newList = list.filter(v => 
      (v.code || '').toUpperCase() !== code
    );

    await putJSON(env, 'vouchers', newList);
    return json({ ok: true, deleted: code }, {}, req);
  } catch (e) {
    return errorResponse(e, 500, req);
  }
}