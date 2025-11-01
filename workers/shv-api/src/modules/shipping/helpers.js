// ===================================================================
// modules/shipping/helpers.js - Shipping Helper Functions
// ===================================================================

import { getJSON, putJSON } from '../../lib/kv.js';

/**
 * Lấy SuperAI token (có thể đổi sang đọc từ env/settings)
 */
export async function superToken(env) {
  // TODO: thay bằng env.SUPERAI_TOKEN khi bạn đã cấu hình secret
  return "FxXOoDz2qlTN5joDCsBGQFqKmm1UNvOw7YPwkzm5".trim();
}

/**
 * Fetch SuperAI (giữ nguyên cách log/debug hiện tại)
 */
export async function superFetch(env, path, options = {}) {
  const base = 'https://api.superai.vn'; // dùng domain chính
  const token = await superToken(env);

  console.log('[superFetch] 🔑 Token retrieved:', token ? `${token.substring(0, 20)}...` : '❌ EMPTY');

  const method = (options.method || 'GET').toUpperCase();
  const headers = {
    'Accept': 'application/json',
    'Token': String(token || '').trim(),
    ...options.headers
  };

  console.log('[superFetch] 📤 Headers:', JSON.stringify(headers, null, 2));
  console.log('[superFetch] 🌐 URL:', base + path);

  const config = { method, headers };

  if (options.body !== undefined && options.body !== null) {
    if (typeof options.body === 'string') {
      config.body = options.body;
    } else {
      config.body = JSON.stringify(options.body);
      config.headers['Content-Type'] = config.headers['Content-Type'] || 'application/json';
    }
  }

  if (config.body) {
    console.log('[superFetch] 📦 Payload:', String(config.body).substring(0, 500));
  }

  try {
    const response = await fetch(base + path, config);
    const responseText = await response.text();

    console.log('[superFetch] 📥 Response status:', response.status);
    console.log('[superFetch] 📥 Response body:', (responseText || '').substring(0, 500));

    const contentType = (response.headers.get('content-type') || '').toLowerCase();
    const isJson = contentType.includes('application/json');

    if (isJson) {
      try {
        const json = responseText ? JSON.parse(responseText) : null;
        return json ?? { ok: false, status: response.status, raw: null };
      } catch (err) {
        console.warn('[superFetch] ⚠️ JSON parse failed:', err?.message);
        return { ok: false, status: response.status, raw: responseText || null };
      }
    }

    return { ok: response.ok, status: response.status, raw: responseText || null };
  } catch (e) {
    console.error('[superFetch] ❌ Error:', path, e);
    return { ok: false, status: 0, raw: String(e?.message || e) };
  }
}

// ===================================================================
// Carriers: cache danh sách & resolve carrier_code (mã số SuperAI)
// ===================================================================

const NORM = (s) => String(s || '')
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .toLowerCase().replace(/\s+/g, ' ').trim();

/**
 * Lấy danh sách carriers và cache 24h vào KV
 */
export async function getCarriersList(env) {
  const cacheKey = 'ship:carriers';
  let list = await getJSON(env, cacheKey, null, { ns: 'VANCHUYEN' });
  if (Array.isArray(list) && list.length) return list;

  const res = await superFetch(env, '/v1/platform/carriers/list', { method: 'GET' });
  const arr = Array.isArray(res?.data) ? res.data : [];
  list = arr.map(x => ({
    id: String(x.id ?? ''),
    name: String(x.name ?? ''),
    code: String(x.code ?? ''),   // SuperAI trả dạng chuỗi số (VD: '10' cho SPX)
    key: NORM(x.name)
  }));

  if (list.length) {
    await putJSON(env, cacheKey, list, { ns: 'VANCHUYEN', ttl: 86400 }); // 24h
  }
  return list;
}

/**
 * Chuẩn hoá input (tên/mã) → trả về carrier_code (chuỗi số)
 */
