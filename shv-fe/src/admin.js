// shv-fe/src/admin.js
import { api } from './lib/api.js';

const $ = (id) => document.getElementById(id);

const routeEl    = $('route');
const menuBtn    = $('menu-btn');
const drawer     = $('drawer');
const tokenInput = $('admin-token');
const saveBtn    = $('save-token');
const csvPicker  = $('csv-picker'); // input file ẩn trong admin.html

// Toggle drawer
menuBtn?.addEventListener('click', () => {
  drawer?.classList.toggle('-translate-x-full');
});

// Lưu ADMIN_TOKEN
saveBtn?.addEventListener('click', () => {
  localStorage.setItem('ADMIN_TOKEN', (tokenInput?.value || '').trim());
  alert('Đã lưu token.');
});

// Khởi tạo
window.addEventListener('hashchange', render);
document.addEventListener('DOMContentLoaded', () => {
  if (tokenInput) tokenInput.value = localStorage.getItem('ADMIN_TOKEN') || '';
  render();
});

// ================= API helpers =================

// Helper gọi API admin: GHÉP base từ #api-base + tự gắn Bearer + stringify JSON.
// Gọi fetch trực tiếp để không bị rơi headers (Authorization) khi đi qua lib/api.js.
export function adminApi(path, init = {}) {
  const baseEl = document.querySelector('#api-base');
  if (!baseEl) throw new Error('#api-base not found in admin.html');

  const base = baseEl.value.trim().replace(/\/+$/, '');
  const url  = `${base}${path.startsWith('/') ? '' : '/'}${path}`;

  const token   = localStorage.getItem('ADMIN_TOKEN') || '';
  const headers = new Headers(init.headers || {});
  if (token) headers.set('Authorization', `Bearer ${token}`);

  // stringify body nếu là object (trừ FormData)
  let body = init.body;
  const isFormData = (typeof FormData !== 'undefined') && (body instanceof FormData);
  if (body && typeof body === 'object' && !isFormData) {
    if (!headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
    body = JSON.stringify(body);
  }

  return fetch(url, { ...init, headers, body }).then(async (res) => {
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`HTTP ${res.status} at ${url}\n${text}`);
    }
    const ct = res.headers.get('content-type') || '';
    return ct.includes('application/json') ? res.json() : res.text();
  });
}

// Expose để test nhanh trong Console
window.adminApi = adminApi;

// Ping helpers (dùng ở trang Cài đặt)
async function pingPublic() {
  const base = document.querySelector('#api-base')?.value?.trim().replace(/\/+$/, '');
  const url  = `${base}/ai/health`;
  const t0 = performance.now();
  const res = await fetch(url);
  const ms = Math.round(performance.now() - t0);
  const body = await res.text();
  return { ok: res.ok, status: res.status, ms, body };
}

async function pingAdminList() {
  const base = document.querySelector('#api-base')?.value?.trim().replace(/\/+$/, '');
  const url  = `${base}/admin/products?limit=1`;
  const token = localStorage.getItem('ADMIN_TOKEN') || '';
  const t0 = performance.now();
  const res = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } });
  const ms = Math.round(performance.now() - t0);
  const body = await res.text();
  return { ok: res.ok, status: res.status, ms, body };
}

// ================= CSV utils =================

/**
 * CSV parser đơn giản, hỗ trợ ô được bao bởi dấu "..."
 * Trả về { headers: string[], rows: string[][] }
 */
function parseCSV(text) {
  const rows = [];
  let row = [];
  let cur = '';
  let quote = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    const next = text[i + 1];

    if (quote) {
      if (c === '"' && next === '"') {
        cur += '"'; i++; // escaped "
      } else if (c === '"') {
        quote = false;
      } else {
        cur += c;
      }
      continue;
    }

    if (c === '"') { quote = true; continue; }
    if (c === ',') { row.push(cur); cur = ''; continue; }
    if (c === '\n') { row.push(cur); rows.push(row); row = []; cur = ''; continue; }
    if (c === '\r') { continue; }

    cur += c;
  }
  row.push(cur);
  rows.push(row);

  const headers = (rows.shift() || []).map(h => (h || '').trim().toLowerCase());
  return { headers, rows };
}

/**
 * Chuẩn hoá 1 dòng CSV -> body sản phẩm cho API
 * (Hỗ trợ nhiều alias tên cột thực tế)
 */
