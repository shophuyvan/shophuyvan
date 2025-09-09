import { api } from './lib/api.js';

const bannerWrap = document.getElementById('banner-wrap');
const newWrap = document.getElementById('new-products');
const allWrap = document.getElementById('all-products');
const loadMoreBtn = document.getElementById('load-more');
const searchInput = document.getElementById('shv-search');
const filterInput = document.getElementById('quick-filter');

let cursor = null;
let allCache = [];

async function loadBanners() {
  // Expect Worker endpoint to return active banners
  const res = await api('/admin/banners', { admin: false });
  const banners = (res.items || []).filter(b => b.is_active);
  bannerWrap.innerHTML = banners.map(b => \`
    <a href="\${b.link_url}" class="block rounded overflow-hidden border">
      <img src="\${b.image_url}" alt="\${b.title||''}" class="w-full h-48 object-cover" />
    </a>
  \`).join('');
}

function productCard(p) {
  const price = p.sale_price ?? p.price;
  const priceHtml = p.sale_price
    ? \`<div><span class="line-through text-gray-400 mr-2">\${p.price.toLocaleString()}đ</span><span class="text-rose-600 font-semibold">\${price.toLocaleString()}đ</span></div>\`
    : \`<div class="font-semibold">\${price.toLocaleString()}đ</div>\`;
  const img = (p.images && p.images[0]) || 'https://via.placeholder.com/400x400?text=Image';
  return \`
    <a href="product.html?id=\${p.id}" class="bg-white border rounded p-3 block">
      <img src="\${img}" alt="\${(p.image_alts||[])[0]||p.name}" class="w-full aspect-square object-cover rounded" />
      <div class="mt-2 text-sm line-clamp-2">\${p.name}</div>
      \${priceHtml}
    </a>
  \`;
}

async function loadNew() {
  const res = await api('/products?limit=8&order=createdAt_desc');
  newWrap.innerHTML = (res.items || []).map(productCard).join('');
}

async function loadAll() {
  const res = await api(`/products?limit=12&cursor=\${cursor||''}`);
  cursor = res.nextCursor || null;
  allCache = allCache.concat(res.items || []);
  renderAll();
  loadMoreBtn.disabled = !cursor;
}

function renderAll() {
  const q = (filterInput?.value || '').toLowerCase();
  const list = !q ? allCache : allCache.filter(p => p.name.toLowerCase().includes(q));
  allWrap.innerHTML = list.map(productCard).join('');
}

loadMoreBtn?.addEventListener('click', loadAll);
filterInput?.addEventListener('input', renderAll);
searchInput?.addEventListener('keydown', e => {
  if (e.key === 'Enter') {
    filterInput.value = searchInput.value;
    renderAll();
  }
});

// ==== BỎ top-level await, đưa hết vào IIFE ====
(async () => {
  try {
    await loadBanners();
    await loadNew();
    await loadAll();
  } catch (e) {
    console.error(e);
  }
})();


