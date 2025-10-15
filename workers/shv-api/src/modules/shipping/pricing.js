// ===================================================================
// modules/shipping/pricing.js - Shipping Price/Quote
// ===================================================================

import { json, errorResponse } from '../../lib/response.js';
import { getJSON } from '../../lib/kv.js';
import { readBody } from '../../lib/utils.js';
import { superFetch } from './helpers.js';

export async function handle(req, env, ctx) {
  const url = new URL(req.url);
  const path = url.pathname;

  // POST /shipping/price
  if (path === '/shipping/price' && req.method === 'POST') {
    return getShippingPrice(req, env);
  }

  // GET /shipping/quote (legacy)
  if (path === '/shipping/quote' && req.method === 'GET') {
    return getShippingQuote(req, env);
  }

  // POST /api/shipping/quote
  if (path === '/api/shipping/quote' && req.method === 'POST') {
    return getShippingQuoteAPI(req, env);
  }

  // POST /v1/platform/orders/price (MINI proxy)
  if (path === '/v1/platform/orders/price' && req.method === 'POST') {
    return getMiniPrice(req, env);
  }

  return json({ ok: false, error: 'Not found' }, { status: 404 }, req);
}

// Main pricing endpoint
async function getShippingPrice(req, env) {
  try {
    const body = await readBody(req) || {};
    const settings = await getJSON(env, 'settings', {});
    const shipping = settings.shipping || {};

    const payload = {
      sender_province: body.sender_province || shipping.sender_province || '',
      sender_district: body.sender_district || shipping.sender_district || '',
      receiver_province: body.receiver_province || body.to_province || '',
      receiver_district: body.receiver_district || body.to_district || '',
      receiver_commune: body.receiver_commune || body.to_ward || '',
      weight_gram: Number(body.weight_gram || body.weight || 0) || 0,
      cod: Number(body.cod || 0) || 0,
      length_cm: Number(body.length_cm || 0) || 0,
      width_cm: Number(body.width_cm || 0) || 0,
      height_cm: Number(body.height_cm || 0) || 0,
      option_id: body.option_id || shipping.option_id || '1'
    };

    const data = await superFetch(env, '/v1/platform/orders/price', {
      method: 'POST',
      body: payload
    });

    const items = normalizeShippingRates(data);
    return json({ ok: true, items, raw: data }, {}, req);
  } catch (e) {
    return errorResponse(e, 500, req);
  }
}

// Legacy GET quote
async function getShippingQuote(req, env) {
  const url = new URL(req.url);
  const weight = Number(url.searchParams.get('weight') || 0);
  const to_province = url.searchParams.get('to_province') || '';
  const to_district = url.searchParams.get('to_district') || '';
  const cod = Number(url.searchParams.get('cod') || 0) || 0;

  const settings = await getJSON(env, 'settings', {});
  const bearer = settings?.shipping?.super_token || '';

  if (bearer) {
    try {
      const apiUrl = 'https://api.mysupership.vn/v1/ai/orders/superai';
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + bearer
        },
        body: JSON.stringify({
          receiver: { province: to_province, district: to_district },
          weight_gram: Math.max(0, Math.round(weight || 0)),
          cod: cod
        })
      });

      const data = await response.json();
      const items = normalizeShippingRates(data);

      if (items.length) {
        return json({ ok: true, items }, {}, req);
      }
    } catch (e) {
      console.error('SuperAI quote error:', e);
    }
  }

  // Fallback
  const unit = Math.max(1, Math.ceil((weight || 0) / 500));
  const base = 12000 + unit * 3000;
  const items = [
    { provider: 'jt', service_code: 'JT-FAST', name: 'Giao nhanh', fee: Math.round(base * 1.1), eta: '1-2 ngày' },
    { provider: 'spx', service_code: 'SPX-REG', name: 'Tiêu chuẩn', fee: Math.round(base), eta: '2-3 ngày' },
    { provider: 'aha', service_code: 'AHA-SAVE', name: 'Tiết kiệm', fee: Math.round(base * 0.9), eta: '3-5 ngày' }
  ];

  return json({ ok: true, items, to_province, to_district }, {}, req);
}

