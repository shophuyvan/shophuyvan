// ===================================================================
// modules/shipping/warehouses.js - Warehouse Management
// ===================================================================

import { json } from '../../lib/response.js';
import { superFetch } from './helpers.js';

export async function handle(req, env, ctx) {
  if (req.method === 'GET' || req.method === 'POST') {
    return getWarehouses(req, env);
  }

  return json({ ok: false, error: 'Method not allowed' }, { status: 405 }, req);
}

async function getWarehouses(req, env) {
  try {
    console.log('[Warehouses] 📦 Fetching warehouses from SuperAI...');
    
    const data = await superFetch(env, '/v1/platform/warehouses', { 
      method: 'GET',
      useBearer: false        // ✅ Gửi header Token:, KHÔNG dùng Bearer
    });

    console.log('[Warehouses] 📥 Response received:', {
      hasData: !!data,
      isError: data?.error,
      message: data?.message,
      dataKeys: data ? Object.keys(data) : [],
      fullData: JSON.stringify(data, null, 2)  // ✅ THÊM DÒNG NÀY
    });

    // Kiểm tra lỗi từ API
    if (data?.error || data?.message?.includes('Token') || data?.message?.includes('chưa đúng')) {
      console.error('[Warehouses] ❌ Token error:', data.message);
      return json({ 
        ok: false, 
        items: [], 
        error: data.message || 'Token không hợp lệ',
        raw: data
      }, { status: 400 }, req);
    }

    const items = normalizeWarehouses(data);
    console.log('[Warehouses] ✅ Normalized items count:', items.length);
    
    if (items.length === 0) {
      console.warn('[Warehouses] ⚠️ No warehouses found. Raw data:', JSON.stringify(data, null, 2));
    }
    
    return json({ ok: true, items, raw: data }, {}, req);
  } catch (e) {
    console.error('[Warehouses] ❌ Exception:', e);
    return json({ 
      ok: false, 
      items: [], 
      error: String(e?.message || e) 
    }, { status: 500 }, req);
  }
}

function normalizeWarehouses(data) {
  const source = [];
  const pushArray = (arr) => { 
    if (Array.isArray(arr)) source.push(...arr); 
  };

  pushArray(data);
  pushArray(data?.data);
  pushArray(data?.items);
  pushArray(data?.data?.items);
  pushArray(data?.warehouses);
  pushArray(data?.data?.warehouses);

  console.log('[Warehouses] 🔍 Raw source count:', source.length);

  return source.map(warehouse => {
    // ✅ LOG warehouse gốc để debug
    console.log('[Warehouses] 🔍 Processing warehouse:', {
      id: warehouse.id,
      code: warehouse.code,
      name: warehouse.name,
      province: warehouse.province,
      district: warehouse.district,
      commune: warehouse.commune,
      keys: Object.keys(warehouse)
    });

    return {
      id: warehouse.id || warehouse.code || '',
      name: warehouse.name || warehouse.contact_name || warehouse.wh_name || '',
      phone: warehouse.phone || warehouse.contact_phone || warehouse.wh_phone || '',
      address: warehouse.address || warehouse.addr || warehouse.wh_address || '',
      
      // ⚠️ SuperAI KHÔNG trả về province_code, chỉ có tên
      province_code: String(warehouse.province_code || warehouse.provinceId || warehouse.province_id || ''),
      province_name: warehouse.province || warehouse.province_name || '',
      
      // ⚠️ SuperAI KHÔNG trả về district_code, chỉ có tên
      district_code: String(warehouse.district_code || warehouse.districtId || warehouse.district_id || ''),
      district_name: warehouse.district || warehouse.district_name || '',
      
      // ✅ Ward code có thể có (ví dụ của bạn có "code": "27460")
      ward_code: String(warehouse.commune_code || warehouse.ward_code || warehouse.code || ''),
      ward_name: String(warehouse.commune || warehouse.ward || warehouse.ward_name || warehouse.name || '')
    };
  });
}
