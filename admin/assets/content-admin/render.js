let state;
let pages;
let escapeHtml;
let text;
let formatPrice;
let currentProduct;
let editableValue;
let currentPublished;
let listProducts;

function emptyView(icon, message) {
  return `<div class="ca-empty"><div><i class="fa-solid ${icon}" aria-hidden="true"></i>${escapeHtml(message)}</div></div>`;
}

function loadingView() {
  return '<div class="ca-skeleton" aria-label="Đang tải nội dung"><span></span><span></span><span></span></div>';
}

function loginView() {
  return `<main class="ca-login-page"><form class="ca-login-card" data-ca-login>
    <div class="ca-login-brand"><i class="fa-solid fa-screwdriver-wrench" aria-hidden="true"></i> SHOPHUYVAN.VN</div>
    <h1>Quản trị nội dung website</h1>
    <p>Chỉnh nội dung hiển thị cho khách hàng: banner, thông tin cửa hàng, hình ảnh, video và phần trình bày sản phẩm.</p>
    <div class="ca-field"><label for="ca-email">Tài khoản</label><input id="ca-email" name="email" type="email" autocomplete="username" required></div>
    <div class="ca-field"><label for="ca-password">Mật khẩu</label><input id="ca-password" name="password" type="password" autocomplete="current-password" required></div>
    <button class="ca-button ca-button-primary" type="submit">Đăng nhập</button>
  </form></main>`;
}

function userInitials() {
  return text(state.user?.email || 'AD').slice(0, 2).toUpperCase();
}

function navView() {
  const contentItems = [
    ['banners', 'fa-images', 'Banner'],
    ['products', 'fa-box-open', 'Sản phẩm website'],
    ['settings', 'fa-store', 'Menu & thông tin'],
    ['media', 'fa-photo-film', 'Thư viện ảnh']
  ];
  return `<aside class="ca-sidebar">
    <div class="ca-sidebar-brand"><div class="ca-brand-lockup"><span class="ca-brand-icon"><i class="fa-solid fa-screwdriver-wrench" aria-hidden="true"></i></span><div><strong>SHOP<span>HUYVAN</span>.vn</strong><small>Quản trị nội dung website</small></div></div></div>
    <div class="ca-sidebar-user"><b class="ca-sidebar-avatar">${escapeHtml(userInitials())}</b><div><span>${escapeHtml(state.user?.email || '')}</span><small>Quản trị nội dung</small></div></div>
    <nav class="ca-sidebar-nav" aria-label="Quản trị nội dung">
      <div class="ca-nav-group"><div class="ca-nav-label">Tổng quan</div><button class="ca-nav-button ${state.page === 'overview' ? 'is-active' : ''}" type="button" data-ca-nav="overview"><i class="fa-solid fa-chart-pie" aria-hidden="true"></i>Dashboard</button></div>
      <div class="ca-nav-group"><div class="ca-nav-label">Nội dung website</div>${contentItems.map(([id, icon, label]) => `<button class="ca-nav-button ${state.page === id ? 'is-active' : ''}" type="button" data-ca-nav="${id}"><i class="fa-solid ${icon}" aria-hidden="true"></i>${label}</button>`).join('')}</div>
      <div class="ca-nav-group"><div class="ca-nav-label">Tài khoản</div><button class="ca-nav-button ${state.page === 'password' ? 'is-active' : ''}" type="button" data-ca-nav="password"><i class="fa-solid fa-key" aria-hidden="true"></i>Đổi mật khẩu</button></div>
    </nav>
    <div class="ca-sidebar-foot"><button type="button" data-ca-logout><i class="fa-solid fa-arrow-right-from-bracket" aria-hidden="true"></i> Đăng xuất</button></div>
  </aside>`;
}

