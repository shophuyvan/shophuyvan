const MIN_CATEGORY_PRODUCT_COUNT = 3;
const OTHER_CATEGORY_KEY = '__other__';
const OTHER_CATEGORY_LABEL = 'Khác';

export function createStorefrontListing(context) {
  const { state, shop, icons, escapeHtml, titleCase, formatMoney, currentPath } = context;

  function rawCategories(products = state.products) {
    const grouped = new Map();
    products.forEach((product) => {
      if (!product.category) return;
      grouped.set(product.category, (grouped.get(product.category) || 0) + 1);
    });
    return [...grouped].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'vi'));
  }

  function smallCategoryNames(products = state.products) {
    return new Set(rawCategories(products)
      .filter(([name, count]) => name === OTHER_CATEGORY_LABEL || count < MIN_CATEGORY_PRODUCT_COUNT)
      .map(([name]) => name));
  }

  function categories(products = state.products) {
    const compact = rawCategories(products)
      .filter(([name, count]) => name !== OTHER_CATEGORY_LABEL && count >= MIN_CATEGORY_PRODUCT_COUNT);
    const otherCount = rawCategories(products)
      .filter(([name, count]) => name === OTHER_CATEGORY_LABEL || count < MIN_CATEGORY_PRODUCT_COUNT)
      .reduce((total, [, count]) => total + count, 0);
    return otherCount ? [...compact, [OTHER_CATEGORY_LABEL, otherCount, OTHER_CATEGORY_KEY]] : compact;
  }

  function categoryHref(key) {
    return `/san-pham?category=${encodeURIComponent(key)}`;
  }

  function categoryLabel(key) {
    return key === OTHER_CATEGORY_KEY ? OTHER_CATEGORY_LABEL : titleCase(key);
  }

  function productMatchesCategory(product, category) {
    if (!category) return true;
    if (category === OTHER_CATEGORY_KEY) return smallCategoryNames().has(product.category);
    return product.category === category;
  }

  function categoryLinks() {
    const items = categories();
    if (!items.length) return '<li><span class="category-empty">Danh mục sẽ hiện khi kho đồng bộ dữ liệu.</span></li>';
    return items.map(([name, count, key = name]) => `<li><a href="${categoryHref(key)}">${escapeHtml(titleCase(name))}<span>${count}</span></a></li>`).join('');
  }

  function categoryPanel() {
    return `<aside class="category-panel"><h2 class="panel-title">☰ Danh mục sản phẩm</h2><ul class="category-list"><li><a href="/san-pham">Tất cả sản phẩm <span>${state.products.length}</span></a></li>${categoryLinks()}</ul></aside>`;
  }

  function productPicture(product, eager = false) {
    return product.image ? `<img ${eager ? 'fetchpriority="high"' : 'loading="lazy"'} src="${escapeHtml(product.image)}" alt="${escapeHtml(product.name)}">` : '<div class="no-image">Sản phẩm chưa có ảnh từ kho</div>';
  }

  function displayCategory(product) {
    if (!product.category) return 'Sản phẩm';
    return smallCategoryNames().has(product.category) ? OTHER_CATEGORY_LABEL : titleCase(product.category);
  }

  function productCard(product) {
    return `<article class="product-card"><a class="product-picture" href="/san-pham/${encodeURIComponent(product.id)}">${productPicture(product)}</a><div class="product-body"><span class="product-category">${escapeHtml(displayCategory(product))}</span><a class="product-name" href="/san-pham/${encodeURIComponent(product.id)}">${escapeHtml(product.name)}</a><strong class="product-price">${formatMoney(product.price)}</strong><span class="product-meta">${product.rating ? `★ ${product.rating.toFixed(1)}${product.ratingCount ? ` (${product.ratingCount})` : ''}` : product.stock === null ? 'Đang cập nhật kho' : product.stock > 0 ? 'Còn hàng' : 'Tạm hết hàng'}</span><div class="product-actions"><button class="button button-cart" data-add="${escapeHtml(product.id)}">Thêm giỏ</button><a class="button button-buy" href="/san-pham/${encodeURIComponent(product.id)}">Mua ngay</a></div></div></article>`;
  }

  function productGrid(products, emptyText = 'Chưa có sản phẩm phù hợp.') {
    return products.length ? `<div class="product-grid">${products.map(productCard).join('')}</div>` : `<div class="empty">${emptyText}</div>`;
  }

  function enabledBanners() {
    return (state.content.banners || [])
      .filter((item) => item?.enabled !== false)
      .sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0));
  }

  function heroVisual(banner, bestsellers) {
    if (banner?.desktop_image) {
      const mobileSource = banner.mobile_image ? `<source media="(max-width: 1024px)" srcset="${escapeHtml(banner.mobile_image)}">` : '';
      return `<div class="hero-visual hero-visual-banner"><picture>${mobileSource}<img class="hero-image" fetchpriority="high" src="${escapeHtml(banner.desktop_image)}" alt="${escapeHtml(banner.title || shop.name)}"></picture></div>`;
    }
    const featured = bestsellers.slice(0, 4);
    return `<div class="hero-visual hero-visual-products" aria-label="Sản phẩm được quan tâm">${featured.length ? `<div class="hero-products">${featured.map((product) => `<a class="hero-product" href="/san-pham/${encodeURIComponent(product.id)}">${productPicture(product, true)}</a>`).join('')}</div>` : '<span class="hero-visual-empty">Sản phẩm đang được cập nhật</span>'}</div>`;
  }

  function heroDots(banners) {
    if (banners.length < 2) return '';
    const active = state.bannerSlide % banners.length;
    return `<div class="hero-pagination" aria-label="Chọn banner">${banners.map((item, index) => `<button class="hero-dot ${index === active ? 'active' : ''}" type="button" data-hero-slide="${index}" aria-label="Xem banner ${index + 1}" aria-current="${index === active ? 'true' : 'false'}"></button>`).join('')}</div>`;
  }

  function homePage() {
    const bestsellers = [...state.products].sort((a, b) => b.sold - a.sold).slice(0, 10);
    const banners = enabledBanners();
    const banner = banners.length ? banners[state.bannerSlide % banners.length] : null;
    const feature = categories().slice(0, 6);
    const heroTitle = banner?.title || 'Đồ gia dụng tiện ích';
    const heroAccent = banner?.accent || 'giá tốt mỗi ngày';
    const heroText = banner?.description || 'Sản phẩm tiện ích được khách quan tâm tại Shop Huy Vân.';
    const target = banner?.source_id ? `/san-pham/${encodeURIComponent(banner.source_id)}` : '/san-pham';
    return `<main class="page"><div class="wrap"><div class="home-grid">${categoryPanel()}<section class="hero">${heroVisual(banner, bestsellers)}<div class="hero-content"><p class="eyebrow">Shop Huy Vân</p><h1>${escapeHtml(heroTitle)}<br><strong>${escapeHtml(heroAccent)}</strong></h1><p>${escapeHtml(heroText)}</p><div class="hero-meta"><span>${shop.address}</span><span>Hotline / Zalo: ${shop.hotline} · ${shop.zalo}</span></div><div class="hero-actions"><a class="button button-primary" href="${target}">Khám phá sản phẩm</a><a class="button button-secondary" href="/lien-he">Nhắn Zalo</a></div></div>${heroDots(banners)}</section></div><section class="benefits"><div class="benefit"><i class="benefit-icon">◉</i><span><strong>Sản phẩm</strong><span>Thông tin rõ ràng</span></span></div><div class="benefit"><i class="benefit-icon">₫</i><span><strong>Giá cả</strong><span>Minh bạch theo kho</span></span></div><div class="benefit"><i class="benefit-icon">▣</i><span><strong>Giao hàng</strong><span>Tư vấn trước khi chốt</span></span></div><div class="benefit"><i class="benefit-icon">☏</i><span><strong>Tư vấn</strong><span>Tận tình 24/7</span></span></div><div class="benefit"><i class="benefit-icon">↔</i><span><strong>Đổi trả</strong><span>Hỗ trợ rõ ràng</span></span></div></section><section class="section"><h2 class="section-heading">Danh mục nổi bật <a href="/san-pham">Xem tất cả ›</a></h2>${feature.length ? `<div class="featured-categories">${feature.map(([name,, key = name], index) => `<a class="featured-category" href="${categoryHref(key)}"><span class="category-icon">${icons[index % icons.length]}</span><strong>${escapeHtml(titleCase(name))}</strong></a>`).join('')}</div>` : '<div class="notice">Danh mục chỉ hiển thị sau khi dữ liệu kho có trường danh mục; website không tự gán danh mục sai cho sản phẩm.</div>'}</section><section class="section"><h2 class="section-heading">Sản phẩm được quan tâm <a href="/san-pham">Xem tất cả ›</a></h2>${productGrid(bestsellers)}</section></div></main>`;
  }

  function catalogPage() {
    const search = new URLSearchParams(location.search).get('q')?.trim() || '';
    const category = new URLSearchParams(location.search).get('category')?.trim() || '';
    const lowered = search.toLocaleLowerCase('vi');
    const remoteSearch = currentPath() === '/tim-kiem' && Boolean(search);
    const source = remoteSearch && state.searchResults.query === search ? state.searchResults.items : state.products;
    const products = source.filter((product) => productMatchesCategory(product, category) && (!remoteSearch || `${product.id} ${product.name} ${product.sku} ${product.description}`.toLocaleLowerCase('vi').includes(lowered)));
    const heading = search ? `Kết quả cho “${escapeHtml(search)}”` : category ? categoryLabel(category) : 'Tất cả sản phẩm';
    return `<main class="page"><div class="wrap"><div class="page-head"><div><p class="crumb">Trang chủ / Sản phẩm</p><h1>${heading}</h1></div><span class="catalog-total">${products.length} sản phẩm</span></div><div class="page-list-grid"><aside class="catalog-sidebar"><div class="section-card"><h2>Danh mục</h2><ul class="category-list"><li><a href="/san-pham">Tất cả sản phẩm <span>${state.products.length}</span></a></li>${categoryLinks()}</ul></div></aside><section><form class="section-card filter-bar" data-search><input name="q" value="${escapeHtml(search)}" placeholder="Tìm theo tên hoặc mã sản phẩm"><button class="button button-outline" type="submit">Tìm kiếm</button></form><div class="catalog-gap"></div>${productGrid(products, search || category ? 'Không tìm thấy sản phẩm phù hợp.' : 'Kho sản phẩm chưa trả dữ liệu.')}</section></div></div></main>`;
  }

  function rotateHeroBanner() {
    const banners = enabledBanners();
    if (banners.length < 2) return false;
    state.bannerSlide = (state.bannerSlide + 1) % banners.length;
    return true;
  }

  return { homePage, catalogPage, productPicture, rotateHeroBanner };
}