function mapRowToProduct(rowObj) {
  const pick = (...keys) => {
    for (const k of keys) {
      const v = rowObj[k];
      if (v !== undefined && v !== null && String(v).trim() !== '') return String(v).trim();
    }
    return '';
  };

  const toNum = (x) => {
    const s = String(x ?? '').replace(/[^\d.-]/g, '');
    const n = Number(s);
    return Number.isFinite(n) ? n : 0;
  };
  const toNumOrNull = (x) => {
    const s = String(x ?? '').replace(/[^\d.-]/g, '');
    if (s === '') return null;
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
  };
  const toBool = (x) => {
    const v = String(x ?? '').toLowerCase().trim();
    return v === '1' || v === 'true' || v === 'yes' || v === 'y' || v === 'active' || v === 'published';
  };
  const splitList = (s) => String(s ?? '')
    .split(/[\n|,;]+/g)
    .map(t => t.trim())
    .filter(Boolean);

  // gom ảnh từ nhiều kiểu cột
  const images = (() => {
    const list = splitList(
      pick('images', 'image_urls', 'imgs', 'pictures', 'photos', 'image')
    );
    for (let i = 1; i <= 10; i++) {
      const v = rowObj[`image${i}`];
      if (v) list.push(String(v).trim());
    }
    return Array.from(new Set(list)).filter(Boolean);
  })();

  const image_alts = splitList(pick('image_alts', 'alts', 'alt', 'image_alts_csv'));

  return {
    id: pick('id', 'sku', 'product_id') || undefined, // cho phép update theo id/sku
    name: pick('name', 'product_name', 'title', 'ten', 'tên', 'product'),
    description: pick('description', 'desc', 'mo_ta', 'mota', 'content', 'details', 'specs'),
    price: toNum(pick('price', 'gia', 'giá', 'price_vnd', 'price_vnd_numeric')),
    sale_price: toNumOrNull(pick('sale_price', 'gia_khuyen_mai', 'giakhuyenmai', 'discount_price')),
    stock: toNum(pick('stock', 'ton', 'tồn', 'inventory', 'quantity', 'qty', 'stock_qty')),
    category: pick('category', 'danh_muc', 'danhmuc', 'category_name') || 'default',
    weight_grams: toNum(pick('weight_grams', 'weight', 'khoi_luong', 'khoiluong', 'gram', 'grams')),
    images,
    image_alts,
    is_active: toBool(pick('is_active', 'active', 'published', 'enabled')),
  };
}

// ============= Import Preview (chọn & Active hàng loạt) =============
let importBuffer = [];        // mảng các product đã parse
let importSelected = new Set(); // index các dòng đang chọn

function renderImportPreview() {
  const box = $('import-preview');
  if (!box) return;

  if (!importBuffer.length) {
    box.innerHTML = '';
    box.classList.add('hidden');
    return;
  }

  const rows = importBuffer.map((p, i) => `
    <tr class="border-b">
      <td class="p-2 text-center">
        <input type="checkbox" class="row-chk" data-i="${i}" ${importSelected.has(i) ? 'checked' : ''}/>
      </td>
      <td class="p-2">${p.name || ''}</td>
      <td class="p-2">${p.category || ''}</td>
      <td class="p-2">${p.price ?? 0}</td>
      <td class="p-2">${p.stock ?? 0}</td>
      <td class="p-2">${p.is_active ? '✅' : '⛔'}</td>
    </tr>
  `).join('');

  box.classList.remove('hidden');
  box.innerHTML = `
    <div class="border rounded bg-white p-3">
      <div class="flex items-center justify-between">
        <div class="font-medium">Preview CSV (${importBuffer.length} dòng)</div>
        <div class="text-sm">
          <label class="inline-flex items-center gap-2 mr-3">
            <input id="chk-all" type="checkbox" ${importSelected.size === importBuffer.length ? 'checked' : ''}/>
            Chọn tất cả
          </label>
          <button id="btn-activate-selected" class="bg-emerald-600 text-white px-3 py-1 rounded text-sm">
            Xác nhận Active các dòng đã chọn
          </button>
          <button id="btn-clear-preview" class="ml-2 border px-3 py-1 rounded text-sm">Đóng preview</button>
        </div>
      </div>

      <div class="overflow-auto mt-2">
        <table class="min-w-[700px] w-full text-sm">
          <thead>
            <tr class="bg-gray-50 border-b">
              <th class="p-2 w-12 text-center">✔</th>
              <th class="p-2 text-left">Tên</th>
              <th class="p-2 text-left">Danh mục</th>
              <th class="p-2 text-left">Giá</th>
              <th class="p-2 text-left">Tồn</th>
              <th class="p-2 text-left">Active?</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
      <div class="text-xs text-gray-500 mt-2">
        * Khi bấm “Xác nhận Active…”, các dòng được chọn sẽ được <b>upsert</b> với <code>is_active = true</code>.
      </div>
    </div>
  `;

  // events
  $('chk-all')?.addEventListener('change', (e) => {
    if (e.target.checked) {
      importSelected = new Set(importBuffer.map((_, i) => i));
    } else {
      importSelected = new Set();
    }
    renderImportPreview();
  });

  box.querySelectorAll('.row-chk').forEach(chk => {
    chk.addEventListener('change', (e) => {
      const i = Number(e.target.getAttribute('data-i'));
      if (e.target.checked) importSelected.add(i);
      else importSelected.delete(i);
    });
  });

  $('btn-clear-preview')?.addEventListener('click', () => {
    importBuffer = [];
    importSelected = new Set();
    renderImportPreview();
  });

  $('btn-activate-selected')?.addEventListener('click', async () => {
    if (!importSelected.size) {
      alert('Bạn chưa chọn dòng nào.');
      return;
    }
    if (!confirm(`Active ${importSelected.size} sản phẩm?`)) return;

    // lấy items đã chọn và ép is_active = true
    const items = [...importSelected].map(i => ({
      ...importBuffer[i],
      is_active: true,
    }));

    try {
      const r = await adminApi('/admin/products/bulk', { method: 'POST', body: { items } });
      alert(`Bulk xong: OK=${r.ok ?? 0}, Lỗi=${r.fail ?? 0}`);
      // clear preview & reload list
      importBuffer = [];
      importSelected = new Set();
      renderImportPreview();
      location.hash = '#products';
      await render();
    } catch (e) {
      alert('Bulk lỗi: ' + e.message);
    }
  });
}

