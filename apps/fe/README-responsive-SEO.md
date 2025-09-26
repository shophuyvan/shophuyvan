
# Gói nâng cấp responsive + SEO cho shophuyvan (drop‑in)

**Cách dùng (không phá vỡ cấu trúc hiện tại):**
1) Sao chép thư mục `apps/fe/assets/` này vào đúng vị trí trong project.
2) Thêm vào `<head>` của các trang FE:
```html
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="canonical" href="https://shophuyvan1.pages.dev/">
<link rel="stylesheet" href="./assets/responsive.css">
<meta name="description" content="Shop Huy Vân - Tổng hợp deal giảm giá, coupon, săn sale các sàn thương mại điện tử.">
<meta property="og:title" content="Shop Huy Vân - Săn deal giảm sâu">
<meta property="og:description" content="Tổng hợp deal hot, mã giảm giá, ưu đãi 10–30% từ các sàn. Cập nhật mỗi ngày.">
<meta property="og:type" content="website">
<meta property="og:url" content="https://shophuyvan1.pages.dev/">
<meta property="og:image" content="https://shophuyvan1.pages.dev/og-cover.jpg">
<meta name="twitter:card" content="summary_large_image">
```
3) Ngay trước `</body>` thêm:
```html
<script src="./assets/app.js" defer></script>
<script type="application/ld+json">
{
  "@context":"https://schema.org",
  "@type":"Organization",
  "name":"Shop Huy Vân",
  "url":"https://shophuyvan1.pages.dev/",
  "logo":"https://shophuyvan1.pages.dev/logo.png",
  "sameAs":["https://www.facebook.com/"]
}
</script>
```
4) Thêm thuộc tính **`loading="lazy"`** và **`alt`** mô tả cho toàn bộ `<img>`.
5) Bọc nội dung chính bằng `.container` để canh lề đẹp trên màn hình lớn.
6) Sử dụng markup gợi ý cho **Header / Nav mobile**, **Lưới sản phẩm**, **Footer** (đoạn mẫu đính kèm dưới).

## Mẫu Header + Nav mobile
```html
<header class="site-header">
  <div class="container site-nav">
    <div class="left">
      <button id="mobile-menu-btn" aria-label="Mở menu" class="md:hidden btn">≡</button>
      <a href="/" class="logo"><img src="/logo.png" alt="Shop Huy Vân" height="36"></a>
    </div>
    <div class="center grow hidden md:block" style="max-width:560px">
      <form class="searchbar" role="search" action="/search">
        <input name="q" placeholder="Tìm kiếm sản phẩm, coupon..." aria-label="Tìm kiếm">
        <button class="btn btn-primary" type="submit">Tìm</button>
      </form>
    </div>
    <div class="right">
      <a class="btn hide-sm" href="/deal-hot">Deal hot</a>
      <a class="btn hide-sm" href="/lien-he">Liên hệ</a>
    </div>
  </div>
  <div id="mobile-drawer" aria-hidden="true">
    <nav class="panel">
      <form class="searchbar" role="search" action="/search" style="margin-bottom:1rem">
        <input name="q" placeholder="Tìm kiếm..." aria-label="Tìm kiếm">
        <button class="btn btn-primary" type="submit">Tìm</button>
      </form>
      <ul style="display:grid; gap:.5rem;">
        <li><a href="/deal-hot" class="btn">Deal hot</a></li>
        <li><a href="/coupon" class="btn">Coupon</a></li>
        <li><a href="/lien-he" class="btn">Liên hệ</a></li>
      </ul>
    </nav>
  </div>
</header>
```

## Mẫu lưới sản phẩm
```html
<section class="section container">
  <div class="head"><h2>Ưu đãi nổi bật</h2></div>
  <div class="products">
    <article class="product-card">
      <a class="thumb"><img src="/imgs/p1.jpg" alt="Tai nghe X" loading="lazy"></a>
      <div class="body">
        <h3 class="title">Tai nghe chống ồn X</h3>
        <div class="price">399.000₫ <s style="opacity:.5">599.000₫</s></div>
        <div class="badges"><span class="badge">-33%</span><span class="badge">Freeship</span></div>
        <a class="btn btn-primary" href="/p/tai-nghe-x">Xem deal</a>
      </div>
    </article>
    <!-- lặp lại ... -->
  </div>
</section>
```

## Mẫu footer 4 cột
```html
<footer class="site-footer">
  <div class="container cols">
    <div><h4>Về chúng tôi</h4><p>Shop Huy Vân tổng hợp mã giảm giá, deal hot.</p></div>
    <div><h4>Danh mục</h4><ul><li><a href="/coupon">Coupon</a></li><li><a href="/deal-hot">Deal hot</a></li></ul></div>
    <div><h4>Hỗ trợ</h4><ul><li><a href="/lien-he">Liên hệ</a></li><li><a href="/bao-mat">Chính sách</a></li></ul></div>
    <div><h4>Theo dõi</h4><a href="#" rel="me">Facebook</a></div>
  </div>
</footer>
```

## Gợi ý SEO kỹ thuật
- Thêm `rel="canonical"` mỗi trang.
- Tiêu đề (title) ≤ 60 ký tự, mô tả (description) 140–160 ký tự riêng từng trang.
- Dùng `schema.org/Product` cho trang chi tiết sản phẩm (giá, tình trạng, rating).
- Thêm **breadcrumb schema** ở trang danh mục.
- Tối ưu CLS: đặt **`width/height`** cho tất cả ảnh và icon.

—