function headerView() {
  const page = pages[state.page] || pages.overview;
  const searchValue = state.page === 'products' ? state.productQuery : '';
  return `<header class="ca-topbar">
    <button class="ca-mobile-menu" type="button" data-ca-menu aria-label="Mở menu"><i class="fa-solid fa-bars" aria-hidden="true"></i></button>
    <div class="ca-topbar-left"><div class="ca-page-title"><strong>${escapeHtml(page.title)}</strong><small>${escapeHtml(page.description)}</small></div><form class="ca-topbar-search" data-ca-global-search><input name="query" value="${escapeHtml(searchValue)}" placeholder="Tìm tên hoặc mã sản phẩm..." aria-label="Tìm sản phẩm"><button type="submit" aria-label="Tìm sản phẩm"><i class="fa-solid fa-magnifying-glass" aria-hidden="true"></i></button></form></div>
    <div class="ca-topbar-actions"><button class="ca-topbar-icon" type="button" data-ca-password title="Đổi mật khẩu" aria-label="Đổi mật khẩu"><i class="fa-solid fa-key" aria-hidden="true"></i></button><button class="ca-topbar-icon" type="button" data-ca-reload title="Làm mới" aria-label="Làm mới"><i class="fa-solid fa-rotate-right" aria-hidden="true"></i></button><a class="ca-topbar-view" href="https://shophuyvan.vn" target="_blank" rel="noreferrer"><i class="fa-solid fa-arrow-up-right-from-square" aria-hidden="true"></i> Xem website</a></div>
  </header>`;
}

function overviewView() {
  const infoKeys = ['brand_name', 'slogan', 'address', 'hotline', 'zalo'];
  const completedInfo = infoKeys.filter((key) => text(state.settings[key]).trim()).length;
  return `<section class="ca-dashboard"><div class="ca-dashboard-heading"><div><p class="ca-kicker">Quản trị nội dung website</p><h2>Chào ${escapeHtml(state.user?.email || '')}</h2><p>Chọn khu vực cần cập nhật. Các thay đổi chỉ áp dụng cách website hiển thị cho khách.</p></div></div>
    <div class="ca-stat-grid">
      <article class="ca-card ca-stat-card"><i class="ca-stat-icon fa-solid fa-box-open" aria-hidden="true"></i><div class="ca-stat-body"><span>Sản phẩm có thể chỉnh</span><b>${state.products.length}</b><small>Dữ liệu hiện có trên website</small></div></article>
      <article class="ca-card ca-stat-card"><i class="ca-stat-icon is-orange fa-solid fa-images" aria-hidden="true"></i><div class="ca-stat-body"><span>Banner / slider</span><b>${state.banners.length}</b><small>Ảnh và thông điệp trang chủ</small></div></article>
      <article class="ca-card ca-stat-card"><i class="ca-stat-icon is-green fa-solid fa-photo-film" aria-hidden="true"></i><div class="ca-stat-body"><span>Ảnh & video nội dung</span><b>${state.media.length}</b><small>Đã tải từ máy tính</small></div></article>
      <article class="ca-card ca-stat-card"><i class="ca-stat-icon is-purple fa-solid fa-store" aria-hidden="true"></i><div class="ca-stat-body"><span>Thông tin cửa hàng</span><b>${completedInfo}/5</b><small>Slogan, địa chỉ và số tư vấn</small></div></article>
    </div>
    <div class="ca-dashboard-grid"><article class="ca-card ca-dashboard-panel"><div class="ca-panel-header"><h3>Nội dung cần cập nhật</h3><button class="ca-button ca-button-outline ca-button-compact" type="button" data-ca-nav="banners">Xem banner</button></div><div class="ca-dashboard-list"><button type="button" data-ca-nav="banners"><i class="fa-solid fa-images" aria-hidden="true"></i><span><strong>${state.banners.length ? 'Kiểm tra banner đang hiển thị' : 'Thêm banner đầu tiên'}</strong><small>${state.banners.length ? `${state.banners.length} banner đang được quản lý` : 'Trang chủ đang dùng cụm sản phẩm bán chạy'}</small></span><i class="fa-solid fa-chevron-right" aria-hidden="true"></i></button><button type="button" data-ca-nav="products"><i class="fa-solid fa-pen-to-square" aria-hidden="true"></i><span><strong>Chỉnh nội dung sản phẩm</strong><small>Tên, ảnh, video, mô tả và lựa chọn hiển thị</small></span><i class="fa-solid fa-chevron-right" aria-hidden="true"></i></button><button type="button" data-ca-nav="settings"><i class="fa-solid fa-store" aria-hidden="true"></i><span><strong>Hoàn thiện thông tin cửa hàng</strong><small>Đã điền ${completedInfo}/5 thông tin cần thiết</small></span><i class="fa-solid fa-chevron-right" aria-hidden="true"></i></button></div></article><article class="ca-card ca-dashboard-panel"><div class="ca-panel-header"><h3>Thao tác nhanh</h3></div><div class="ca-quick-grid"><button class="ca-quick-button" type="button" data-ca-nav="banners"><i class="fa-solid fa-images" aria-hidden="true"></i><span><strong>Chỉnh banner</strong><small>Ảnh desktop, mobile và thông điệp</small></span></button><button class="ca-quick-button" type="button" data-ca-nav="products"><i class="fa-solid fa-box-open" aria-hidden="true"></i><span><strong>Chỉnh sản phẩm</strong><small>Nội dung hiển thị cho khách</small></span></button><button class="ca-quick-button" type="button" data-ca-nav="media"><i class="fa-solid fa-photo-film" aria-hidden="true"></i><span><strong>Thư viện ảnh</strong><small>Tải ảnh và video từ máy tính</small></span></button></div></article></div></section>`;
}

