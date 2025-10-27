// File: workers/shv-api/src/modules/costs.js
// Module quản lý chi phí (lương, nhà, ads...)

import { json } from '../lib/response.js';
import { getJSON, putJSON } from '../lib/kv.js';

const COST_KEY = 'config:costs_v1';

/**
 * Main handler for /admin/costs
 */
export async function handle(req, env, ctx) {
  const method = req.method;

  try {
    if (method === 'GET') {
      return await getCosts(req, env);
    }
    
    if (method === 'POST') {
      return await saveCosts(req, env);
    }

    return json({ ok: false, error: 'Method not allowed' }, { status: 405 }, req);

  } catch (e) {
    console.error('[Costs] Error:', e);
    return json({ 
      ok: false, 
      error: 'Internal error', 
      details: e.message 
    }, { status: 500 }, req);
  }
}

/**
 * Lấy danh sách chi phí
 */
async function getCosts(req, env) {
  const costs = await getJSON(env, COST_KEY, []);
  return json({ ok: true, costs }, {}, req);
}

/**
 * Lưu danh sách chi phí
 */
async function saveCosts(req, env) {
  try {
    const { costs } = await req.json();

    if (!Array.isArray(costs)) {
      return json({ ok: false, error: 'Invalid data format' }, { status: 400 }, req);
    }

    // Validate data
    const validCosts = costs.map(c => ({
      id: c.id || Date.now(),
      name: String(c.name || 'Chi phí'),
      amount: Number(c.amount || 0),
      type: (c.type === 'monthly' || c.type === 'per_order') ? c.type : 'monthly'
    })).filter(c => c.name && c.amount > 0);

    await putJSON(env, COST_KEY, validCosts);

    return json({ ok: true, message: 'Costs saved', costs: validCosts }, {}, req);

  } catch (e) {
    console.error('[Costs] Save error:', e);
    return json({ ok: false, error: 'Failed to save costs' }, { status: 500 }, req);
  }
}

/**
 * Helper function để các module khác (như stats) gọi
 * Trả về danh sách chi phí thô
 */
export async function getCostRules(env) {
  return await getJSON(env, COST_KEY, []);
}