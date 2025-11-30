// workers/shv-api/src/modules/social-video-sync/youtube-uploader.js
import { json, errorResponse } from '../../lib/response.js';

// Scope bắt buộc để upload video
const SCOPES = [
  'https://www.googleapis.com/auth/youtube.upload',
  'https://www.googleapis.com/auth/youtube.readonly',
  'https://www.googleapis.com/auth/youtube.force-ssl'
];

const REDIRECT_URI = 'https://api.shophuyvan.vn/auth/google/callback';

/**
 * 1. Tạo URL đăng nhập Google
 */
export function getAuthUrl(env) {
  if (!env.GOOGLE_CLIENT_ID) throw new Error('Chưa cấu hình GOOGLE_CLIENT_ID');

  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.searchParams.set('client_id', env.GOOGLE_CLIENT_ID);
  url.searchParams.set('redirect_uri', REDIRECT_URI);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', SCOPES.join(' '));
  url.searchParams.set('access_type', 'offline'); 
  url.searchParams.set('prompt', 'consent');      
  url.searchParams.set('include_granted_scopes', 'true');

  return url.toString();
}

/**
 * 2. Xử lý Callback -> Lưu Token vào D1 (Bảng settings)
 */
export async function handleCallback(req, env) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const error = url.searchParams.get('error');

  if (error) return errorResponse(`Google Auth Error: ${error}`, 400, req);
  if (!code) return errorResponse('Missing code', 400, req);

  try {
    // Đổi code lấy token
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
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

    const tokens = await tokenRes.json();
    if (!tokenRes.ok) throw new Error(tokens.error_description || JSON.stringify(tokens));

    const now = Date.now();

    // ✅ FIX: Dùng đúng tên cột key_name và value_json
    // Lưu Refresh Token (Quan trọng nhất)
    if (tokens.refresh_token) {
      await env.DB.prepare(`
        INSERT INTO settings (key_name, value_json, updated_at)
        VALUES ('youtube_refresh_token', ?, ?)
        ON CONFLICT(key_name) DO UPDATE SET value_json = excluded.value_json, updated_at = excluded.updated_at
      `).bind(JSON.stringify({ token: tokens.refresh_token }), now).run();
    }
      
    // Lưu Access Token
    if (tokens.access_token) {
        await env.DB.prepare(`
          INSERT INTO settings (key_name, value_json, updated_at)
          VALUES ('youtube_access_token', ?, ?)
          ON CONFLICT(key_name) DO UPDATE SET value_json = excluded.value_json, updated_at = excluded.updated_at
        `).bind(JSON.stringify({ token: tokens.access_token }), now).run();
    }

    return new Response(`
      <html>
        <body style="font-family:sans-serif; text-align:center; padding:50px; background:#f9fafb;">
          <div style="background:white; padding:30px; border-radius:12px; box-shadow:0 4px 6px rgba(0,0,0,0.1); max-width:500px; margin:0 auto;">
            <h1 style="color:#10b981; margin-bottom:10px;">✅ Kết nối YouTube Thành Công!</h1>
            <p style="color:#374151; font-size:16px;">Hệ thống đã lưu Token.<br>Bây giờ bạn có thể dùng tính năng Đăng Đa Kênh.</p>
            <script>setTimeout(() => window.close(), 3000);</script>
          </div>
        </body>
      </html>
    `, { headers: { 'Content-Type': 'text/html;charset=UTF-8' } });

  } catch (e) {
    return errorResponse('YouTube Auth Error: ' + e.message, 500, req);
  }
}

/**
 * 3. Helper: Lấy Access Token (Tự động refresh nếu hết hạn)
 */
async function getAccessToken(env) {
  // ✅ FIX: Đọc từ cột value_json
  const setting = await env.DB.prepare("SELECT value_json FROM settings WHERE key_name = 'youtube_refresh_token'").first();
  if (!setting || !setting.value_json) throw new Error('Chưa kết nối YouTube (Thiếu Refresh Token)');

  // Parse JSON để lấy token string
  let refresh_token;
  try {
      refresh_token = JSON.parse(setting.value_json).token;
  } catch(e) {
      refresh_token = setting.value_json; // Fallback nếu lỡ lưu dạng string cũ
  }

  // Gọi Google API để lấy access token mới
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      refresh_token: refresh_token,
      grant_type: 'refresh_token'
    })
  });

  const data = await res.json();
  if (!res.ok) throw new Error('Không thể làm mới YouTube Token: ' + JSON.stringify(data));
  
  return data.access_token;
}

/**
 * 4. Upload Video lên YouTube Shorts
 */
export async function uploadToYouTube(env, videoUrl, title, description) {
  // Sẽ hoàn thiện ở bước tiếp theo sau khi bạn kết nối thành công
  const accessToken = await getAccessToken(env);
  return { ok: true, message: 'Token is valid', token: accessToken.substring(0, 10) + '...' };
}