// API shipping quote
async function getShippingQuoteAPI(req, env) {
  try {
    const body = await readBody(req) || {};
    const settings = await getJSON(env, 'settings', {});
    const shipping = settings.shipping || {};

    // Derive weight
    let weight = 0;
    if (body.package?.weight_grams != null) {
      weight = Number(body.package.weight_grams) || 0;
    }
    if (!weight && Array.isArray(body.items)) {
      weight = body.items.reduce((sum, item) => 
        sum + Number(item.weight_grams || item.weight || 0) * Number(item.qty || item.quantity || 1), 0
      );
    }
    if (!weight && body.weight_grams != null) {
      weight = Number(body.weight_grams) || 0;
    }

    // Volumetric weight
    let volGrams = 0;
    const dim = body.package?.dim_cm || null;
    const L = Number(dim?.l || body.length_cm || 0);
    const W = Number(dim?.w || body.width_cm || 0);
    const H = Number(dim?.h || body.height_cm || 0);

    if (L > 0 && W > 0 && H > 0) {
      volGrams = Math.round((L * W * H) / 5000 * 1000);
    }
    if (volGrams > weight) weight = volGrams;

    const receiver = body.to || body.receiver || {};
    const payload = {
      sender_province: String(body.from?.province_code || shipping.sender_province || ''),
      sender_district: String(body.from?.district_code || shipping.sender_district || ''),
      receiver_province: String(receiver.province_code || body.to_province || ''),
      receiver_district: String(receiver.district_code || body.to_district || ''),
      receiver_commune: String(receiver.commune_code || receiver.ward_code || body.to_ward || ''),
      weight_gram: Number(weight) || 0,
      cod: Number(body.total_cod || body.cod || 0) || 0,
      option_id: String(body.option_id || shipping.option_id || '1')
    };

    const data = await superFetch(env, '/v1/platform/orders/price', {
      method: 'POST',
      body: payload
    });

    const items = normalizeShippingRates(data);

    if (items.length) {
      return json({ ok: true, items, used: payload }, {}, req);
    }

    // Fallback
    const unit = Math.max(1, Math.ceil((payload.weight_gram || 0) / 500));
    const base = 12000 + unit * 3000;
    const fallback = [
      { provider: 'jt', service_code: 'JT-FAST', name: 'Giao nhanh', fee: Math.round(base * 1.1), eta: '1-2 ngày' },
      { provider: 'spx', service_code: 'SPX-REG', name: 'Tiêu chuẩn', fee: Math.round(base), eta: '2-3 ngày' },
      { provider: 'aha', service_code: 'AHA-SAVE', name: 'Tiết kiệm', fee: Math.round(base * 0.9), eta: '3-5 ngày' }
    ];

    return json({ ok: true, items: fallback, used: payload, fallback: true }, {}, req);
  } catch (e) {
    return errorResponse(e, 500, req);
  }
}

// MINI proxy pricing
async function getMiniPrice(req, env) {
  try {
    const body = await readBody(req) || {};
    
    const payload = {
      sender_province: String(body.sender_province || body.from?.province_code || ''),
      sender_district: String(body.sender_district || body.from?.district_code || ''),
      receiver_province: String(body.receiver_province || body.to_province || body.to?.province_code || ''),
      receiver_district: String(body.receiver_district || body.to_district || body.to?.district_code || ''),
      receiver_commune: String(body.receiver_commune || body.to_ward || body.to?.commune_code || body.to?.ward_code || ''),
      weight_gram: Number(body.weight_gram || body.weight || 0) || 0,
      cod: Number(body.cod || 0) || 0,
      option_id: String(body.option_id || '1')
    };

    const data = await superFetch(env, '/v1/platform/orders/price', {
      method: 'POST',
      body: payload
    });

    const items = normalizeShippingRates(data);
    return json({ ok: true, data: items, used: payload }, {}, req);
  } catch (e) {
    return json({ 
      ok: false, 
      error: String(e?.message || e) 
    }, { status: 500 }, req);
  }
}

// Normalize shipping rates from various API responses
function normalizeShippingRates(data) {
  const arr = (data?.data && (data.data.items || data.data.rates)) || 
              data?.data || data || [];
  
  const items = [];
  
  const pushOne = (rate) => {
    if (!rate) return;
    
    const fee = Number(rate.fee ?? rate.price ?? rate.total_fee ?? rate.amount ?? 0);
    const eta = rate.eta ?? rate.leadtime_text ?? rate.leadtime ?? '';
    const provider = rate.provider ?? rate.carrier ?? rate.brand ?? rate.code ?? 'dvvc';
    const service_code = rate.service_code ?? rate.service ?? rate.serviceId ?? '';
    const name = rate.name ?? rate.service_name ?? rate.display ?? 'Dịch vụ';
    
    if (fee > 0) {
      items.push({ provider, service_code, name, fee, eta });
    }
  };

  if (Array.isArray(arr)) {
    arr.forEach(pushOne);
  } else {
    pushOne(arr);
  }

  return items;
}
