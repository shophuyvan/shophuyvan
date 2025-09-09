import { api } from './lib/api.js';
import { formatPrice, pickPrice } from './lib/price.js';

const params = new URLSearchParams(location.search);
const id = params.get('id');

const titleEl = document.getElementById('title');
const priceEl = document.getElementById('price');
const gallery = document.getElementById('gallery');
const countdown = document.getElementById('countdown');
const descEl = document.getElementById('description');
const relatedEl = document.getElementById('related');
const ld = document.getElementById('ld-product');

let product, selectedVariant = null;

function renderPrice() {
  const { base, original } = pickPrice(product, selectedVariant);
  priceEl.innerHTML = original && original !== base
    ? `<span class="line-through text-gray-400 mr-2">${formatPrice(original)}</span><span class="text-rose-600 font-semibold">${formatPrice(base)}</span>`
    : `<span class="font-semibold">${formatPrice(base)}</span>`;
}

function renderVariants() {
  const box = document.getElementById('variants');
  if (!product.variants || !product.variants.length) { box.innerHTML=''; return; }
  box.innerHTML = `<div class="text-sm mb-1">Phân loại</div><div id="vlist" class="flex flex-wrap gap-2"></div>`;
  const vlist = box.querySelector('#vlist');
  product.variants.forEach(v => {
    const btn = document.createElement('button');
    btn.textContent = v.name;
    btn.className = 'border rounded px-2 py-1 text-sm';
    btn.onclick = () => { selectedVariant = v; renderPrice(); };
    vlist.appendChild(btn);
  });
}

function renderGallery() {
  const imgs = product.images?.length ? product.images : ['https://via.placeholder.com/600?text=Image'];
  gallery.innerHTML = `<img src="${imgs[0]}" alt="${product.image_alts?.[0]||product.name}" class="w-full h-full object-cover rounded" />`;
}

function renderBadges() {
  const badges = [];
  if (product.flash_end && product.flash_end > Date.now()) badges.push('Flash Sale');
  if (product.freeship_xtra) badges.push('XTRA Freeship');
  document.getElementById('badges').innerHTML = badges.map(b=>`<span class="border rounded px-2 py-1">${b}</span>`).join('');
}

function tickCountdown() {
  if (!product.flash_end) return;
  const ms = product.flash_end - Date.now();
  if (ms <= 0) { countdown.textContent = ''; return; }
  const h = Math.floor(ms/3600000), m = Math.floor(ms%3600000/60000), s = Math.floor(ms%60000/1000);
  countdown.textContent = `Kết thúc sau ${h}h ${m}m ${s}s`;
  requestAnimationFrame(tickCountdown);
}

function renderSEO() {
  document.getElementById('seo-title').textContent = product.seo_title || product.name;
  document.getElementById('seo-desc').setAttribute('content', product.seo_description || product.description?.slice(0,120) || '');
  const ldj = {
    "@context":"https://schema.org/",
    "@type":"Product",
    name: product.name,
    image: product.images,
    description: product.seo_description || product.description || '',
    sku: product.variants?.[0]?.sku || '',
    offers: {
      "@type":"Offer",
      priceCurrency: "VND",
      price: (pickPrice(product, selectedVariant).base||0)/1,
      availability: product.stock>0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock"
    }
  };
  document.getElementById('ld-product').textContent = JSON.stringify(ldj);
}

function renderRelated(items) {
  relatedEl.innerHTML = items.map(p => `
    <a href="product.html?id=${p.id}" class="bg-white border rounded p-3 block">
      <img src="${(p.images?.[0])||'https://via.placeholder.com/400'}" class="w-full aspect-square object-cover rounded" />
      <div class="mt-2 text-sm line-clamp-2">${p.name}</div>
      <div class="text-sm">${formatPrice(p.sale_price ?? p.price)}</div>
    </a>
  `).join('');
}

document.getElementById('add-to-cart')?.addEventListener('click', () => {
  const cart = JSON.parse(localStorage.getItem('cart') || '[]');

  cart.push({
    id: product.id,
    name: product.name,
    price: pickPrice(product, selectedVariant).base,
    qty: 1,
    variant: selectedVariant?.name ?? null,
    // ưu tiên cân nặng biến thể → cân nặng sản phẩm → 0
    weight_grams: selectedVariant?.weight_grams ?? product.weight_grams ?? 0,
  });

  localStorage.setItem('cart', JSON.stringify(cart));
  alert('Đã thêm vào giỏ');
});

});

// Load product
const res = await api(`/products/${id}`);
product = res.item;
titleEl.textContent = product.name;
renderPrice();
renderVariants();
renderGallery();
renderBadges();
renderSEO();
// Related
const rel = await api(`/products?category=${encodeURIComponent(product.category)}&limit=8`);
renderRelated(rel.items||[]);
// Countdown
tickCountdown();