function productListView() {
  const products = listProducts();
  return `<aside class="ca-card ca-list-card"><div class="ca-list-head"><h3>Sản phẩm</h3><form class="ca-search-form" data-ca-product-search><input name="query" value="${escapeHtml(state.productQuery)}" placeholder="Tìm tên hoặc mã sản phẩm"><button class="ca-button ca-button-outline ca-button-compact" type="submit">Tìm</button></form></div>
    <div class="ca-product-list">${products.length ? products.map((product) => `<button class="ca-product-button ${state.selectedId === product.id ? 'is-selected' : ''}" type="button" data-ca-product="${escapeHtml(product.id)}"><span class="ca-product-thumb">${product.image ? `<img src="${escapeHtml(product.image)}" alt="">` : 'Chưa có ảnh'}</span><span class="ca-product-copy"><strong title="${escapeHtml(product.name)}">${escapeHtml(product.name)}</strong><small>${escapeHtml(product.sku || product.id)}</small></span></button>`).join('') : emptyView('fa-magnifying-glass', 'Không tìm thấy sản phẩm phù hợp.')}</div>
  </aside>`;
}

function imageChoices(product) {
  if (!product.images.length) return '<p class="ca-field is-wide"><small>Sản phẩm này chưa có ảnh để chọn.</small></p>';
  const active = editableValue('primary_image', product.image);
  return `<div class="ca-field is-wide"><label>Ảnh đang có của sản phẩm</label><div class="ca-image-choices">${product.images.slice(0, 12).map((image) => `<label class="ca-image-choice"><input data-ca-source-image type="radio" name="ca-source-image" value="${escapeHtml(image)}" ${image === active ? 'checked' : ''}><img src="${escapeHtml(image)}" alt="Ảnh sản phẩm"></label>`).join('')}</div></div>`;
}

function basicFields(product) {
  return `<div class="ca-form-grid"><div class="ca-field"><label>Tên hiển thị trên website</label><input name="display_title" value="${escapeHtml(editableValue('display_title', product.name))}"><small>Tên hiện có: ${escapeHtml(product.name)}</small></div><div class="ca-field"><label>Danh mục hiển thị</label><input name="category" value="${escapeHtml(editableValue('category', product.category))}" placeholder="Ví dụ: Dụng cụ tiện ích"><small>Danh mục hiện có: ${escapeHtml(product.category || 'Chưa có danh mục')}</small></div><div class="ca-field"><label>Giá hiển thị trên website</label><input name="display_price" inputmode="numeric" value="${escapeHtml(editableValue('display_price', product.price))}" placeholder="Để trống để dùng giá hiện có"><small>Chỉ đổi cách hiển thị trên web; không đổi giá sàn. Giá gốc: ${escapeHtml(formatPrice(product.price))}</small></div><label class="ca-check-row"><input name="published" type="checkbox" ${currentPublished() ? 'checked' : ''}> Hiển thị sản phẩm này trên website</label></div>`;
}

