// ===================================================================
// modules/settings.js - Settings Module (D1 Version)
// Chuyển đổi từ KV sang D1 Database để ổn định dữ liệu
// ===================================================================

import { json, errorResponse } from '../lib/response.js';
import { adminOK } from '../lib/auth.js';
import { readBody } from '../lib/utils.js';

// ============================================================
// 1. HELPER FUNCTIONS (Dùng chung cho toàn bộ dự án)
// ============================================================

/**
 * Lấy cấu hình từ D1 (Có cache fallback nếu cần)
 * @param {Object} env - Cloudflare Env
 * @param {string} key - Key name (VD: 'facebook_ads_token')
 * @param {any} defaultValue - Giá trị mặc định nếu không tìm thấy
 */
export async function getSetting(env, key, defaultValue = null) {
  try {
    // Ưu tiên lấy từ D1
    const row = await env.DB.prepare("SELECT value_json FROM settings WHERE key_name = ?").bind(key).first();
    
    if (row && row.value_json) {
      return JSON.parse(row.value_json);
    }
    
    // (Optional Migration) Fallback: Nếu D1 chưa có, thử tìm ở KV cũ để không gãy logic cũ
    // Sau khi migrate xong có thể xóa đoạn này
    /*
    try {
        const kvVal = await env.SHV.get(`settings:${key}`);
        if (kvVal) return JSON.parse(kvVal);
    } catch(e) {}
    */

    return defaultValue;
  } catch (e) {
    console.error(`[Settings] Get error for key ${key}:`, e);
    return defaultValue;
  }
}

/**
 * Lưu cấu hình vào D1 (Upsert)
 * @param {Object} env - Cloudflare Env
 * @param {string} key - Key name
 * @param {any} value - Giá trị (Object/Array/String...)
 * @param {string} desc - Mô tả (Optional)
 */
export async function setSetting(env, key, value, desc = '') {
  try {
    const valStr = JSON.stringify(value);
    const now = Date.now();

    // Dùng UPSERT: Nếu key đã tồn tại thì Update, chưa có thì Insert
    await env.DB.prepare(`
      INSERT INTO settings (key_name, value_json, description, updated_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(key_name) DO UPDATE SET
        value_json = excluded.value_json,
        description = excluded.description,
        updated_at = excluded.updated_at
    `).bind(key, valStr, desc, now).run();

    return true;
  } catch (e) {
    console.error(`[Settings] Set error for key ${key}:`, e);
    throw e;
  }
}

// ============================================================
// 2. ROUTER HANDLERS (API Endpoint)
// ============================================================

export async function handle(req, env, ctx) {
  const url = new URL(req.url);
  const path = url.pathname;
  const method = req.method;

  // Public: Get public settings (Nếu cần)
  if (path === '/public/settings' && method === 'GET') {
    return getPublicSettings(req, env);
  }

  // Admin: Upsert settings (POST)
  if (path === '/admin/settings/upsert' && method === 'POST') {
    return upsertSettings(req, env);
  }

  // Admin: Get specific setting by path (GET)
  // Support: /admin/settings/facebook_ads
  if (path.startsWith('/admin/settings/') && method === 'GET') {
    const settingKey = path.replace('/admin/settings/', '');
    return getSettingByKey(req, env, settingKey);
  }

  return errorResponse('Route not found', 404, req);
}

/**
 * Admin: Get setting by key
 */
async function getSettingByKey(req, env, key) {
  if (!(await adminOK(req, env))) {
    return errorResponse('Unauthorized', 401, req);
  }

  try {
    // ✅ Dùng helper D1 mới
    const value = await getSetting(env, key, null);

    // Nếu D1 chưa có, thử fallback key có tiền tố 'settings:' (logic cũ) để đảm bảo không lỗi
    // (Chỉ dùng giai đoạn chuyển giao)
    /*
    if (!value) {
       const legacyValue = await getSetting(env, `settings:${key}`, null);
       if (legacyValue) return json({ ok: true, key, value: legacyValue }, {}, req);
    }
    */

    return json({
      ok: true,
      key: key,
      value: value
    }, {}, req);
  } catch (e) {
    console.error('[Settings] Get by key error:', e);
    return errorResponse(e.message, 500, req);
  }
}

/**
 * Admin: Update settings
 */
async function upsertSettings(req, env) {
  if (!(await adminOK(req, env))) {
    return errorResponse('Unauthorized', 401, req);
  }

  try {
    const body = await readBody(req) || {};

    // 1. Support path-based setting: { path: 'facebook_ads_token', value: {...}, description: '...' }
    if (body.path) {
      const key = body.path; // Giữ nguyên key, không thêm tiền tố 'settings:' nữa cho sạch
      
      // ✅ Dùng helper D1 mới
      await setSetting(env, key, body.value, body.description || `Setting for ${key}`);
      
      console.log('[Settings] Saved to D1:', key);
      
      return json({ 
        ok: true, 
        message: `Đã lưu settings cho ${key} (D1)`,
        key: key,
        value: body.value
      }, {}, req);
    } 
    
    // 2. Support direct data merge (Legacy support - có thể bỏ nếu không dùng)
    else if (body.data && typeof body.data === 'object') {
        // Logic cũ merge vào cục to 'settings' - Khuyên dùng path cụ thể hơn
        // Ở đây ta tạm thời bỏ qua hoặc map vào key 'global_settings'
        return errorResponse('Vui lòng sử dụng { path, value } để lưu settings', 400, req);
    }

    return errorResponse('Missing path or value', 400, req);
  } catch (e) {
    console.error('[Settings] Upsert error:', e);
    return errorResponse(e.message, 500, req);
  }
}

/**
 * Public: Get all settings (Ví dụ public config cho Frontend)
 */
async function getPublicSettings(req, env) {
  try {
    // Lấy key 'public_config' hoặc tương tự
    const settings = await getSetting(env, 'public_config', {});
    return json({ ok: true, settings }, {}, req);
  } catch (e) {
    return errorResponse(e.message, 500, req);
  }
}