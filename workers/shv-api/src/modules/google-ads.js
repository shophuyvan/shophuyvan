// workers/shv-api/src/modules/google-ads.js
import { json, errorResponse } from '../lib/response.js';

// Cấu hình Google Ads
const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
// Scope cần thiết để xem báo cáo Ads
const SCOPES = 'https://www.googleapis.com/auth/adwords';
const REDIRECT_URI = 'https://api.shophuyvan.vn/admin/marketing/auth/google/callback';

export async function handle(req, env, ctx) {
  const url = new URL(req.url);
  const path = url.pathname;

  // 1. AUTH ROUTES
  if (path.includes('/auth/google/start')) {
    return getAuthUrl(req, env); // ✅ Code mới đã truyền req
  }
  
  if (path.includes('/auth/google/callback')) {
    return handleCallback(req, env);
  }

  // 2. DATA ROUTES (Lấy danh sách chiến dịch)
  if (path.endsWith('/google/campaigns') && req.method === 'GET') {
    return getCampaigns(req, env);
  }

  return errorResponse('Google Ads Route Not Found', 404, req);
}

// ============================================================
// 1. AUTHENTICATION FLOW
// ============================================================

// Cập nhật hàm getAuthUrl nhận thêm 'req'
function getAuthUrl(req, env) {
  // Kiểm tra biến môi trường an toàn hơn
  if (!env || !env.GOOGLE_ADS_CLIENT_ID) {
    // Truyền đủ tham số req để không bị lỗi 1101
    return errorResponse('LỖI: Chưa cấu hình biến GOOGLE_ADS_CLIENT_ID trong Cloudflare Settings', 500, req);
  }

  try {
    const url = new URL(GOOGLE_AUTH_URL);
    url.searchParams.set('client_id', env.GOOGLE_ADS_CLIENT_ID);
    url.searchParams.set('redirect_uri', REDIRECT_URI);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', SCOPES);
    url.searchParams.set('access_type', 'offline');
    url.searchParams.set('prompt', 'consent');

    return Response.redirect(url.toString(), 302);
  } catch (e) {
    return errorResponse('Lỗi tạo URL Google Auth: ' + e.message, 500, req);
  }
}

async function handleCallback(req, env) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');

  if (!code) return errorResponse('Missing Auth Code', 400, req);

  try {
    const res = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code: code,
        client_id: env.GOOGLE_ADS_CLIENT_ID,         // ✅ FIX: Dùng biến _ADS_
        client_secret: env.GOOGLE_ADS_CLIENT_SECRET, // ✅ FIX: Dùng biến _ADS_
        redirect_uri: REDIRECT_URI,
        grant_type: 'authorization_code'
      })
    });

    const data = await res.json();
    if (data.error) throw new Error(data.error_description || JSON.stringify(data));

    const now = Date.now();
    
    // Lưu Token vào D1 (Tách riêng key google_ads_token)
    await env.DB.prepare(`
      INSERT INTO settings (key_name, value_json, updated_at)
      VALUES ('google_ads_token', ?, ?)
      ON CONFLICT(key_name) DO UPDATE SET value_json = excluded.value_json, updated_at = excluded.updated_at
    `).bind(JSON.stringify({
      access_token: data.access_token,
      refresh_token: data.refresh_token, 
      expires_in: data.expires_in
    }), now).run();

    return new Response(`
      <html>
        <body style="font-family:sans-serif; text-align:center; padding-top:50px;">
          <h1 style="color:#ef4444;">✅ Kết nối Google Ads Thành Công!</h1>
          <p>Token đã được lưu. Bạn có thể đóng cửa sổ này.</p>
          <script>setTimeout(() => window.close(), 3000);</script>
        </body>
      </html>
    `, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });

  } catch (e) {
    return errorResponse('Lỗi kết nối Google: ' + e.message, 500, req);
  }
}

// ============================================================
// 2. DATA FETCHING (CAMPAIGNS)
// ============================================================

async function getCampaigns(req, env) {
  try {
    const accessToken = await getAccessToken(env);
    
    // Kiểm tra cấu hình Customer ID & Developer Token
    const customerId = env.GOOGLE_ADS_CUSTOMER_ID; 
    const developerToken = env.GOOGLE_ADS_DEVELOPER_TOKEN;

    if (!customerId || !developerToken) {
        // Trả về rỗng nếu chưa cấu hình xong (để dashboard không lỗi)
        console.warn('Thiếu cấu hình Google Ads ID/Token');
        return json({ ok: true, campaigns: [] }, {}, req);
    }

    // Câu lệnh GAQL lấy metrics
    const query = `
      SELECT 
        campaign.id, 
        campaign.name, 
        campaign.status, 
        metrics.cost_micros, 
        metrics.impressions, 
        metrics.clicks,
        metrics.ctr,
        metrics.average_cpc
      FROM campaign 
      WHERE campaign.status != 'REMOVED'
    `;

    const cleanId = customerId.replace(/-/g, '');
    const apiUrl = `https://googleads.googleapis.com/v14/customers/${cleanId}/googleAds:search`;

    const res = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'developer-token': developerToken,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ query })
    });

    const data = await res.json();
    
    // Xử lý lỗi từ Google API (VD: Token chưa được duyệt)
    if (data.error) {
        console.error('[Google Ads API Error]', JSON.stringify(data.error));
        // Trả về mảng rỗng thay vì ném lỗi 500 để Dashboard vẫn hiện FB/Zalo
        return json({ ok: true, campaigns: [], error: data.error.message }, {}, req);
    }

    const campaigns = (data.results || []).map(row => ({
      id: row.campaign.id,
      name: row.campaign.name,
      status: row.campaign.status === 'ENABLED' ? 'ACTIVE' : 'PAUSED',
      spend: (row.metrics.costMicros || 0) / 1000000, 
      impressions: row.metrics.impressions || 0,
      clicks: row.metrics.clicks || 0,
      ctr: (row.metrics.ctr || 0) * 100,
      cpc: (row.metrics.averageCpc || 0) / 1000000,
      platform: 'google' // Đánh dấu nguồn
    }));

    return json({ ok: true, campaigns }, {}, req);

  } catch (e) {
    console.error('[Google Ads] Fetch Error:', e);
    return json({ ok: false, campaigns: [], error: e.message }, {}, req);
  }
}

// ============================================================
// HELPER: REFRESH TOKEN
// ============================================================

async function getAccessToken(env) {
  const setting = await env.DB.prepare("SELECT value_json FROM settings WHERE key_name = 'google_ads_token'").first();
  if (!setting) throw new Error('Chưa kết nối Google Ads');

  const tokenData = JSON.parse(setting.value_json);

  // Refresh Token
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: env.GOOGLE_ADS_CLIENT_ID,         // ✅ FIX: _ADS_
      client_secret: env.GOOGLE_ADS_CLIENT_SECRET, // ✅ FIX: _ADS_
      refresh_token: tokenData.refresh_token,
      grant_type: 'refresh_token'
    })
  });

  const data = await res.json();
  if (!res.ok) throw new Error('Refresh Token Failed');

  return data.access_token;
}