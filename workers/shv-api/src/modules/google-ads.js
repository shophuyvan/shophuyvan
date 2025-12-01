// workers/shv-api/src/modules/google-ads.js
import { json, errorResponse } from '../lib/response.js';

// Cấu hình Google Ads
const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const SCOPES = 'https://www.googleapis.com/auth/adwords';
const REDIRECT_URI = 'https://api.shophuyvan.vn/admin/marketing/auth/google/callback';

export async function handle(req, env, ctx) {
  const url = new URL(req.url);
  const path = url.pathname;

  // 1. AUTH ROUTES
  if (path.includes('/auth/google/start')) {
    return getAuthUrl(env);
  }
  
  if (path.includes('/auth/google/callback')) {
    return handleCallback(req, env);
  }

  // 2. DATA ROUTES
  if (path.endsWith('/google/campaigns') && req.method === 'GET') {
    return getCampaigns(req, env);
  }

  return errorResponse('Google Ads Route Not Found', 404, req);
}

// ============================================================
// 1. AUTHENTICATION FLOW
// ============================================================

function getAuthUrl(env) {
  if (!env.GOOGLE_CLIENT_ID) return errorResponse('Thiếu cấu hình GOOGLE_CLIENT_ID', 500);

  const url = new URL(GOOGLE_AUTH_URL);
  url.searchParams.set('client_id', env.GOOGLE_CLIENT_ID);
  url.searchParams.set('redirect_uri', REDIRECT_URI);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', SCOPES);
  url.searchParams.set('access_type', 'offline'); // Để lấy Refresh Token
  url.searchParams.set('prompt', 'consent');      // Bắt buộc để lấy Refresh Token

  return Response.redirect(url.toString(), 302);
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
        client_id: env.GOOGLE_CLIENT_ID,
        client_secret: env.GOOGLE_CLIENT_SECRET,
        redirect_uri: REDIRECT_URI,
        grant_type: 'authorization_code'
      })
    });

    const data = await res.json();
    if (data.error) throw new Error(data.error_description || JSON.stringify(data));

    const now = Date.now();
    
    // Lưu Token
    await env.DB.prepare(`
      INSERT INTO settings (key_name, value_json, updated_at)
      VALUES ('google_ads_token', ?, ?)
      ON CONFLICT(key_name) DO UPDATE SET value_json = excluded.value_json, updated_at = excluded.updated_at
    `).bind(JSON.stringify({
      access_token: data.access_token,
      refresh_token: data.refresh_token, // Rất quan trọng
      expires_in: data.expires_in
    }), now).run();

    return new Response(`
      <html>
        <body style="font-family:sans-serif; text-align:center; padding-top:50px;">
          <h1 style="color:#ef4444;">✅ Kết nối Google Ads Thành Công!</h1>
          <p>Token đã được lưu.</p>
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
    const customerId = env.GOOGLE_ADS_CUSTOMER_ID; // ID tài khoản Ads (VD: 123-456-7890)
    const developerToken = env.GOOGLE_ADS_DEVELOPER_TOKEN;

    if (!customerId || !developerToken) {
        throw new Error('Thiếu cấu hình Customer ID hoặc Developer Token');
    }

    // Google Ads Query Language (GAQL)
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

    // Gọi API Google Ads
    // Lưu ý: customerId trong URL phải bỏ dấu gạch ngang (-)
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
    if (data.error) throw new Error(data.error.message);

    // Chuẩn hóa dữ liệu
    const campaigns = (data.results || []).map(row => ({
      id: row.campaign.id,
      name: row.campaign.name,
      status: row.campaign.status === 'ENABLED' ? 'ACTIVE' : 'PAUSED',
      // Google trả về cost ở dạng micros (nhân với 1 triệu) -> chia lại
      spend: (row.metrics.costMicros || 0) / 1000000, 
      impressions: row.metrics.impressions || 0,
      clicks: row.metrics.clicks || 0,
      ctr: (row.metrics.ctr || 0) * 100,
      cpc: (row.metrics.averageCpc || 0) / 1000000,
      platform: 'google'
    }));

    return json({ ok: true, campaigns }, {}, req);

  } catch (e) {
    console.error('[Google Ads] Fetch Error:', e);
    // Trả về rỗng để không làm crash dashboard
    return json({ ok: false, campaigns: [], error: e.message }, {}, req);
  }
}

// ============================================================
// HELPER: REFRESH TOKEN
// ============================================================

async function getAccessToken(env) {
  const setting = await env.DB.prepare("SELECT value_json FROM settings WHERE key_name = 'google_ads_token'").first();
  if (!setting) throw new Error('Chưa kết nối tài khoản Google Ads');

  const tokenData = JSON.parse(setting.value_json);

  // Cơ chế refresh token đơn giản (Google Token sống 1h)
  // Trong thực tế nên check time, ở đây ta refresh luôn cho chắc nếu cần
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      refresh_token: tokenData.refresh_token,
      grant_type: 'refresh_token'
    })
  });

  const data = await res.json();
  if (!res.ok) throw new Error('Refresh Token Failed: ' + JSON.stringify(data));

  return data.access_token;
}