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