/* =========================
 *  Admin FE – no custom headers
 *  All admin endpoints pass token via query string.
 *  POST uses URLSearchParams (form-encoded) to avoid CORS preflight.
 * ========================= */

const apiBase = 'https://shv-api.shophuyvan.workers.dev';

// ---------- DOM refs ----------
const $ = (s) => document.querySelector(s);
const listEl = $('#list');

const f = {
  id: $('#pid'),
  name: $('#name'),
  category: $('#category'),
  desc: $('#description'),
  price: $('#price'),
  sale: $('#sale_price'),
  stock: $('#stock'),
  weight: $('#weight'),
  images: $('#images'),
  videos: $('#videos'),
  alts: $('#alts'),
  isActive: $('#is_active'),
  seoTitle: $('#seo_title'),
  seoDesc: $('#seo_description'),
  seoKeywords: $('#seo_keywords'),
  faq: $('#faq'),
  variants: $('#variants'),
  token: $('#token'),
  cldName: $('#cld_name'),
  cldPreset: $('#cld_preset'),
  thumbs: $('#thumbs'),

  btnSaveToken: $('#btnSaveToken'),
  btnReload: $('#btnReload'),
  btnSave: $('#btnSave'),
  btnNew: $('#btnNew'),
  btnDelete: $('#btnDelete'),

  btnUploadImg: $('#btnUploadImg'),
  fileImg: $('#fileImg'),
  btnUploadVid: $('#btnUploadVid'),
  fileVid: $('#fileVid'),

  aiTitle: $('#aiTitle'),
  aiDesc: $('#aiDesc'),
  aiSEO: $('#aiSEO'),
  aiFAQ: $('#aiFAQ'),
  aiReview: $('#aiReview'),
  aiAlt: $('#aiAlt'),
  search: $('#search'),
};

// --------- State ----------
let STATE = {
  items: [],
  cache: new Map(),
  editingId: null,
  loadingList: false,
};

