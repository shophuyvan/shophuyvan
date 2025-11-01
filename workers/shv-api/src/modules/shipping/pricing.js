
// ===================================================================
// modules/shipping/pricing.js - Shipping Price/Quote
// ===================================================================

import { json, errorResponse } from '../../lib/response.js';
import { getJSON } from '../../lib/kv.js';
import { readBody } from '../../lib/utils.js';
import { superFetch } from './helpers.js';
import { filterEnabledProviders } from './providers.js';

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

  // NEW: POST /shipping/weight
  if (path === '/shipping/weight' && req.method === 'POST') {
    return getShippingWeight(req, env);
  }

  return json({ ok: false, error: 'Not found' }, { status: 404 }, req);
}

// Main pricing endpoint
async function getShippingPrice(req, env) {
  try {
    const body = await readBody(req) || {};
    const settings = await getJSON(env, 'settings', {});
    const shipping = settings.shipping || {};

    // Import helper
    const { lookupProvinceCode } = await import('./helpers.js');

    // ✅ LUÔN tra cứu mã từ tên để đảm bảo đúng format SuperAI
    const provinceName = String(shipping.sender_province || 'Thành phố Hồ Chí Minh');
    console.log('[ShippingPrice] 🔍 Resolving province:', provinceName);
    
    let senderProvince = await lookupProvinceCode(env, provinceName);
    
    // ✅ Nếu không tìm thấy, thử dùng mã có sẵn hoặc fallback
    if (!senderProvince) {
      senderProvince = String(
        body.sender_province_code || 
        shipping.sender_province_code || 
        '79'
      );
      console.warn('[ShippingPrice] ⚠️ Lookup failed, using:', senderProvince);
    } else {
      console.log('[ShippingPrice] ✅ Resolved sender_province:', provinceName, '→', senderProvince);
    }
    
    const senderDistrict = String(
      body.sender_district_code || 
      shipping.sender_district_code || 
      shipping.sender_district || 
      ''
    );

    // ✅ Build payload - ƯU TIÊN warehouse_code
    const payload = {
      warehouse_code: String(shipping.warehouse_code || ''),
      receiver_province: String(body.receiver_province || body.to_province || ''),
      receiver_district: String(body.receiver_district || body.to_district || ''),
      receiver_commune: String(body.receiver_commune || body.to_ward || ''),
      weight: Number(body.weight_gram || body.weight || 0) || 0,
      value: Number(body.cod || body.value || 0) || 0,
      option_id: String(body.option_id || shipping.option_id || '1')
    };

    // ✅ CHỈ GỬI sender_province/district NẾU KHÔNG CÓ WAREHOUSE
    if (!payload.warehouse_code) {
      payload.sender_province = senderProvince;
      payload.sender_district = senderDistrict;
      console.log('[ShippingPrice] ⚠️ No warehouse_code, using sender address');
    } else {
      console.log('[ShippingPrice] ✅ Using warehouse_code:', payload.warehouse_code);
    }
      
      // Địa chỉ người nhận (MÃ)
      receiver_province: String(body.receiver_province || body.to_province || ''),
      receiver_district: String(body.receiver_district || body.to_district || ''),
      receiver_commune: String(body.receiver_commune || body.to_ward || ''),
      
      // Gói hàng
      weight: Number(body.weight_gram || body.weight || 0) || 0,
      value: Number(body.cod || body.value || 0) || 0,
      option_id: String(body.option_id || shipping.option_id || '1')
    };

    console.log('[ShippingPrice] Payload to SuperAI:', payload);
    console.log('[ShippingPrice] 🔍 DEBUG - Settings shipping:', shipping);
    console.log('[ShippingPrice] 🔍 DEBUG - Body received:', body);

    const data = await superFetch(env, '/v1/platform/orders/price', {
      method: 'POST',
      body: payload
      // headers: {} (ĐÃ XÓA)
    });

    let items = normalizeShippingRates(data);
    
    // ✅ Lọc theo cấu hình enabled providers
    items = await filterEnabledProviders(items, env);
    
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

  // Legacy Bearer-based quote disabled – using /shipping/price only
/*
  ...(giữ nguyên khối trên nhưng bọc trong comment)...
*/

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

    let items = normalizeShippingRates(data);
    
    // ✅ Lọc theo cấu hình enabled providers
    items = await filterEnabledProviders(items, env);

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
  // Trọng lượng & COD từ checkout
  weight_gram: Number(body.weight_gram || body.weight || 0) || 0,
  cod: Number(body.cod || body.value || 0) || 0,
  option_id: String(body.option_id || '1'),
  // 👇 Alias để SuperAI nhận đúng tham số
  weight: Number(body.weight_gram || body.weight || 0) || 0,
  value:  Number(body.value || body.cod || 0) || 0
};

    const data = await superFetch(env, '/v1/platform/orders/price', {
      method: 'POST',
      body: payload
    });

    let items = normalizeShippingRates(data);
    
    // ✅ Lọc theo cấu hình enabled providers
    items = await filterEnabledProviders(items, env);
    
    return json({ ok: true, data: items, used: payload }, {}, req);
  } catch (e) {
    return json({ 
      ok: false, 
      error: String(e?.message || e) 
    }, { status: 500 }, req);
  }
}

