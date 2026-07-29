import { render as renderPage } from './render.js?v=20260729.8';

const API = '/api/content';
const CATALOG = 'https://huyvan-worker-api.nghiemchihuy.workers.dev/api/core/products/public-catalog?limit=110';
const root = document.querySelector('#admin-root');

const state = {
  session: sessionStorage.getItem('shv-content-token') || '',
  user: null,
  products: [],
  overrides: {},
  banners: [],
  settings: {},
  media: [],
  page: 'overview',
  tab: 'basic',
  selectedId: '',
  productQuery: '',
  editingBanner: null,
  loading: false,
  productLoading: false,
  loadError: false,
  notice: null,
  confirm: null,
  menuOpen: false
};

const pages = {
  overview: { title: 'Tổng quan nội dung', description: 'Kiểm tra nhanh nội dung đang hiển thị trên website.' },
  banners: { title: 'Banner website', description: 'Ảnh bán hàng, slogan và thông điệp xuất hiện trên trang chủ.' },
  products: { title: 'Sản phẩm website', description: 'Chọn sản phẩm đang có để điều chỉnh phần hiển thị riêng trên website.' },
  settings: { title: 'Menu & thông tin', description: 'Thông tin thương hiệu, địa chỉ và số liên hệ dành cho khách xem website.' },
  media: { title: 'Thư viện ảnh', description: 'Ảnh và video đã tải từ máy tính để dùng cho nội dung website.' },
  password: { title: 'Đổi mật khẩu', description: 'Cập nhật mật khẩu cho tài khoản quản trị nội dung.' }
};

const escapeHtml = (value = '') => String(value).replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
const mojibakePattern = new RegExp('[\\u00c3\\u00c4]|\\u00e1[\\u00ba\\u00bb]');

function text(value) {
  let output = value === null || value === undefined ? '' : String(value).trim();
  if (!mojibakePattern.test(output)) return output;
  for (let index = 0; index < 2; index += 1) {
    try {
      const bytes = Uint8Array.from(Array.from(output), (character) => character.codePointAt(0) & 255);
      const repaired = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
      if (!repaired || repaired.includes(String.fromCharCode(0xfffd)) || repaired === output) break;
      output = repaired;
      if (!mojibakePattern.test(output)) break;
    } catch { break; }
  }
  return output;
}

function parseList(value) {
  try { return Array.isArray(value) ? value : JSON.parse(value || '[]'); } catch { return []; }
}

function formatPrice(value) {
  if (value === null || value === undefined || value === '') return 'Chưa đặt giá hiển thị';
  const number = Number(String(value).replace(/[^\d]/g, ''));
  return Number.isFinite(number) && number > 0 ? `${new Intl.NumberFormat('vi-VN').format(number)}đ` : text(value);
}

function normalizeProduct(item) {
  const images = parseList(item.images).filter(Boolean);
  const detailImages = [...parseList(item.product_images), ...parseList(item.detail_images)].filter(Boolean);
  const variants = Array.isArray(item.variants) ? item.variants : parseList(item.variants);
  const image = text(item.image ?? item.image_url ?? images[0]);
  return {
    id: text(item.id ?? item.sku),
    sku: text(item.sku),
    name: text(item.name ?? item.title ?? item.product_name) || 'Sản phẩm chưa có tên',
    description: text(item.description),
    category: text(item.category_name ?? item.category ?? item.category_slug),
    image,
    images: [...new Set([image, ...images, ...detailImages].map(text).filter(Boolean))],
    video: text(item.video_url),
    price: item.price_display ?? item.price_final ?? item.price ?? null,
    stock: item.stock ?? null,
    variants
  };
}

async function request(path, options = {}) {
  const headers = new Headers(options.headers || {});
  if (state.session) headers.set('authorization', `Bearer ${state.session}`);
  if (options.body && !(options.body instanceof FormData)) headers.set('content-type', 'application/json');
  const response = await fetch(`${API}${path}`, { ...options, headers });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error('content_request_failed');
  return result;
}

