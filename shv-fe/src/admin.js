import { api, authHeader } from './lib/api.js';

const routeEl = document.getElementById('route');
const menuBtn = document.getElementById('menu-btn');
const drawer = document.getElementById('drawer');
const tokenInput = document.getElementById('admin-token');
const saveBtn = document.getElementById('save-token');

menuBtn?.addEventListener('click', () => {
  drawer.classList.toggle('-translate-x-full');
});

saveBtn?.addEventListener('click', () => {
  localStorage.setItem('ADMIN_TOKEN', tokenInput.value.trim());
  alert('Đã lưu token.');
});

window.addEventListener('hashchange', render);
document.addEventListener('DOMContentLoaded', () => {
  tokenInput.value = localStorage.getItem('ADMIN_TOKEN') || '';
  render();
});

function navLink(h, label){ return `<a href="#${h}" class="underline">${label}</a>`; }

async function render() {
  const hash = (location.hash || '#products').slice(1);
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
    const res = await api('/products?limit=50');
    document.getElementById('list').innerHTML = (res.items||[]).map(p=>`
      <div class="flex items-center gap-3 p-3 border-b">
        <img src="${(p.images?.[0])||'https://via.placeholder.com/80'}" class="w-16 h-16 object-cover rounded"/>
        <div class="flex-1 text-sm">
          <div class="font-medium">${p.name}</div>
          <div>Giá: ${(p.sale_price??p.price)} | Tồn: ${p.stock} | Active: ${p.is_active?'✅':'⛔'}</div>
        </div>
        <a href="#editor?id=${p.id}" class="text-blue-600 underline text-sm">Sửa</a>
      </div>
    `).join('');
  }
  else if (hash.startsWith('editor')) {
    const id = new URLSearchParams(hash.split('?')[1]).get('id');
    let item = id ? (await api(`/products/${id}`)).item : null;
    routeEl.innerHTML = `
      <h2 class="font-semibold mb-2">${id?'Sửa':'Thêm'} sản phẩm</h2>
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
        <button id="save" class="bg-emerald-600 text-white px-4 py-2 rounded w-max">Lưu</button>
      </div>
    `;
    if (item) {
      document.getElementById('name').value = item.name||'';
      document.getElementById('description').value = item.description||'';
      document.getElementById('price').value = item.price||0;
      document.getElementById('sale_price').value = item.sale_price||'';
      document.getElementById('stock').value = item.stock||0;
      document.getElementById('category').value = item.category||'';
      document.getElementById('weight_grams').value = item.weight_grams||0;
      document.getElementById('images').value = (item.images||[]).join(',');
      document.getElementById('image_alts').value = (item.image_alts||[]).join(',');
      document.getElementById('is_active').checked = !!item.is_active;
    }
    document.getElementById('save').onclick = async () => {
      const body = {
        id: id || undefined,
        name: document.getElementById('name').value,
        description: document.getElementById('description').value,
        price: +document.getElementById('price').value||0,
        sale_price: document.getElementById('sale_price').value? +document.getElementById('sale_price').value: null,
        stock: +document.getElementById('stock').value||0,
        category: document.getElementById('category').value||'',
        weight_grams: +document.getElementById('weight_grams').value||0,
        images: (document.getElementById('images').value||'').split(',').map(s=>s.trim()).filter(Boolean),
        image_alts: (document.getElementById('image_alts').value||'').split(',').map(s=>s.trim()).filter(Boolean),
        is_active: document.getElementById('is_active').checked,
      };
      const res = await api('/admin/products', { method:'POST', body, admin:true });
      alert('Đã lưu');
      location.hash = '#products';
    };
  }
  else if (hash === 'banners') {
    routeEl.innerHTML = `<h2 class="font-semibold mb-2">Banner</h2><div class="text-sm">CRUD (dùng API /admin/banners)</div>`;
  } else if (hash === 'vouchers') {
    routeEl.innerHTML = `<h2 class="font-semibold mb-2">Voucher</h2><div class="text-sm">CRUD + Test mã bằng /pricing/preview</div>`;
  } else if (hash === 'orders') {
    routeEl.innerHTML = `<h2 class="font-semibold mb-2">Đơn hàng</h2>`;
  } else if (hash === 'shipping') {
    routeEl.innerHTML = `<h2 class="font-semibold mb-2">Vận chuyển</h2><div class="text-sm">Cài đặt hãng, origin, test health</div>`;
  } else if (hash === 'users') {
    routeEl.innerHTML = `<h2 class="font-semibold mb-2">Người dùng</h2>`;
  } else if (hash === 'analytics') {
    routeEl.innerHTML = `<h2 class="font-semibold mb-2">Thống kê</h2>`;
  } else if (hash === 'marketing') {
    routeEl.innerHTML = `<h2 class="font-semibold mb-2">Marketing</h2>`;
  } else if (hash === 'settings') {
    routeEl.innerHTML = `<h2 class="font-semibold mb-2">Cài đặt</h2>`;
  } else {
    routeEl.textContent = '404';
  }
}
