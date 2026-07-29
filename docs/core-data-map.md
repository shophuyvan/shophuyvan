# Bản đồ dữ liệu website

| Nhu cầu hiển thị | Nguồn chuẩn | Có ghi vào content D1? |
| --- | --- | --- |
| Mã sản phẩm, SKU, tên, tồn, đã bán | Public Catalog Core | Không |
| Giá hiện tại và giá gốc | Public Catalog Core | Không, trừ override website do quản trị chủ động lưu |
| Danh mục, ảnh, video, phân loại/biến thể | Public Catalog Core | Chỉ lưu override hiển thị riêng khi chủ động chọn |
| Review, ảnh/video review từ sàn | Public Catalog Core reviews | Không |
| Slogan, hotline, địa chỉ, banner | Admin nội dung website | Có |
| Ảnh/video tải từ PC cho banner hoặc nội dung riêng | R2 `social-videos` prefix `website-content/` + metadata D1 | Có metadata |

Quy tắc: Source Core luôn là mặc định; D1 chỉ chứa phần ghi đè rõ ràng cho website. Không ghi ngược thay đổi website về giá, tồn, SKU, phân loại sàn hay listing sàn.
