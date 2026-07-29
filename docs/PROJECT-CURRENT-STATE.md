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

## Cập nhật tỷ lệ hiển thị storefront (2026-07-29)

- Nguyên nhân banner trang chủ bị kéo rất dài là `home-grid` mặc định kéo banner theo chiều cao của cột danh mục. Đã đặt các phần tử trong lưới tự canh đầu và khóa chiều cao banner desktop trong khoảng `390–430px`; tablet và mobile giữ `370px`.
- Khung ảnh chính PDP dùng tỷ lệ vuông `1:1`, ảnh dùng `object-fit: contain` để không cắt nội dung ảnh sàn. Danh sách ảnh thu nhỏ có chiều cao tối đa và cuộn dọc riêng, không còn kéo giãn khung ảnh chính.
- Storefront deploy: `https://23ed4197.shophuyvan1.pages.dev` và đã kiểm lại trên `https://shophuyvan.vn` với CSS phiên bản `20260729.6`.
- Kiểm trình duyệt thật: desktop 1534×889 — banner `1004×430`, ảnh chính PDP `504×504`; tablet 820×1180 — banner `760×370`, ảnh chính `671×671`; mobile 390×844 — banner `366×370`, ảnh chính `277×277`. Cả ba không tràn ngang.
- `npm run check`, `npm test`, `npm run test:core-read` đều pass. Public Catalog và endpoint review/media thực vẫn đọc được; không đổi dữ liệu giá, tồn kho hoặc phân loại trong Warehouse Core.

## Dọn dẹp mã nguồn legacy (2026-07-29)

- Đã audit caller bằng `rg` và `git grep`: mã/deploy đang chạy chỉ dùng `site/`, `admin/`, `services/content-api/` và `tests/`.
- Xóa toàn bộ `apps/`, `workers/`, `packages/`, `shared/`, `scripts/`, `.vscode/`, cache `.wrangler/`, file sơ đồ cũ `cau_truc_thu_muc.txt` và cache cài đặt cũ `node_modules/`.
- Xóa workflow GitHub cũ trỏ đến `workers/website-content-api`, cùng hai handoff mô tả giao diện legacy `apps/fe`. Không còn caller runtime, test, route, binding hay deploy path tới các phần này.
- Giữ lại `profiles.local.json` vì đây là cấu hình đăng nhập Cloudflare/GitHub cục bộ của chủ shop; file bị Git bỏ qua và không nằm trong deploy.
- Không đụng D1, R2, dữ liệu khách hàng hoặc dữ liệu Core trong đợt cleanup này.