function mediaFields(product) {
  return `<div class="ca-form-grid">${imageChoices(product)}<div class="ca-field is-wide"><label for="ca-primary-image">Ảnh chính hiển thị</label><input id="ca-primary-image" name="primary_image" value="${escapeHtml(editableValue('primary_image', product.image))}" placeholder="Chọn ảnh ở trên hoặc tải ảnh mới từ máy"><small>Nếu để giống ảnh hiện có, website tiếp tục dùng ảnh của sản phẩm.</small></div><div class="ca-field is-wide"><label>Tải ảnh hoặc video từ máy tính</label><div class="ca-upload-box"><input data-ca-product-media type="file" accept="image/png,image/jpeg,image/webp,video/mp4,video/webm"><small>Chọn ảnh để thay ảnh chính, hoặc chọn video để tự điền vào video giới thiệu.</small></div></div><div class="ca-field is-wide"><label>Video giới thiệu</label><input name="video_url" value="${escapeHtml(editableValue('video_url', product.video))}" placeholder="Tải video từ máy tính ở ô phía trên"><small>Video được lưu trong thư viện nội dung website.</small></div></div>`;
}

function variantFields(product) {
  const labels = product.variants.map((variant) => text(variant?.name || variant?.sku || variant)).filter(Boolean);
  return `<div class="ca-form-grid"><div class="ca-field is-wide"><label>Lựa chọn đang có</label><div class="ca-variant-list">${labels.length ? labels.map((label) => `<span class="ca-variant-chip">${escapeHtml(label)}</span>`).join('') : '<small>Chưa có lựa chọn riêng cho sản phẩm này.</small>'}</div><small>Các lựa chọn hiện có được hiển thị để bạn tham khảo trước khi điều chỉnh nội dung website.</small></div><div class="ca-field is-wide"><label>Ghi chú lựa chọn trên website</label><textarea name="variants" placeholder="Ví dụ: Màu trắng, kích thước 10 cm">${escapeHtml(editableValue('variants', labels.join('\n')))}</textarea></div><div class="ca-field"><label>Giá hiển thị trên website</label><input name="display_price" inputmode="numeric" value="${escapeHtml(editableValue('display_price', product.price))}" placeholder="Để trống để dùng giá hiện có"><small>Không thay đổi giá gốc của sàn.</small></div></div>`;
}

function descriptionFields(product) {
  return `<div class="ca-form-grid"><div class="ca-field"><label>Mô tả ngắn</label><textarea name="short_description" placeholder="Tóm tắt nhanh lợi ích của sản phẩm">${escapeHtml(editableValue('short_description', ''))}</textarea></div><div class="ca-field"><label>Mô tả chi tiết</label><textarea name="description" placeholder="Nội dung chi tiết để khách xem trên trang sản phẩm">${escapeHtml(editableValue('description', product.description))}</textarea><small>Nội dung hiện có đã được nạp sẵn để bạn điều chỉnh.</small></div></div>`;
}

function coreSummaryView(product) {
  const stock = product.stock === null || product.stock === undefined ? 'Chưa có dữ liệu' : `${product.stock} sản phẩm`;
  return `<section class="ca-core-summary" aria-label="Dữ liệu sản phẩm gốc"><div class="ca-core-summary-heading"><i class="fa-solid fa-lock" aria-hidden="true"></i><div><strong>Dữ liệu gốc từ hệ thống</strong><small>Chỉ để xem. Giá và tồn kho của sàn không được thay đổi tại đây.</small></div></div><dl><div><dt>Tên gốc</dt><dd>${escapeHtml(product.name)}</dd></div><div><dt>Mã sản phẩm</dt><dd>${escapeHtml(product.sku || product.id)}</dd></div><div><dt>Danh mục gốc</dt><dd>${escapeHtml(product.category || 'Chưa phân danh mục')}</dd></div><div><dt>Giá gốc</dt><dd>${escapeHtml(formatPrice(product.price))}</dd></div><div><dt>Tồn kho</dt><dd>${escapeHtml(stock)}</dd></div></dl></section>`;
}

