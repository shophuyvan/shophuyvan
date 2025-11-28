import { json, errorResponse } from '../../lib/response.js';
import { adminOK } from '../../lib/auth.js';
import { readBody } from '../../lib/utils.js';
import { getSetting } from '../settings.js';

/**
 * DATABASE SCHEMA MAP (SỰ THẬT DUY NHẤT)
 * table: fanpages
 * - page_id (TEXT, PK): ID của Fanpage
 * - page_name (TEXT): Tên hiển thị
 * - access_token (TEXT): Token đăng bài
 * - auto_reply_enabled (INTEGER): 0 hoặc 1
 * - reply_template (TEXT): Nội dung mẫu
 * - website_link (TEXT): Link web
 * - is_active (INTEGER): Trạng thái hoạt động
 */

// Lấy danh sách Fanpage
export async function listFanpages(req, env) {
  if (!(await adminOK(req, env))) return errorResponse('Unauthorized', 401, req);
  try {
    const result = await env.DB.prepare('SELECT * FROM fanpages ORDER BY created_at DESC').all();
    return json({ ok: true, items: result.results || [] }, {}, req);
  } catch (e) {
    return errorResponse(e.message, 500, req);
  }
}

// ✅ HAM XỬ LÝ CHUẨN: THÊM HOẶC CẬP NHẬT (SMART MERGE)
export async function upsertFanpage(req, env) {
  if (!(await adminOK(req, env))) return errorResponse('Unauthorized', 401, req);
  
  try {
    const body = await readBody(req);
    
    // 1. Nhận dữ liệu thô từ Frontend (Cho phép nhận nhiều format để tương thích)
    const inputId = body.page_id || body.id;
    const inputName = body.page_name || body.name; // Frontend gửi 'name' hay 'page_name' đều nhận
    const inputToken = body.access_token;
    const inputAutoReply = body.auto_reply_enabled; // Có thể là true/false hoặc 1/0
    const inputTemplate = body.reply_template || body.welcome_message; // Ưu tiên reply_template
    const inputWebsite = body.website_link;

    if (!inputId) return errorResponse('Thiếu page_id (Primary Key)', 400, req);

    // 2. Lấy dữ liệu hiện tại trong Database (Snapshot)
    const existingPage = await env.DB.prepare('SELECT * FROM fanpages WHERE page_id = ?').bind(inputId).first();

    const now = Date.now();
    let query = '';
    let params = [];

    if (existingPage) {
      // === LOGIC UPDATE (SMART MERGE) ===
      // Nguyên tắc: Mới có thì dùng Mới, Mới không có thì giữ Cũ.

      // Tên Page: Nếu frontend không gửi tên, DÙNG LẠI TÊN CŨ.
      const finalName = inputName ? inputName : existingPage.page_name;
      
      // Token: Nếu frontend không gửi token, DÙNG LẠI TOKEN CŨ.
      const finalToken = inputToken ? inputToken : existingPage.access_token;

      // Auto Reply: Vì là boolean/int, cần kiểm tra kỹ undefined
      // Nếu inputAutoReply không được gửi lên (undefined), giữ nguyên giá trị cũ
      let finalAutoReply = existingPage.auto_reply_enabled; 
      if (inputAutoReply !== undefined && inputAutoReply !== null) {
        finalAutoReply = (inputAutoReply === true || inputAutoReply == 1) ? 1 : 0;
      }

      // Template: Tương tự
      const finalTemplate = inputTemplate !== undefined ? inputTemplate : existingPage.reply_template;
      const finalWebsite = inputWebsite !== undefined ? inputWebsite : existingPage.website_link;

      query = `
        UPDATE fanpages 
        SET page_name = ?, 
            access_token = ?, 
            auto_reply_enabled = ?, 
            reply_template = ?, 
            website_link = ?,
            updated_at = ?, 
            is_active = 1 
        WHERE page_id = ?
      `;
      params = [finalName, finalToken, finalAutoReply, finalTemplate, finalWebsite, now, inputId];

    } else {
      // === LOGIC INSERT (MỚI TINH) ===
      // Bắt buộc phải có tên, nếu không thì set mặc định
      const finalName = inputName || 'Unnamed Page';
      const finalToken = inputToken || null;
      const finalAutoReply = (inputAutoReply === true || inputAutoReply == 1) ? 1 : 0;
      const finalTemplate = inputTemplate || null;
      const finalWebsite = inputWebsite || 'https://shophuyvan.vn';

      query = `
        INSERT INTO fanpages (
          page_id, page_name, access_token, auto_reply_enabled, 
          reply_template, website_link, is_active, 
          created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)
      `;
      params = [inputId, finalName, finalToken, finalAutoReply, finalTemplate, finalWebsite, now, now];
    }

    // 3. Thực thi
    await env.DB.prepare(query).bind(...params).run();

    return json({ ok: true, page_id: inputId, message: 'Đã đồng bộ dữ liệu thành công' }, {}, req);

  } catch (e) {
    console.error('[upsertFanpage] Error:', e);
    return errorResponse('DB Error: ' + e.message, 500, req);
  }
}

