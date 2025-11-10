// apps/fe/src/top-products-home.js
// Component Top Products (Bestsellers + Newest) cho trang chủ - Phương án 2

import api from './lib/api.js';
import { formatPrice } from './lib/price.js';

// ==========================================
// CLOUDIFY HELPER (giống ui-home.js)
// ==========================================
const noImage = encodeURI(`
  data:image/svg+xml;utf8,
  <svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 600 380'>
    <rect width='100%' height='100%' fill='%23f3f4f6'/>
    <g stroke='%239ca3af' stroke-width='10' fill='none'>
      <circle cx='130' cy='120' r='40'/>
      <path d='M80 310 L230 190 L350 270 L410 230 L520 310'/>
      <rect x='5' y='5' width='590' height='370' rx='18'/>
    </g>
    <text x='300' y='350' text-anchor='middle' fill='%236b7280' font-size='28' font-family='ui-sans-serif,system-ui'>No image</text>
  </svg>
`);

function cloudify(u, t = 'w_800,dpr_auto,q_auto,f_auto') {
  try {
    if (!u) return noImage;
    const url = new URL(u);
    if (!url.hostname.includes('res.cloudinary.com')) return u;
    url.pathname = url.pathname.replace('/upload/', `/upload/${t}/`);
    return url.toString();
  } catch {
    return u || noImage;
  }
}

// ==========================================
// RENDER PRODUCT CARD
// ==========================================
function productCard(p) {
  const thumb = cloudify(p?.image || p?.images?.[0]);

  // Ưu tiên giá từ API (price_display đã tính sẵn)
  let base = 0;
  let original = 0;

  if (p.price_display && p.price_display > 0) {
    base = Number(p.price_display);
    original = Number(p.compare_at_display || 0);
  } else {
    // Fallback: tính từ variants
    base = Number(p.price || 0);
    original = Number(p.compare_at || 0);
  }

  const priceHtml = original > base && original > 0
    ? `<div><span class="text-rose-600 font-semibold mr-2">${formatPrice(base)}</span><span class="line-through text-gray-400 text-sm">${formatPrice(original)}</span></div>`
    : base > 0
      ? `<div class="text-rose-600 font-semibold">${formatPrice(base)}</div>`
      : `<div class="text-gray-400 text-sm">Liên hệ</div>`;

  // Sold badge cho bestsellers
  const soldBadge = p.sold && p.sold > 0
    ? `<div class="absolute top-2 right-2 bg-orange-500 text-white text-xs font-bold px-2 py-1 rounded-full">🔥 Đã bán ${p.sold}</div>`
    : '';

  return `
  <a class="product-card-horizontal" href="/product?id=${encodeURIComponent(p.id)}">
    ${soldBadge}
    <div class="aspect-square bg-gray-50 overflow-hidden">
      <img loading="lazy" class="w-full h-full object-cover" src="${thumb}" alt="${p.name || 'Sản phẩm'}">
    </div>
    <div class="p-2">
      <div class="text-xs h-8 line-clamp-2 mb-1" style="font-size:11px;line-height:1.3;">${p.name || 'Sản phẩm'}</div>
      ${priceHtml}
    </div>
  </a>`;
}

// ==========================================
// LOAD BESTSELLERS
// ==========================================
async function loadBestsellers() {
  const bestProductsEl = document.getElementById('best-products');

  if (!bestProductsEl) {
    console.warn('⚠️ #best-products element not found');
    return;
  }

  try {
    // Loading state
    bestProductsEl.innerHTML = `
      <div class="col-span-full text-center py-8">
        <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-rose-600"></div>
        <div class="text-gray-500 mt-2">Đang tải...</div>
      </div>
    `;

    const data = await api('/products/bestsellers?limit=8');

    if (!data || !data.ok || !data.items || data.items.length === 0) {
      console.log('ℹ️ Không có sản phẩm bán chạy');
      // Ẩn section
      const section = bestProductsEl.closest('section');
      if (section) section.style.display = 'none';
      return;
    }

    // Render sản phẩm
    bestProductsEl.innerHTML = data.items.map(productCard).join('');

    console.log(`✅ Đã render ${data.items.length} sản phẩm bán chạy`);

  } catch (error) {
    console.error('❌ Lỗi load bestsellers:', error);
    bestProductsEl.innerHTML = '<div class="col-span-full text-center text-red-500 py-4">Không thể tải sản phẩm</div>';
  }
}

// ==========================================
// LOAD NEWEST PRODUCTS
// ==========================================
async function loadNewest() {
  const newProductsEl = document.getElementById('new-products');

  if (!newProductsEl) {
    console.warn('⚠️ #new-products element not found');
    return;
  }

  try {
    // Loading state
    newProductsEl.innerHTML = `
      <div class="col-span-full text-center py-8">
        <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-rose-600"></div>
        <div class="text-gray-500 mt-2">Đang tải...</div>
      </div>
    `;

    const data = await api('/products/newest?limit=8');

    if (!data || !data.ok || !data.items || data.items.length === 0) {
      console.log('ℹ️ Không có sản phẩm mới');
      // Ẩn section
      const section = newProductsEl.closest('section');
      if (section) section.style.display = 'none';
      return;
    }

    // Render sản phẩm
    newProductsEl.innerHTML = data.items.map(productCard).join('');

    console.log(`✅ Đã render ${data.items.length} sản phẩm mới`);

  } catch (error) {
    console.error('❌ Lỗi load newest products:', error);
    newProductsEl.innerHTML = '<div class="col-span-full text-center text-red-500 py-4">Không thể tải sản phẩm</div>';
  }
}

// ==========================================
// INIT - LOAD TẤT CẢ
// ==========================================
(async function initTopProducts() {
  // Load song song cả 2 sections
  await Promise.all([
    loadBestsellers(),
    loadNewest()
  ]);
})();

console.log('✅ top-products-home.js loaded');