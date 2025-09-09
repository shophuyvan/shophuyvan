// shv-fe/src/admin.js
import { api } from './lib/api.js';

const $ = (id) => document.getElementById(id);

const routeEl    = $('route');
const menuBtn    = $('menu-btn');
const drawer     = $('drawer');
const tokenInput = $('admin-token');
const saveBtn    = $('save-token');

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

// Helper gọi API admin: tự gắn Bearer token
export function adminApi(path, init = {}) {
  const token = localStorage.getItem('ADMIN_TOKEN') || '';
  const headers = new Headers(init.headers || {});
  if (token) headers.set('Authorization', `Bearer ${token}`);
  return api(path, { ...init, headers });
}

// ====== AI Helper (dùng endpoint /ai/suggest) ======
async function callAI(prompt) {
  const r = await api('/ai/suggest', { method: 'POST', body: { prompt } });
  return r.text || r.result || '';
}

function navLink(h, label){ return `<a href="#${h}" class="underline">${label}</a>`; }

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

    // NOTE: endpoint public demo /products. Nếu bạn đã có /admin/products (list),
    // đổi xuống adminApi('/admin/products?limit=50') để có đủ dữ liệu admin.
    const res = await api('/products?limit=50');
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
    return;
  }

  // ====== Editor (thêm/sửa) ======
  if (hash.startsWith('editor')) {
    const id = new URLSearchParams(hash.split('?')[1]).get('id');
    // Nếu đã có endpoint admin: dùng adminApi(`/admin/products/${id}`)
    const item = id ? (await api(`/products/${id}`)).item : null;

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

        <!-- 👉 Khối “AI trợ giúp” -->
        <div class="border rounded p-3 bg-sky-50">
          <div class="text-sm font-medium mb-2">AI trợ giúp</div>
          <textarea id="aiPrompt" class="border rounded px-3 py-2 w-full" placeholder="Gợi ý thêm cho AI, vd: khách DIY, nhấn mạnh bảo hành 1 đổi 1..."></textarea>
          <div class="flex gap-2 mt-2">
            <button id="btnAiDesc" class="border rounded px-3 py-1">Tạo mô tả bằng AI</button>
            <button id="btnAiAlts" class="border rounded px-3 py-1">Tạo ALT ảnh bằng AI</button>
          </div>
        </div>

        <label class="inline-flex items-center gap-2 text-sm"><input id="is_active" type="checkbox"/> Active</label>

        <div class="flex gap-2">
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

    // ====== Nút AI: mô tả
    $('btnAiDesc').onclick = async () => {
      try {
        const btn = $('btnAiDesc');
        btn.disabled = true; btn.textContent = 'Đang tạo...';

        const name  = $('name').value.trim();
        const extra = ($('aiPrompt').value || '').trim();
        const prompt = `Hãy viết mô tả bán hàng hấp dẫn (120–250 từ) cho sản phẩm "${name}". ${extra ? 'Lưu ý: '+extra : ''}`;

        const txt = await callAI(prompt);
        $('description').value = txt;
      } catch (e) {
        alert('AI lỗi: ' + e.message);
      } finally {
        const btn = $('btnAiDesc');
        btn.disabled = false; btn.textContent = 'Tạo mô tả bằng AI';
      }
    };

    // ====== Nút AI: ALT ảnh
    $('btnAiAlts').onclick = async () => {
      try {
        const btn = $('btnAiAlts');
        btn.disabled = true; btn.textContent = 'Đang tạo...';

        const name  = $('name').value.trim();
        const extra = ($('aiPrompt').value || '').trim();
        const prompt = `Hãy tạo 5 ALT ảnh ngắn (<=10 từ) cho sản phẩm "${name}". Trả về dạng CSV (alt1, alt2, alt3, alt4, alt5). ${extra ? 'Gợi ý thêm: '+extra : ''}`;

        const raw = await callAI(prompt);
        const alts = raw
          .replace(/\n/g, ',')
          .split(',')
          .map(s => s.trim())
          .filter(Boolean)
          .slice(0, 5);

        $('image_alts').value = alts.join(', ');
      } catch (e) {
        alert('AI lỗi: ' + e.message);
      } finally {
        const btn = $('btnAiAlts');
        btn.disabled = false; btn.textContent = 'Tạo ALT ảnh bằng AI';
      }
    };

    // ====== Lưu
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

      // Nếu đã có route admin chính thức:
      // await adminApi('/admin/products', { method:'POST', body });

      // Tạm thời dùng demo /products (nếu chưa có backend thật)
      await adminApi('/admin/products', { method: 'POST', body });

      alert('Đã lưu');
      location.hash = '#products';
    };

    // ====== Xoá
    $('delete')?.addEventListener('click', async () => {
      if (!confirm('Xoá sản phẩm này?')) return;
      await adminApi(`/admin/products/${id}`, { method: 'DELETE' });
      alert('Đã xoá');
      location.hash = '#products';
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

