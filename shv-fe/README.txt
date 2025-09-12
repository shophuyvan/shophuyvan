# SHV R6 FULL (Home + Banner/Voucher Admin)

- `index.html` — Trang chủ: giá thấp nhất theo biến thể, banner slider, placeholder nội bộ.
- `src/ui-home.js` — Logic trang chủ.
- `src/lib/price.js` — `pickLowestPrice` + `formatPrice`.
- `admin-bv.html` + `src/ui-admin-bv.js` — Admin Banner/Voucher độc lập, không đụng admin cũ.
- `src/lib/api.js` — Helper API (để gói tự chạy).

Nếu Worker chưa có `/settings`, dữ liệu Banner/Voucher sẽ lưu tạm `localStorage` và trang chủ vẫn đọc được.