function currentProduct() { return state.products.find((product) => product.id === state.selectedId) || null; }
function currentOverride() { return state.overrides[state.selectedId] || {}; }
function hasOwn(object, key) { return Object.prototype.hasOwnProperty.call(object || {}, key); }
function editableValue(key, fallback = '') { const override = currentOverride(); return hasOwn(override, key) ? text(override[key]) : text(fallback); }
function currentPublished() { const override = currentOverride(); return hasOwn(override, 'published') ? override.published !== false : true; }
function listProducts() {
  const query = state.productQuery.toLocaleLowerCase('vi');
  return state.products.filter((product) => !query || `${product.name} ${product.sku} ${product.id}`.toLocaleLowerCase('vi').includes(query));
}

function render() {
  renderPage(root, { state, pages, escapeHtml, text, formatPrice, currentProduct, editableValue, currentPublished, listProducts });
}

function showNotice(message, kind = 'success') {
  state.notice = { message, kind };
  render();
  window.clearTimeout(showNotice.timer);
  showNotice.timer = window.setTimeout(() => {
    state.notice = null;
    render();
  }, 3500);
}

async function loadSession() {
  if (!state.session) return;
  try { state.user = (await request('/v1/session/me')).user; } catch {
    state.session = '';
    sessionStorage.removeItem('shv-content-token');
  }
}

async function loadCatalog() {
  const response = await fetch(CATALOG, { headers: { accept: 'application/json' } });
  if (!response.ok) throw new Error('catalog_unavailable');
  const body = await response.json();
  const values = Array.isArray(body) ? body : body.products || body.items || body.data || [];
  state.products = values.map(normalizeProduct).filter((product) => product.id);
  if (!state.selectedId && state.products[0]) state.selectedId = state.products[0].id;
}

async function loadContent() {
  const [banners, settings, media] = await Promise.all([
    request('/v1/site/banners'), request('/v1/site/settings'), request('/v1/site/media')
  ]);
  state.banners = banners.items || [];
  state.settings = settings.settings || {};
  state.media = media.items || [];
}

async function selectProduct(id, redraw = true) {
  if (!id || (state.selectedId === id && state.overrides[id])) return;
  state.selectedId = id;
  state.productLoading = true;
  if (redraw) render();
  try { state.overrides[id] = (await request(`/v1/site/products/${encodeURIComponent(id)}`)).item || {}; }
  catch { state.overrides[id] = {}; }
  state.productLoading = false;
  if (redraw) render();
}

async function hydrate() {
  state.loading = true;
  state.loadError = false;
  render();
  try {
    await Promise.all([loadCatalog(), loadContent()]);
    if (state.selectedId) await selectProduct(state.selectedId, false);
  } catch { state.loadError = true; }
  state.loading = false;
  render();
}

async function withBusy(button, task) {
  if (!button || button.disabled) return;
  const previous = button.innerHTML;
  button.disabled = true;
  button.textContent = 'Đang xử lý...';
  try { await task(); } finally {
    if (button.isConnected) {
      button.disabled = false;
      button.innerHTML = previous;
    }
  }
}

function updateOverrideValue(target, key, value, baseline) {
  if (String(value ?? '').trim() === String(baseline ?? '').trim()) delete target[key];
  else target[key] = value;
}

async function saveProduct(form, button) {
  const product = currentProduct();
  if (!product) return;
  const formData = new FormData(form);
  const next = { ...currentOverride() };
  const set = (key, fallback) => {
    if (formData.has(key)) updateOverrideValue(next, key, text(formData.get(key)), fallback);
  };
  set('display_title', product.name);
  set('category', product.category);
  set('display_price', product.price);
  set('primary_image', product.image);
  set('video_url', product.video);
  set('variants', product.variants.map((variant) => text(variant?.name || variant?.sku || variant)).filter(Boolean).join('\n'));
  set('short_description', '');
  set('description', product.description);
  if (formData.has('published')) delete next.published;
  if (form.querySelector('[name="published"]') && !form.querySelector('[name="published"]').checked) next.published = false;
  await withBusy(button, async () => {
    const saved = await request(`/v1/site/products/${encodeURIComponent(product.id)}`, { method: 'PUT', body: JSON.stringify(next) });
    state.overrides[product.id] = saved.item || {};
    showNotice('Đã lưu nội dung hiển thị của sản phẩm.');
  });
}

