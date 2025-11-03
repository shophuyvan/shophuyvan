// ===================================================================
// modules/flash-sales.js - Flash Sale Module
// Đường dẫn: workers/shv-api/src/modules/flash-sales.js
// ===================================================================

import { json, errorResponse } from '../lib/response.js';
import { adminOK } from '../lib/auth.js';
import { getJSON, putJSON } from '../lib/kv.js';
import { readBody, slugify } from '../lib/utils.js';

/**
 * Main handler for Flash Sale routes
 */
export async function handle(req, env, ctx) {
  const url = new URL(req.url);
  const path = url.pathname;
  const method = req.method;

  // ===== PUBLIC ROUTES =====
  
  // Public: Get active Flash Sale
  if (path === '/flash-sales/active' && method === 'GET') {
    return getActiveFlashSale(req, env);
  }

  // ===== ADMIN ROUTES =====
  
  // Admin: List all Flash Sales
  if (path === '/admin/flash-sales' && method === 'GET') {
    return listFlashSales(req, env);
  }

  // Admin: Get single Flash Sale
  if (path === '/admin/flash-sales/get' && method === 'GET') {
    return getFlashSale(req, env);
  }

  // Admin: Create/Update Flash Sale
  if (path === '/admin/flash-sales' && method === 'POST') {
    return upsertFlashSale(req, env);
  }

  // Admin: Delete Flash Sale
  if (path === '/admin/flash-sales/delete' && method === 'POST') {
    return deleteFlashSale(req, env);
  }

  return errorResponse('Route not found', 404, req);
}

// ===================================================================
// HELPER FUNCTIONS
// ===================================================================

/**
 * Get active Flash Sale (đang chạy)
 */
async function getActiveFlashSale(req, env) {
  try {
    const list = await getJSON(env, 'flash-sales:list', []);
    const now = Date.now();

    // Tìm Flash Sale đang active
    for (const id of list) {
      const fs = await getJSON(env, `flash-sale:${id}`, null);
      if (!fs) continue;

      const start = new Date(fs.start_time).getTime();
      const end = new Date(fs.end_time).getTime();

      // Kiểm tra: đang trong thời gian + status active
      if (fs.status === 'active' && start <= now && now <= end) {
        return json({ ok: true, flash_sale: fs }, {}, req);
      }
    }

    // Không có Flash Sale nào đang chạy
    return json({ ok: true, flash_sale: null }, {}, req);
  } catch (e) {
    return errorResponse(e, 500, req);
  }
}

/**
 * Admin: List all Flash Sales
 */
async function listFlashSales(req, env) {
  if (!(await adminOK(req, env))) {
    return errorResponse('Unauthorized', 401, req);
  }

  try {
    const list = await getJSON(env, 'flash-sales:list', []);
    const items = [];

    for (const id of list) {
      const fs = await getJSON(env, `flash-sale:${id}`, null);
      if (fs) items.push(fs);
    }

    // Sort theo start_time (mới nhất trước)
    items.sort((a, b) => 
      new Date(b.start_time).getTime() - new Date(a.start_time).getTime()
    );

    return json({ ok: true, items }, {}, req);
  } catch (e) {
    return errorResponse(e, 500, req);
  }
}

/**
 * Admin: Get single Flash Sale
 */
async function getFlashSale(req, env) {
  if (!(await adminOK(req, env))) {
    return errorResponse('Unauthorized', 401, req);
  }

  const url = new URL(req.url);
  const id = url.searchParams.get('id');

  if (!id) {
    return errorResponse('Missing id parameter', 400, req);
  }

  try {
    const fs = await getJSON(env, `flash-sale:${id}`, null);
    
    if (!fs) {
      return errorResponse('Flash Sale not found', 404, req);
    }

    return json({ ok: true, data: fs }, {}, req);
  } catch (e) {
    return errorResponse(e, 500, req);
  }
}

/**
 * Admin: Create/Update Flash Sale
 */
async function upsertFlashSale(req, env) {
  if (!(await adminOK(req, env))) {
    return errorResponse('Unauthorized', 401, req);
  }

  try {
    const body = await readBody(req);

    // Validate required fields
    if (!body.name || !body.start_time || !body.end_time || !Array.isArray(body.products)) {
      return errorResponse('Missing required fields: name, start_time, end_time, products', 400, req);
    }

    // Generate ID if creating new
    const id = body.id || `flash_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const now = new Date().toISOString();

    const flashSale = {
      id,
      name: body.name,
      description: body.description || '',
      start_time: body.start_time,
      end_time: body.end_time,
      status: body.status || 'active',
      products: body.products, // Array of { product_id, discount_type, discount_value, stock_limit }
      created_at: body.created_at || now,
      updated_at: now,
      created_by: body.created_by || 'admin'
    };

    // Validate products
    for (const p of flashSale.products) {
      if (!p.product_id || !p.discount_type || !p.discount_value) {
        return errorResponse('Invalid product config: missing product_id, discount_type, or discount_value', 400, req);
      }
      if (!['percent', 'fixed'].includes(p.discount_type)) {
        return errorResponse('discount_type must be "percent" or "fixed"', 400, req);
      }
      // Set default stock_limit
      if (!p.stock_limit) p.stock_limit = 0; // 0 = unlimited
    }

    // Save Flash Sale
    await putJSON(env, `flash-sale:${id}`, flashSale);

    // Update list
    const list = await getJSON(env, 'flash-sales:list', []);
    if (!list.includes(id)) {
      list.push(id);
      await putJSON(env, 'flash-sales:list', list);
    }

    console.log('✅ Flash Sale saved:', id);

    return json({ ok: true, data: flashSale }, {}, req);
  } catch (e) {
    console.error('❌ Flash Sale save error:', e);
    return errorResponse(e, 500, req);
  }
}

/**
 * Admin: Delete Flash Sale
 */
async function deleteFlashSale(req, env) {
  if (!(await adminOK(req, env))) {
    return errorResponse('Unauthorized', 401, req);
  }

  try {
    const body = await readBody(req);
    const id = body.id;

    if (!id) {
      return errorResponse('Flash Sale ID is required', 400, req);
    }

    // Delete from KV
    await env.SHV.delete(`flash-sale:${id}`);

    // Update list
    const list = await getJSON(env, 'flash-sales:list', []);
    const newList = list.filter(fsId => fsId !== id);
    await putJSON(env, 'flash-sales:list', newList);

    return json({ ok: true, deleted: id }, {}, req);
  } catch (e) {
    return errorResponse(e, 500, req);
  }
}

console.log('✅ flash-sales.js loaded');