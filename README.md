# Shop Huy Vân website

Đây là mã nguồn mới, tách hoàn toàn khỏi storefront, mini-app, OMS và worker cũ.

## Cấu trúc đang chạy

- `site/`: website khách hàng tại `shophuyvan.vn`.
- `admin/`: quản trị nội dung website tại `admin.shophuyvan.vn`.
- `services/content-api/`: API riêng cho đăng nhập, nội dung website và media.
- `docs/`: tài liệu vận hành của mã nguồn mới.

Website chỉ đọc catalogue công khai từ hệ thống Product/Warehouse hiện có. Quản trị website chỉ lưu phần nội dung hiển thị riêng như banner, mô tả, ảnh/video và cài đặt hiển thị; không ghi giá, tồn kho hay SKU sang hệ thống sàn.

Đợt dọn dẹp ngày 2026-07-29 đã xóa toàn bộ mã legacy, build cũ và cache cũ. Thư mục gốc chỉ giữ phần source/deploy đang chạy; `node_modules/`, `.wrangler/` và `profiles.local.json` là dữ liệu máy cục bộ, không đưa vào Git.