async function uploadMedia(file) {
  if (!file) return null;
  const form = new FormData();
  form.append('file', file);
  const result = await request('/v1/media', { method: 'POST', body: form });
  const item = {
    ...result.item,
    media_type: result.item?.media_type || (result.item?.type?.startsWith('video/') ? 'video' : 'image')
  };
  state.media = [item, ...state.media];
  return item;
}

async function saveBanner(form, button) {
  const data = new FormData(form);
  const index = Number(data.get('editing_index'));
  const item = {
    id: text(data.get('id')), title: text(data.get('title')), accent: text(data.get('accent')),
    description: text(data.get('description')), desktop_image: text(data.get('desktop_image')),
    mobile_image: text(data.get('mobile_image')), source_id: text(data.get('source_id')),
    enabled: data.get('enabled') === 'on', sort_order: Number(data.get('sort_order')) || state.banners.length + 1
  };
  const items = [...state.banners];
  if (index >= 0) items[index] = item;
  else items.push(item);
  await withBusy(button, async () => {
    const saved = await request('/v1/site/banners', { method: 'PUT', body: JSON.stringify({ items }) });
    state.banners = saved.items || [];
    state.editingBanner = null;
    showNotice('Đã lưu banner website.');
  });
}

async function removeBanner(index, button) {
  const items = state.banners.filter((_, itemIndex) => itemIndex !== index).map((item, itemIndex) => ({ ...item, sort_order: itemIndex + 1 }));
  await withBusy(button, async () => {
    const saved = await request('/v1/site/banners', { method: 'PUT', body: JSON.stringify({ items }) });
    state.banners = saved.items || [];
    state.confirm = null;
    if (state.editingBanner === index) state.editingBanner = null;
    showNotice('Đã xóa banner khỏi website.');
  });
}

async function saveSettings(form, button) {
  const settings = Object.fromEntries(new FormData(form).entries());
  await withBusy(button, async () => {
    const saved = await request('/v1/site/settings', { method: 'PUT', body: JSON.stringify({ settings }) });
    state.settings = saved.settings || {};
    showNotice('Đã lưu thông tin website.');
  });
}

async function changePassword(form, button) {
  const data = new FormData(form);
  if (data.get('new_password') !== data.get('confirm_password')) {
    showNotice('Mật khẩu nhập lại chưa khớp.', 'error');
    return;
  }
  await withBusy(button, async () => {
    await request('/v1/password', { method: 'PUT', body: JSON.stringify(Object.fromEntries(data.entries())) });
    state.session = '';
    state.user = null;
    sessionStorage.removeItem('shv-content-token');
    showNotice('Đã đổi mật khẩu. Hãy đăng nhập lại.');
  });
}

root.addEventListener('click', async (event) => {
  const target = event.target.closest('button, [data-ca-menu]');
  if (!target) return;
  const nav = target.dataset.caNav;
  if (nav) {
    state.page = nav;
    state.menuOpen = false;
    render();
    return;
  }
  if (target.dataset.caMenu !== undefined) {
    state.menuOpen = !state.menuOpen;
    render();
    return;
  }
  if (target.matches('[data-ca-logout]')) {
    state.session = '';
    state.user = null;
    sessionStorage.removeItem('shv-content-token');
    render();
    return;
  }
  if (target.matches('[data-ca-password]')) {
    state.page = 'password';
    render();
    return;
  }
  if (target.matches('[data-ca-reload]')) { await withBusy(target, hydrate); return; }
  if (target.dataset.caProduct) { await selectProduct(target.dataset.caProduct); return; }
  if (target.dataset.caTab) { state.tab = target.dataset.caTab; render(); return; }
  if (target.matches('[data-ca-reset-product]')) { render(); return; }
  if (target.matches('[data-ca-banner-add]')) { state.editingBanner = -1; render(); return; }
  if (target.dataset.caBannerEdit !== undefined) { state.editingBanner = Number(target.dataset.caBannerEdit); render(); return; }
  if (target.matches('[data-ca-banner-cancel]')) { state.editingBanner = null; render(); return; }
  if (target.dataset.caBannerRemove !== undefined) {
    state.confirm = { index: Number(target.dataset.caBannerRemove), title: 'Xóa banner?', message: 'Banner này sẽ không còn hiển thị trên website sau khi bạn xác nhận.' };
    render();
    return;
  }
  if (target.matches('[data-ca-confirm-cancel]')) { state.confirm = null; render(); return; }
  if (target.matches('[data-ca-confirm-ok]') && state.confirm) await removeBanner(state.confirm.index, target);
});