export async function resolveCarrierCode(env, raw) {
  const input = String(raw ?? '').trim();
  if (!input) return '';
  // FE/Admin đã lưu sẵn mã số?
  if (/^\d+$/.test(input)) return input;

  const list = await getCarriersList(env);
  const k = NORM(input);

  // 1) match tuyệt đối
  let hit = list.find(c => c.key === k);
  if (hit?.code) return String(hit.code);

  // 2) alias thường gặp
  const alias = {
    'spx': 'spx express',
    'shopee express': 'spx express',
    'best': 'best express',
    'vtp': 'viettel post',
    'viettelpost': 'viettel post',
    'ghn': 'ghn',
    'giao hang nhanh': 'ghn',
    'ninjavan': 'ninja van'
  };
  const aliasName = alias[k];
  if (aliasName) {
    hit = list.find(c => c.key === NORM(aliasName));
    if (hit?.code) return String(hit.code);
  }

  // 3) match gần đúng
  hit = list.find(c => c.key.includes(k) || k.includes(c.key));
  if (hit?.code) return String(hit.code);

  // 4) fallback an toàn → GHN ('2')
  const ghn = list.find(c => c.key === 'ghn');
  return ghn?.code || '2';
}

// ===================================================================
// Địa giới hành chính & validate
// ===================================================================

/**
 * Tra cứu mã province từ SuperAI API (có cache)
 */
export async function lookupProvinceCode(env, provinceName) {
  try {
    if (!provinceName || !provinceName.trim()) return null;

    const cacheKey = 'ship:provinces';
    
    // Thử lấy từ cache trước (TTL 7 ngày)
    let provinces = await getJSON(env, cacheKey, null, { ns: 'VANCHUYEN' });
    
    // Nếu chưa có cache, gọi API
    if (!Array.isArray(provinces) || provinces.length === 0) {
      console.log('[Helpers] 🔄 Loading provinces from SuperAI...');
      const data = await superFetch(env, '/v1/platform/areas/province', { method: 'GET' });
      provinces = Array.isArray(data?.data) ? data.data : [];
      
      // Lưu cache 7 ngày
      if (provinces.length > 0) {
        await putJSON(env, cacheKey, provinces, { ns: 'VANCHUYEN', ttl: 604800 });
        console.log('[Helpers] ✅ Cached', provinces.length, 'provinces');
      }
    }

    // Chuẩn hóa tên để so sánh
    const normalize = (s) => String(s || '')
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/^thành phố\s+/gi, '')
      .replace(/^tỉnh\s+/gi, '')
      .replace(/\s+/g, ' ')
      .trim();

    const targetName = normalize(provinceName);
    console.log('[Helpers] 🔍 Looking up province:', targetName);

    // Tìm province khớp
    const province = provinces.find(p => {
      const pName = normalize(p.name || '');
      return pName === targetName || pName.includes(targetName) || targetName.includes(pName);
    });

    if (province?.code) {
      console.log('[Helpers] ✅ Found province code:', province.code, 'for', provinceName);
      return String(province.code);
    }

    console.warn('[Helpers] ⚠️ Province not found:', provinceName);
    return null;
  } catch (error) {
    console.error('[Helpers] ❌ lookupProvinceCode error:', error);
    return null;
  }
}

/**
 * Tra cứu mã district theo tỉnh + tên quận/huyện
 */