function productEditorView() {
  const product = currentProduct();
  if (!product || state.productLoading) return `<section class="ca-card ca-editor-card">${loadingView()}</section>`;
  const tabs = [['basic', 'Cơ bản'], ['media', 'Hình ảnh & video'], ['variants', 'Phân loại & giá'], ['description', 'Mô tả']];
  const fields = state.tab === 'media' ? mediaFields(product) : state.tab === 'variants' ? variantFields(product) : state.tab === 'description' ? descriptionFields(product) : basicFields(product);
  return `<section class="ca-card ca-editor-card"><div class="ca-section-heading"><div><p class="ca-kicker">Chỉnh nội dung hiển thị</p><h2>${escapeHtml(product.name)}</h2><p>Dữ liệu hiện tại đã nạp sẵn. Bạn chỉ cần điều chỉnh phần muốn khách thấy trên website.</p></div></div>${coreSummaryView(product)}<div class="ca-source-summary"><i class="fa-solid fa-circle-info" aria-hidden="true"></i><span>Các trường bên dưới chỉ ghi đè phần trình bày trên website; không cập nhật ngược giá, tồn kho hoặc listing của sàn.</span></div><div class="ca-tabs">${tabs.map(([id, label]) => `<button class="ca-tab ${state.tab === id ? 'is-active' : ''}" type="button" data-ca-tab="${id}">${label}</button>`).join('')}</div><form data-ca-product-form>${fields}<div class="ca-form-actions"><button class="ca-button ca-button-outline" type="button" data-ca-reset-product>Bỏ thay đổi chưa lưu</button><div><button class="ca-button ca-button-primary" type="submit"><i class="fa-solid fa-floppy-disk" aria-hidden="true"></i> Lưu nội dung website</button></div></div></form></section>`;
}

function previewView() {
  const product = currentProduct();
  if (!product) return '';
  const title = editableValue('display_title', product.name) || product.name;
  const image = editableValue('primary_image', product.image) || product.image;
  const price = editableValue('display_price', product.price) || product.price;
  return `<aside class="ca-card ca-preview-card"><h3>Bản xem trước</h3><div class="ca-preview-image">${image ? `<img src="${escapeHtml(image)}" alt="">` : '<i class="fa-solid fa-image" aria-hidden="true"></i>'}</div><h4>${escapeHtml(title)}</h4><div class="ca-preview-price">${escapeHtml(formatPrice(price))}</div><p>${escapeHtml(editableValue('category', product.category) || 'Chưa có danh mục')}</p></aside>`;
}

function productsView() {
  if (!state.products.length && !state.loading) return emptyView('fa-box-open', 'Chưa lấy được danh sách sản phẩm để chỉnh nội dung. Hãy làm mới và thử lại.');
  return `<section><div class="ca-section-heading"><div><p class="ca-kicker">Nội dung sản phẩm</p><h2>Chọn sản phẩm để chỉnh phần hiển thị</h2><p>Không tạo sản phẩm mới tại đây. Mỗi sản phẩm được mở ra với nội dung hiện có để bạn điều chỉnh.</p></div><div class="ca-section-actions"><button class="ca-button ca-button-outline" type="button" data-ca-reload><i class="fa-solid fa-rotate-right" aria-hidden="true"></i> Tải lại danh sách</button></div></div><div class="ca-workspace">${productListView()}${productEditorView()}${previewView()}</div></section>`;
}

function bannerThumb(url) { return url ? `<img src="${escapeHtml(url)}" alt="">` : '<i class="fa-solid fa-image" aria-hidden="true"></i>'; }