// ============= Import CSV từ file =============
async function importCSVFromFileToPreview(file) {
  const txt = await file.text();
  const { headers, rows } = parseCSV(txt);
  if (!headers.length) throw new Error('CSV không có header.');

  // map header -> index
  const idx = {};
  headers.forEach((h, i) => idx[h] = i);

  // reset buffer
  importBuffer = [];
  importSelected = new Set();

  // parse toàn bộ vào buffer
  for (const r of rows) {
    const obj = {};
    Object.keys(idx).forEach(k => obj[k] = r[idx[k]]);
    const body = mapRowToProduct(obj);
    importBuffer.push(body);
  }

  // mặc định tick tất cả
  importSelected = new Set(importBuffer.map((_, i) => i));

  renderImportPreview();
}

// ================= AI helpers =================
async function callAI(prompt) {
  // /ai/suggest là public, vẫn dùng helper api() dùng chung
  const r = await api('/ai/suggest', { method: 'POST', body: { prompt } });
  return r.text || r.result || '';
}


// ---- AI helpers ----
async function aiSuggest(payload) {
  try { return await api('/ai/suggest', { method:'POST', body: payload }); }
  catch (e){ console.error(e); return {}; }
}
const VN_NAMES = ['Ngọc','Tú','Anh','Huyền','Lan','Minh','Hải','Phúc','Dũng','Trang','Quân','Vy','Hạnh','Thảo','Dương'];
function avatarDataURI(name='K'){
  const ch = (name||'')[0] || 'K';
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='40' height='40'>
    <rect width='100%' height='100%' fill='#e5e7eb'/>
    <text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle'
          font-family='sans-serif' font-size='18' fill='#374151'>${ch}</text>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
function safeImg(url){
  if (url && String(url).trim()) return url;
  const svg = encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><rect width="100%" height="100%" fill="#f3f4f6"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="10" fill="#9ca3af">No Image</text></svg>');
  return `data:image/svg+xml;utf8,${svg}`;
}

// ---- FAQ DOM helpers ----
function addFaqRow(item={q:'',a:''}){
  const wrap = document.getElementById('faq-list');
  const row = document.createElement('div');
  row.className = 'grid grid-cols-1 md:grid-cols-2 gap-2';
  row.innerHTML = `<input class="border rounded px-3 py-2" placeholder="Câu hỏi" value="${item.q||''}"/>
                   <input class="border rounded px-3 py-2" placeholder="Trả lời" value="${item.a||''}"/>`;
  wrap.appendChild(row);
}
function readFaq(){
  const wrap = document.getElementById('faq-list');
  const rows = wrap ? Array.from(wrap.children) : [];
  return rows.map(r => ({ q: r.children[0].value.trim(), a: r.children[1].value.trim() })).filter(x => x.q || x.a);
}

// ---- Review DOM helpers ----
function addReviewRow(item={name:'',rating:5,content:'',avatar:''}){
  const wrap = document.getElementById('reviews-list');
  const row = document.createElement('div');
  row.className = 'grid grid-cols-1 md:grid-cols-4 gap-2 items-center';
  row.innerHTML = `
    <img src="${item.avatar||avatarDataURI(item.name)}" class="w-10 h-10 rounded-full border"/>
    <input class="border rounded px-3 py-2" placeholder="Tên" value="${item.name||''}"/>
    <select class="border rounded px-3 py-2">
      ${[5,4,3,2,1].map(v=>`<option ${v===(item.rating||5)?'selected':''}>${v}</option>`).join('')}
    </select>
    <input class="border rounded px-3 py-2 md:col-span-2" placeholder="Nội dung" value="${item.content||''}"/>
  `;
  wrap.appendChild(row);
}
function readReviews(){
  const wrap = document.getElementById('reviews-list');
  const rows = wrap ? Array.from(wrap.children) : [];
  return rows.map(r => ({
    avatar: r.querySelector('img').src,
    name: r.children[1].value.trim() || VN_NAMES[Math.floor(Math.random()*VN_NAMES.length)],
    rating: Number(r.children[2].value)||5,
    content: r.children[3].value.trim()
  })).filter(x => x.content);
}

// ---- Variant DOM helpers ----
function addVariantRow(v={image:'',name:'',sku:'',stock:0,weight_grams:0,price:0,sale_price:null}){
  const tbody = document.getElementById('variants-body');
  const tr = document.createElement('tr');
  tr.innerHTML = `
    <td class="p-1 border"><input class="border rounded px-2 py-1 w-28" placeholder="URL ảnh" value="${v.image||''}"/></td>
    <td class="p-1 border"><input class="border rounded px-2 py-1" placeholder="Tên" value="${v.name||''}"/></td>
    <td class="p-1 border"><input class="border rounded px-2 py-1" placeholder="SKU" value="${v.sku||''}"/></td>
    <td class="p-1 border"><input class="border rounded px-2 py-1" type="number" placeholder="Tồn" value="${v.stock||0}"/></td>
    <td class="p-1 border"><input class="border rounded px-2 py-1" type="number" placeholder="gram" value="${v.weight_grams||0}"/></td>
    <td class="p-1 border"><input class="border rounded px-2 py-1" type="number" placeholder="Giá gốc" value="${v.price||0}"/></td>
    <td class="p-1 border"><input class="border rounded px-2 py-1" type="number" placeholder="Giá sale" value="${v.sale_price ?? ''}"/></td>
    <td class="p-1 border"><button class="text-rose-600 text-xs">Xoá</button></td>
  `;
  tr.querySelector('button').onclick = () => tr.remove();
  tbody.appendChild(tr);
}
function readVariants(){
  const tbody = document.getElementById('variants-body');
  const rows = tbody ? Array.from(tbody.children) : [];
  return rows.map(r => ({
    image: r.children[0].querySelector('input').value.trim(),
    name: r.children[1].querySelector('input').value.trim(),
    sku: r.children[2].querySelector('input').value.trim(),
    stock: Number(r.children[3].querySelector('input').value)||0,
    weight_grams: Number(r.children[4].querySelector('input').value)||0,
    price: Number(r.children[5].querySelector('input').value)||0,
    sale_price: r.children[6].querySelector('input').value ? Number(r.children[6].querySelector('input').value) : null,
  })).filter(v => v.name);
}

// ================= RENDER =================

async function render() {
  const hash = (location.hash || '#products').slice(1);

  // ====== Danh sách sản phẩm ======
  if (hash === 'products') {
    routeEl.innerHTML = `
      <div class="flex items-center justify-between">
        <h2 class="font-semibold">Sản phẩm</h2>
        <div class="flex gap-2">
          <button id="import-csv" class="border rounded px-3 py-1 text-sm">Import CSV ▶ Preview</button>
          <button id="delete-all" class="border rounded px-3 py-1 text-sm text-rose-600">Xoá tất cả</button>
        </div>
      </div>

      <div id="import-preview" class="hidden"></div>

      <input id="search" placeholder="Tìm..." class="border rounded px-3 py-1 my-3 w-full"/>
      <div id="list" class="bg-white border rounded"></div>
    `;

    // hiển thị preview nếu đang có buffer
    renderImportPreview();

    // Bind AI & section buttons (editor)

    // Upload media via Cloudinary (signed)
    function createPicker(accept, multiple=true){
      const input = document.createElement('input');
      input.type = 'file'; input.accept = accept; input.multiple = multiple;
      return input;
    }
    async function getSignature(){
      return await adminApi('/upload/signature', { method:'POST', body: { folder: 'products' } });
    }
    async function uploadToCloudinary(file, sig, type='auto'){
      const endpoint = `https://api.cloudinary.com/v1_1/${sig.cloud_name}/${type}/upload`;
      const fd = new FormData();
      fd.append('file', file);
      fd.append('timestamp', sig.timestamp);
      fd.append('api_key', sig.api_key);
      fd.append('signature', sig.signature);
      if (sig.folder) fd.append('folder', sig.folder);
      if (sig.upload_preset) fd.append('upload_preset', sig.upload_preset);
      const res = await fetch(endpoint, { method:'POST', body: fd });
      if (!res.ok) throw new Error('Upload failed');
      return await res.json();
    }
    // Buttons
    const imgPicker = createPicker('image/*', true);
    document.getElementById('btnUploadImages')?.addEventListener('click', () => imgPicker.click());
    imgPicker.onchange = async () => {
      const sig = await getSignature();
      const urls = [];
      for (const f of Array.from(imgPicker.files)){
        const r = await uploadToCloudinary(f, sig, 'image');
        urls.push(r.secure_url || r.url);
      }
      const cur = $('images').value ? $('images').value.split(',').map(s=>s.trim()).filter(Boolean) : [];
      $('images').value = [...cur, ...urls].join(',');
      // ALT gợi ý cho ảnh mới
      try {
        const r = await aiSuggest({ mode:'alt', title:$('name').value.trim() });
        const alts = (r.items||[]);
        if (alts.length){
          const curAlt = $('image_alts').value ? $('image_alts').value.split(',').map(s=>s.trim()) : [];
          $('image_alts').value = [...curAlt, ...alts.slice(0, urls.length)].join(',');
        }
      } catch {}
    };

    const vidPicker = createPicker('video/*', true);
    document.getElementById('btnUploadVideos')?.addEventListener('click', () => vidPicker.click());
    vidPicker.onchange = async () => {
      const sig = await getSignature();
      const urls = [];
      for (const f of Array.from(vidPicker.files)){
        const r = await uploadToCloudinary(f, sig, 'video');
        urls.push(r.secure_url || r.url);
      }
      const cur = $('videos').value ? $('videos').value.split(',').map(s=>s.trim()).filter(Boolean) : [];
      $('videos').value = [...cur, ...urls].join(',');
    };

    if (document.getElementById('faq-add')) {
      document.getElementById('faq-add').onclick = () => addFaqRow();
      document.getElementById('reviews-add').onclick = () => addReviewRow();
      document.getElementById('variant-add').onclick = () => addVariantRow();
      document.getElementById('btnAiTitle').onclick = async () => {
        const r = await aiSuggest({ mode:'title', title:$('name').value.trim(), description:$('description').value.trim() });
        const list = (r.suggestions||[]).slice(0,5).map(s => s.slice(0,120));
        const box = document.getElementById('aiSuggestions');
        box.innerHTML = list.map(s => `<button class='border rounded px-2 py-1 mr-1 mb-1' data-v='${s.replace(/'/g, "&apos;")}' title='${s.length} ký tự'>${s}</button>`).join('');
        box.querySelectorAll('button').forEach(b => b.onclick = () => { $('name').value = b.dataset.v; });
      };
      document.getElementById('btnAiSeo').onclick = async () => {
        const r = await aiSuggest({ mode:'seo', title:$('name').value.trim(), description:$('description').value.trim() });
        $('seo_title').value       = (r.seo_title||'').slice(0,150);
        $('seo_description').value = r.seo_description || '';
        $('seo_keywords').value    = r.seo_keywords || '';
      };
      document.getElementById('btnAiFaq').onclick = async () => {
        const r = await aiSuggest({ mode:'faq', title:$('name').value.trim(), description:$('description').value.trim() });
        const items = (r.items||[]);
        document.getElementById('faq-list').innerHTML='';
        (items.length?items:[{q:'Chính sách bảo hành?',a:'Theo quy định của shop.'}]).forEach(addFaqRow);
      };
      document.getElementById('btnAiReviews').onclick = async () => {
        const r = await aiSuggest({ mode:'reviews', title:$('name').value.trim(), description:$('description').value.trim() });
        const items = (r.items||[]);
        document.getElementById('reviews-list').innerHTML='';
        (items.length?items:[...Array(5)].map((_,i)=>({name:VN_NAMES[i%VN_NAMES.length],rating:5,content:'Hài lòng',avatar:avatarDataURI(VN_NAMES[i%VN_NAMES.length])}))).forEach(addReviewRow);
      };
    }
    

    // List admin (để thấy cả inactive)
    const res = await adminApi('/admin/products?limit=50');
    const items = res.items || [];
    $('list').innerHTML = items.map(p => `
      <div class="flex items-center gap-3 p-3 border-b">
        <img src="${safeImg(p.images?.[0])}" class="w-16 h-16 object-cover rounded"/>
        <div class="flex-1 text-sm">
          <div class="font-medium">${p.name}</div>
          <div>Giá: ${(p.sale_price ?? p.price)} | Tồn: ${p.stock} | Active: ${p.is_active ? '✅' : '⛔'}</div>
        </div>
        <a href="#editor?id=${p.id}" class="text-blue-600 underline text-sm">Sửa</a>
      </div>
    `).join('');

    // Nút Import CSV -> Preview
    $('import-csv').onclick = () => csvPicker?.click();
    csvPicker?.addEventListener('change', async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
        await importCSVFromFileToPreview(file);
      } catch (err) {
        alert('Import lỗi: ' + err.message);
      } finally {
        csvPicker.value = '';
      }
    });

    // Nút Xoá tất cả
    $('delete-all').onclick = deleteAllProducts;

    return;
  }

  // ====== Editor (thêm/sửa) ======
  if (hash.startsWith('editor')) {
    const id = new URLSearchParams(hash.split('?')[1]).get('id');
    // Lấy item từ admin route để có cả inactive
    const item = id ? (await adminApi(`/admin/products/${id}`)).item : null;

    routeEl.innerHTML = `
      <h2 class="font-semibold mb-2">${id ? 'Sửa' : 'Thêm'} sản phẩm</h2>
      <div class="grid gap-2">
        <input id="name" placeholder="Tên" class="border rounded px-3 py-2"/>
        <textarea id="description" placeholder="Mô tả (giữ specs)" class="border rounded px-3 py-2"></textarea>

        <div class="grid grid-cols-2 gap-2">
          <input id="price" type="number" placeholder="Giá" class="border rounded px-3 py-2"/>
          <input id="sale_price" type="number" placeholder="Giá sale" class="border rounded px-3 py-2"/>
          <input id="stock" type="number" placeholder="Tồn" class="border rounded px-3 py-2"/>
          <input id="category" placeholder="Danh mục" class="border rounded px-3 py-2"/>
          <input id="weight_grams" type="number" placeholder="Khối lượng (gram)" class="border rounded px-3 py-2"/>
        </div>

        <input id="images" placeholder="Ảnh (CSV URL)" class="border rounded px-3 py-2"/>
        <button id="btnUploadImages" class="border px-3 py-1 rounded text-sm w-max">Upload ảnh…</button>
        <input id="image_alts" placeholder="ALT ảnh (CSV)" class="border rounded px-3 py-2"/>
        <label class="inline-flex items-center gap-2 text-sm"><input id="is_active" type="checkbox" checked/> Active</label>
        <!-- SEO fields -->
        <div class="grid gap-2 mt-3">
          <input id="seo_title" placeholder="SEO tiêu đề" class="border rounded px-3 py-2"/>
          <textarea id="seo_description" placeholder="SEO mô tả" class="border rounded px-3 py-2"></textarea>
          <input id="seo_keywords" placeholder="SEO từ khoá (phẩy , cách)" class="border rounded px-3 py-2"/>
          <div class="flex flex-wrap gap-2 text-sm">
            <button id="btnAiTitle" class="border px-3 py-1 rounded">AI gợi ý tiêu đề (3–5)</button>
            <button id="btnAiSeo" class="border px-3 py-1 rounded">AI tạo SEO</button>
            <button id="btnAiFaq" class="border px-3 py-1 rounded">AI tạo FAQ</button>
            <button id="btnAiReviews" class="border px-3 py-1 rounded">AI tạo đánh giá</button>
          </div>
          <div id="aiSuggestions" class="text-sm text-gray-600"></div>
        </div>

        <!-- FAQ -->
        <div class="mt-3 p-3 border rounded bg-white">
          <div class="font-medium mb-2">FAQ</div>
          <div id="faq-list" class="space-y-2"></div>
          <button id="faq-add" class="border px-3 py-1 rounded text-sm mt-2">+ Thêm Q/A</button>
        </div>

        <!-- Đánh giá khách hàng -->
        <div class="mt-3 p-3 border rounded bg-white">
          <div class="font-medium mb-2">Đánh giá khách hàng</div>
          <div id="reviews-list" class="space-y-2"></div>
          <button id="reviews-add" class="border px-3 py-1 rounded text-sm mt-2">+ Thêm đánh giá</button>
        </div>

        <!-- Video URLs -->
        <input id="videos" placeholder="Video (CSV URL)" class="border rounded px-3 py-2 mt-3"/>
        <button id="btnUploadVideos" class="border px-3 py-1 rounded text-sm w-max mt-1">Upload video…</button>

        <!-- Variants -->
        <div class="mt-3 p-3 border rounded bg-white">
          <div class="font-medium mb-2">Biến thể</div>
          <table class="w-full text-sm border">
            <thead><tr class="bg-gray-50">
              <th class="p-2 border">Ảnh</th>
              <th class="p-2 border">Tên phân loại</th>
              <th class="p-2 border">SKU</th>
              <th class="p-2 border">Tồn</th>
              <th class="p-2 border">Cân nặng (g)</th>
              <th class="p-2 border">Giá gốc</th>
              <th class="p-2 border">Giá sale</th>
              <th class="p-2 border"></th>
            </tr></thead>
            <tbody id="variants-body"></tbody>
          </table>
          <button id="variant-add" class="border px-3 py-1 rounded text-sm mt-2">+ Thêm biến thể</button>
          <div class="text-xs text-gray-500 mt-1">Giá sale sẽ hiển thị <s>giá gốc</s> <b class="text-rose-600">giá sale</b></div>
        </div>


        <!-- Khối AI trợ giúp -->
        <div class="mt-3 p-3 border rounded bg-white">
          <div class="font-medium mb-2">AI trợ giúp</div>
          <textarea id="aiPrompt" placeholder="Thêm ghi chú/keyword cho AI (tuỳ chọn)" class="border rounded px-3 py-2 w-full"></textarea>
          <div class="flex gap-2 mt-2">
            <button id="btnAiDesc" class="border px-3 py-1 rounded text-sm">Gợi ý mô tả</button>
            <button id="btnAiAlts" class="border px-3 py-1 rounded text-sm">Gợi ý ALT ảnh</button>
          </div>
          <div class="text-xs text-gray-500 mt-2">
            * Gợi ý mô tả (120–250 từ) & ALT ảnh (&le;10 từ). Bạn có thể nhập prompt riêng vào ô trên.
          </div>
        </div>

        <div class="flex gap-2 mt-2">
          <button id="save" class="bg-emerald-600 text-white px-4 py-2 rounded w-max">Lưu</button>
          ${id ? `<button id="delete" class="text-rose-600 border px-4 py-2 rounded">Xoá</button>` : ''}
        </div>
      </div>
    `;

    if (item) {
      $('name').value          = item.name || '';
      $('description').value   = item.description || '';
      $('price').value         = item.price ?? 0;
      $('sale_price').value    = item.sale_price ?? '';
      $('stock').value         = item.stock ?? 0;
      $('category').value      = item.category || '';
      $('weight_grams').value  = item.weight_grams ?? 0;
      $('images').value        = (item.images || []).join(',');
      $('image_alts').value    = (item.image_alts || []).join(',');
      $('is_active').checked   = !!item.is_active;
    }

    $('save').onclick = async () => {
      const body = {
        id: id || undefined,
        name: $('name').value.trim(),
        description: $('description').value.trim(),
        price: Number($('price').value) || 0,
        sale_price: $('sale_price').value ? Number($('sale_price').value) : null,
        stock: Number($('stock').value) || 0,
        category: $('category').value.trim() || 'default',
        weight_grams: Number($('weight_grams').value) || 0,
        images: ($('images').value || '').split(',').map(s => s.trim()).filter(Boolean),
        image_alts: ($('image_alts').value || '').split(',').map(s => s.trim()).filter(Boolean),
        is_active: $('is_active').checked,
        seo: { title: $('seo_title').value.trim(), description: $('seo_description').value.trim(), keywords: $('seo_keywords').value.trim() }
        , faq: readFaq()
        , reviews: readReviews()
        , videos: ($('videos').value || '').split(',').map(s=>s.trim()).filter(Boolean)
        , variants: readVariants()
      };

      await adminApi('/admin/products', { method: 'POST', body });
      alert('Đã lưu');
      location.hash = '#products';
    };

    $('delete')?.addEventListener('click', async () => {
      if (!confirm('Xoá sản phẩm này?')) return;
      await adminApi(`/admin/products/${id}`, { method: 'DELETE' });
      alert('Đã xoá');
      location.hash = '#products';
    });

    // ===== AI buttons =====
    $('btnAiDesc')?.addEventListener('click', async () => {
      const name = $('name').value.trim();
      const extra = $('aiPrompt').value.trim();
      const prompt =
        extra
          ? `${extra}\nHãy viết mô tả bán hàng hấp dẫn (120–250 từ) cho sản phẩm "${name}".`
          : `Hãy viết mô tả bán hàng hấp dẫn (120–250 từ) cho sản phẩm "${name}".`;
      const txt = await callAI(prompt);
      $('description').value = txt;
    });

    $('btnAiAlts')?.addEventListener('click', async () => {
      const name = $('name').value.trim();
      const extra = $('aiPrompt').value.trim();
      const prompt =
        extra
          ? `${extra}\nHãy tạo 5 ALT ảnh ngắn (<=10 từ) cho sản phẩm "${name}". Trả về dạng CSV với dấu phẩy.`
          : `Hãy tạo 5 ALT ảnh ngắn (<=10 từ) cho sản phẩm "${name}". Trả về dạng CSV với dấu phẩy.`;
      const txt = await callAI(prompt);
      $('image_alts').value = (txt || '').replace(/\n/g, ' ').trim();
    });

    return;
  }

  // ====== CÀI ĐẶT & KIỂM TRA KẾT NỐI ======
  if (hash === 'settings') {
    const base = document.querySelector('#api-base')?.value?.trim() || '';
    const token = localStorage.getItem('ADMIN_TOKEN') || '';

    routeEl.innerHTML = `
      <div class="space-y-4">
        <div class="border rounded bg-white p-3">
          <h2 class="font-semibold mb-2">Cài đặt & Kiểm tra kết nối</h2>
          <div class="text-sm">
            <div><b>API Base:</b> <code>${base}</code></div>
            <div><b>ADMIN_TOKEN:</b> <code>${token ? (token.slice(0,4) + '…' + token.slice(-4)) : '(chưa có)'}</code> <span class="text-xs opacity-60">(đổi ở góc trên cùng)</span></div>
          </div>
        </div>

        <div class="border rounded bg-white p-3">
          <div class="flex items-center gap-2">
            <button id="btnPingPublic" class="border rounded px-3 py-1 text-sm">Ping public (/ai/health)</button>
            <button id="btnPingAdmin" class="border rounded px-3 py-1 text-sm">Ping admin (/admin/products)</button>
          </div>
          <pre id="pingLog" class="mt-3 bg-gray-50 p-2 rounded text-xs overflow-auto"></pre>
        </div>

        <div class="border rounded bg-white p-3">
          <div class="font-medium mb-2">Test qua cURL</div>
          <div class="text-xs">Public health</div>
          <pre class="bg-gray-50 p-2 rounded text-xs overflow-auto mb-3">curl -i "${base}/ai/health"</pre>
          <div class="text-xs">Admin list (cần token)</div>
          <pre class="bg-gray-50 p-2 rounded text-xs overflow-auto">curl -i -H "Authorization: Bearer ${token || 'YOUR_ADMIN_TOKEN'}" "${base}/admin/products?limit=1"</pre>
        </div>
      </div>
    `;

    const $log = $('pingLog');
    const write = (txt) => $log.textContent = String(txt);

    $('btnPingPublic')?.addEventListener('click', async () => {
      write('Đang ping public…');
      try {
        const r = await pingPublic();
        write(`Public /ai/health: ${r.ok ? 'OK ✅' : 'FAIL ⛔'} (HTTP ${r.status}, ${r.ms}ms)\n\n${r.body}`);
      } catch (e) {
        write('Lỗi: ' + e.message);
      }
    });

    $('btnPingAdmin')?.addEventListener('click', async () => {
      write('Đang ping admin…');
      try {
        const r = await pingAdminList();
        write(`Admin /admin/products: ${r.ok ? 'OK ✅' : 'FAIL ⛔'} (HTTP ${r.status}, ${r.ms}ms)\n\n${r.body}`);
      } catch (e) {
        write('Lỗi: ' + e.message);
      }
    });

    return;
  }

  // ====== Các trang placeholder khác ======
  if (hash === 'banners')   { routeEl.innerHTML = `<h2 class="font-semibold mb-2">Banner</h2><div class="text-sm">CRUD (dùng API /admin/banners)</div>`; return; }
  if (hash === 'vouchers')  { routeEl.innerHTML = `<h2 class="font-semibold mb-2">Voucher</h2><div class="text-sm">CRUD + Test mã bằng /pricing/preview</div>`; return; }
  if (hash === 'orders')    { routeEl.innerHTML = `<h2 class="font-semibold mb-2">Đơn hàng</h2>`; return; }
  if (hash === 'shipping')  { routeEl.innerHTML = `<h2 class="font-semibold mb-2">Vận chuyển</h2><div class="text-sm">Cài đặt hãng, origin, test health</div>`; return; }
  if (hash === 'users')     { routeEl.innerHTML = `<h2 class="font-semibold mb-2">Người dùng</h2>`; return; }
  if (hash === 'analytics') { routeEl.innerHTML = `<h2 class="font-semibold mb-2">Thống kê</h2>`; return; }
  if (hash === 'marketing') { routeEl.innerHTML = `<h2 class="font-semibold mb-2">Marketing</h2>`; return; }

  routeEl.textContent = '404';
}

// ====== Delete all helper ======
async function deleteAllProducts() {
  if (!confirm('Bạn chắc chắn xoá TẤT CẢ sản phẩm?')) return;

  // lấy nhiều nhất có thể (từ admin list để xóa cả inactive)
  let cursor = '';
  let total = 0;
  do {
    const res = await adminApi(`/admin/products?limit=100&cursor=${encodeURIComponent(cursor)}`);
    const items = res.items || [];
    for (const p of items) {
      try {
        await adminApi(`/admin/products/${p.id}`, { method: 'DELETE' });
        total++;
      } catch (e) {
        console.error('Delete failed', p.id, e);
      }
    }
    cursor = res.nextCursor || '';
  } while (cursor);

  alert(`Đã xoá ${total} sản phẩm.`);
  location.reload();
}
