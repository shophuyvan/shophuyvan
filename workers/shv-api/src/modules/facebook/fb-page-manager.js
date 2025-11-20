import { json, errorResponse } from '../../lib/response.js';
import { adminOK } from '../../lib/auth.js';
import { readBody } from '../../lib/utils.js';
import { getJSON, putJSON } from '../../lib/kv.js'; // ✅ Import thêm putJSON

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
    // ✅ QUAN TRỌNG: Lưu Token vào KV để Automation Worker đọc nhanh (không cần query DB)
    await putJSON(env, `fb_token:${page_id}`, access_token);

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
    // 1. ✅ Lấy Token từ KV (không phải D1)
    const config = await getJSON(env, 'settings:facebook_ads', null);
    
    if (!config || !config.access_token) {
      return errorResponse('Chưa đăng nhập Facebook. Vui lòng bấm nút "Đăng nhập Facebook" trước.', 400, req);
    }

    const userAccessToken = config.access_token;
    const userId = config.user_id; // ✅ Sửa key từ fb_user_id → user_id

    if (!userAccessToken) return errorResponse('Thiếu Access Token. Vui lòng Login lại.', 400, req);

    let allPages = [];

    // CÁCH 1: Lấy Page trực tiếp từ User (Cách cũ)
    const res1 = await fetch(`https://graph.facebook.com/v19.0/me/accounts?fields=id,name,access_token,picture,tasks&limit=100&access_token=${userAccessToken}`);
    const data1 = await res1.json();
    if (data1.data) allPages = [...allPages, ...data1.data];

    // CÁCH 2: Lấy Page từ Business Manager (Cách mới - Quét sâu hơn)
    // Nếu cách 1 không ra, thử lấy danh sách Business mà user quản lý, rồi lấy Page trong đó
    if (allPages.length === 0 && userId) {
        const resBm = await fetch(`https://graph.facebook.com/v19.0/${userId}/businesses?fields=id,name,client_pages{id,name,access_token,picture}&access_token=${userAccessToken}`);
        const dataBm = await resBm.json();
        
        if (dataBm.data) {
            dataBm.data.forEach(bm => {
                if (bm.client_pages && bm.client_pages.data) {
                    allPages = [...allPages, ...bm.client_pages.data];
                }
            });
        }
    }

    // Lọc trùng lặp
    const uniquePages = Array.from(new Map(allPages.map(p => [p.id, p])).values());

    if (uniquePages.length === 0) {
        return errorResponse('Không tìm thấy Page nào. Hãy chắc chắn bạn là Admin của Page.', 404, req);
    }

    // 3. Trả về danh sách
   return json({ ok: true, data: uniquePages }, {}, req);

  } catch (e) {
    return errorResponse(e.message, 500, req);
  }
}

// ===================================================================
// CÁC HÀM MỚI: QUẢN LÝ CẤU HÌNH AUTOMATION (Lưu trong KV)
// ===================================================================

// 3. Lấy cấu hình Automation của Page
export async function getPageSettings(req, env) {
  const url = new URL(req.url);
  const pageId = url.searchParams.get('pageId');
  
  if (!pageId) return errorResponse('Missing pageId', 400, req);

  // Mặc định cấu hình
  const defaultSettings = {
    enable_hide_phone: false,
    enable_auto_reply: false,
    reply_template: "Chào bạn, shop đã inbox báo giá chi tiết ạ! ❤️",
    website_link: "https://shophuyvan.vn"
  };

  // Lấy từ KV
  const settings = await getJSON(env, `config:fanpage:${pageId}`, defaultSettings);
  return json({ ok: true, data: settings }, {}, req);
}

// 4. Lưu cấu hình Automation
export async function savePageSettings(req, env) {
  if (!(await adminOK(req, env))) return errorResponse('Unauthorized', 401, req);
  
  const body = await readBody(req);
  const { pageId, settings } = body;

  if (!pageId || !settings) return errorResponse('Invalid data', 400, req);

  // Lưu vào KV
  await putJSON(env, `config:fanpage:${pageId}`, settings);
  
  return json({ ok: true, message: 'Đã lưu cấu hình thành công' }, {}, req);
}