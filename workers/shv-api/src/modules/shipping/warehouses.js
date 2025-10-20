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
    const data = await superFetch(env, 'https://dev.superai.vn/v1/platform/warehouses', { 
      method: 'GET' 
    });

    const items = normalizeWarehouses(data);
    return json({ ok: true, items, raw: data }, {}, req);
  } catch (e) {
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

  return source.map(warehouse => ({
    id: warehouse.id || warehouse.code || '',
    name: warehouse.name || warehouse.contact_name || warehouse.wh_name || '',
    phone: warehouse.phone || warehouse.contact_phone || warehouse.wh_phone || '',
    address: warehouse.address || warehouse.addr || warehouse.wh_address || '',
    province_code: String(warehouse.province_code || warehouse.provinceId || warehouse.province_code_id || ''),
    province_name: warehouse.province || warehouse.province_name || '',
    district_code: String(warehouse.district_code || warehouse.districtId || ''),
    district_name: warehouse.district || warehouse.district_name || '',
    ward_code: String(warehouse.commune_code || warehouse.ward_code || ''),
    ward_name: String(warehouse.commune || warehouse.ward || warehouse.ward_name || '')
  }));
}
