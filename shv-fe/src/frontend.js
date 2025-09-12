import { api } from './lib/api.js';

const bannerWrap  = document.getElementById('banner-wrap');
const newWrap     = document.getElementById('new-products');
const allWrap     = document.getElementById('all-products');
const loadMoreBtn = document.getElementById('load-more');
const searchInput = document.getElementById('shv-search');
const filterInput = document.getElementById('quick-filter');

let cursor = null;
let allCache = [];

// ----- Banners -----
async function loadBanners() {
  // Trước đây gọi /admin/banners -> 401
  const res = await api('/banners'); // public
  const banners = (res.items || []).filter(b => b.is_active);
  if (bannerWrap) bannerWrap.innerHTML = banners.map(b => `
    <a href="${b.link_url}" class="block rounded overflow-hidden border">
      <img src="${b.image_url}" alt="${b.title||''}" class="w-full h-48 object-cover" />
    </a>
  `).join('');
}


// ----- Product card -----
function productCard(p) {
  function minPriceOf(p){
    const arr = Array.isArray(p.variants)? p.variants : [];
    if (!arr.length) return {base: p.sale_price ?? p.price, original: p.price};
    let base = Infinity, orig = Infinity;
    for (const v of arr){
      const b = (v.sale_price==null||v.sale_price==='') ? Number(v.price||0) : Number(v.sale_price||0);
      const o = Number(v.price||0);
      if (b < base) base = b;
      if (o < orig) orig = o;
    }
    if (!isFinite(base)) base = p.sale_price ?? p.price; if (!isFinite(orig)) orig = p.price; return {base, original: orig};
  }
  const {base, original} = minPriceOf(p);
  const priceHtml = (original>base)
    ? `<div><span class=\"line-through text-gray-400 mr-2\">${original.toLocaleString()}đ</span><span class=\"text-rose-600 font-semibold\">${base.toLocaleString()}đ</span></div>`
    : `<div class=\"font-semibold\">${base.toLocaleString()}đ</div>`;
  const img = (p.images && p.images[0]) || 'https://via.placeholder.com/400x400?text=Image';
  return `
    <a href=\"product.html?id=${p.id}\" class=\"bg-white border rounded p-3 block\">
      <img src=\"${img}\" alt=\"${(p.alt_images||p.image_alts||[])[0]||p.name}\" class=\"w-full aspect-square object-cover rounded\" />
      <div class=\"mt-2 text-sm line-clamp-2\">${p.name}</div>
      ${priceHtml}
    </a>
  `;
}


// ----- Sections -----
async function loadNew() {
  const res = await api('/products?limit=8&order=createdAt_desc');
  newWrap && (newWrap.innerHTML = (res.items || []).map(productCard).join(''));
}

async function loadAll() {
  const res = await api(`/products?limit=12&cursor=${cursor || ''}`);
  cursor   = res.nextCursor || null;
  allCache = allCache.concat(res.items || []);
  renderAll();
  if (loadMoreBtn) loadMoreBtn.disabled = !cursor;
}

function renderAll() {
  const q = (filterInput?.value || '').toLowerCase();
  const list = !q ? allCache : allCache.filter(p => p.name.toLowerCase().includes(q));
  allWrap && (allWrap.innerHTML = list.map(productCard).join(''));
}

// ----- UI events -----
loadMoreBtn?.addEventListener('click', loadAll);
filterInput?.addEventListener('input', renderAll);
searchInput?.addEventListener('keydown', e => {
  if (e.key === 'Enter') {
    if (filterInput) filterInput.value = searchInput.value;
    renderAll();
  }
});

// ===== IIFE: KHÔNG còn top-level await =====
(async () => {
  try {
    await loadBanners();
    await loadNew();
    await loadAll();
  } catch (e) {
    console.error(e);
  }
})();
