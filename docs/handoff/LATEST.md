# Handoff mới nhất

Ngày: 2026-07-29

## Điểm dừng đã xác nhận

Storefront mới đã nối đúng Public Catalog Core thay vì endpoint cũ:

- List: `/api/core/products/public-catalog?limit=110`.
- Search: `/api/core/products/public-catalog?q=<từ-khóa>&limit=110`.
- PDP: `/api/core/products/public-catalog/:id`.
- Review/media: `/api/core/products/public-catalog/:id/reviews?limit=8&media=1`.

Mã nguồn liên quan:

- `site/assets/catalog-data.js`: chuẩn hóa dữ liệu đọc từ Core.
- `site/assets/app.js`: list, tìm kiếm, PDP, biến thể, gallery và review/media.
- `admin/assets/admin.js`: catalog dùng cho quản trị nội dung website.

## Deploy và kiểm tra

- Storefront: `https://1e09bc03.shophuyvan1.pages.dev` → `https://shophuyvan.vn`.
- Admin: `https://3ad3f740.adminshophuyvan.pages.dev` → `https://admin.shophuyvan.vn`.
- `npm run check`, `npm test`, `npm run test:core-read`: pass.
- Kiểm browser thực với `K154`: thay biến thể đổi giá/ảnh, click thumbnail đổi ảnh chính, review/media hiện; responsive pass ở desktop 1366×900, tablet 820×1180 và mobile 390×844.

## Còn mở

- Chrome kiểm thử hiện không có phiên admin đã đăng nhập, nên chưa bấm thử lưu thay đổi bằng phiên của chủ shop. Không được tự đặt lại mật khẩu hay giả lập phiên. Khi có phiên đã đăng nhập trong Chrome kiểm thử, mở admin và kiểm tra một sản phẩm có nội dung Core điền sẵn, sửa website-only override, lưu, rồi readback ở storefront.
- Đã mở Claude bằng visible runtime `account_16` để review UI theo yêu cầu trước đó, nhưng cổng điều khiển của runtime (`9516`) không phản hồi nên chưa gửi prompt hoặc upload dữ liệu. Không được báo đã có nhận xét Claude cho đến khi runtime phản hồi được.
- D1 cũ `shophuyvan-website-content-db` chưa xóa và không nằm trong luồng mới; chỉ xử lý theo xác nhận riêng của chủ shop.
