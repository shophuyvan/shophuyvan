# Handoff mới nhất

Ngày: 2026-07-29

## Điểm dừng đã xác nhận

Đã hoàn tất thay thế source cũ bằng kiến trúc website nội dung độc lập:

- `site/` là storefront khách hàng.
- `admin/` là quản trị nội dung website.
- `services/content-api/` là API nội dung với D1 sạch.

Domain đang chạy:

- `https://shophuyvan.vn`
- `https://admin.shophuyvan.vn`

Admin đã đăng nhập được qua same-origin Pages proxy. Product editor tải 262 sản phẩm từ Product/Warehouse API, rồi nạp sẵn dữ liệu nguồn trước khi cho phép chỉnh phần hiển thị riêng trên website.

## Kiểm tra browser đã chạy

- Desktop 1366px: storefront, search, menu, PDP và gallery ảnh đều hoạt động.
- Tablet 820px: không tràn ngang, header responsive đúng.
- Mobile 390px: header mobile hiện, desktop header ẩn, không tràn ngang.
- Admin: login, danh sách sản phẩm, form ảnh/video, form đổi mật khẩu và responsive đã mở/kiểm trực tiếp.

## Không được quay lại

- Không dùng source legacy trong `apps/`, `workers/`, `packages/`, `shared/`.
- Không dùng D1 `shophuyvan-website-content-db` cho API mới.
- Không tự tạo brand/danh mục/giá/review khi Warehouse chưa có dữ liệu.
- Không để credential trong source hoặc Git; dùng `profiles.local.json` chỉ ở máy local.

## Hướng tiếp theo duy nhất còn phụ thuộc Product Core

Khi Nhà Kho mở endpoint chuẩn cho review/media từ sàn, giá website, danh mục và phân loại/biến thể, nối chúng vào `site/assets/content.js`, kiểm browser đủ ba kích thước và cập nhật file này.
