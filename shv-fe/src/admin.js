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

// Expose để test nhanh trong Console: adminApi('/admin/products', {...})
window.adminApi = adminApi;

function navLink(h, label){ return `<a href="#${h}" class="underline">${label}</a>`; }

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
 * Chuyển 1 object theo headers -> body SP cho API
 */
function mapRowToProduct(obj) {
  // chấp nhận images/image_alts phân tách bằng "," hoặc "|"
  const splitList = (s) => (s || '')
    .split(/[|,]/g)
    .map(x => x.trim())
    .filter(Boolean);

  const toNum = (x) => {
    const n = Number(x);
    return Number.isFinite(n) ? n : 0;
  };

  const toNumOrNull = (x) => {
    if (x === undefined || x === null || String(x).trim() === '') return null;
    const n = Number(x);
    return Number.isFinite(n) ? n : null;
  };

  const toBool = (x) => {
    const v = String(x || '').toLowerCase().trim();
    return v === '1' || v === 'true' || v === 'yes';
  };

  return {
    name: obj.name || '',
    description: obj.description || '',
    price: toNum(obj.price),
    sale_price: toNumOrNull(obj.sale_price),
    stock: toNum(obj.stock),
    category: obj.category || 'default',
    weight_grams: toNum(obj.weight_grams),
    images: splitList(obj.images),
    image_alts: splitList(obj.image_alts),
    is_active: toBool(obj.is_active),
  };
}

async function importCSVFromFile(file) {
  const txt = await file.text();
  const { headers, rows } = parseCSV(txt);
  if (!headers.length) throw new Error('CSV không có header.');

  // map header -> index
  const idx = {};
  headers.forEach((h, i) => idx[h] = i);

  // name, description, price, sale_price, stock, category, weight_grams, images, image_alts, is_active
  let ok = 0, fail = 0;
  for (const r of rows) {
    const obj = {};
    Object.keys(idx).forEach(k => obj[k] = r[idx[k]]);

    const body = mapRowToProduct(obj);
    try {
      await adminApi('/admin/products', { method: 'POST', body });
      ok++;
    } catch (e) {
      console.error('Import row failed:', obj, e);
      fail++;
    }
  }
  return { ok, fail };
}

async function deleteAllProducts() {
  if (!confirm('Bạn chắc chắn xoá TẤT CẢ sản phẩm?')) return;

  // lấy nhiều nhất có thể
  let cursor = '';
  let total = 0;
  do {
    const res = await adminApi(`/products?limit=100&cursor=${encodeURIComponent(cursor)}`);
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

// ================= AI helpers =================
async function callAI(prompt) {
  // /ai/suggest là public, vẫn dùng helper api() dùng chung
  const r = await api('/ai/suggest', { method: 'POST', body: { prompt } });
  return r.text || r.result || '';
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
          <button id="import-csv" class="border rounded px-3 py-1 text-sm">Import CSV</button>
          <button id="delete-all" class="border rounded px-3 py-1 text-sm text-rose-600">Xoá tất cả</button>
        </div>
      </div>
      <input id="search" placeholder="Tìm..." class="border rounded px-3 py-1 my-3 w-full"/>
      <div id="list" class="bg-white border rounded"></div>
    `;

    const res = await adminApi('/products?limit=50');
    const items = res.items || [];
    $('list').innerHTML = items.map(p => `
      <div class="flex items-center gap-3 p-3 border-b">
        <img src="${(p.images?.[0]) || 'https://via.placeholder.com/80'}" class="w-16 h-16 object-cover rounded"/>
        <div class="flex-1 text-sm">
          <div class="font-medium">${p.name}</div>
          <div>Giá: ${(p.sale_price ?? p.price)} | Tồn: ${p.stock} | Active: ${p.is_active ? '✅' : '⛔'}</div>
        </div>
        <a href="#editor?id=${p.id}" class="text-blue-600 underline text-sm">Sửa</a>
      </div>
    `).join('');

    // Nút Import CSV
    $('import-csv').onclick = () => csvPicker?.click();
    csvPicker?.addEventListener('change', async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      $('import-csv').disabled = true;
      $('import-csv').textContent = 'Đang import...';
      try {
        const { ok, fail } = await importCSVFromFile(file);
        alert(`Import xong: OK=${ok}, Lỗi=${fail}`);
        location.reload();
      } catch (err) {
        alert('Import lỗi: ' + err.message);
      } finally {
        $('import-csv').disabled = false;
        $('import-csv').textContent = 'Import CSV';
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
    const item = id ? (await adminApi(`/products/${id}`)).item : null;

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
        <input id="image_alts" placeholder="ALT ảnh (CSV)" class="border rounded px-3 py-2"/>
        <label class="inline-flex items-center gap-2 text-sm"><input id="is_active" type="checkbox"/> Active</label>

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
