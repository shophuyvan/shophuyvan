// ===================================================================
// modules/shipping/helpers.js - Shipping Helper Functions
// ===================================================================

import { getJSON, putJSON } from '../../lib/kv.js';

/**
 * Get SuperAI token from settings
 */
export async function superToken(env) {
  // 1. Kiểm tra super_key trước
 if (env.SUPER_KEY && typeof env.SUPER_KEY === 'string' && env.SUPER_KEY.length > 50) {
  console.log('[superToken] ✅ Using SUPER_KEY from env');
  return env.SUPER_KEY;
}
  try {
    const settings = await getJSON(env, 'settings', {});
    const shipping = settings.shipping || {};
    
    console.log('[superToken] 🔍 Checking settings:', {
      hasShipping: !!shipping,
      hasKey: !!shipping.super_key,
      keyLength: shipping.super_key ? shipping.super_key.length : 0
    });
    
    if (shipping.super_key) {
      console.log('[superToken] ✅ Found super_key:', shipping.super_key.substring(0, 20) + '...');
      return shipping.super_key;
    }
  } catch (e) {
    console.error('[superToken] Error reading super_key:', e);
  }

  // 2. Password token flow
  try {
    const settings = await getJSON(env, 'settings', {});
    const shipping = settings.shipping || {};
    const user = shipping.super_user || '';
    const pass = shipping.super_pass || '';
    const partner = shipping.super_partner || '';

    console.log('[superToken] 🔐 Trying password flow:', {
      hasUser: !!user,
      hasPass: !!pass,
      hasPartner: !!partner
    });

    if (user && pass && partner) {
  const urls = [
    'https://dev.superai.vn/v1/platform/auth/token'
  ];

  for (const url of urls) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          username: user,
          password: pass,
          partner: partner
        })
      });

      const data = await response.json();
      const token = data?.data?.token || data?.token || '';

      if (token) {
        console.log('[superToken] ✅ Got Access Token from SuperAI');
        await putJSON(env, 'super:token', token);
        await env.SHV.put('super:token:ts', String(Date.now()));
        return token;
      } else {
        console.error('[superToken] ❌ No token field in response:', data);
      }
    } catch (e) {
      console.error('[superToken] Token fetch error:', e);
    }
  }
}

  // 3. KV cache
  try {
    const token = await getJSON(env, 'super:token', null);
    const timestamp = Number(await env.SHV.get('super:token:ts', 'text')) || 0;
    if (token && (Date.now() - timestamp) < 23 * 60 * 60 * 1000) {
      console.log('[superToken] ✅ Found cached token');
      return token;
    }
  } catch (e) {
    console.error('[superToken] Cache read error:', e);
  }

  console.error('[superToken] ❌ NO TOKEN FOUND!');
  return '';
}

/**
 * Fetch from SuperAI API
 */
export async function superFetch(env, path, options = {}) {
  const base = 'https://dev.superai.vn';
  const token = await superToken(env);

  // ✅ THÊM LOG ĐỂ DEBUG TOKEN
  console.log('[superFetch] 🔑 Token retrieved:', token ? `${token.substring(0, 20)}...` : '❌ EMPTY');

  const headers = {
    'Accept': 'application/json',
    ...options.headers
  };

  if (options.useBearer) {
    headers['Authorization'] = 'Bearer ' + token;
  } else {
    headers['Token'] = token;
  }

  // ✅ LOG HEADERS TRƯỚC KHI GỬI
  console.log('[superFetch] 📤 Headers:', JSON.stringify(headers, null, 2));
  console.log('[superFetch] 🌐 URL:', base + path);

  const config = {
    method: options.method || 'GET',
    headers
  };

  if (options.body) {
    if (typeof options.body === 'string') {
      config.body = options.body;
    } else {
      config.body = JSON.stringify(options.body);
      config.headers['Content-Type'] = 'application/json';
    }
  }

  // ✅ LOG PAYLOAD
  if (config.body) {
    console.log('[superFetch] 📦 Payload:', config.body.substring(0, 500));
  }

  try {
    const response = await fetch(base + path, config);
    const responseText = await response.text();
    
    // ✅ LOG RESPONSE
    console.log('[superFetch] 📥 Response status:', response.status);
    console.log('[superFetch] 📥 Response body:', responseText.substring(0, 500));
    
    return JSON.parse(responseText);
  } catch (e) {
    console.error('[superFetch] ❌ Error:', path, e);
    return null;
  }
}
/**
 * Tra cứu mã district chuẩn từ SuperAI API
 * @param {Object} env - Cloudflare Workers environment
 * @param {string} provinceCode - Mã tỉnh/thành (VD: '79' cho TP.HCM)
 * @param {string} districtName - Tên quận/huyện (VD: 'Quận 7', 'Huyện Bình Chánh')
 * @returns {Promise<string|null>} - Mã district chuẩn hoặc null nếu không tìm thấy
 */
