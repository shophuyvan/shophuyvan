import { json, errorResponse } from '../../lib/response.js';
import { adminOK } from '../../lib/auth.js';
import { readBody } from '../../lib/utils.js';
import { getSetting } from '../settings.js'; // ✅ Chỉ dùng getSetting

// Lấy danh sách Fanpage đã kết nối
export async function listFanpages(req, env) {
  if (!(await adminOK(req, env))) return errorResponse('Unauthorized', 401, req);
  
  try {
    const result = await env.DB.prepare('SELECT * FROM fanpages ORDER BY created_at DESC').all();
    return json({ ok: true, items: result.results || [] }, {}, req);
  } catch (e) {
    return errorResponse(e.message, 500, req);
  }
}

// Thêm hoặc Cập nhật Fanpage (FIXED SCHEMA)
export async function upsertFanpage(req, env) {
  if (!(await adminOK(req, env))) return errorResponse('Unauthorized', 401, req);
  
  try {
    const body = await readBody(req);
    const { page_id, name, access_token, auto_reply_enabled, welcome_message } = body;

    if (!page_id) return errorResponse('Thiếu page_id', 400, req);

    const now = Date.now();

    // (Đã bỏ lưu KV thừa, Token được lưu trực tiếp vào bảng fanpages bên dưới)

    // 2. Check tồn tại trong D1
    const exists = await env.DB.prepare('SELECT page_id FROM fanpages WHERE page_id = ?').bind(page_id).first();

        if (exists) {
          // UPDATE (dùng tên cột chuẩn: page_name, reply_template)
          // Chỉ update access_token nếu có giá trị mới
    const updateQuery = access_token 
      ? `UPDATE fanpages 
         SET page_name = ?, access_token = ?, auto_reply_enabled = ?, 
             reply_template = ?, updated_at = ?, is_active = 1
         WHERE page_id = ?`
      : `UPDATE fanpages 
         SET page_name = ?, auto_reply_enabled = ?, 
             reply_template = ?, updated_at = ?, is_active = 1
         WHERE page_id = ?`;
    
    const bindValues = access_token
      ? [name, access_token, auto_reply_enabled ? 1 : 0, welcome_message || null, now, page_id]
      : [name, auto_reply_enabled ? 1 : 0, welcome_message || null, now, page_id];
    
    await env.DB.prepare(updateQuery).bind(...bindValues).run();
        } else {
          // INSERT (Thêm đầy đủ các trường mặc định)
          await env.DB.prepare(`
            INSERT INTO fanpages (
              page_id, page_name, access_token, auto_reply_enabled, 
              reply_template, website_link, is_active, 
              created_at, updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).bind(
        page_id, 
        name, 
        access_token, 
        auto_reply_enabled ? 1 : 0, 
        welcome_message || null, 
        'https://shophuyvan.vn', // Default website
        1, // is_active = true
        now, 
        now
      ).run();
    }

    return json({ ok: true, page_id, message: 'Đã lưu cấu hình Fanpage' }, {}, req);
  } catch (e) {
    console.error('[upsertFanpage] Error:', e);
    return errorResponse(e.message, 500, req);
  }
}

// Lấy danh sách Fanpage từ tài khoản Facebook đang kết nối (OAuth)
export async function fetchPagesFromFacebook(req, env) {
  if (!(await adminOK(req, env))) return errorResponse('Unauthorized', 401, req);

  try {
    // 1. ✅ Lấy Token từ bảng settings (D1)
// Lưu ý: Key chuẩn là 'facebook_ads_token' (do frontend ads_real.js lưu)
let config = await getSetting(env, 'facebook_ads_token');

// Fallback: Nếu không có, thử key cũ
if (!config) config = await getSetting(env, 'facebook_ads');
    
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

// ==========================================================
// 🚀 ROUTER FANPAGE HUB – THÊM NGAY CUỐI FILE
// ==========================================================

export async function handle(req, env, ctx) {
  const url = new URL(req.url);
  const path = url.pathname;
  const method = req.method;

  // ======================
  // 📌 ROUTES FANPAGE HUB
  // ======================

  // Danh sách fanpage
  if (path === "/facebook/page/list" && method === "GET") {
    return listFanpages(req, env);
  }

  // Thêm / sửa fanpage
  if (path === "/facebook/page/upsert" && method === "POST") {
    return upsertFanpage(req, env);
  }

  // Lấy danh sách page từ Facebook
  if (path === "/facebook/page/fetch" && method === "GET") {
    return fetchPagesFromFacebook(req, env);
  }

  // Page Info (header cho fb-page-detail.html)
  if (path === "/facebook/page/info" && method === "GET") {
    return getPageInfo(req, env);
  }

  // Page Overview
  if (path === "/facebook/page/overview" && method === "GET") {
    return getPageOverview(req, env);
  }

 // Page Settings (GET)
  if (path === "/facebook/page/settings" && method === "GET") {
    return getPageSettings(req, env);
  }

  // Lưu Settings (POST)
  if (path === "/facebook/page/save-settings" && method === "POST") {
    return savePageSettings(req, env);
  }

  // Xóa Fanpage (DELETE) - MỚI THÊM
  // Hỗ trợ cả 2 dạng URL: /facebook/page/delete?id=... hoặc pattern RESTful từ Router
  if (method === "DELETE") {
    // Lấy ID từ URL param hoặc parse từ path nếu cần
    const urlId = url.searchParams.get("page_id"); 
    // Nếu router bên ngoài truyền ID vào qua request.params (tùy implementation), ta xử lý ở đây.
    // Tuy nhiên, để đơn giản, ta sẽ dùng hàm deleteFanpage xử lý logic ID.
    return deleteFanpage(req, env);
  }

  // Không khớp route nào
  return errorResponse("Fanpage route not found", 404, req);
}

// ==========================================================
// HÀM XỬ LÝ DATABASE (CRUD)
// ==========================================================

// Xóa Fanpage khỏi D1 Database
export async function deleteFanpage(req, env) {
  if (!(await adminOK(req, env))) return errorResponse('Unauthorized', 401, req);

  try {
    const url = new URL(req.url);
    // Cố gắng lấy ID từ nhiều nguồn (Query param hoặc Path extraction)
    let pageId = url.searchParams.get("page_id"); 
    
    // Nếu không có trong query string, thử lấy từ path (ví dụ: /admin/facebook/fanpages/123456)
    if (!pageId) {
      const parts = url.pathname.split('/');
      pageId = parts[parts.length - 1]; // Lấy phần cuối cùng
    }

    if (!pageId) return errorResponse("Missing page_id", 400, req);

    // Thực thi lệnh xóa
    const res = await env.DB.prepare('DELETE FROM fanpages WHERE page_id = ?').bind(pageId).run();

    if (res.success) {
      return json({ ok: true, message: 'Đã xóa fanpage thành công' }, {}, req);
    } else {
      return errorResponse('Lỗi khi xóa từ Database', 500, req);
    }
  } catch (e) {
    console.error('[deleteFanpage] Error:', e);
    return errorResponse(e.message, 500, req);
  }
}

// ==========================================================
// 🎯 API MỚI CẦN THÊM VÀO ĐÂY – ĐẢM BẢO CÓ ĐỦ
// ==========================================================

// 1. Lấy thông tin Fanpage
export async function getPageInfo(req, env) {
  const url = new URL(req.url);
  const pageId = url.searchParams.get("page_id");
  if (!pageId) return errorResponse("Missing page_id", 400, req);

  const row = await env.DB
    .prepare("SELECT page_id, name, access_token FROM fanpages WHERE page_id = ?")
    .bind(pageId)
    .first();

  if (!row) return errorResponse("Page not found", 404, req);

  return json({
    ok: true,
    page: {
      page_id: row.page_id,
      name: row.name,
      avatar: `https://graph.facebook.com/v19.0/${row.page_id}/picture?type=large`,
      token_status: row.access_token ? "active" : "missing"
    }
  }, {}, req);
}