// NEW: compute total_gram từ biến thể x số lượng
async function getShippingWeight(req, env) {
  try {
    const body = await readBody(req) || {};
    const lines = Array.isArray(body.lines) ? body.lines : [];
    if (!lines.length) return json({ ok: true, total_gram: 0 }, {}, req);

    // Chuẩn hoá chuỗi: bỏ dấu + bỏ khoảng trắng + lower-case
    const norm = (s) => String(s ?? '')
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .toLowerCase().replace(/\s+/g, '').trim();

    let total = 0;

    for (const line of lines) {
      const pid  = String(line.product_id ?? line.productId ?? line.id ?? '').trim();
      const qty  = Number(line.qty ?? line.quantity ?? 1) || 1;
      if (!pid) continue;

      // 0) Nếu client đã gửi weight_gram hợp lệ → dùng luôn
      const wClient = Number(line.weight_gram ?? line.weight ?? 0) || 0;
      if (wClient > 0) { total += wClient * qty; continue; }

      // 1) Lấy sản phẩm từ KV
      // Một số client gửi product_id dạng "<id>:<text>" (ví dụ thêm tên biến thể sau dấu :)
      const pidRaw = String(pid || '').trim();
      const pidClean = pidRaw.includes(':') ? pidRaw.split(':')[0].trim() : pidRaw;

      // Thử nhiều khóa KV để lấy product
      let product =
        await getJSON(env, 'product:' + pidClean, null) ||
        await getJSON(env, 'product:' + pidRaw,   null) ||
        await getJSON(env, 'prd:'     + pidClean, null);

      if (!product) continue;

      const variants = Array.isArray(product.variants) ? product.variants : [];

      const vid   = String(line.variant_id  ?? line.variantId  ?? '').trim();
      const vsku  = String(line.variant_sku ?? line.sku        ?? '').trim();
      const vname = String(line.variant_name?? line.variantName?? '').trim();

      // 2) Tìm biến thể: id → sku → tên (không dấu)
      let match = null;

      if (vid) {
        match = variants.find(v => String(v.id ?? v._id ?? '').trim() === vid) || null;
      }
      if (!match && vsku) {
        const S = vsku.toLowerCase();
        match = variants.find(v => String(v.sku ?? v.SKU ?? '').toLowerCase() === S) || null;
      }
      if (!match && vname) {
        const target = norm(vname);
        match = variants.find(v => {
          const names = [
            v.name, v.title, v.option1, v.option2, v.option3
          ].filter(Boolean).map(norm);
          const opts = Array.isArray(v.options) ? v.options.map(norm) : [];
          return [...names, ...opts].some(n => n === target || n.includes(target) || target.includes(n));
        }) || null;
      }
      if (!match && variants.length === 1) match = variants[0];

      const w = Number(match?.weight_gram ?? match?.weight ?? 0) || 0;
      if (w > 0) total += w * qty;
    }

    return json({ ok: true, total_gram: Math.round(total) }, {}, req);
  } catch (e) {
    return errorResponse(e, 500, req);
  }
}


// Normalize shipping rates from various API responses
function normalizeShippingRates(data) {

  const arr = (data?.data && (data.data.services || data.data.items || data.data.rates)) ||
            data?.data || data || [];
  
  const items = [];
  
  const pushOne = (rate) => {
    if (!rate) return;
    
    const fee = Number(
  rate.shipment_fee ?? rate.fee ?? rate.price ?? rate.total_fee ?? rate.amount ?? 0
);
const eta = rate.estimated_delivery ?? rate.eta ?? rate.leadtime_text ?? rate.leadtime ?? '';
const provider = rate.carrier_name ?? rate.provider ?? rate.carrier ?? rate.brand ?? rate.code ?? 'dvvc';
const service_code = String(
  rate.service_code ?? rate.service ?? rate.serviceId ?? rate.carrier_id ?? ''
);
const name = rate.name ?? rate.service_name ?? rate.display ?? (rate.carrier_name || 'Dịch vụ');
    
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
