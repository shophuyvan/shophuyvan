// workers/shv-api/src/modules/flash-pricing.js
// Module tính giá Flash Sale - dùng chung cho FE & Mini

import { json, corsHeaders } from '../lib/response.js';

// Helper chuyển đổi số an toàn
function num(v) { 
  return Math.max(0, Number(v || 0)); 
}

/**
 * Tính giá cuối cùng cho 1 variant + Flash Sale
 * @param {object} variant - { price, price_sale, sale_price }
 * @param {object} flash - { type: 'percent'|'fixed', value: number }
 * @returns {object} { final, strike }
 */
function computeFinalPriceByVariant(variant, flash) {
  const base = num(variant?.sale_price ?? variant?.price_sale ?? variant?.price);
  let final = base;

  if (flash && num(flash.value) > 0 && base > 0) {
    final = (flash.type === 'fixed')
      ? Math.max(0, base - num(flash.value))
      : Math.floor(base * (1 - num(flash.value) / 100));
  }

  return { final, strike: base };
}

/**
 * Tính MIN/MAX giá cho product (tất cả variants)
 * @param {object} product - { variants: [...] }
 * @param {object} flash - { type, value }
 * @returns {object} { minFinal, maxFinal, minStrike, maxStrike }
 */
function computeFlashPriceRangeByProduct(product, flash) {
  const vs = Array.isArray(product?.variants) ? product.variants : [];
  const rows = vs
    .map((v) => computeFinalPriceByVariant(v, flash))
    .filter((x) => x.final > 0);

  if (!rows.length) {
    return { minFinal: 0, maxFinal: 0, minStrike: 0, maxStrike: 0 };
  }

  const finals = rows.map((x) => x.final);
  const strikes = rows.map((x) => x.strike);
  
  return {
    minFinal: Math.min(...finals),
    maxFinal: Math.max(...finals),
    minStrike: Math.min(...strikes),
    maxStrike: Math.max(...strikes),
  };
}

/**
 * Router handler
 */
export async function handle(req, env, ctx) {
  const url = new URL(req.url);
  const path = url.pathname;

  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders(req)
    });
  }

  try {
    // POST /api/flash-pricing/compute - Tính giá cho 1 variant
    if (path === '/api/flash-pricing/compute' && req.method === 'POST') {
      const body = await req.json();
      const { variant, flash } = body;

      if (!variant) {
        return json({ ok: false, error: 'missing_variant' }, { status: 400 }, req);
      }

      const result = computeFinalPriceByVariant(variant, flash || null);
      return json({ ok: true, data: result }, {}, req);
    }

    // POST /api/flash-pricing/range - Tính MIN/MAX cho product
    if (path === '/api/flash-pricing/range' && req.method === 'POST') {
      const body = await req.json();
      const { product, flash } = body;

      if (!product) {
        return json({ ok: false, error: 'missing_product' }, { status: 400 }, req);
      }

      const result = computeFlashPriceRangeByProduct(product, flash || null);
      return json({ ok: true, data: result }, {}, req);
    }

    // Route không khớp
    return json({ ok: false, error: 'route_not_found' }, { status: 404 }, req);

  } catch (e) {
    console.error('[Flash Pricing] Error:', e);
    return json(
      { ok: false, error: String(e?.message || e) },
      { status: 500 },
      req
    );
  }
}