function bannerListView() {
  if (!state.banners.length) return emptyView('fa-images', 'Chưa có banner. Hãy thêm banner có ảnh thật và thông tin phù hợp với sản phẩm đang bán.');
  return `<div class="ca-table-wrap"><table class="ca-table"><thead><tr><th>Thứ tự</th><th>Hình ảnh</th><th>Nội dung</th><th>Liên kết</th><th>Hiển thị</th><th></th></tr></thead><tbody>${state.banners.map((banner, index) => `<tr><td class="ca-number">${index + 1}</td><td><div class="ca-banner-thumb">${bannerThumb(banner.desktop_image)}</div></td><td><div class="ca-table-title">${escapeHtml(banner.title || 'Chưa đặt tiêu đề')}</div><small>${escapeHtml(banner.accent || banner.description || 'Chưa có thông điệp phụ')}</small></td><td>${escapeHtml((state.products.find((product) => product.id === banner.source_id) || {}).name || 'Chưa gắn sản phẩm')}</td><td><span class="ca-status ${banner.enabled === false ? 'is-hidden' : ''}">${banner.enabled === false ? 'Tạm ẩn' : 'Đang hiển thị'}</span></td><td><div class="ca-table-actions"><button class="ca-button ca-button-outline ca-button-compact" type="button" data-ca-banner-edit="${index}">Chỉnh sửa</button><button class="ca-button ca-button-danger ca-button-compact" type="button" data-ca-banner-remove="${index}" aria-label="Xóa banner"><i class="fa-solid fa-trash" aria-hidden="true"></i></button></div></td></tr>`).join('')}</tbody></table></div>`;
}

function productOptions(sourceId) {
  return `<option value="">Không gắn sản phẩm</option>${state.products.map((product) => `<option value="${escapeHtml(product.id)}" ${product.id === sourceId ? 'selected' : ''}>${escapeHtml(product.name)}</option>`).join('')}`;
}

function bannerEditorView() {
  if (state.editingBanner === null) return '';
  const source = state.editingBanner >= 0 ? state.banners[state.editingBanner] : {};
  const banner = { enabled: true, sort_order: state.banners.length + 1, ...source };
  const label = state.editingBanner >= 0 ? `Banner ${state.editingBanner + 1}` : 'Banner mới';
  return `<form class="ca-card ca-banner-editor" data-ca-banner-form><div class="ca-section-heading"><div><p class="ca-kicker">${escapeHtml(label)}</p><h2>${state.editingBanner >= 0 ? 'Chỉnh nội dung banner' : 'Thêm banner trang chủ'}</h2><p>Dùng ảnh và thông điệp thật phù hợp với sản phẩm khách đang quan tâm.</p></div><button class="ca-button ca-button-outline" type="button" data-ca-banner-cancel>Quay lại danh sách</button></div><div class="ca-form-grid"><div class="ca-field"><label>Tiêu đề</label><input name="title" value="${escapeHtml(banner.title)}" placeholder="Ví dụ: Đồ gia dụng tiện ích"></div><div class="ca-field"><label>Dòng nhấn</label><input name="accent" value="${escapeHtml(banner.accent)}" placeholder="Ví dụ: Giá tốt mỗi ngày"></div><div class="ca-field"><label>Sản phẩm liên kết</label><select name="source_id">${productOptions(text(banner.source_id))}</select></div><label class="ca-check-row"><input name="enabled" type="checkbox" ${banner.enabled !== false ? 'checked' : ''}> Hiển thị banner này trên trang chủ</label><div class="ca-field"><label>Ảnh desktop</label><input name="desktop_image" value="${escapeHtml(banner.desktop_image)}" placeholder="Chọn ảnh hoặc tải ảnh từ máy"></div><div class="ca-field"><label>Ảnh mobile</label><input name="mobile_image" value="${escapeHtml(banner.mobile_image)}" placeholder="Tải ảnh riêng cho điện thoại nếu cần"></div><div class="ca-field is-wide"><label>Thông điệp phụ</label><textarea name="description" placeholder="Nhóm sản phẩm cửa hàng chuyên bán, lợi ích và cách liên hệ tư vấn.">${escapeHtml(banner.description)}</textarea></div><div class="ca-field is-wide"><label>Tải ảnh banner từ máy tính</label><div class="ca-upload-box"><input data-ca-banner-file type="file" accept="image/png,image/jpeg,image/webp"><small>Ảnh sẽ được điền vào ô ảnh desktop. Bạn có thể đổi sang ảnh mobile sau khi tải.</small></div></div></div><input name="id" type="hidden" value="${escapeHtml(banner.id || '')}"><input name="sort_order" type="hidden" value="${escapeHtml(banner.sort_order)}"><input name="editing_index" type="hidden" value="${state.editingBanner}"><div class="ca-form-actions"><button class="ca-button ca-button-outline" type="button" data-ca-banner-cancel>Hủy</button><div><button class="ca-button ca-button-primary" type="submit"><i class="fa-solid fa-floppy-disk" aria-hidden="true"></i> Lưu banner</button></div></div></form>`;
}

