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
- `admin/assets/content-admin/main.js`: kết nối phiên đăng nhập, API nội dung và catalog dùng cho quản trị nội dung website.
- `admin/assets/content-admin/render.js`: giao diện quản trị theo mẫu `Admin_dashboard.html`, chỉ có Banner, Sản phẩm website, Menu & thông tin và Thư viện ảnh/video.

## Deploy và kiểm tra

- Storefront: `https://23ed4197.shophuyvan1.pages.dev` → `https://shophuyvan.vn`.
- Admin: `https://1840096e.adminshophuyvan.pages.dev` → `https://admin.shophuyvan.vn`, dùng giao diện content-admin mới theo `Admin_dashboard.html` với asset phiên bản `20260729.8`. Hai asset admin legacy được chặn và tab cũ tự chuyển sang trang đăng nhập bản mới, không cần xóa cache thủ công.
- `npm run check`, `npm test`, `npm run test:core-read`: pass.
- Kiểm browser thực với `K154`: thay biến thể đổi giá/ảnh, click thumbnail đổi ảnh chính, review/media hiện; responsive pass ở desktop 1366×900, tablet 820×1180 và mobile 390×844.
- Cấu trúc repo đã được dọn: chỉ còn `site/`, `admin/`, `services/content-api/`, `tests/` và tài liệu vận hành. Legacy `apps/`, `workers/`, cache/build cũ và handoff legacy đã bị xóa sau audit caller.

## Còn mở

- Chrome profile `E:\codex-chrome-profiles\shophuyvan-test` có thông tin tự điền nhưng API login trả `401`, nên chưa thể bấm thử lưu thay đổi bằng phiên của chủ shop. Không được tự đặt lại mật khẩu hay giả lập phiên. Khi chủ shop nhập mật khẩu hiện hành, mở admin và kiểm tra một sản phẩm có nội dung Core điền sẵn, sửa website-only override, lưu, rồi readback ở storefront.
- Đã mở Claude bằng visible runtime `account_16` để review UI theo yêu cầu trước đó, nhưng cổng điều khiển của runtime (`9516`) không phản hồi nên chưa gửi prompt hoặc upload dữ liệu. Không được báo đã có nhận xét Claude cho đến khi runtime phản hồi được.
- D1 cũ `shophuyvan-website-content-db` chưa xóa và không nằm trong luồng mới; chỉ xử lý theo xác nhận riêng của chủ shop.
