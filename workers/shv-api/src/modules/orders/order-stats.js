import { adminOK } from '../../lib/auth.js';
import { getJSON } from '../../lib/kv.js';
import { json, errorResponse } from '../../lib/response.js';

export async function getStats(req, env) {
  if (!(await adminOK(req, env))) return errorResponse('Unauthorized', 401, req);

  const url = new URL(req.url);
  const granularity = (url.searchParams.get('granularity') || 'day').toLowerCase();
  let from = url.searchParams.get('from');
  let to = url.searchParams.get('to');

  const now = new Date(Date.now() + 7 * 3600 * 1000);
  const todayStart = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) - 7 * 3600 * 1000;

  if (!from || !to) {
    if (granularity === 'day') { from = todayStart; to = todayStart + 86400000; }
    else if (granularity === 'week') { const weekday = (new Date(todayStart + 7 * 3600 * 1000).getDay() + 6) % 7; const start = todayStart - weekday * 86400000; from = start; to = start + 7 * 86400000; }
    else if (granularity === 'month') { const dt = new Date(todayStart + 7 * 3600 * 1000); const start = Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth(), 1) - 7 * 3600 * 1000; const end = Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth() + 1, 1) - 7 * 3600 * 1000; from = start; to = end; }
    else { from = todayStart; to = todayStart + 86400000; }
  } else { from = Number(from); to = Number(to); }

  let list = await getJSON(env, 'orders:list', []);
  const enriched = [];
  for (const order of list) {
    if (!order.items) { const full = await getJSON(env, 'order:' + order.id, null); enriched.push(full || order); }
    else { enriched.push(order); }
  }
  list = enriched;

  let orderCount = 0, revenue = 0, goodsCost = 0;
  const topMap = {};

  for (const order of list) {
    const ts = Number(order.createdAt || order.created_at || 0);
    if (!ts || ts < from || ts >= to) continue;
    orderCount++;
    revenue += Number(order.revenue || 0);
    for (const item of (order.items || [])) {
      goodsCost += Number(item.cost || 0) * Number(item.qty || 1);
      const name = item.name || item.title || item.id || 'unknown';
      if (!topMap[name]) topMap[name] = { name, qty: 0, revenue: 0 };
      topMap[name].qty += Number(item.qty || 1);
      topMap[name].revenue += Number(item.price || 0) * Number(item.qty || 1);
    }
  }

  const tax = revenue * 0.015; const ads = revenue * 0.15; const labor = revenue * 0.10;
  const profit = Math.max(0, revenue - goodsCost - tax - ads - labor);
  const topProducts = Object.values(topMap).sort((a, b) => b.revenue - a.revenue).slice(0, 20);

  return json({ ok: true, orders: orderCount, revenue, profit, goods_cost: goodsCost, top_products: topProducts, from, to, granularity }, {}, req);
}