function bannersView() {
  return `<section><div class="ca-section-heading"><div><p class="ca-kicker">Trang chủ</p><h2>Banner / Slider</h2><p>Mỗi banner có thể dùng ảnh desktop, ảnh mobile, slogan, thông tin liên hệ và liên kết đến một sản phẩm thực tế.</p></div><div class="ca-section-actions"><button class="ca-button ca-button-primary" type="button" data-ca-banner-add><i class="fa-solid fa-plus" aria-hidden="true"></i> Thêm banner</button></div></div><article class="ca-card ca-table-card"><div class="ca-table-toolbar"><div><strong>Banner hiện có</strong><p>${state.banners.length ? `Đang quản lý ${state.banners.length} banner` : 'Chưa có banner nào để hiển thị'}</p></div></div>${bannerListView()}</article>${bannerEditorView()}</section>`;
}

function settingsView() {
  const setting = (key, fallback = '') => text(state.settings[key] ?? fallback);
  return `<section class="ca-card ca-settings-card"><div class="ca-section-heading"><div><p class="ca-kicker">Thông tin cửa hàng</p><h2>Menu & thông tin liên hệ</h2><p>Thông tin này xuất hiện ở phần đầu, banner và cuối website để khách nhận diện cửa hàng và liên hệ dễ dàng.</p></div></div><form data-ca-settings-form class="ca-form-grid"><div class="ca-field"><label>Tên thương hiệu</label><input name="brand_name" value="${escapeHtml(setting('brand_name', 'SHOP HUY VÂN'))}"></div><div class="ca-field"><label>Slogan</label><input name="slogan" value="${escapeHtml(setting('slogan', 'Đồ gia dụng tiện ích, giá tốt mỗi ngày'))}"></div><div class="ca-field"><label>Địa chỉ</label><input name="address" value="${escapeHtml(setting('address'))}" placeholder="Địa chỉ cửa hàng"></div><div class="ca-field"><label>Hotline</label><input name="hotline" value="${escapeHtml(setting('hotline'))}" placeholder="Số gọi tư vấn"></div><div class="ca-field"><label>Zalo</label><input name="zalo" value="${escapeHtml(setting('zalo'))}" placeholder="Số nhận tin nhắn Zalo"></div><div class="ca-form-actions ca-field is-wide"><span></span><div><button class="ca-button ca-button-primary" type="submit"><i class="fa-solid fa-floppy-disk" aria-hidden="true"></i> Lưu thông tin website</button></div></div></form></section>`;
}

function mediaVisual(item) { return item.media_type === 'video' ? `<video src="${escapeHtml(item.url)}" muted preload="metadata"></video>` : `<img src="${escapeHtml(item.url)}" alt="${escapeHtml(item.filename)}">`; }

