# Bản đồ dữ liệu website mới

| Nhu cầu hiển thị | Nguồn chuẩn | Ghi vào website content D1? |
| --- | --- | --- |
| SKU, tồn kho, sản phẩm nguồn | Product/Warehouse API | Không |
| Giá sàn, giá gốc | Product/Warehouse API khi endpoint có | Không |
| Tên/mô tả/ảnh/video hiển thị riêng | Admin nội dung website | Có, chỉ khi người quản trị lưu |
| Danh mục website và giá hiển thị riêng | Admin nội dung website hoặc Warehouse khi có field chuẩn | Có, chỉ khi chủ động ghi đè |
| Banner, slogan, địa chỉ, hotline | Admin nội dung website | Có |
| Tệp ảnh/video đã tải từ PC | R2 `social-videos` prefix `website-content/` + metadata D1 | Có metadata |
| Review/media sàn | Marketplace → Product/Warehouse API | Không cho tới khi Core có endpoint chuẩn |

Không ghi ngược thay đổi website sang SKU, giá, tồn kho hoặc listing sàn.