// Lấy danh sách Fanpage từ Facebook API (OAuth)
export async function fetchPagesFromFacebook(req, env) {
  if (!(await adminOK(req, env))) return errorResponse('Unauthorized', 401, req);

  try {
    let config = await getSetting(env, 'facebook_ads_token');
    if (!config) config = await getSetting(env, 'facebook_ads');
    
    if (!config || !config.access_token) {
      return errorResponse('Chưa có Token. Vui lòng đăng nhập Facebook trước.', 400, req);
    }

    const userAccessToken = config.access_token;
    const userId = config.user_id;

    let allPages = [];

    // Cách 1: Lấy trực tiếp từ /me/accounts
    const res1 = await fetch(`https://graph.facebook.com/v19.0/me/accounts?fields=id,name,access_token,picture,tasks&limit=100&access_token=${userAccessToken}`);
    const data1 = await res1.json();
    if (data1.data) allPages = [...allPages, ...data1.data];

    // Cách 2: Lấy từ Business Manager (nếu cách 1 ít quá)
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

    // Lọc trùng lặp ID
    const uniquePages = Array.from(new Map(allPages.map(p => [p.id, p])).values());

    return json({ ok: true, data: uniquePages }, {}, req);

  } catch (e) {
    return errorResponse(e.message, 500, req);
  }
}

// Xóa Fanpage
export async function deleteFanpage(req, env) {
  if (!(await adminOK(req, env))) return errorResponse('Unauthorized', 401, req);
  try {
    const url = new URL(req.url);
    let pageId = url.searchParams.get("page_id"); 
    if (!pageId) {
      const parts = url.pathname.split('/');
      pageId = parts[parts.length - 1];
    }
    if (!pageId) return errorResponse("Missing page_id", 400, req);

    await env.DB.prepare('DELETE FROM fanpages WHERE page_id = ?').bind(pageId).run();
    return json({ ok: true, message: 'Đã xóa fanpage' }, {}, req);
  } catch (e) {
    return errorResponse(e.message, 500, req);
  }
}

// API: Lấy thông tin chi tiết Page (Header Info)
export async function getPageInfo(req, env) {
  const url = new URL(req.url);
  const pageId = url.searchParams.get("page_id");
  if (!pageId) return errorResponse("Missing page_id", 400, req);

  const row = await env.DB.prepare("SELECT page_id, page_name, access_token FROM fanpages WHERE page_id = ?").bind(pageId).first();
  if (!row) return errorResponse("Page not found", 404, req);

  return json({
    ok: true,
    page: {
      page_id: row.page_id,
      name: row.page_name, // Map về chuẩn JSON output
      avatar: `https://graph.facebook.com/v19.0/${row.page_id}/picture?type=large`,
      token_status: row.access_token ? "active" : "missing"
    }
  }, {}, req);
}

// ROUTER HANDLER
export async function handle(req, env, ctx) {
  const url = new URL(req.url);
  const path = url.pathname;
  const method = req.method;

  if (path === "/facebook/page/list" && method === "GET") return listFanpages(req, env); // Legacy
  if (path === "/admin/fanpages" && method === "GET") return listFanpages(req, env); // New Standard
  
  if (path === "/facebook/page/upsert" && method === "POST") return upsertFanpage(req, env); // Legacy
  if (path === "/admin/fanpages" && method === "POST") return upsertFanpage(req, env); // New Standard

  if (path === "/facebook/page/fetch" && method === "GET") return fetchPagesFromFacebook(req, env); // Legacy
  if (path === "/admin/fanpages/fetch-facebook" && method === "GET") return fetchPagesFromFacebook(req, env); // New Standard

  if (path === "/facebook/page/info" && method === "GET") return getPageInfo(req, env);

  if (method === "DELETE") return deleteFanpage(req, env);

  return errorResponse("Fanpage route not found", 404, req);
}