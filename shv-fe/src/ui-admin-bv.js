
// src/ui-admin-bv.js
// Inject "Banner/Voucher" management INTO the existing admin page.
// No new page — this script creates panels inside current admin.html.
import api from './lib/api.js';

function h(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

function $(sel, root=document){ return root.querySelector(sel); }
function $all(sel, root=document){ return Array.from(root.querySelectorAll(sel)); }

// Small store wrapper with server fallback+localStorage
const Settings = {
  key: 'shv_settings',
  token() { return ($('#token')?.value || $('#api-token')?.value || '').trim(); },
  async load() {
    const t = this.token();
    try {
      const data = await api(`admin/settings?token=${encodeURIComponent(t)}`);
      if (data) localStorage.setItem(this.key, JSON.stringify(data));
      return data;
    } catch (e) {
      try {
        return JSON.parse(localStorage.getItem(this.key) || '{}');
      } catch { return {}; }
    }
  },
  async save(data) {
    const t = this.token();
    try {
      const res = await api(`admin/settings?token=${encodeURIComponent(t)}`, {
        method: 'PUT',
        body: data
      });
      localStorage.setItem(this.key, JSON.stringify(res||data));
      alert('Đã lưu cài đặt Banner/Voucher!');
      return res||data;
    } catch (e) {
      localStorage.setItem(this.key, JSON.stringify(data));
      alert('Chưa gọi được API, đã lưu tạm ở trình duyệt (localStorage).');
      return data;
    }
  }
};

function renderBanners(list, wrap) {
  wrap.innerHTML = '';
  const rows = list.map((b, i) => h(`
    <div class="grid grid-cols-12 gap-2 items-center border rounded p-2">
      <input class="col-span-4 px-2 py-1 border rounded" placeholder="Image URL" value="${b.image||''}">
      <input class="col-span-4 px-2 py-1 border rounded" placeholder="Link URL" value="${b.link||''}">
      <input class="col-span-2 px-2 py-1 border rounded" placeholder="ALT" value="${b.alt||''}">
      <input class="col-span-1 px-2 py-1 border rounded" type="number" min="0" placeholder="Thứ tự" value="${b.order??i}">
      <button class="col-span-1 text-red-600 hover:underline" data-rm>XOÁ</button>
    </div>
  `));
  rows.forEach((row, i) => {
    row.querySelector('[data-rm]').onclick = () => {
      list.splice(i,1);
      renderBanners(list, wrap);
    };
    wrap.appendChild(row);
  });
  const add = h(`<button class="mt-2 px-3 py-1 rounded bg-blue-600 text-white">+ Thêm banner</button>`);
  add.onclick = () => { list.push({image:'', link:'', alt:'', order:list.length}); renderBanners(list, wrap); };
  wrap.appendChild(add);
}

function readBanners(wrap) {
  return $all('.grid', wrap).map((row, idx) => {
    const [image, link, alt, order] = $all('input', row).map(i => i.value.trim());
    return { image, link, alt, order: Number(order||idx) };
  });
}

function renderVouchers(list, wrap) {
  wrap.innerHTML = '';
  const rows = list.map((v,i) => h(`
    <div class="grid grid-cols-12 gap-2 items-center border rounded p-2">
      <input class="col-span-2 px-2 py-1 border rounded" placeholder="Mã (CODE)" value="${v.code||''}">
      <select class="col-span-2 px-2 py-1 border rounded">
        <option value="percent" ${v.type==='percent'?'selected':''}>%</option>
        <option value="amount" ${v.type==='amount'?'selected':''}>đ</option>
        <option value="freeship" ${v.type==='freeship'?'selected':''}>Miễn ship</option>
      </select>
      <input class="col-span-2 px-2 py-1 border rounded" type="number" placeholder="Giá trị" value="${v.value??0}">
      <input class="col-span-2 px-2 py-1 border rounded" type="number" placeholder="Đơn tối thiểu" value="${v.min_order??0}">
      <label class="col-span-2 inline-flex items-center gap-2">
        <input type="checkbox" ${v.active?'checked':''}> <span>Active</span>
      </label>
      <button class="col-span-1 text-red-600 hover:underline" data-rm>XOÁ</button>
    </div>
  `));
  rows.forEach((row,i)=>{
    row.querySelector('[data-rm]').onclick = () => { list.splice(i,1); renderVouchers(list, wrap); };
    wrap.appendChild(row);
  });
  const add = h(`<button class="mt-2 px-3 py-1 rounded bg-blue-600 text-white">+ Thêm voucher</button>`);
  add.onclick = () => { list.push({code:'', type:'percent', value:0, min_order:0, active:true}); renderVouchers(list, wrap); };
  wrap.appendChild(add);
}

function readVouchers(wrap) {
  return $all('.grid', wrap).map(row => {
    const [codeEl, typeEl, valueEl, minEl, activeWrap] = [
      row.querySelector('input[placeholder="Mã (CODE)"]'),
      row.querySelector('select'),
      row.querySelector('input[placeholder="Giá trị"]'),
      row.querySelector('input[placeholder="Đơn tối thiểu"]'),
      row.querySelector('label input[type="checkbox"]')
    ];
    return {
      code: codeEl.value.trim(),
      type: typeEl.value,
      value: Number(valueEl.value||0),
      min_order: Number(minEl.value||0),
      active: !!activeWrap.checked
    };
  });
}

function injectPanels() {
  // Sidebar: add nav buttons if possible
  const nav = document.querySelector('aside, nav, #sidebar') || document.body;
  if (!document.querySelector('[data-view="banners"]')) {
    const btn = h(`<button data-view="banners" class="block w-full text-left px-3 py-2 rounded hover:bg-gray-700/30">Cài đặt Banner</button>`);
    nav.appendChild(btn);
  }
  if (!document.querySelector('[data-view="vouchers"]')) {
    const btn = h(`<button data-view="vouchers" class="block w-full text-left px-3 py-2 rounded hover:bg-gray-700/30">Cài đặt Voucher</button>`);
    nav.appendChild(btn);
  }

  // Main content area
  const root = document.querySelector('#app') || document.querySelector('main') || document.body;

  if (!$('#view-banners')) {
    root.appendChild(h(`
      <section id="view-banners" class="hidden space-y-3">
        <h2 class="text-xl font-semibold mt-4 mb-2">Banner</h2>
        <div id="banners-wrap" class="space-y-2"></div>
        <div class="flex gap-2">
          <button id="save-banners" class="px-3 py-2 rounded bg-emerald-600 text-white">Lưu banner</button>
        </div>
      </section>
    `));
  }
  if (!$('#view-vouchers')) {
    root.appendChild(h(`
      <section id="view-vouchers" class="hidden space-y-3">
        <h2 class="text-xl font-semibold mt-4 mb-2">Voucher</h2>
        <div id="vouchers-wrap" class="space-y-2"></div>
        <div class="flex gap-2">
          <button id="save-vouchers" class="px-3 py-2 rounded bg-emerald-600 text-white">Lưu voucher</button>
        </div>
      </section>
    `));
  }

  // View switcher
  const views = {
    banners: $('#view-banners'),
    vouchers: $('#view-vouchers')
  };
  document.querySelectorAll('[data-view]').forEach(btn => {
    btn.addEventListener('click', () => {
      const v = btn.getAttribute('data-view');
      Object.values(views).forEach(el => el?.classList.add('hidden'));
      views[v]?.classList.remove('hidden');
    });
  });

  return { views };
}

async function boot() {
  const { views } = injectPanels();
  const data = await Settings.load() || {};
  const banners = Array.isArray(data.banners) ? data.banners : [];
  const vouchers = Array.isArray(data.vouchers) ? data.vouchers : [];

  renderBanners(banners, $('#banners-wrap'));
  renderVouchers(vouchers, $('#vouchers-wrap'));

  $('#save-banners').onclick = async () => {
    const updated = readBanners($('#banners-wrap'));
    await Settings.save({ ...data, banners: updated });
  };
  $('#save-vouchers').onclick = async () => {
    const updated = readVouchers($('#vouchers-wrap'));
    await Settings.save({ ...data, vouchers: updated });
  };
}

document.addEventListener('DOMContentLoaded', boot);
