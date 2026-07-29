# Website ↔ Warehouse Core

## Luồng bắt buộc

```text
Sàn / API / import
  → Product/Warehouse Core
  → https://huyvan-worker-api.nghiemchihuy.workers.dev/api/products
  → shophuyvan.vn
```

Website khách chỉ đọc dữ liệu nguồn. Không tự tạo tồn kho, SKU, giá sàn hoặc trạng thái đơn.

## Ghi đè riêng cho website

```text
admin.shophuyvan.vn
  → shophuyvan-content-api
  → D1 shophuyvan-website-content-clean
  → website-only override
  → shophuyvan.vn
```

Override chỉ chứa nội dung hiển thị: tiêu đề website, danh mục website, giá hiển thị, mô tả, ảnh/video, phân loại, trạng thái xuất bản. Nếu không có override thì website dùng nguyên dữ liệu Warehouse.

## Không có dữ liệu nguồn

`null` hoặc thiếu trường phải được hiển thị là chưa có dữ liệu/đang liên hệ, không ép thành `0` và không thay bằng thương hiệu hay danh mục tự đặt.
