// ===================================================================
// modules/shipping/areas.js - Province/District/Ward
// ===================================================================

import { json } from '../../lib/response.js';
import { superFetch } from './helpers.js';

export async function handle(req, env, ctx) {
  const url = new URL(req.url);
  const path = url.pathname;

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
