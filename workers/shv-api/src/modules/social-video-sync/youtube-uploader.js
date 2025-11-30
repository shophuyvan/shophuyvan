// workers/shv-api/src/modules/social-video-sync/youtube-uploader.js
import { json, errorResponse } from '../../lib/response.js';

// Scope bắt buộc để upload video
const SCOPES = [
  'https://www.googleapis.com/auth/youtube.upload',
  'https://www.googleapis.com/auth/youtube.readonly'
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
  url.searchParams.set('access_type', 'offline'); // Quan trọng: để lấy refresh_token
  url.searchParams.set('prompt', 'consent');      // Quan trọng: Bắt buộc user đồng ý để lấy refresh_token

  return url.toString();
}

/**
 * 2. Xử lý Callback sau khi đăng nhập -> Lưu Refresh Token vào D1
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
    if (!tokenRes.ok) throw new Error(tokens.error_description || 'Failed to exchange token');

    // Lưu Refresh Token vào bảng settings (D1)
    // Lưu ý: Chúng ta chỉ cần refresh_token để dùng lâu dài
    if (tokens.refresh_token) {
      await env.DB.prepare(`
        INSERT INTO settings (key, value, created_at, updated_at)
        VALUES ('youtube_refresh_token', ?, ?, ?)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
      `).bind(tokens.refresh_token, Date.now(), Date.now()).run();
      
      // Lưu thêm access token tạm thời
      await env.DB.prepare(`
        INSERT INTO settings (key, value, created_at, updated_at)
        VALUES ('youtube_access_token', ?, ?, ?)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
      `).bind(tokens.access_token, Date.now(), Date.now()).run();
    }

    // Trả về HTML thông báo thành công và tự đóng cửa sổ
    return new Response(`
      <html>
        <body style="font-family:sans-serif; text-align:center; padding:50px;">
          <h1 style="color:green;">✅ Kết nối YouTube Thành Công!</h1>
          <p>Hệ thống đã lưu Token. Bạn có thể đóng cửa sổ này.</p>
          <script>setTimeout(() => window.close(), 3000);</script>
        </body>
      </html>
    `, { headers: { 'Content-Type': 'text/html;charset=UTF-8' } });

  } catch (e) {
    return errorResponse(e.message, 500, req);
  }
}

/**
 * 3. Lấy Access Token mới từ Refresh Token
 */
async function getAccessToken(env) {
  // Lấy refresh token từ DB
  const setting = await env.DB.prepare("SELECT value FROM settings WHERE key = 'youtube_refresh_token'").first();
  if (!setting || !setting.value) throw new Error('Chưa kết nối YouTube (Thiếu Refresh Token)');

  const refresh_token = setting.value;

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
  if (!res.ok) throw new Error('Không thể làm mới YouTube Token');
  
  return data.access_token;
}

/**
 * 4. Upload Video lên YouTube Shorts
 * (Lưu ý: Logic Upload chi tiết sẽ hoàn thiện ở bước sau khi test xong kết nối)
 */
export async function uploadToYouTube(env, videoUrl, title, description) {
  // Placeholder để test luồng
  const accessToken = await getAccessToken(env);
  return { ok: true, videoId: 'test_id', message: 'Token valid, ready to upload' };
}