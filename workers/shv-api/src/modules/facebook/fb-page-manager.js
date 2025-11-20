import { json, errorResponse } from '../../lib/response.js'; // Lưu ý ../../
import { adminOK } from '../../lib/auth.js';
import { readBody } from '../../lib/utils.js';

// Lấy danh sách Fanpage đã kết nối
export async function listFanpages(req, env) {
  if (!(await adminOK(req, env))) return errorResponse('Unauthorized', 401, req);
  
  try {
    // Tạo bảng nếu chưa có (Code tạm, nên chạy migration riêng)
    await env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS fanpages (
        page_id TEXT PRIMARY KEY,
        name TEXT,
        access_token TEXT,
        auto_reply_enabled INTEGER DEFAULT 0,
        welcome_message TEXT,
        created_at INTEGER,
        updated_at INTEGER
      )
    `).run();

    const result = await env.DB.prepare('SELECT * FROM fanpages ORDER BY created_at DESC').all();
    return json({ ok: true, items: result.results || [] }, {}, req);
  } catch (e) {
    return errorResponse(e.message, 500, req);
  }
}

// Thêm hoặc Cập nhật Fanpage
export async function upsertFanpage(req, env) {
  if (!(await adminOK(req, env))) return errorResponse('Unauthorized', 401, req);
  
  try {
    const body = await readBody(req);
    const { page_id, name, access_token, auto_reply_enabled, welcome_message } = body;

    if (!page_id || !access_token) return errorResponse('Thiếu page_id hoặc access_token', 400, req);

    const now = Date.now();
    const exists = await env.DB.prepare('SELECT page_id FROM fanpages WHERE page_id = ?').bind(page_id).first();

    if (exists) {
      await env.DB.prepare(`
        UPDATE fanpages 
        SET name = ?, access_token = ?, auto_reply_enabled = ?, welcome_message = ?, updated_at = ?
        WHERE page_id = ?
      `).bind(name, access_token, auto_reply_enabled ? 1 : 0, welcome_message, now, page_id).run();
    } else {
      await env.DB.prepare(`
        INSERT INTO fanpages (page_id, name, access_token, auto_reply_enabled, welcome_message, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).bind(page_id, name, access_token, auto_reply_enabled ? 1 : 0, welcome_message, now, now).run();
    }

    return json({ ok: true, page_id, message: 'Đã lưu cấu hình Fanpage' }, {}, req);
  } catch (e) {
    return errorResponse(e.message, 500, req);
  }
}
// Lấy danh sách Fanpage từ tài khoản Facebook đang kết nối (OAuth)
export async function fetchPagesFromFacebook(req, env) {
  if (!(await adminOK(req, env))) return errorResponse('Unauthorized', 401, req);

  try {
    // 1. Lấy Token hệ thống từ bảng settings
    const setting = await env.DB.prepare("SELECT value FROM settings WHERE path = 'facebook_ads'").first();
    
    if (!setting || !setting.value) {
      return errorResponse('Chưa cấu hình Facebook Ads hoặc chưa đăng nhập Facebook trong Cài đặt.', 400, req);
    }

    const config = JSON.parse(setting.value);
    const userAccessToken = config.access_token;

    if (!userAccessToken) {
      return errorResponse('Thiếu Access Token. Vui lòng vào tab Cài đặt -> Login Facebook lại.', 400, req);
    }

    // 2. Gọi Graph API để lấy danh sách Page
    // ✅ FIX: Dùng v19.0 và thêm fields tasks để check quyền
    const fbRes = await fetch(`https://graph.facebook.com/v19.0/me/accounts?fields=id,name,access_token,picture,tasks&limit=100&access_token=${userAccessToken}`);
    const fbData = await fbRes.json();

    // Log để debug (xem Facebook trả về gì)
    console.log('[FB Page Fetch] Data:', JSON.stringify(fbData));

    if (fbData.error) {
      console.error('FB API Error:', fbData.error);
      return errorResponse('Lỗi từ Facebook: ' + fbData.error.message, 400, req);
    }

    // 3. Trả về danh sách
    return json({ ok: true, data: fbData.data || [] }, {}, req);

  } catch (e) {
    return errorResponse(e.message, 500, req);
  }
}