# Trạng thái hiện tại — website Shop Huy Vân

Cập nhật: 2026-07-29

## Mã nguồn chuẩn

- Website khách: `site/` → Pages `shophuyvan` → `https://shophuyvan.vn`.
- Quản trị nội dung: `admin/` → Pages `adminshophuyvan` → `https://admin.shophuyvan.vn`.
- API nội dung: `services/content-api/` → Worker `shophuyvan-content-api`.
- D1 nội dung sạch: `shophuyvan-website-content-clean` (`096624b7-6dd4-434f-a426-73e7858da891`).
- Media dùng bucket R2 hiện có `social-videos`, giới hạn trong prefix `website-content/`.

## Đã hoàn tất

- Thay toàn bộ storefront/admin legacy bằng nguồn mới, không còn route hoặc build nào dùng `apps/`, `workers/`, `packages/` hay `shared/` cũ.
- URL công khai chuẩn: `/`, `/san-pham`, `/tim-kiem`, `/san-pham/:id`, `/khuyen-mai`, `/huong-dan`, `/lien-he`, `/gio-hang`; không còn `desktop`, `mobile` hoặc `new-ui`.
- Website tự đổi bố cục theo thiết bị, không đổi URL.
- Website đọc sản phẩm từ Product/Warehouse API: `https://huyvan-worker-api.nghiemchihuy.workers.dev/api/products`.
- Admin chỉ quản trị nội dung website: thương hiệu/liên hệ/slogan, banner, media tải từ PC và phần ghi đè nội dung hiển thị cho sản phẩm.
- Admin dùng same-origin proxy Pages cho `/api/content/*`, nên đăng nhập không còn phụ thuộc CORS của trình duyệt. Không có token Cloudflare/GitHub trong source hoặc Git.
- Mật khẩu admin băm PBKDF2; phiên đăng nhập ký HMAC và chỉ lưu theo phiên trình duyệt.

## Dữ liệu nguồn và giới hạn đang hiển thị đúng

Product/Warehouse API hiện có SKU, tên, mô tả, ảnh, video và tồn kho. API chưa trả giá website, danh mục chuẩn, phân loại/biến thể hoặc review/media từ sàn.

Website không tự bịa thương hiệu, Panasonic, danh mục, giá hoặc đánh giá. Khi Core bổ sung endpoint dữ liệu chuẩn, frontend chỉ đọc thêm từ Nhà Kho, không tạo nguồn dữ liệu thứ hai.

## D1 và legacy

- D1 cũ `shophuyvan-website-content-db` không được API mới sử dụng.
- D1 cũ chưa xóa để tránh mất dữ liệu ngoài phạm vi website; chỉ được xóa khi chủ shop xác nhận riêng.
- D1 mới chỉ có: admin users, settings, banners, product overrides và media.
- Toàn bộ source legacy đã bị loại khỏi Git và deploy; cache cục bộ bị `.gitignore` loại trừ.

## Bản deploy đã kiểm thật

- Website: `https://5b22f480.shophuyvan1.pages.dev` và domain `https://shophuyvan.vn`.
- Admin: `https://149b01e0.adminshophuyvan.pages.dev` và domain `https://admin.shophuyvan.vn`.
- Content API: Worker `shophuyvan-content-api` đã kiểm `/health`, public content, login và đọc settings có quyền.
- `npm run check`: pass.
- `npm test`: pass (`clean website route contract passed`).
- Tất cả JS source mới dưới 30 KB; kiểm UTF-8 và không có mojibake trong source.
- Browser production đã kiểm: tìm kiếm, menu, trang sản phẩm, gallery thumbnail, khuyến mãi, hướng dẫn, liên hệ, đăng nhập admin, product editor, đổi mật khẩu (mở form), desktop 1366px, tablet 820px và mobile 390px.

## Việc cần làm khi Product Core mở rộng dữ liệu

1. Bổ sung endpoint chuẩn cho giá, danh mục, phân loại/biến thể và review/media từ sàn.
2. Nối endpoint đó vào `site/assets/content.js`.
3. Kiểm lại trang danh sách/PDP và admin editor bằng dữ liệu nguồn; không vá UI bằng dữ liệu giả.
