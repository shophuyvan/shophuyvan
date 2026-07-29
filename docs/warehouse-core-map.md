# Website ↔ Warehouse Core

## Luồng bắt buộc

```text
Sàn / API / import
  → Product / Warehouse Core
  → Public Catalog Core
  → shophuyvan.vn
```

Website khách chỉ đọc:

```text
GET /api/core/products/public-catalog?limit=110
GET /api/core/products/public-catalog?q=<từ-khóa>&limit=110
GET /api/core/products/public-catalog/:id
GET /api/core/products/public-catalog/:id/reviews?limit=8&media=1
```

Các endpoint này là nguồn cho tên, SKU, danh mục, giá, tồn, số đã bán, ảnh, video, biến thể, review và media. Storefront không tự tính nghiệp vụ, không tạo nguồn dữ liệu thứ hai và không ghi ngược vào Core.

## Nội dung riêng của website

```text
admin.shophuyvan.vn
  → shophuyvan-content-api
  → D1 shophuyvan-website-content-clean
  → explicit website-only override
  → shophuyvan.vn
```

Override chỉ có hiệu lực khi người quản trị chủ động lưu. Nếu không có override, website hiển thị đúng dữ liệu Public Catalog Core. Override không được thay đổi giá/tồn/SKU/listing trên sàn.

## Quy ước dữ liệu

- `0`: số liệu thực từ Core.
- `null` hoặc thiếu trường: chưa có dữ liệu; UI phải nói rõ, không tự thay bằng `0`.
- D1 cũ `shophuyvan-website-content-db` không nằm trong luồng mới và chỉ được xóa theo xác nhận riêng của chủ shop.