export async function lookupDistrictCode(env, provinceCode, districtName) {
  try {
    if (!provinceCode || !districtName) {
      console.warn('[Helpers] lookupDistrictCode: Missing provinceCode or districtName');
      return null;
    }

    console.log(`[Helpers] 🔍 Looking up district: "${districtName}" in province: ${provinceCode}`);

    // Gọi API SuperAI để lấy danh sách quận/huyện
    const base = 'https://dev.superai.vn';
    const token = await superToken(env);
    
    const url = `${base}/v1/platform/areas/district?province_code=${provinceCode}`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Token': token
      }
    });

    if (!response.ok) {
      console.error('[Helpers] District API error:', response.status, await response.text());
      return null;
    }

    const data = await response.json();
    
    if (!data?.data || !Array.isArray(data.data)) {
      console.error('[Helpers] Invalid district API response:', data);
      return null;
    }

    // Chuẩn hóa tên để so sánh (bỏ prefix "Quận", "Huyện", "Thị xã"...)
    const normalizedName = districtName.trim().toLowerCase()
      .replace(/^quận\s+/gi, '')
      .replace(/^huyện\s+/gi, '')
      .replace(/^thị\s+xã\s+/gi, '')
      .replace(/^thành\s+phố\s+/gi, '')
      .trim();

    console.log(`[Helpers] Normalized search: "${normalizedName}"`);

    // Tìm district khớp tên
    const district = data.data.find(d => {
      const dName = (d.name || '').toLowerCase()
        .replace(/^quận\s+/gi, '')
        .replace(/^huyện\s+/gi, '')
        .replace(/^thị\s+xã\s+/gi, '')
        .replace(/^thành\s+phố\s+/gi, '')
        .trim();
      
      return dName === normalizedName || 
             dName.includes(normalizedName) || 
             normalizedName.includes(dName);
    });

    if (district && district.code) {
      console.log(`[Helpers] ✅ Found district: "${district.name}" → code: ${district.code}`);
      return String(district.code);
    }

    console.warn(`[Helpers] ⚠️ District not found: "${districtName}" in province ${provinceCode}`);
    console.log(`[Helpers] Available districts:`, data.data.map(d => `${d.name} (${d.code})`).join(', '));
    
    return null;

  } catch (error) {
    console.error('[Helpers] lookupDistrictCode error:', error);
    return null;
  }
}

/**
 * Validate và tự động sửa mã district nếu cần
 * @param {Object} env - Cloudflare Workers environment
 * @param {string} provinceCode - Mã tỉnh/thành
 * @param {string} districtCode - Mã quận/huyện hiện tại
 * @param {string} districtName - Tên quận/huyện (để tra cứu nếu code sai)
 * @returns {Promise<string>} - Mã district đã được validate/sửa
 */
export async function validateDistrictCode(env, provinceCode, districtCode, districtName) {
  const code = String(districtCode || '').trim();

  // Kiểm tra format cơ bản: 3 chữ số
  if (/^\d{3}$/.test(code)) {
    console.log(`[Helpers] ✅ District code format OK: ${code}`);
    return code;
  }

  console.warn(`[Helpers] ⚠️ Invalid district_code format: "${code}" (expected 3 digits)`);

  // Nếu có tên district, thử tra cứu
  if (districtName && districtName.trim()) {
    console.log(`[Helpers] 🔄 Attempting lookup by name: "${districtName}"`);
    const lookedUpCode = await lookupDistrictCode(env, provinceCode, districtName);
    
    if (lookedUpCode) {
      console.log(`[Helpers] ✅ Auto-corrected: "${code}" → "${lookedUpCode}" (via name lookup)`);
      return lookedUpCode;
    }
  }

  // Không tìm được, trả về code gốc và log cảnh báo
  console.error(`[Helpers] ❌ Cannot validate district_code: "${code}", keeping original value`);
  return code;
}

/**
 * Tra cứu mã commune/ward chuẩn từ SuperAI API
 * @param {Object} env - Cloudflare Workers environment
 * @param {string} districtCode - Mã quận/huyện
 * @param {string} communeName - Tên phường/xã
 * @returns {Promise<string|null>} - Mã commune chuẩn hoặc null
 */
export async function lookupCommuneCode(env, districtCode, communeName) {
  try {
    if (!districtCode || !communeName) {
      return null;
    }

    console.log(`[Helpers] 🔍 Looking up commune: "${communeName}" in district: ${districtCode}`);

    const base = 'https://dev.superai.vn';
    const token = await superToken(env);
    
    const url = `${base}/v1/platform/areas/commune?district_code=${districtCode}`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Token': token
      }
    });

    if (!response.ok) {
      console.error('[Helpers] Commune API error:', response.status);
      return null;
    }

    const data = await response.json();
    
    if (!data?.data || !Array.isArray(data.data)) {
      return null;
    }

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
      
      return cName === normalizedName || 
             cName.includes(normalizedName) || 
             normalizedName.includes(cName);
    });

    if (commune && commune.code) {
      console.log(`[Helpers] ✅ Found commune: "${commune.name}" → code: ${commune.code}`);
      return String(commune.code);
    }

    return null;

  } catch (error) {
    console.error('[Helpers] lookupCommuneCode error:', error);
    return null;
  }
}
/**
 * Calculate chargeable weight (volumetric)
 */
export function chargeableWeightGrams(body = {}, order = {}) {
  let weight = Number(order.weight_gram || body.weight_gram || body.package?.weight_grams || 0) || 0;

  // Sum from items if not provided
  const items = Array.isArray(body.items) ? body.items : 
               (Array.isArray(order.items) ? order.items : []);

  if (!weight && items.length) {
    try {
      weight = items.reduce((sum, item) => {
        const w = Number(item.weight_gram || item.weight_grams || item.weight || 0);
        const qty = Number(item.qty || item.quantity || 1);
        return sum + w * qty;
      }, 0);
    } catch (e) {
      console.error('Weight calculation error:', e);
    }
  }

  // Volumetric weight: (L*W*H)/5000 kg -> grams
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
