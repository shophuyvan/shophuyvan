import { CATALOG_ENDPOINT, SHOP } from './config.js';
import { loadWebsiteContent, mergeWebsiteOverride } from './content.js';

const root = document.querySelector('#site-root');
const state = { products: [], content: { settings: {}, banners: [], product_overrides: {} }, loading: true, error: '', cart: loadCart(), gallery: 0 };
const icons = ['⚡', '⌂', '◈', '✦', '◌', '⚙'];

function escapeHtml(value = '') {
  return String(value).replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char]);
}

function toText(value) {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function parseJson(value, fallback = []) {
  if (Array.isArray(value)) return value;
  if (typeof value !== 'string' || !value.trim()) return fallback;
  try { return JSON.parse(value); } catch { return fallback; }
}

function toNumber(value) {
  const numeric = Number(String(value ?? '').replace(/[^0-9.-]/g, ''));
  return Number.isFinite(numeric) ? numeric : 0;
}

function normalizeProduct(item) {
  const images = parseJson(item.images).filter(Boolean);
  const variants = Array.isArray(item.variants) ? item.variants : parseJson(item.variants);
  const explicitPrice = item.price_display ?? item.price_sale ?? item.price ?? item.sale_price ?? null;
  const explicitCategory = item.category_name ?? item.category ?? item.category_slug ?? '';
  return {
    id: toText(item.id ?? item.product_id ?? item.sku),
    sku: toText(item.sku),
    name: toText(item.name ?? item.title ?? item.product_name) || 'Sản phẩm chưa có tên',
    description: toText(item.description ?? item.shortDesc ?? item.short_desc),
    category: toText(explicitCategory),
    image: toText(item.image ?? item.image_url ?? images[0]),
    images: [...new Set([toText(item.image ?? item.image_url), ...images].filter(Boolean))],
    video: toText(item.video_url ?? item.video),
    price: explicitPrice === null || explicitPrice === '' ? null : toNumber(explicitPrice),
    compareAt: toNumber(item.compare_at_display ?? item.price_original ?? item.compare_at),
    stock: item.stock === undefined || item.stock === null ? null : toNumber(item.stock),
    sold: toNumber(item.sold ?? item.sold_count),
    rating: toNumber(item.rating),
    ratingCount: toNumber(item.rating_count ?? item.review_count),
    variants: variants.map((variant) => ({
      id: toText(variant.id ?? variant.sku ?? variant.name),
      name: toText(variant.name ?? variant.title ?? variant.sku),
      sku: toText(variant.sku),
      price: variant.price_sale ?? variant.price ?? null,
      stock: variant.stock ?? null
    })),
    reviewMedia: Array.isArray(item.review_media) ? item.review_media : parseJson(item.review_media)
  };
}

async function loadProducts() {
  state.loading = true;
  render();
  try {
    const [response, content] = await Promise.all([
      fetch(CATALOG_ENDPOINT, { headers: { accept: 'application/json' } }),
      loadWebsiteContent()
    ]);
    if (!response.ok) throw new Error(`catalog_http_${response.status}`);
    const payload = await response.json();
    const rows = Array.isArray(payload) ? payload : (payload.items ?? payload.data ?? []);
    state.content = content;
    state.products = rows.map(normalizeProduct).filter((item) => item.id).map((item) => mergeWebsiteOverride(item, content.product_overrides[item.id]));
    state.error = '';
  } catch (error) {
    state.products = [];
    state.error = 'Không thể kết nối kho sản phẩm. Vui lòng thử lại sau.';
  } finally {
    state.loading = false;
    render();
  }
}

function loadCart() {
  try { return JSON.parse(localStorage.getItem('shv-clean-cart') || '[]'); } catch { return []; }
}

function saveCart() {
  localStorage.setItem('shv-clean-cart', JSON.stringify(state.cart));
}

function cartTotal() { return state.cart.reduce((sum, item) => sum + item.quantity, 0); }
function formatMoney(value) { return value && value > 0 ? `${new Intl.NumberFormat('vi-VN').format(value)}đ` : 'Liên hệ để báo giá'; }
function titleCase(value) { return toText(value).replace(/[-_]/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()); }

function currentPath() { return location.pathname.replace(/\/+$/, '') || '/'; }
function currentRoute() {
  const path = currentPath();
  if (path === '/') return 'home';
  if (path === '/san-pham' || path === '/tim-kiem') return 'catalog';
  if (path.startsWith('/san-pham/')) return 'product';
  if (path === '/khuyen-mai') return 'promotion';
  if (path === '/huong-dan') return 'guide';
  if (path === '/lien-he') return 'contact';
  if (path === '/gio-hang') return 'cart';
  return 'not-found';
}

function link(path, label, route) { return `<a href="${path}" ${currentRoute() === route ? 'aria-current="page"' : ''}>${label}</a>`; }

function brand() {
  return `<a class="brand" href="/" aria-label="Trang chủ Shop Huy Vân"><span class="brand-mark">⌂</span><span><span class="brand-name">SHOP<span>HUYVÂN</span>.vn</span><span class="brand-tag">Đồ gia dụng &amp; thiết bị điện nước</span></span></a>`;
}

function searchBox() {
  const query = new URLSearchParams(location.search).get('q') || '';
  return `<form class="search" data-search><label class="sr-only" for="site-search">Tìm sản phẩm</label><input id="site-search" name="q" value="${escapeHtml(query)}" placeholder="Bạn cần tìm sản phẩm gì..."><button type="submit" aria-label="Tìm kiếm">⌕</button></form>`;
}

function desktopHeader() {
  return `<div class="desktop-header"><div class="topline"><div class="wrap"><span>Chào mừng bạn đến với SHOPHUYVAN.VN</span><span>Hotline / Zalo: <b class="hotline">${SHOP.hotline} · ${SHOP.zalo}</b></span></div></div><header class="header"><div class="wrap"><div class="header-main">${brand()}${searchBox()}<div class="header-actions"><a class="header-link" href="/lien-he">♙ Tài khoản<br>Đăng nhập</a><a class="cart-link" href="/gio-hang">🛒 Giỏ hàng <span class="cart-count">${cartTotal()}</span></a></div></div><div class="address">⌖ ${SHOP.address}</div></div></header><nav class="nav"><div class="wrap"><a class="category-toggle" href="/san-pham">☰ DANH MỤC SẢN PHẨM</a><ul class="main-links"><li>${link('/', '⌂ TRANG CHỦ', 'home')}</li><li>${link('/san-pham', '◈ SẢN PHẨM', 'catalog')}</li><li>${link('/khuyen-mai', '◇ KHUYẾN MÃI', 'promotion')}</li><li>${link('/huong-dan', '▱ HƯỚNG DẪN', 'guide')}</li><li>${link('/lien-he', '✉ LIÊN HỆ', 'contact')}</li></ul></div></nav></div>`;
}

function mobileHeader() {
  return `<div class="mobile-header"><div class="wrap mobile-top">${brand()}<a class="mobile-menu" href="/san-pham" aria-label="Mở danh mục">☰</a></div><div class="wrap mobile-search">${searchBox()}</div><nav class="mobile-nav"><div class="wrap" style="display:flex;gap:2px;">${link('/', 'Trang chủ', 'home')}${link('/san-pham', 'Sản phẩm', 'catalog')}${link('/khuyen-mai', 'Khuyến mãi', 'promotion')}${link('/huong-dan', 'Hướng dẫn', 'guide')}${link('/lien-he', 'Liên hệ', 'contact')}</div></nav></div>`;
}

function header() { return `<div class="shell">${desktopHeader()}${mobileHeader()}`; }
function footer() { return `<footer class="footer"><div class="wrap"><div><strong>SHOP HUY VÂN</strong><p>${SHOP.slogan}. Chọn sản phẩm phù hợp và được tư vấn rõ ràng trước khi mua.</p></div><div><strong>Liên hệ</strong><p>${SHOP.address}</p><p>Hotline/Zalo: ${SHOP.hotline}</p></div><div><strong>Thông tin</strong><p><a href="/huong-dan">Hướng dẫn mua hàng</a></p><p><a href="/lien-he">Liên hệ &amp; hỗ trợ</a></p></div></div></footer></div>`; }

function categories() {
  const grouped = new Map();
  state.products.forEach((product) => {
    if (!product.category) return;
    grouped.set(product.category, (grouped.get(product.category) || 0) + 1);
  });
  return [...grouped].sort((a, b) => b[1] - a[1]);
}

function categoryPanel() {
  const items = categories();
  return `<aside class="category-panel"><h2 class="panel-title">☰ Danh mục sản phẩm</h2><ul class="category-list"><li><a href="/san-pham">Tất cả sản phẩm <span>${state.products.length}</span></a></li>${items.length ? items.map(([name, count]) => `<li><a href="/san-pham?category=${encodeURIComponent(name)}">${escapeHtml(titleCase(name))}<span>${count}</span></a></li>`).join('') : '<li><span style="display:block;padding:11px 14px;color:#61708a;font-size:12px;">Danh mục sẽ hiện khi kho đồng bộ dữ liệu.</span></li>'}</ul></aside>`;
}

function productPicture(product) {
  return product.image ? `<img loading="lazy" src="${escapeHtml(product.image)}" alt="${escapeHtml(product.name)}">` : '<div class="no-image">Sản phẩm chưa có ảnh từ kho</div>';
}

function productCard(product) {
  return `<article class="product-card"><a class="product-picture" href="/san-pham/${encodeURIComponent(product.id)}">${productPicture(product)}</a><div class="product-body"><span class="product-category">${escapeHtml(titleCase(product.category || 'Sản phẩm'))}</span><a class="product-name" href="/san-pham/${encodeURIComponent(product.id)}">${escapeHtml(product.name)}</a><strong class="product-price">${formatMoney(product.price)}</strong><span class="product-meta">${product.rating ? `★ ${product.rating.toFixed(1)}${product.ratingCount ? ` (${product.ratingCount})` : ''}` : product.stock === null ? 'Đang cập nhật kho' : product.stock > 0 ? 'Còn hàng' : 'Tạm hết hàng'}</span><div class="product-actions"><button class="button button-cart" data-add="${escapeHtml(product.id)}">Thêm giỏ</button><a class="button button-buy" href="/san-pham/${encodeURIComponent(product.id)}">Mua ngay</a></div></div></article>`;
}

function productGrid(products, emptyText = 'Chưa có sản phẩm phù hợp.') {
  return products.length ? `<div class="product-grid">${products.map(productCard).join('')}</div>` : `<div class="empty">${emptyText}</div>`;
}

function homePage() {
  const bestsellers = [...state.products].sort((a, b) => b.sold - a.sold).slice(0, 10);
  const hero = bestsellers[0] || state.products[0];
  const banner = state.content.banners.find((item) => item.enabled !== false);
  const heroImageUrl = banner?.desktop_image || hero?.image;
  const heroImage = heroImageUrl ? `<img class="hero-image" src="${escapeHtml(heroImageUrl)}" alt="${escapeHtml(banner?.title || hero?.name || SHOP.name)}">` : '';
  const feature = categories().slice(0, 6);
  const heroTitle = banner?.title || 'Đồ gia dụng tiện ích';
  const heroAccent = banner?.accent || 'giá tốt mỗi ngày';
  const heroText = banner?.description || (hero ? `Đang được khách quan tâm: ${hero.name}` : 'Sản phẩm được đồng bộ trực tiếp từ kho Shop Huy Vân.');
  const target = banner?.source_id ? `/san-pham/${encodeURIComponent(banner.source_id)}` : '/san-pham';
  return `<main class="page"><div class="wrap"><div class="home-grid">${categoryPanel()}<section class="hero">${heroImage}<div class="hero-content"><p class="eyebrow">Shop Huy Vân</p><h1>${escapeHtml(heroTitle)}<br><strong>${escapeHtml(heroAccent)}</strong></h1><p>${escapeHtml(heroText)}</p><div class="hero-meta"><span>${SHOP.address}</span><span>Hotline / Zalo: ${SHOP.hotline} · ${SHOP.zalo}</span></div><div class="hero-actions"><a class="button button-primary" href="${target}">Khám phá sản phẩm</a><a class="button button-secondary" href="/lien-he">Nhắn Zalo</a></div></div></section></div><section class="benefits"><div class="benefit"><i class="benefit-icon">◉</i><span><strong>Sản phẩm</strong><span>Thông tin rõ ràng</span></span></div><div class="benefit"><i class="benefit-icon">₫</i><span><strong>Giá cả</strong><span>Minh bạch theo kho</span></span></div><div class="benefit"><i class="benefit-icon">▣</i><span><strong>Giao hàng</strong><span>Tư vấn trước khi chốt</span></span></div><div class="benefit"><i class="benefit-icon">☏</i><span><strong>Tư vấn</strong><span>Tận tình 24/7</span></span></div><div class="benefit"><i class="benefit-icon">↔</i><span><strong>Đổi trả</strong><span>Hỗ trợ rõ ràng</span></span></div></section><section class="section"><h2 class="section-heading">Danh mục nổi bật <a href="/san-pham">Xem tất cả ›</a></h2>${feature.length ? `<div class="featured-categories">${feature.map(([name], index) => `<a class="featured-category" href="/san-pham?category=${encodeURIComponent(name)}"><span class="category-icon">${icons[index % icons.length]}</span><strong>${escapeHtml(titleCase(name))}</strong></a>`).join('')}</div>` : '<div class="notice">Danh mục chỉ hiển thị sau khi dữ liệu kho có trường danh mục; website không tự gán danh mục sai cho sản phẩm.</div>'}</section><section class="section"><h2 class="section-heading">Sản phẩm được quan tâm <a href="/san-pham">Xem tất cả ›</a></h2>${productGrid(bestsellers)}</section></div></main>`;
}

function catalogPage() {
  const search = new URLSearchParams(location.search).get('q')?.trim() || '';
  const category = new URLSearchParams(location.search).get('category')?.trim() || '';
  const lowered = search.toLocaleLowerCase('vi');
  const products = state.products.filter((product) => (!category || product.category === category) && (!search || `${product.name} ${product.sku} ${product.description}`.toLocaleLowerCase('vi').includes(lowered)));
  const heading = search ? `Kết quả cho “${escapeHtml(search)}”` : category ? titleCase(category) : 'Tất cả sản phẩm';
  return `<main class="page"><div class="wrap"><div class="page-head"><div><p class="crumb">Trang chủ / Sản phẩm</p><h1>${heading}</h1></div><span style="color:#61708a;font-size:13px;">${products.length} sản phẩm</span></div><div class="page-list-grid"><aside class="catalog-sidebar"><div class="section-card"><h2>Danh mục</h2><ul class="category-list"><li><a href="/san-pham">Tất cả sản phẩm <span>${state.products.length}</span></a></li>${categories().map(([name,count])=>`<li><a href="/san-pham?category=${encodeURIComponent(name)}">${escapeHtml(titleCase(name))}<span>${count}</span></a></li>`).join('')}</ul></div></aside><section><form class="section-card filter-bar" data-search><input name="q" value="${escapeHtml(search)}" placeholder="Tìm theo tên hoặc mã sản phẩm"><button class="button button-outline" type="submit">Tìm kiếm</button></form><div style="height:14px"></div>${productGrid(products, search || category ? 'Không tìm thấy sản phẩm phù hợp.' : 'Kho sản phẩm chưa trả dữ liệu.')}</section></div></div></main>`;
}

function findProduct() {
  const rawId = decodeURIComponent(currentPath().replace('/san-pham/', ''));
  return state.products.find((product) => product.id === rawId || product.sku === rawId);
}

function detailPage() {
  const product = findProduct();
  if (!product) return `<main class="page"><div class="wrap"><div class="notice"><strong>Không tìm thấy sản phẩm</strong><p>Sản phẩm có thể đã được cập nhật hoặc chưa đồng bộ từ kho.</p><p><a class="button button-outline" href="/san-pham">Quay về danh sách</a></p></div></div></main>`;
  const selectedImage = product.images[state.gallery] || product.image;
  const variantMarkup = product.variants.length ? `<div class="variant-block"><span class="variant-label">Phân loại / lựa chọn</span><div class="variants">${product.variants.map((variant, index) => `<button class="variant ${index === 0 ? 'selected' : ''}" data-variant="${escapeHtml(variant.id)}">${escapeHtml(variant.name || 'Phân loại')}</button>`).join('')}</div></div>` : '<div class="notice">Sản phẩm hiện chưa có dữ liệu phân loại từ kho.</div>';
  const reviewMedia = product.reviewMedia.filter(Boolean);
  const mediaMarkup = `${product.video ? `<video controls preload="metadata" src="${escapeHtml(product.video)}">Trình duyệt không hỗ trợ video.</video>` : ''}${reviewMedia.map((media) => `<img src="${escapeHtml(media.url ?? media)}" alt="Media đánh giá">`).join('')}`;
  return `<main class="page"><div class="wrap"><p class="crumb">Trang chủ / ${escapeHtml(titleCase(product.category || 'Sản phẩm'))} / ${escapeHtml(product.name)}</p><section class="section-card detail-grid"><div class="gallery"><div class="thumbs">${product.images.map((image, index) => `<button class="thumb ${index === state.gallery ? 'active' : ''}" data-image="${index}"><img src="${escapeHtml(image)}" alt="Ảnh ${index + 1} của ${escapeHtml(product.name)}"></button>`).join('')}</div><div class="main-picture">${selectedImage ? `<img src="${escapeHtml(selectedImage)}" alt="${escapeHtml(product.name)}">` : '<div class="no-image">Sản phẩm chưa có ảnh</div>'}</div></div><div class="detail-info"><h1>${escapeHtml(product.name)}</h1><div class="rating-row"><span class="rating">${product.rating ? `★ ${product.rating.toFixed(1)} / 5` : 'Chưa có đánh giá đồng bộ'}</span>${product.ratingCount ? `<span>${product.ratingCount.toLocaleString('vi-VN')} lượt đánh giá</span>` : ''}${product.sold ? `<span>Đã bán: ${product.sold.toLocaleString('vi-VN')}</span>` : ''}</div><div class="price-box">${formatMoney(product.price)}</div>${product.stock === null ? '<p>Kho đang cập nhật tình trạng còn hàng.</p>' : product.stock > 0 ? '<p style="color:#09844a">Còn hàng</p>' : '<p style="color:#d92d20">Tạm hết hàng</p>'}${variantMarkup}<div class="buy-box"><div><span class="variant-label">Số lượng</span><div class="quantity"><button data-quantity="-1">−</button><output id="quantity">1</output><button data-quantity="1">+</button></div></div><div class="buy-buttons"><button class="button button-cart" data-add="${escapeHtml(product.id)}">🛒 Thêm vào giỏ hàng</button><button class="button button-buy" data-buy="${escapeHtml(product.id)}">Mua ngay</button></div></div></div></section><section class="section-card detail-tabs"><div class="tab-list"><button class="active" data-tab="description">Mô tả sản phẩm</button><button data-tab="media">Đánh giá &amp; media</button></div><div class="tab-panel" data-panel="description">${escapeHtml(product.description || 'Mô tả sản phẩm đang được đồng bộ từ kho.').replace(/\n/g, '<br>')}</div><div class="tab-panel" data-panel="media" hidden>${mediaMarkup ? `<div class="media-grid">${mediaMarkup}</div>` : '<div class="notice">Chưa có review/media được API sàn đồng bộ cho sản phẩm này.</div>'}</div></section></div></main>`;
}

function simplePage(type) {
  const pages = {
    promotion: ['Khuyến mãi', 'Ưu đãi đang hiển thị được lấy từ dữ liệu chiến dịch đã công bố. Website không tự tạo mức giảm giá giả.'],
    guide: ['Hướng dẫn mua hàng', 'Chọn sản phẩm, kiểm tra mô tả và phân loại, sau đó thêm giỏ hoặc liên hệ Zalo để được tư vấn trước khi chốt đơn.'],
    contact: ['Liên hệ Shop Huy Vân', `${SHOP.address}\nHotline / Zalo: ${SHOP.hotline} · ${SHOP.zalo}\nChúng tôi tư vấn sản phẩm gia dụng, dụng cụ tiện ích và thiết bị điện nước.`]
  };
  const [title, content] = pages[type];
  return `<main class="page"><div class="wrap"><div class="content-card" style="padding:28px"><p class="crumb">Trang chủ / ${title}</p><h1 style="margin-top:0;color:#05245f">${title}</h1><p style="white-space:pre-line;line-height:1.8">${content}</p>${type === 'contact' ? `<a class="button button-primary" href="tel:${SHOP.hotline.replace(/\s/g,'')}">Gọi tư vấn</a>` : '<a class="button button-outline" href="/san-pham">Xem sản phẩm</a>'}</div></div></main>`;
}

function cartPage() {
  const lines = state.cart.map((line) => { const product = state.products.find((item) => item.id === line.id); return product ? `<div class="summary-card" style="display:flex;gap:12px;align-items:center;padding:12px;margin-bottom:10px"><div style="width:70px;height:70px">${productPicture(product)}</div><div style="flex:1"><strong>${escapeHtml(product.name)}</strong><p>${formatMoney(product.price)} × ${line.quantity}</p></div><button class="button button-outline" data-remove="${escapeHtml(product.id)}">Bỏ</button></div>` : ''; }).join('');
  return `<main class="page"><div class="wrap"><div class="page-head"><div><p class="crumb">Trang chủ / Giỏ hàng</p><h1>Giỏ hàng</h1></div></div>${lines || '<div class="empty">Giỏ hàng đang trống.</div>'}</div></main>`;
}

function notFoundPage() { return `<main class="page"><div class="wrap"><div class="empty"><h1>Trang không tồn tại</h1><p>Đường dẫn đã được chuẩn hóa. Bạn có thể quay về trang chủ.</p><a class="button button-outline" href="/">Về trang chủ</a></div></div></main>`; }

function content() {
  if (state.loading) return '<main class="page"><div class="wrap"><div class="loading">Đang lấy dữ liệu sản phẩm từ kho…</div></div></main>';
  if (state.error) return `<main class="page"><div class="wrap"><div class="notice"><strong>Không tải được dữ liệu kho</strong><p>${escapeHtml(state.error)}</p><button class="button button-outline" data-reload>Tải lại</button></div></div></main>`;
  switch (currentRoute()) {
    case 'home': return homePage();
    case 'catalog': return catalogPage();
    case 'product': return detailPage();
    case 'promotion': case 'guide': case 'contact': return simplePage(currentRoute());
    case 'cart': return cartPage();
    default: return notFoundPage();
  }
}

function render() {
  root.innerHTML = `${header()}${content()}${footer()}`;
  bindEvents();
}

function navigate(url) { history.pushState({}, '', url); state.gallery = 0; render(); window.scrollTo({ top: 0, behavior: 'instant' }); }

function addToCart(id, buyNow = false) {
  const existing = state.cart.find((item) => item.id === id);
  if (existing) existing.quantity += 1;
  else state.cart.push({ id, quantity: 1 });
  saveCart();
  if (buyNow) navigate('/gio-hang'); else { render(); showToast('Đã thêm sản phẩm vào giỏ hàng.'); }
}

function showToast(message) { const toast = document.createElement('div'); toast.className = 'toast'; toast.textContent = message; document.body.append(toast); setTimeout(() => toast.remove(), 2600); }

function bindEvents() {
  root.querySelectorAll('a[href^="/"]').forEach((anchor) => anchor.addEventListener('click', (event) => { if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return; event.preventDefault(); navigate(anchor.getAttribute('href')); }));
  root.querySelectorAll('[data-search]').forEach((form) => form.addEventListener('submit', (event) => { event.preventDefault(); const query = new FormData(form).get('q')?.toString().trim() || ''; navigate(query ? `/tim-kiem?q=${encodeURIComponent(query)}` : '/san-pham'); }));
  root.querySelectorAll('[data-add]').forEach((button) => button.addEventListener('click', () => addToCart(button.dataset.add)));
  root.querySelectorAll('[data-buy]').forEach((button) => button.addEventListener('click', () => addToCart(button.dataset.buy, true)));
  root.querySelectorAll('[data-remove]').forEach((button) => button.addEventListener('click', () => { state.cart = state.cart.filter((item) => item.id !== button.dataset.remove); saveCart(); render(); }));
  root.querySelectorAll('[data-image]').forEach((button) => button.addEventListener('click', () => { state.gallery = Number(button.dataset.image); render(); }));
  root.querySelectorAll('[data-variant]').forEach((button) => button.addEventListener('click', () => { root.querySelectorAll('[data-variant]').forEach((item) => item.classList.toggle('selected', item === button)); }));
  root.querySelectorAll('[data-tab]').forEach((button) => button.addEventListener('click', () => { root.querySelectorAll('[data-tab]').forEach((item) => item.classList.toggle('active', item === button)); root.querySelectorAll('[data-panel]').forEach((panel) => panel.hidden = panel.dataset.panel !== button.dataset.tab); }));
  root.querySelectorAll('[data-quantity]').forEach((button) => button.addEventListener('click', () => { const output = root.querySelector('#quantity'); output.value = Math.max(1, Number(output.value) + Number(button.dataset.quantity)); output.textContent = output.value; }));
  root.querySelector('[data-reload]')?.addEventListener('click', loadProducts);
}

window.addEventListener('popstate', () => { state.gallery = 0; render(); });
loadProducts();
