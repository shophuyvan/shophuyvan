// ===================================================================
// modules/shipping/helpers.js - Shipping Helper Functions
// ===================================================================

import { getJSON, putJSON } from '../../lib/kv.js';

/**
 * Get SuperAI token from settings
 */
export async function superToken(env) {
  try {
    const settings = await getJSON(env, 'settings', {});
    const shipping = settings.shipping || {};
    if (shipping.super_key) return shipping.super_key;
  } catch (e) {
    console.error('superToken error:', e);
  }

  // Password token flow
  try {
    const settings = await getJSON(env, 'settings', {});
    const shipping = settings.shipping || {};
    const user = shipping.super_user || '';
    const pass = shipping.super_pass || '';
    const partner = shipping.super_partner || '';

    if (user && pass && partner) {
      const urls = [
        'https://api.mysupership.vn/v1/platform/auth/token',
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
            body: JSON.stringify({ username: user, password: pass, partner })
          });

          const data = await response.json();
          const token = (data && (data.data?.token || data.token)) || '';

          if (token) {
            await putJSON(env, 'super:token', token);
            await env.SHV.put('super:token:ts', String(Date.now()));
            return token;
          }
        } catch (e) {
          console.error('Token fetch error:', e);
        }
      }
    }
  } catch (e) {
    console.error('Password flow error:', e);
  }

  // KV cache
  try {
    const token = await getJSON(env, 'super:token', null);
    const timestamp = Number(await env.SHV.get('super:token:ts', 'text')) || 0;
    if (token && (Date.now() - timestamp) < 23 * 60 * 60 * 1000) {
      return token;
    }
  } catch (e) {
    console.error('Cache read error:', e);
  }

  return '';
}

/**
 * Fetch from SuperAI API
 */
export async function superFetch(env, path, options = {}) {
  const base = 'https://api.mysupership.vn';
  const token = await superToken(env);

  const headers = {
    'Accept': 'application/json',
    ...options.headers
  };

  if (options.useBearer) {
    headers['Authorization'] = 'Bearer ' + token;
  } else {
    headers['Token'] = token;
  }

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

  try {
    const response = await fetch(base + path, config);
    return await response.json();
  } catch (e) {
    console.error('superFetch error:', path, e);
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
