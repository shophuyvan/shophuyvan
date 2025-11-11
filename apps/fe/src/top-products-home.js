// apps/fe/src/top-products-home.js
// Component Top Products (Bestsellers + Newest) cho trang chủ - Phương án 2

import api from './lib/api.js';
import { formatPrice, pickLowestPrice } from './lib/price.js';

// Đánh dấu đã dùng component Top Products v2
if (typeof window !== 'undefined') {
  window.__SHV_TOP_PRODUCTS_V2__ = true;
}

// ==========================================
// STYLE INJECTOR CHO CAROUSEL TOP PRODUCTS
// ==========================================

(function ensureTopProductsStyles() {
  if (document.getElementById('shv-scroll-fix')) return;

  const css = `
  .shv-scroll-section {
    display: flex !important;
    gap: 8px !important;
    overflow-x: auto !important;
    overflow-y: hidden !important;
    scroll-behavior: smooth !important;
    -webkit-overflow-scrolling: touch !important;
    scrollbar-width: none !important;
    -ms-overflow-style: none !important;
    padding-bottom: 8px !important;
    flex-wrap: nowrap !important;
  }
  .shv-scroll-section::-webkit-scrollbar { display: none !important; }

  .shv-product-card {
    display: block !important;
    width: 130px !important;
    min-width: 130px !important;
    max-width: 130px !important;
    flex: 0 0 130px !important;
    flex-shrink: 0 !important;
    background: #fff !important;
    border: 1px solid #e5e7eb !important;
    border-radius: 8px !important;
    overflow: hidden !important;
    text-decoration: none !important;
    color: inherit !important;
    position: relative !important;
  }

  @media (min-width: 375px) {
    .shv-product-card {
      width: 140px !important;
      min-width: 140px !important;
      max-width: 140px !important;
      flex: 0 0 140px !important;
    }
  }
  @media (min-width: 640px) {
    .shv-product-card {
      width: 180px !important;
      min-width: 180px !important;
      max-width: 180px !important;
      flex: 0 0 180px !important;
    }
    .shv-scroll-section { gap: 12px !important; }
  }
  @media (min-width: 1024px) {
    .shv-product-card {
      width: 220px !important;
      min-width: 220px !important;
      max-width: 220px !important;
      flex: 0 0 220px !important;
    }
    .shv-scroll-section { gap: 16px !important; }
  }
  `;

  const style = document.createElement('style');
  style.id = 'shv-scroll-fix';
  style.textContent = css;
  document.head.appendChild(style);
})();

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
  const id = p?.id || p?.key || '';
  const thumb = cloudify(p?.image || (Array.isArray(p?.images) ? p.images[0] : null));

      // ƯU TIÊN GIÁ FLASH (nếu có), Fallback: pickLowestPrice từ variants
  const flashMap = window.__FLASH_PRICE_MAP || {};
  const flashInfo = flashMap[p.id];

  let base = 0;
  let original = 0;

  if (flashInfo && flashInfo.original > flashInfo.base) {
    base = flashInfo.base;
    original = flashInfo.original;
  } else {
    const info = pickLowestPrice(p) || {};
    base = info.base || 0;
    original = info.original || 0;
  }

  let priceHtml = '';



  if (base > 0) {
    if (original > base) {
      priceHtml = `
        <div class="product-card-price">
          <span class="product-card-price-sale">${formatPrice(base)}</span>
          <span class="product-card-price-original">${formatPrice(original)}</span>
        </div>
      `;
    } else {
      priceHtml = `
        <div class="product-card-price">
          <span class="product-card-price-sale">${formatPrice(base)}</span>
        </div>
      `;
    }
  } else {
    priceHtml = `<div class="text-gray-400 text-xs">Liên hệ</div>`;
  }


  // Sold badge cho bestsellers (hiển thị nhỏ ở góc)
  const soldBadge = p.sold && p.sold > 0
    ? `<div class="absolute top-2 right-2 bg-orange-500 text-white text-[10px] font-bold px-2 py-1 rounded-full">🔥 Đã bán ${p.sold}</div>`
    : '';

  return `
    <a class="shv-product-card" href="/product.html?id=${encodeURIComponent(id)}" data-id="${encodeURIComponent(id)}">
      ${soldBadge}
      <div class="relative w-full aspect-square overflow-hidden bg-gray-50">
        <img loading="lazy" class="absolute inset-0 w-full h-full object-cover object-center" src="${thumb}" alt="${p.name || 'Sản phẩm'}">
      </div>
      <div class="p-2">
        <div class="font-semibold text-xs line-clamp-2 min-h-[32px]">${p.title || p.name || 'Sản phẩm'}</div>
        <div class="mt-1 text-blue-600 text-xs js-price" data-id="${id}">
          ${priceHtml}
        </div>
        <div class="mt-1 flex items-center gap-2 text-[10px] text-gray-600">
          <span class="js-rating" data-id="${id}">★ 5.0 (0)</span>
          <span class="js-sold" data-id="${id}">Đã bán 0</span>
        </div>
      </div>
    </a>
  `;
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

    // Chỉ hiển thị 3 sản phẩm đầu tiên
        const items = data.items || [];

    // Render sản phẩm
    bestProductsEl.innerHTML = items.map(productCard).join('');

    // Hydrate sao & đã bán nếu có hàm global
    if (typeof hydrateSoldAndRating === 'function') {
      try { hydrateSoldAndRating(items.map(p => p.id || p.key || '').filter(Boolean)); }
      catch (err) { console.warn('hydrateSoldAndRating(bestsellers) error', err); }
    }

    console.log(`✅ Đã render ${items.length} sản phẩm bán chạy`);

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

        const items = data.items || [];

    // Render sản phẩm
    newProductsEl.innerHTML = items.map(productCard).join('');

    // Hydrate sao & đã bán
    if (typeof hydrateSoldAndRating === 'function') {
      try { hydrateSoldAndRating(items.map(p => p.id || p.key || '').filter(Boolean)); }
      catch (err) { console.warn('hydrateSoldAndRating(newest) error', err); }
    }

    console.log(`✅ Đã render ${items.length} sản phẩm mới`);



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