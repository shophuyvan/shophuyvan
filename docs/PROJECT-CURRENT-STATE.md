# Trạng thái hiện tại — website Shop Huy Vân

## Theo dõi đường dẫn sản phẩm cũ (2026-07-29)

- `GET /api/core/products/public-catalog/K145` trả đúng dữ liệu gốc: giá, tồn kho và bốn phân loại.
- PDP mới tại `/san-pham/K145` hiển thị đầy đủ các giá trị này. Đường dẫn cũ `/product?id=K145` được chuyển 302 sang `/product.html?id=K145`, sau đó chuẩn hóa về `/san-pham/K145` để luôn dùng cùng PDP mới.
- `site/assets/content.js` giữ nguyên phân loại từ nguồn chuẩn khi có ghi đè nội dung riêng của website. `site/assets/app.js` chuẩn hóa URL sản phẩm cũ sang `/san-pham/:id` và hiển thị tồn kho theo số lượng của phân loại đang chọn.
- `site/_headers` tắt bộ nhớ đệm cho hai đường dẫn sản phẩm cũ. `site/_redirects` áp dụng redirect trước khi trang cũ được tải. Đã kiểm HTTP 302 và kiểm bằng trình duyệt trên tên miền chính; không cần xoá cache toàn bộ hay chỉnh Worker route.

Cập nhật: 2026-07-29

## Thay giao diện quản trị nội dung theo Admin_dashboard.html (đang triển khai)

- Mẫu giao diện chuẩn là `E:\WEB\website shop huy van\shophuyvan.vn\Admin_dashboard.html`; chỉ dùng ngôn ngữ thiết kế mới (sidebar xanh navy, nội dung nền sáng và nút thao tác cam), không đưa các màn hình minh họa giả của mẫu vào production.
- Mã giao diện hoạt động là `admin/assets/content-admin/dashboard.css`, `admin/assets/content-admin/main.js` và `admin/assets/content-admin/render.js`.
- Các asset admin có phiên bản URL `20260729.8` để tên miền chính nhận đúng giao diện mới ngay sau deploy, không bám cache JavaScript/CSS cũ.
- Khắc phục tab cũ còn giữ giao diện trước đây: `admin/_worker.js` chặn hai tệp legacy `/assets/admin.js` và `/assets/admin-20260729.css`, trả script không cache để tự chuyển tab về `/login_admin?refresh=20260729.8`. Đã kiểm trực tiếp trên tên miền chính: trang `/`, `/login_admin` và `/login?legacy=1` đều dùng `content-admin`; request asset cũ đã trả recovery script với `Cache-Control: no-store`.
- Theo review thực tế qua Claude: trang sửa sản phẩm luôn hiển thị rõ khối dữ liệu gốc chỉ đọc (tên, mã, danh mục, giá và tồn kho) trước phần ghi đè website-only. Giá/tồn kho sàn không có thao tác chỉnh sửa trong admin nội dung.
- Deploy mới: `https://1840096e.adminshophuyvan.pages.dev` → `https://admin.shophuyvan.vn`; tên miền chính đã trả các asset `content-admin` phiên bản `20260729.8` và cơ chế tự thoát giao diện cũ.
- Kiểm tra Chrome thật: desktop `1366×900`, tablet `820×1180`, mobile `390×844` đều không tràn ngang. Menu mobile mở đúng. Trang chỉnh sản phẩm đã kiểm với Public Catalog Core thực tế: tên, mã, danh mục, giá và tồn hiển thị sẵn trong khối chỉ đọc; phần dưới chỉ ghi đè nội dung website.
- Kiểm tra đăng nhập trên Chrome profile `E:\codex-chrome-profiles\shophuyvan-test`: trình duyệt có tự điền thông tin cũ nhưng API trả `401`; giao diện mới hiện rõ lỗi thay vì im lặng. Không reset mật khẩu hoặc bỏ qua xác thực. Cần chủ shop nhập mật khẩu hiện hành để kiểm thử luồng lưu/readback thật.
- Claude được mở qua visible runtime `account_16`, route `http://127.0.0.1:7096/api/open-provider-runtime`, CDP `9516`; đã nhận review sau khi đính kèm `Admin_dashboard.html` và ảnh mẫu. Khuyến nghị đã áp dụng: giữ thiết kế navy–cam, bỏ toàn bộ menu sàn, responsive và tách Core read-only / website-only.
- Admin chỉ quản trị nội dung hiển thị cho khách: Banner, Sản phẩm website, Menu & thông tin, Thư viện ảnh/video và mật khẩu. Không có route, menu hoặc thao tác quản lý đơn hàng, sản phẩm sàn, giá/tồn kho Warehouse, voucher, quảng cáo, người dùng hay đánh giá.
- Sản phẩm website đọc dữ liệu hiện có từ Public Catalog Core trước khi cho phép lưu ghi đè website-only; các thao tác này không ghi ngược sang sàn hoặc Warehouse Core.
- Cần hoàn tất deploy và kiểm thử trình duyệt thực tế desktop/tablet/mobile sau khi thay giao diện.

## Đồng bộ khung quản trị đúng theo `Admin_dashboard.html` (2026-07-30)

- Đã lấy `E:\WEB\website shop huy van\shophuyvan.vn\Admin_dashboard.html` làm chuẩn trực quan cho production: sidebar 240px, biểu tượng cam, khối tài khoản, menu phân nhóm, topbar nền sáng có ô tìm kiếm, nút làm mới và `Xem website`, cùng dashboard bốn thẻ thống kê.
- Chỉ giữ phạm vi quản trị nội dung website: Dashboard, Banner, Sản phẩm website, Menu & thông tin, Thư viện ảnh/video và đổi mật khẩu. Không đưa các menu minh họa Đơn hàng, kho, voucher, khách hàng, quảng cáo hoặc dữ liệu giả của file mẫu vào production.
- Ô tìm kiếm trên topbar đã hoạt động: gửi từ khóa sẽ chuyển đến `Sản phẩm website` và lọc danh sách sản phẩm hiện có; không tạo dữ liệu hoặc ghi ngược vào Warehouse/sàn.
- Deploy admin mới: `https://96f61788.adminshophuyvan.pages.dev` → `https://admin.shophuyvan.vn`, asset phiên bản `20260730.2`; kiểm tra readback trên tên miền chính xác nhận CSS/JS mới đã có sidebar 240px, dashboard 4 thẻ và luồng tìm kiếm.
- `npm run check`, `npm test`, `npm run test:core-read` đều pass; kiểm tra giới hạn kích thước file không có JavaScript/Python/Worker nào vượt 30KB.
- Đã kiểm trực tiếp trên phiên admin đã đăng nhập ở production: desktop 1366×900, tablet 820×1180 và mobile 390×844 đều không tràn ngang; sidebar desktop đúng 240px, tablet đúng 196px và menu mobile mở/đóng bình thường. Đã cập nhật CSP cho Font Awesome CDN, nên các biểu tượng menu, đổi mật khẩu và làm mới hiển thị đúng trên mobile.

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
