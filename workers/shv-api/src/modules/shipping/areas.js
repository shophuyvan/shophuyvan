// ===================================================================
// modules/shipping/areas.js - Province/District/Ward
// ===================================================================

import { json } from '../../lib/response.js';
import { superFetch } from './helpers.js';

export async function handle(req, env, ctx) {
  const url = new URL(req.url);
  const path = url.pathname;

  // ✅ Full areas tree (Province -> District -> Commune)
  if (path === '/public/shipping/areas' || 
      path === '/shipping/areas') {
    return getAllAreas(req, env, ctx);
  }

  // Provinces
  if (path === '/shipping/provinces' || 
      path === '/shipping/areas/province' ||
      path === '/api/addresses/province' ||
      path === '/v1/platform/areas/province') {
    return getProvinces(req, env);
  }

  // Districts
  if (path === '/shipping/districts' || 
      path === '/shipping/areas/district' ||
      path === '/api/addresses/district' ||
      path === '/v1/platform/areas/district') {
    return getDistricts(req, env);
  }

  // Wards/Communes
  if (path === '/shipping/wards' || 
      path === '/shipping/areas/commune' ||
      path === '/api/addresses/commune' ||
      path === '/v1/platform/areas/commune') {
    return getWards(req, env);
  }

  return json({ ok: false, error: 'Not found' }, { status: 404 }, req);
}

async function getProvinces(req, env) {
  try {
    const data = await superFetch(env, '/v1/platform/areas/province', { 
      method: 'GET' 
    });

    const items = normalizeAreaData(data);
    return json({ ok: true, items, data: items }, {}, req);
  } catch (e) {
    return json({ 
      ok: false, 
      error: String(e?.message || e) 
    }, { status: 500 }, req);
  }
}

async function getDistricts(req, env) {
  const url = new URL(req.url);
  const province = url.searchParams.get('province_code') || 
                  url.searchParams.get('province') || '';

  try {
    const data = await superFetch(env, 
      '/v1/platform/areas/district?province=' + encodeURIComponent(province), 
      { method: 'GET' }
    );

    const items = normalizeAreaData(data);
    return json({ ok: true, items, data: items, province }, {}, req);
  } catch (e) {
    return json({ 
      ok: false, 
      error: String(e?.message || e) 
    }, { status: 500 }, req);
  }
}

async function getWards(req, env) {
  const url = new URL(req.url);
  const district = url.searchParams.get('district_code') || 
                  url.searchParams.get('district') || '';

  try {
    const data = await superFetch(env, 
      '/v1/platform/areas/commune?district=' + encodeURIComponent(district), 
      { method: 'GET' }
    );

    const items = normalizeAreaData(data);
    return json({ ok: true, items, data: items, district }, {}, req);
  } catch (e) {
    return json({ 
      ok: false, 
      error: String(e?.message || e) 
    }, { status: 500 }, req);
  }
}

function normalizeAreaData(data) {
  const source = data?.data || data || [];
  return source.map(item => ({
    code: String(item.code || item.id || item.value || ''),
    name: item.name || item.text || ''
  }));
}

// ✅ NEW FUNCTION - Get all areas with full tree structure
/**
 * Get all areas with full tree structure
 * Route: GET /public/shipping/areas
 * Returns: { ok: true, areas: [{ code, name, province_code, districts: [...] }] }
 */
async function getAllAreas(req, env, ctx) {
  try {
    console.log('[Areas] Loading all provinces with districts...');

    // Lấy danh sách tất cả provinces
    const data = await superFetch(env, '/v1/platform/areas/province', { 
      method: 'GET' 
    });

    const provinces = data?.data || data || [];
    
    // Nếu không có dữ liệu, trả về mảng rỗng
    if (!Array.isArray(provinces) || provinces.length === 0) {
      console.warn('[Areas] No provinces data from SuperAI API');
      return json({ 
        ok: true, 
        areas: [],
        data: [] 
      }, {}, req);
    }

    console.log(`[Areas] Found ${provinces.length} provinces, loading districts...`);

    // Lấy chi tiết districts cho mỗi province (giới hạn 63 tỉnh VN)
    const areasWithDetails = await Promise.all(
      provinces.slice(0, 63).map(async (province) => {
        try {
          const provinceCode = String(province.code || province.province_code || '');
          
          if (!provinceCode) {
            console.warn('[Areas] Province missing code:', province);
            return {
              code: '',
              name: province.name || '',
              province_code: '',
              districts: []
            };
          }

          // Lấy districts cho province này
          const districtData = await superFetch(env, 
            '/v1/platform/areas/district?province=' + encodeURIComponent(provinceCode), 
            { method: 'GET' }
          );
          
          const districts = (districtData?.data || []).map(district => ({
            code: String(district.code || district.district_code || ''),
            name: district.name || '',
            district_code: String(district.code || district.district_code || ''),
            communes: [] // Có thể load communes sau nếu cần
          }));

          return {
            code: provinceCode,
            name: province.name || '',
            province_code: provinceCode,
            districts: districts
          };

        } catch (e) {
          console.warn('[Areas] Error loading districts for province:', province.code, e.message);
          return {
            code: String(province.code || ''),
            name: province.name || '',
            province_code: String(province.code || ''),
            districts: []
          };
        }
      })
    );

    console.log('[Areas] ✅ Loaded areas successfully');

    return json({ 
      ok: true, 
      areas: areasWithDetails,
      data: areasWithDetails 
    }, {}, req);

  } catch (e) {
    console.error('[Areas] ❌ Error fetching all areas:', e);
    return json({ 
      ok: false, 
      error: String(e?.message || e),
      message: 'Không thể tải danh sách khu vực',
      areas: [],
      data: []
    }, { status: 500 }, req);
  }
}
