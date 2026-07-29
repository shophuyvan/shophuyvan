# Trạng thái hiện tại — website Shop Huy Vân

## Theo dõi đường dẫn sản phẩm cũ (2026-07-29)

- `GET /api/core/products/public-catalog/K145` trả đúng dữ liệu gốc: giá, tồn kho và bốn phân loại.
- PDP mới tại `/san-pham/K145` hiển thị đầy đủ các giá trị này. Đường dẫn cũ `/product?id=K145` được chuyển 302 sang `/product.html?id=K145`, sau đó chuẩn hóa về `/san-pham/K145` để luôn dùng cùng PDP mới.
- `site/assets/content.js` giữ nguyên phân loại từ nguồn chuẩn khi có ghi đè nội dung riêng của website. `site/assets/app.js` chuẩn hóa URL sản phẩm cũ sang `/san-pham/:id` và hiển thị tồn kho theo số lượng của phân loại đang chọn.
- `site/_headers` tắt bộ nhớ đệm cho hai đường dẫn sản phẩm cũ. `site/_redirects` áp dụng redirect trước khi trang cũ được tải. Đã kiểm HTTP 302 và kiểm bằng trình duyệt trên tên miền chính; không cần xoá cache toàn bộ hay chỉnh Worker route.

Cập nhật: 2026-07-29

## Mã nguồn và deploy chuẩn

- Storefront khách hàng: `site/` → Cloudflare Pages `shophuyvan` → `https://shophuyvan.vn`.
- Quản trị nội dung: `admin/` → Cloudflare Pages `adminshophuyvan` → `https://admin.shophuyvan.vn`.
- API nội dung website: `services/content-api/` → Worker `shophuyvan-content-api`.
- D1 nội dung sạch: `shophuyvan-website-content-clean` (`096624b7-6dd4-434f-a426-73e7858da891`).
- Media do quản trị tải lên dùng R2 `social-videos` trong prefix `website-content/`.

## Luồng dữ liệu đang chạy

- Danh sách sản phẩm: `GET /api/core/products/public-catalog?limit=110`.
- Tìm kiếm: `GET /api/core/products/public-catalog?q=<từ-khóa>&limit=110`.
- Chi tiết sản phẩm: `GET /api/core/products/public-catalog/:id`.
- Đánh giá và media sàn: `GET /api/core/products/public-catalog/:id/reviews?limit=8&media=1`.
- Storefront chỉ đọc dữ liệu Core qua `site/assets/catalog-data.js`; không có danh mục, giá, biến thể, review hay SKU giả trong mã nguồn.
- Website chỉ lưu ghi đè rõ ràng trong D1 cho phần trình bày riêng; trường chưa ghi đè tiếp tục lấy từ Core. `null` là thiếu dữ liệu, `0` là dữ liệu thật.

## Đã hoàn tất trong lượt 2026-07-29

- Đổi storefront và admin sang nguồn Public Catalog Core có giá, tồn, bán, ảnh, video, danh mục, biến thể, review và media.
- PDP đọc trực tiếp theo mã sản phẩm, nên sản phẩm không nằm trong trang danh sách đầu vẫn mở đúng.
- Chọn biến thể đổi đúng giá, tồn và ảnh; thumbnail đổi ảnh chính; review có ảnh/video hiển thị từ Core.
- Tìm kiếm theo tên, SKU hoặc mã sản phẩm, gồm mã như `K154`; yêu cầu tìm kiếm chạy song song khi người dùng mở trực tiếp URL tìm kiếm.
- Admin chỉ quản trị nội dung website; không ghi ngược giá/tồn/SKU/listing về sàn hoặc Warehouse Core.

## Deploy và kiểm tra gần nhất

- Storefront deploy: `https://3ceb0461.shophuyvan1.pages.dev` và tên miền chính `https://shophuyvan.vn`.
- Admin deploy: `https://3ad3f740.adminshophuyvan.pages.dev` và tên miền chính `https://admin.shophuyvan.vn`.
- `npm run check`: pass.
- `npm test`: pass.
- `npm run test:core-read`: pass với Public Catalog và review/media thực.
- Đã kiểm trình duyệt PDP `K154`: giá, biến thể, thumbnail, review/media; desktop 1366×900, tablet 820×1180, mobile 390×844 không tràn ngang.

## Lưu ý vận hành

- D1 cũ `shophuyvan-website-content-db` không được API mới dùng và chưa được xóa. Chỉ xóa khi chủ shop xác nhận riêng vì đây là tài nguyên production cũ.
- Phiên Chrome kiểm thử hiện không có phiên đăng nhập admin của chủ shop; cần kiểm lại phần điền sẵn/sửa/lưu trong admin bằng phiên đã đăng nhập, nhưng không được thay đổi mật khẩu hoặc giả lập phiên của người dùng.
