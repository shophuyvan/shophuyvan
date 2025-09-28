SHV - Website + Admin (v10.1) đã chỉnh sẵn
=================================================

Các thay đổi chính trong ZIP này (dựa trên zip bạn gửi):
- Thêm proxy **/api** qua Cloudflare Pages → Worker (file _redirects).
- Thêm **Admin** bên trong website: /admin/, /admin_login.html, /admin_real.js (hotfix), /admin/promos.html, /admin_promos.js.
- Thêm **src/shv_api_client.js** (client nhẹ để website gọi /api).

Cách dùng:
1) Upload ZIP này làm dự án Pages (hoặc commit/push lên repo rồi để Pages build).
2) Mở /admin_login.html để đăng nhập. Trang login sẽ thử nhiều endpoint khác nhau
   (GET/POST /admin/login, /login, /admin_login). Khi Worker có một trong các route đó là đăng nhập được.
3) Sau khi đăng nhập, vào /admin/promos.html để quản trị khuyến mại.

Lưu ý:
- Nếu Worker CHƯA có route login/me, hãy thêm nhanh bằng gói auth tối thiểu mình đã gửi: shv_api_admin_endpoints_min_v1.zip
- /api/* phải đứng TRÊN /* trong _redirects để proxy hoạt động.