root.addEventListener('change', async (event) => {
  const target = event.target;
  if (target.matches('[data-ca-source-image]')) {
    const input = root.querySelector('[name="primary_image"]');
    if (input) input.value = target.value;
    return;
  }
  if (target.matches('[data-ca-product-media], [data-ca-banner-file]')) {
    const file = target.files?.[0];
    if (!file) return;
    try {
      target.disabled = true;
      const item = await uploadMedia(file);
      const isVideo = item?.media_type === 'video' || item?.type?.startsWith('video/');
      const field = target.matches('[data-ca-banner-file]')
        ? root.querySelector('[data-ca-banner-form] [name="desktop_image"]')
        : root.querySelector(isVideo ? '[name="video_url"]' : '[name="primary_image"]');
      if (field && item?.url) field.value = item.url;
      showNotice(isVideo ? 'Đã tải video và điền vào sản phẩm.' : 'Đã tải ảnh và điền vào nội dung.');
    } catch { showNotice('Chưa tải được tệp. Kiểm tra định dạng hoặc dung lượng rồi thử lại.', 'error'); }
    finally { if (target.isConnected) target.disabled = false; }
  }
});

root.addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.target;
  const submitter = event.submitter || form.querySelector('button[type="submit"]');
  if (form.matches('[data-ca-login]')) {
    const data = Object.fromEntries(new FormData(form).entries());
    try {
      await withBusy(submitter, async () => {
        const result = await request('/v1/session', { method: 'POST', body: JSON.stringify(data) });
        state.session = result.token;
        state.user = result.user;
        sessionStorage.setItem('shv-content-token', result.token);
        await hydrate();
      });
    } catch { showNotice('Tài khoản hoặc mật khẩu chưa đúng.', 'error'); }
    return;
  }
  if (form.matches('[data-ca-product-search]')) { state.productQuery = text(new FormData(form).get('query')); render(); return; }
  if (form.matches('[data-ca-product-form]')) {
    try { await saveProduct(form, submitter); } catch { showNotice('Chưa lưu được nội dung sản phẩm. Hãy thử lại.', 'error'); }
    return;
  }
  if (form.matches('[data-ca-banner-form]')) {
    try { await saveBanner(form, submitter); } catch { showNotice('Chưa lưu được banner. Hãy kiểm tra lại thông tin rồi thử lại.', 'error'); }
    return;
  }
  if (form.matches('[data-ca-settings-form]')) {
    try { await saveSettings(form, submitter); } catch { showNotice('Chưa lưu được thông tin website. Hãy thử lại.', 'error'); }
    return;
  }
  if (form.matches('[data-ca-library-form]')) {
    try {
      await withBusy(submitter, async () => {
        await uploadMedia(new FormData(form).get('file'));
        showNotice('Đã tải tệp vào thư viện.');
      });
    } catch { showNotice('Chưa tải được tệp vào thư viện. Hãy thử lại.', 'error'); }
    return;
  }
  if (form.matches('[data-ca-password-form]')) {
    try { await changePassword(form, submitter); } catch { showNotice('Chưa đổi được mật khẩu. Hãy kiểm tra lại thông tin.', 'error'); }
  }
});

async function boot() {
  await loadSession();
  render();
  if (state.user) await hydrate();
}

boot();
