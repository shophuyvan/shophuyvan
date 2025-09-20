SHV Worker – CORS + login alias
================================

Nội dung:
- ./src/index.js      : Worker ESM, bật CORS cho mọi response, trả 200 cho OPTIONS
                        Hỗ trợ /admin/login bằng POST (JSON) *và* GET fallback
                        Hỗ trợ /admin/me xác thực token (demo)
- ./wrangler.toml     : file cấu hình wrangler

Hướng dẫn nhanh:
1) Tạo project mới (hoặc sửa project hiện tại) bằng wrangler:
   wrangler dev
   wrangler deploy
2) Nếu bạn dùng KV cho session/token, mở comment phần AUTH_KV trong wrangler.toml
   và trong code doLogin/verifyToken để lưu/đọc token.
3) Sau khi deploy, trỏ Admin Pages về API base này và đăng nhập.

Lưu ý: doLogin/verifyToken ở đây đang để dạng DEMO cho mục đích vá đăng nhập.
Bạn nên thay bằng logic thực/đọc từ AUTH_KV như hiện trạng dự án của bạn.