function mediaView() {
  return `<section class="ca-card ca-media-card"><div class="ca-section-heading"><div><p class="ca-kicker">Ảnh và video</p><h2>Thư viện nội dung</h2><p>Tải ảnh JPG, PNG, WebP hoặc video MP4, WebM từ máy tính để dùng cho banner và sản phẩm.</p></div></div><form class="ca-upload-box" data-ca-library-form><input name="file" type="file" accept="image/png,image/jpeg,image/webp,video/mp4,video/webm" required><button class="ca-button ca-button-primary" type="submit"><i class="fa-solid fa-cloud-arrow-up" aria-hidden="true"></i> Tải lên thư viện</button><small>Tối đa 30 MB mỗi tệp.</small></form>${state.media.length ? `<div class="ca-media-grid">${state.media.map((item) => `<a class="ca-media-item" href="${escapeHtml(item.url)}" target="_blank" rel="noreferrer"><span class="ca-media-visual">${mediaVisual(item)}</span><span class="ca-media-copy"><strong title="${escapeHtml(item.filename)}">${escapeHtml(item.filename)}</strong><small>${item.media_type === 'video' ? 'Video' : 'Ảnh'} đã tải</small></span></a>`).join('')}</div>` : emptyView('fa-photo-film', 'Chưa có ảnh hoặc video trong thư viện.')}</section>`;
}

function passwordView() {
  return `<section class="ca-card ca-password-card"><div class="ca-section-heading"><div><p class="ca-kicker">Bảo mật</p><h2>Đổi mật khẩu quản trị</h2><p>Nhập mật khẩu hiện tại và mật khẩu mới có ít nhất 12 ký tự. Sau khi đổi xong, hãy đăng nhập lại.</p></div></div><form data-ca-password-form class="ca-form-grid"><div class="ca-field"><label>Mật khẩu hiện tại</label><input name="old_password" type="password" autocomplete="current-password" required></div><div class="ca-field"><label>Mật khẩu mới</label><input name="new_password" type="password" autocomplete="new-password" minlength="12" required></div><div class="ca-field"><label>Nhập lại mật khẩu mới</label><input name="confirm_password" type="password" autocomplete="new-password" minlength="12" required></div><div class="ca-form-actions ca-field is-wide"><button class="ca-button ca-button-outline" type="button" data-ca-nav="overview">Quay lại</button><div><button class="ca-button ca-button-primary" type="submit">Cập nhật mật khẩu</button></div></div></form></section>`;
}

function pageView() {
  if (state.loading) return loadingView();
  if (state.loadError) return `<div class="ca-card">${emptyView('fa-triangle-exclamation', 'Không thể tải nội dung quản trị. Hãy bấm Làm mới để thử lại.')}</div>`;
  if (state.page === 'banners') return bannersView();
  if (state.page === 'products') return productsView();
  if (state.page === 'settings') return settingsView();
  if (state.page === 'media') return mediaView();
  if (state.page === 'password') return passwordView();
  return overviewView();
}

function confirmView() {
  if (!state.confirm) return '';
  return `<div class="ca-confirm-backdrop" role="dialog" aria-modal="true"><section class="ca-confirm"><h3>${escapeHtml(state.confirm.title)}</h3><p>${escapeHtml(state.confirm.message)}</p><div class="ca-confirm-actions"><button class="ca-button ca-button-outline" type="button" data-ca-confirm-cancel>Hủy</button><button class="ca-button ca-button-danger" type="button" data-ca-confirm-ok>Xóa banner</button></div></section></div>`;
}

function toastView() {
  if (!state.notice) return '';
  const icon = state.notice.kind === 'error' ? 'fa-circle-xmark' : 'fa-circle-check';
  const tone = state.notice.kind === 'error' ? ' is-error' : '';
  return `<div class="ca-toast${tone}"><i class="fa-solid ${icon}" aria-hidden="true"></i>${escapeHtml(state.notice.message)}</div>`;
}

export function render(root, context) {
  ({ state, pages, escapeHtml, text, formatPrice, currentProduct, editableValue, currentPublished, listProducts } = context);
  document.body.classList.toggle('ca-no-scroll', state.menuOpen);
  root.innerHTML = state.user ? `<div class="ca-admin-shell ${state.menuOpen ? 'ca-menu-open' : ''}">${navView()}<div class="ca-overlay" data-ca-menu></div><main class="ca-main">${headerView()}<div class="ca-page">${pageView()}</div></main>${toastView()}${confirmView()}</div>` : `${loginView()}${toastView()}`;
}
