// workers/shv-api/src/modules/shipping/providers.js
// API endpoint để lọc providers theo cấu hình đã lưu

import { json, errorResponse } from '../../lib/response.js';
import { getJSON } from '../../lib/kv.js';

/**
 * Lọc danh sách providers theo cấu hình enabled
 * @param {Array} providers - Danh sách providers từ SuperAI
 * @param {object} env - Worker env
 * @returns {Array} - Providers đã lọc
 */
export async function filterEnabledProviders(providers, env) {
  try {
    const settings = await getJSON(env, 'settings', {});
    const enabled = settings?.shipping?.enabled_providers || [];
    
    // Nếu chưa cấu hình hoặc mảng rỗng → cho phép tất cả
    if (!Array.isArray(enabled) || enabled.length === 0) {
      console.log('[Providers] No filter config, returning all');
      return providers;
    }

    // Set để tra nhanh
    const enabledSet = new Set(enabled.map(String));
    
    // Lọc providers
    const filtered = providers.filter(p => {
      const code = String(p.provider || p.carrier || p.code || '');
      return enabledSet.has(code);
    });

    console.log('[Providers] Filtered:', {
      total: providers.length,
      enabled: enabled.length,
      result: filtered.length
    });

    return filtered;
  } catch (error) {
    console.error('[Providers] Filter error:', error);
    // Fallback: trả về tất cả
    return providers;
  }
}

/**
 * Handle GET /shipping/providers/enabled
 * Trả về danh sách providers đang được bật
 */
export async function getEnabledProviders(req, env) {
  try {
    const settings = await getJSON(env, 'settings', {});
    const enabled = settings?.shipping?.enabled_providers || [];
    
    return json({
      ok: true,
      enabled: Array.isArray(enabled) ? enabled : [],
      count: enabled.length
    }, {}, req);
  } catch (error) {
    return errorResponse(error.message, 500, req);
  }
}