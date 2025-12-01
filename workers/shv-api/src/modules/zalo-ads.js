// workers/shv-api/src/modules/zalo-ads.js
import { json, errorResponse } from '../lib/response.js';

// Cấu hình Zalo Ads API
const ZALO_AUTH_URL = 'https://oauth.zalo.me/v4/permission';
const ZALO_TOKEN_URL = 'https://oauth.zalo.me/v4/access_token';
const ZALO_API_BASE = 'https://ads-openapi.zalo.me/v2';

export async function handle(req, env, ctx) {
  const url = new URL(req.url);
  const path = url.pathname;
  const method = req.method;

  // 1. AUTH ROUTES
  if (path.endsWith('/auth/zalo/start')) {
    return getAuthUrl(env);
  }
  
  if (path.endsWith('/auth/zalo/callback')) {
    return handleCallback(req, env);
  }

  // 2. DATA ROUTES
  if (path.endsWith('/zalo/campaigns') && method === 'GET') {
    return getCampaigns(req, env);
  }

  if (path.endsWith('/zalo/report') && method === 'GET') {
    return getReport(req, env);
  }

  return errorResponse('Zalo Ads Route Not Found', 404, req);
}

// ============================================================
// 1. AUTHENTICATION FLOW
// ============================================================

function getAuthUrl(env) {
  if (!env.ZALO_APP_ID) return errorResponse('Thiếu cấu hình ZALO_APP_ID', 500);

  const redirectUri = 'https://api.shophuyvan.vn/admin/marketing/auth/zalo/callback';
  const url = new URL(ZALO_AUTH_URL);
  
  url.searchParams.set('app_id', env.ZALO_APP_ID);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('state', 'zalo_ads_connect');

  return Response.redirect(url.toString(), 302);
}

async function handleCallback(req, env) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  // Zalo thường trả về OA ID nếu login thành công
  const oaId = url.searchParams.get('oa_id'); 

  if (!code) return errorResponse('Missing Auth Code', 400, req);

  try {
    // Đổi Code lấy Access Token
    const formData = new URLSearchParams();
    formData.append('app_id', env.ZALO_APP_ID);
    formData.append('grant_type', 'authorization_code');
    formData.append('code', code);
    // Lưu ý: Zalo yêu cầu secret key ở header custom 'secret_key'
    
    const res = await fetch(ZALO_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'secret_key': env.ZALO_SECRET_KEY
      },
      body: formData
    });

    const data = await res.json();
    if (data.error) throw new Error(data.error_name || JSON.stringify(data));

    // Lưu Token vào D1 Database (Bảng settings)
    const now = Date.now();
    await env.DB.prepare(`
      INSERT INTO settings (key_name, value_json, updated_at)
      VALUES ('zalo_ads_token', ?, ?)
      ON CONFLICT(key_name) DO UPDATE SET value_json = excluded.value_json, updated_at = excluded.updated_at
    `).bind(JSON.stringify({
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_in: data.expires_in, // Thường là 25 giờ
      oa_id: oaId
    }), now).run();

    return new Response(`
      <html>
        <body style="font-family:sans-serif; text-align:center; padding-top:50px;">
          <h1 style="color:#10b981;">✅ Kết nối Zalo Ads Thành Công!</h1>
          <p>Token đã được lưu. Bạn có thể tắt cửa sổ này.</p>
          <script>setTimeout(() => window.close(), 3000);</script>
        </body>
      </html>
    `, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });

  } catch (e) {
    return errorResponse('Lỗi kết nối Zalo: ' + e.message, 500, req);
  }
}

// ============================================================
// 2. DATA FETCHING (CAMPAIGNS & REPORT)
// ============================================================

async function getCampaigns(req, env) {
  try {
    const token = await getAccessToken(env);
    
    // Gọi API Zalo lấy danh sách Campaign
    const res = await fetch(`${ZALO_API_BASE}/campaigns`, {
      method: 'GET',
      headers: { 'access_token': token }
    });
    
    const data = await res.json();
    if (data.error) throw new Error(data.message);

    // Chuẩn hóa dữ liệu để giống cấu trúc Facebook (cho Dashboard dễ hiển thị)
    const campaigns = (data.data || []).map(c => ({
      id: c.campaign_id,
      name: c.campaign_name,
      status: c.status === 1 ? 'ACTIVE' : 'PAUSED', // Giả định status code
      spend: c.cost || 0,
      impressions: c.impression || 0,
      clicks: c.click || 0,
      ctr: c.ctr || 0,
      cpc: c.cpc || 0,
      platform: 'zalo' // Đánh dấu nguồn dữ liệu
    }));

    return json({ ok: true, campaigns }, {}, req);

  } catch (e) {
    // Trả về mảng rỗng nếu lỗi để không làm sập dashboard chung
    console.error('[Zalo Ads] Fetch Error:', e);
    return json({ ok: false, campaigns: [], error: e.message }, {}, req);
  }
}

async function getReport(req, env) {
    // Hàm này sẽ dùng để lấy báo cáo chi tiết theo ngày (giống stats.js)
    // Hiện tại trả về dummy data cấu trúc chuẩn để test dashboard
    return json({
        ok: true,
        totals: {
            spend: 0,
            impressions: 0,
            clicks: 0,
            ctr: 0
        }
    }, {}, req);
}

// ============================================================
// HELPER: TOKEN MANAGEMENT
// ============================================================

async function getAccessToken(env) {
  const setting = await env.DB.prepare("SELECT value_json FROM settings WHERE key_name = 'zalo_ads_token'").first();
  if (!setting) throw new Error('Chưa kết nối tài khoản Zalo Ads');

  const tokenData = JSON.parse(setting.value_json);
  
  // TODO: Kiểm tra hết hạn và Refresh Token nếu cần (Zalo Token hết hạn sau 25h)
  // Logic refresh token sẽ được thêm vào sau khi bạn chạy test Auth thành công.
  
  return tokenData.access_token;
}