export async function lookupDistrictCode(env, provinceCode, districtName) {
  try {
    if (!provinceCode || !districtName) return null;

    console.log(`[Helpers] 🔍 Looking up district: "${districtName}" in province: ${provinceCode}`);

    const base = 'https://api.superai.vn';
    const token = await superToken(env);
    const url = `${base}/v1/platform/areas/district?province=${provinceCode}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: { 'Accept': 'application/json', 'Token': token }
    });

    if (!response.ok) {
      console.error('[Helpers] District API error:', response.status, await response.text());
      return null;
    }

    const data = await response.json();
    if (!data?.data || !Array.isArray(data.data)) return null;

    const normalizedName = districtName.trim().toLowerCase()
      .replace(/^quận\s+/gi, '')
      .replace(/^huyện\s+/gi, '')
      .replace(/^thị\s+xã\s+/gi, '')
      .replace(/^thành\s+phố\s+/gi, '')
      .trim();

    const district = data.data.find(d => {
      const dName = (d.name || '').toLowerCase()
        .replace(/^quận\s+/gi, '')
        .replace(/^huyện\s+/gi, '')
        .replace(/^thị\s+xã\s+/gi, '')
        .replace(/^thành\s+phố\s+/gi, '')
        .trim();
      return dName === normalizedName || dName.includes(normalizedName) || normalizedName.includes(dName);
    });

    return district?.code ? String(district.code) : null;
  } catch (error) {
    console.error('[Helpers] lookupDistrictCode error:', error);
    return null;
  }
}

/**
 * Validate/sửa mã district nếu format sai
 */
export async function validateDistrictCode(env, provinceCode, districtCode, districtName) {
  const code = String(districtCode || '').trim();
  if (/^\d{3}$/.test(code)) return code;

  console.warn(`[Helpers] ⚠️ Invalid district_code: "${code}"`);
  if (districtName && districtName.trim()) {
    const lookedUpCode = await lookupDistrictCode(env, provinceCode, districtName);
    if (lookedUpCode) return lookedUpCode;
  }
  return code;
}

/**
 * Tra cứu mã commune theo district + tên phường/xã
 */
export async function lookupCommuneCode(env, districtCode, communeName) {
  try {
    if (!districtCode || !communeName) return null;

    const base = 'https://api.superai.vn';
    const token = await superToken(env);
    const url = `${base}/v1/platform/areas/commune?district=${districtCode}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: { 'Accept': 'application/json', 'Token': token }
    });

    if (!response.ok) return null;
    const data = await response.json();
    if (!data?.data || !Array.isArray(data.data)) return null;

    const normalizedName = communeName.trim().toLowerCase()
      .replace(/^phường\s+/gi, '')
      .replace(/^xã\s+/gi, '')
      .replace(/^thị\s+trấn\s+/gi, '')
      .trim();

    const commune = data.data.find(c => {
      const cName = (c.name || '').toLowerCase()
        .replace(/^phường\s+/gi, '')
        .replace(/^xã\s+/gi, '')
        .replace(/^thị\s+trấn\s+/gi, '')
        .trim();
      return cName === normalizedName || cName.includes(normalizedName) || normalizedName.includes(cName);
    });

    return commune?.code ? String(commune.code) : null;
  } catch (error) {
    console.error('[Helpers] lookupCommuneCode error:', error);
    return null;
  }
}

// ===================================================================
// Cân nặng tính phí (gross/volumetric) - giữ nguyên logic hiện tại
// ===================================================================

export function chargeableWeightGrams(body = {}, order = {}) {
  // ✅ FIX: Ưu tiên order.weight_gram (đã tính sẵn) trước
  let weight = Number(
    order.weight_gram || 
    order.weight_grams || 
    order.weight || 
    body.weight_gram || 
    body.weight || 
    body.package?.weight_grams || 
    0
  ) || 0;
  
  console.log('[chargeableWeight] Order level weight:', weight, 'g');

  const items = Array.isArray(body.items) ? body.items :
               (Array.isArray(order.items) ? order.items : []);

  if (!weight && items.length) {
    try {
      weight = items.reduce((sum, item) => {
        const w = Number(item.weight_gram || item.weight_grams || item.weight || 0);
        const qty = Number(item.qty || item.quantity || 1);
        const itemTotal = w * qty;
        // ✅ LOG chi tiết để debug
        console.log('[chargeableWeight] Item:', {
          name: item.name,
          weight_gram: item.weight_gram,
          weight_grams: item.weight_grams,
          weight: item.weight,
          qty,
          itemTotal
        });
        return sum + itemTotal;
      }, 0);
      console.log('[chargeableWeight] Total from items:', weight, 'g');
    } catch (e) {
      console.error('Weight calculation error:', e);
    }
  }

  try {
    const dim = body.package?.dim_cm || body.dim_cm || body.package?.dimensions || {};
    const L = Number(dim.l || dim.length || 0);
    const W = Number(dim.w || dim.width || 0);
    const H = Number(dim.h || dim.height || 0);

    if (L > 0 && W > 0 && H > 0) {
      const volumetric = Math.round((L * W * H) / 5000 * 1000);
      if (volumetric > weight) weight = volumetric;
    }
  } catch (e) {
    console.error('Volumetric calculation error:', e);
  }

  return Math.max(0, Math.round(weight));
}