// --------- Storage helpers ----------
const store = {
  get(k, d = '') { try { return localStorage.getItem(k) ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch {} },
};

f.token.value = store.get('admin_token', '');
f.cldName.value = store.get('cld_name', '');
f.cldPreset.value = store.get('cld_preset', '');

// --------- API helpers (NO custom header, NO JSON body) ----------
const qs = (obj={}) => new URLSearchParams(obj).toString();

async function apiGET(path, params = {}) {
  params.token = store.get('admin_token', '');
  const url = `${apiBase}${path}?${qs(params)}`;
  const r = await fetch(url, { method: 'GET' });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

async function apiPOST(path, data = {}, params = {}) {
  params.token = store.get('admin_token', '');
  const url = `${apiBase}${path}?${qs(params)}`;
  // form-encoded body to avoid preflight
  const body = new URLSearchParams({ data: JSON.stringify(data) });
  const r = await fetch(url, { method: 'POST', body });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

async function aiSuggest(payload) {
  // POST form-encoded, no headers
  const url = `${apiBase}/ai/suggest`;
  const body = new URLSearchParams({ data: JSON.stringify(payload), token: store.get('admin_token','') });
  const r = await fetch(url, { method: 'POST', body });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

// ---------- UI helpers ----------
function toast(msg) { alert(msg); }

function csv(arr) { return Array.isArray(arr) ? arr.join(',') : (arr || ''); }
function parseCSV(input) {
  if (!input) return [];
  return input.split(',').map(s => s.trim()).filter(Boolean);
}

function renderThumbs() {
  f.thumbs.innerHTML = '';
  parseCSV(f.images.value).forEach(u => {
    const img = document.createElement('img');
    img.src = u; img.className = 'thumb';
    f.thumbs.appendChild(img);
  });
}

function productToForm(p) {
  STATE.editingId = p.id || null;
  f.id.textContent = p.id || 'mới';

  f.name.value   = p.name || '';
  f.category.value = p.category || 'default';
  f.desc.value   = p.description || '';
  f.price.value  = p.price ?? '';
  f.sale.value   = p.sale_price ?? '';
  f.stock.value  = p.stock ?? '';
  f.weight.value = p.weight ?? '';
  f.images.value = csv(p.images);
  f.videos.value = csv(p.videos);
  f.alts.value   = csv(p.alts);
  f.isActive.checked = !!p.is_active;

  f.seoTitle.value = p.seo?.title || '';
  f.seoDesc.value  = p.seo?.description || '';
  f.seoKeywords.value = csv(p.seo?.keywords);

  f.faq.value = (p.faq || []).map(x => `${x.q}|${x.a}`).join('\n');

  f.variants.value = (p.variants || []).map(v =>
    `${v.name||''}|${v.price||''}|${v.sale_price||''}|${v.origin_price||''}|${v.weight||''}|${v.sku||''}|${v.stock||''}|${v.image||''}`
  ).join('\n');

  renderThumbs();
}

function formToProduct() {
  const variants = (f.variants.value || '').split('\n').map(l => l.trim()).filter(Boolean).map(line => {
    const [name, price, sale, origin, weight, sku, stock, image] = line.split('|').map(s => s?.trim() ?? '');
    return { name, price: +price || 0, sale_price: +sale || 0, origin_price: +origin || 0, weight: +weight || 0, sku, stock: +stock || 0, image };
  });

  const faq = (f.faq.value || '').split('\n').map(l => l.trim()).filter(Boolean).map(line => {
    const [q, a] = line.split('|');
    return { q: q?.trim() ?? '', a: a?.trim() ?? '' };
  });

  return {
    id: STATE.editingId || undefined,
    name: f.name.value.trim(),
    category: f.category.value.trim() || 'default',
    description: f.desc.value.trim(),
    price: +f.price.value || 0,
    sale_price: +f.sale.value || 0,
    stock: +f.stock.value || 0,
    weight: +f.weight.value || 0,
    images: parseCSV(f.images.value),
    videos: parseCSV(f.videos.value),
    alts: parseCSV(f.alts.value),
    is_active: !!f.isActive.checked,
    seo: {
      title: f.seoTitle.value.trim(),
      description: f.seoDesc.value.trim(),
      keywords: parseCSV(f.seoKeywords.value),
    },
    faq,
    variants,
  };
}

function renderList(items) {
  listEl.innerHTML = '';
  items.forEach(p => {
    const row = document.createElement('div');
    row.className = 'flex gap-3 items-center p-2 rounded hover:bg-white/5 cursor-pointer';
    row.innerHTML = `
      <img class="w-12 h-12 object-cover rounded border border-white/10" src="${(p.images?.[0]) || 'https://via.placeholder.com/80x80?text=No+Image'}">
      <div class="flex-1">
        <div class="font-medium">${p.name || '(Tên...)'}</div>
        <div class="text-xs opacity-70">Giá: ${p.price ?? 0} • Tồn: ${p.stock ?? 0} • ID: ${p.id || ''}</div>
      </div>
      <button class="btn text-sm">Sửa</button>
    `;
    row.querySelector('button').addEventListener('click', () => showEditor(p));
    listEl.appendChild(row);
  });
}

let showing = false;
function showEditor(p) {
  if (showing) return;       // guard tránh đệ quy
  showing = true;
  try {
    // lấy từ cache trước
    const cache = STATE.cache.get(p.id);
    productToForm(cache || p);
    if (!cache && p.id) {
      // cập nhật cache (nếu cần) nhưng không clear form
      // (giữ trải nghiệm không "mất dữ liệu")
      STATE.cache.set(p.id, p);
    }
  } finally {
    setTimeout(() => (showing = false), 0);
  }
}

// ---------- Load list ----------
async function loadList() {
  if (STATE.loadingList) return;
  STATE.loadingList = true;
  try {
    const { items = [] } = await apiGET('/admin/products', { limit: 50 });
    STATE.items = items;
    items.forEach(i => STATE.cache.set(i.id, i));
    renderList(items.filter(filterBySearch));
  } catch (e) {
    console.error(e);
    toast('Không tải được danh sách sản phẩm. Kiểm tra token/CORS.');
  } finally {
    STATE.loadingList = false;
  }
}
function filterBySearch(p) {
  const q = (f.search.value || '').toLowerCase();
  if (!q) return true;
  return (p.name || '').toLowerCase().includes(q) || String(p.id || '').includes(q);
}

// ---------- Save / Delete ----------
async function saveProduct() {
  const data = formToProduct();
  try {
    const res = await apiPOST('/admin/products', data); // POST form-encoded
    toast('Lưu thành công!');
    if (res?.item) {
      STATE.cache.set(res.item.id, res.item);
      await loadList();
      // chọn lại item vừa lưu
      showEditor(res.item);
    } else {
      await loadList();
    }
  } catch (e) {
    console.error(e);
    toast('Lưu thất bại!');
  }
}

async function deleteProduct() {
  if (!STATE.editingId) return toast('Chưa có sản phẩm để xóa');
  if (!confirm('Xóa sản phẩm này?')) return;
  try {
    await apiPOST('/admin/products', { id: STATE.editingId, _delete: true });
    toast('Đã xóa');
    STATE.editingId = null;
    productToForm({}); // clear form
    await loadList();
  } catch (e) {
    console.error(e);
    toast('Xóa thất bại');
  }
}

// ---------- Cloudinary unsigned ----------
async function cldUpload(files, type='image') {
  const cloud = f.cldName.value.trim();
  const preset = f.cldPreset.value.trim();
  if (!cloud || !preset) return toast('Nhập Cloudinary cloud_name + upload_preset');

  const out = [];
  for (const file of files) {
    const url = `https://api.cloudinary.com/v1_1/${cloud}/${type}/upload`;
    const fd = new FormData();
    fd.append('upload_preset', preset);
    fd.append('file', file);
    // có thể fd.append('folder','diagnostics') nếu muốn
    const r = await fetch(url, { method:'POST', body: fd });
    const j = await r.json();
    if (j.secure_url) out.push(j.secure_url);
  }
  return out;
}

// ---------- AI buttons ----------
async function doAiTitle() {
  try {
    const j = await aiSuggest({ type:'title', name: f.name.value, description: f.desc.value });
    // pick 1 đề xuất ~ 110 ký tự
    const best = (j.titles || []).map(s => s.trim()).find(s => s.length >= 100 && s.length <= 120) || j.titles?.[0];
    if (best) f.name.value = best;
  } catch (e) { toast('AI tiêu đề lỗi'); }
}
async function doAiDesc() {
  try {
    const j = await aiSuggest({ type:'description', name: f.name.value, description: f.desc.value });
    if (j.description) f.desc.value = j.description;
  } catch (e) { toast('AI mô tả lỗi'); }
}
async function doAiSEO() {
  try {
    const j = await aiSuggest({ type:'seo', name: f.name.value, description: f.desc.value });
    if (j.title) f.seoTitle.value = j.title;
    if (j.description) f.seoDesc.value = j.description;
    if (j.keywords) f.seoKeywords.value = j.keywords.join(',');
  } catch (e) { toast('AI SEO lỗi'); }
}
async function doAiFAQ() {
  try {
    const j = await aiSuggest({ type:'faq', name: f.name.value, description: f.desc.value });
    if (Array.isArray(j.faq)) f.faq.value = j.faq.map(x => `${x.q}|${x.a}`).join('\n');
  } catch (e) { toast('AI FAQ lỗi'); }
}
async function doAiReview() {
  try {
    const j = await aiSuggest({ type:'reviews', name: f.name.value });
    if (Array.isArray(j.reviews)) {
      // gắn review vào cuối mô tả cho nhanh
      const lines = j.reviews.map(r => `• ${r.name}: ${r.text}`).join('\n');
      f.desc.value = (f.desc.value ? f.desc.value + '\n\n' : '') + lines;
    }
  } catch (e) { toast('AI Đánh giá lỗi'); }
}
async function doAiAlt() {
  try {
    const j = await aiSuggest({ type:'alt', name: f.name.value, description: f.desc.value, images: parseCSV(f.images.value) });
    if (Array.isArray(j.alts)) f.alts.value = j.alts.join(',');
  } catch (e) { toast('AI ALT lỗi'); }
}

// ---------- Events ----------
f.btnSaveToken.addEventListener('click', () => {
  store.set('admin_token', f.token.value.trim());
  store.set('cld_name', f.cldName.value.trim());
  store.set('cld_preset', f.cldPreset.value.trim());
  toast('Đã lưu token/Cld');
  loadList();
});
f.btnReload.addEventListener('click', loadList);
f.btnNew.addEventListener('click', () => { STATE.editingId=null; productToForm({ is_active:true, category:'default' }); });
f.btnSave.addEventListener('click', saveProduct);
f.btnDelete.addEventListener('click', deleteProduct);

f.btnUploadImg.addEventListener('click', () => f.fileImg.click());
f.fileImg.addEventListener('change', async (e) => {
  const urls = await cldUpload(e.target.files,'image');
  if (urls?.length) {
    const current = parseCSV(f.images.value);
    f.images.value = csv([...current, ...urls]);
    renderThumbs();
  }
});
f.btnUploadVid.addEventListener('click', () => f.fileVid.click());
f.fileVid.addEventListener('change', async (e) => {
  const urls = await cldUpload(e.target.files,'video');
  if (urls?.length) {
    const current = parseCSV(f.videos.value);
    f.videos.value = csv([...current, ...urls]);
  }
});

f.aiTitle.addEventListener('click', doAiTitle);
f.aiDesc.addEventListener('click', doAiDesc);
f.aiSEO.addEventListener('click', doAiSEO);
f.aiFAQ.addEventListener('click', doAiFAQ);
f.aiReview.addEventListener('click', doAiReview);
f.aiAlt.addEventListener('click', doAiAlt);

f.images.addEventListener('input', renderThumbs);
f.search.addEventListener('input', () => renderList(STATE.items.filter(filterBySearch)));

// ---------- Init ----------
(function init() {
  if (!f.token.value) f.token.value = store.get('admin_token','');
  loadList();
  productToForm({ is_active:true, category:'default' });
})();
