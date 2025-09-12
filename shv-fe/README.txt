Fix PDP media + slider + video autoplay

Thay thế file:
  shv-fe/src/ui-pdp.js

Ghi chú:
- Tự bắt các field ảnh: images, gallery, gallery_map(url/src), variants.image, image, alt_images (CSV), v.v.
- Ảnh Cloudinary tự chèn transform: w_800,q_auto,f_auto.
- Video (nếu có) tự động play (muted, loop).
- Ảnh tự slide mỗi 3 giây.
- Gán window.__pdp để bạn kiểm tra nhanh trong Console.

Sau khi chép đè, hãy Deploy lại Pages.