// 2. Tổng quan Fanpage
export async function getPageOverview(req, env) {
  const url = new URL(req.url);
  const pageId = url.searchParams.get("page_id");
  if (!pageId) return errorResponse("Missing page_id", 400, req);

  const info = await env.DB
    .prepare("SELECT access_token FROM fanpages WHERE page_id = ?")
    .bind(pageId)
    .first();

  if (!info || !info.access_token)
    return errorResponse("Missing page token", 400, req);

  const token = info.access_token;

  const postsRes = await fetch(
    `https://graph.facebook.com/v19.0/${pageId}/posts?limit=5&access_token=${token}`
  );
  const posts = await postsRes.json();

  const adsKV = await getJSON(env, `fb_ads_campaigns:${pageId}`, []);

  return json({
    ok: true,
    data: {
      posts: posts.data || [],
      ads: adsKV || []
    }
  }, {}, req);
}

// ===================================================================
// API MỚI: Lấy danh sách bài chờ đăng (Pending Posts)
// Dùng cho tab "Kho nội dung & Lên lịch"
// ===================================================================
export async function getPendingPosts(req, env) {
  // if (!(await adminOK(req, env))) return errorResponse('Unauthorized', 401, req);

  try {
    // Join bảng assignments với variants để lấy nội dung
    // Sửa lại: Bảng assignments là 'fanpage_assignments'
    const query = `
      SELECT 
        fa.id, 
        fa.fanpage_name, 
        fa.status, 
        fa.created_at,
        cv.caption, 
        cv.hashtags,
        aj.product_name
      FROM fanpage_assignments fa
      JOIN content_variants cv ON fa.variant_id = cv.id
      JOIN automation_jobs aj ON fa.job_id = aj.id
      WHERE fa.status = 'pending'
      ORDER BY fa.created_at DESC
    `;

    const results = await env.DB.prepare(query).all();

    return json({ ok: true, items: results.results || [] }, {}, req);
  } catch (e) {
    console.error('[getPendingPosts] Error:', e);
    return errorResponse(e.message, 500, req);
  }
}
