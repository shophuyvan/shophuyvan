// apps/fe/src/top-products-home.js
// Component Top Products (Bestsellers + Newest) cho trang chủ - Phương án 2

import api from './lib/api.js';
import { formatPrice, pickLowestPrice, pickPriceByCustomer } from './lib/price.js';

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
  
  .shv-product-card .product-card-price{display:flex!important;align-items:baseline!important;gap:8px!important;margin-top:4px!important;}
  .shv-product-card .product-card-price-sale{font-size:16px!important;font-weight:700!important;color:#ef4444!important;}
  .shv-product-card .product-card-price-original{font-size:13px!important;color:#9ca3af!important;text-decoration:line-through!important;}
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
async function productCard(p) {
  const id = p?.id || p?.key || '';
  const thumb = cloudify(p?.image || (Array.isArray(p?.images) ? p.images[0] : null));

  // ✅ SỬA: Dùng pickPriceByCustomer để áp dụng giá tier
  const priceInfo = await pickPriceByCustomer(p, null) || {};
  const base = priceInfo.base || 0;
  const original = priceInfo.original || null;

  let priceHtml = '';

  if (base > 0) {
    // ✅ GIÁ SALE + GIÁ GỐC (CÙNG DÒNG) - ĐỒNG NHẤT VỚI frontend.js
    priceHtml = `<div style="display:flex;align-items:baseline;gap:6px;">
      <span style="font-size:16px;font-weight:700;color:#ef4444;">${formatPrice(base)}</span>`;
    
    if (original && original > base) {
      priceHtml += `<span style="font-size:13px;color:#9ca3af;text-decoration:line-through;">${formatPrice(original)}</span>`;
    }
    
    priceHtml += `</div>`;
    
    // ✅ Badge "Giá sỉ" hoặc "-%discount" - LUÔN XUỐNG DÒNG RIÊNG
    if (priceInfo.customer_type === 'wholesale' || priceInfo.customer_type === 'si') {
      priceHtml += `<div style="margin-top:4px;"><span style="background:#4f46e5;color:white;font-size:9px;padding:2px 6px;border-radius:4px;font-weight:700;">Giá sỉ</span></div>`;
    } else if (priceInfo.discount > 0) {
      priceHtml += `<div style="margin-top:4px;"><span style="background:#10b981;color:white;font-size:9px;padding:2px 6px;border-radius:4px;font-weight:700;">-${priceInfo.discount}%</span></div>`;
    }
  } else {
    priceHtml = `<div class="text-gray-400 text-xs">Liên hệ</div>`;
  }
  
  // ✅ THÊM: Hiển thị text tier (giống Bán chạy)
  const tierMap = {
    'retail': { name: 'Thành viên thường', icon: '👤' },
    'silver': { name: 'Thành viên bạc', icon: '🥈' },
    'gold': { name: 'Thành viên vàng', icon: '🥇' },
    'diamond': { name: 'Thành viên kim cương', icon: '💎' }
  };
  const tierInfo = tierMap[priceInfo.tier] || tierMap['retail'];
  
  // Chỉ hiển thị text tier cho khách lẻ có hạng (không phải retail và không phải sỉ)
  let tierText = '';
  if (priceInfo.customer_type === 'retail' && priceInfo.tier !== 'retail') {
    tierText = `<div style="font-size:11px;color:#059669;margin-top:4px;font-weight:600;">${tierInfo.name}</div>`;
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
          ${tierText}
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

    const items = data.items || [];

// Render sản phẩm
    const cardPromises = items.map(async (item) => await productCard(item));
    const cards = await Promise.all(cardPromises);
    bestProductsEl.innerHTML = cards.join('');

    // ✅ Hydrate sold & rating từ API metrics
    try {
      const ids = items.map(p => p.id || p.key || '').filter(Boolean);
      
      if (ids.length > 0) {
        const metricsRes = await api('/api/products/metrics', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ product_ids: ids })
        });

        if (metricsRes?.ok && Array.isArray(metricsRes.metrics)) {
          metricsRes.metrics.forEach(m => {
            const soldEls = document.querySelectorAll(`.js-sold[data-id="${m.product_id}"]`);
            soldEls.forEach(el => {
              el.textContent = `Đã bán ${m.sold || 0}`;
            });

            const ratingEls = document.querySelectorAll(`.js-rating[data-id="${m.product_id}"]`);
            ratingEls.forEach(el => {
              el.textContent = `★ ${(m.rating || 5.0).toFixed(1)} (${m.rating_count || 0})`;
            });
          });

          console.log('✅ Đã cập nhật metrics cho Bán chạy:', metricsRes.metrics.length);
        }
      }
    } catch (e) {
      console.warn('⚠️ Không thể load metrics Bán chạy:', e);
    }

    console.log(`✅ Đã render ${items.length} sản phẩm bán chạy`);

  } catch (error) {
    console.error('❌ Lỗi load bestsellers:', error);
    bestProductsEl.innerHTML = '<div class="col-span-full text-center text-red-500 py-4">Không thể tải sản phẩm</div>';
  }
}


// ==========================================
// INTERSECTION OBSERVER - LAZY LOAD HELPER
// ==========================================
function setupLazyLoad(section) {
  const el = document.getElementById(section.elementId);
  if (!el) return;

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        loadCategorySection(section);
        observer.unobserve(entry.target);
      }
    });
  }, {
    rootMargin: '400px' // Load trước 400px khi scroll đến
  });

  observer.observe(el.closest('section') || el);
}

// ==========================================
// LOAD SẢN PHẨM THEO DANH MỤC (SECTION GIỐNG "HÀNG MỚI RA MẮT")
// ==========================================
async function loadCategorySection(section) {
  if (!section || !section.elementId) return;

  const el = document.getElementById(section.elementId);
  if (!el) {
    console.warn('⚠️ Category section element not found:', section.elementId);
    return;
  }

  try {
    el.innerHTML = `
      <div class="col-span-full text-center py-8">
        <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-rose-600"></div>
        <div class="text-gray-500 mt-2">Đang tải...</div>
      </div>
    `;

    const limit = section.limit || 8;

    // URL API cho danh mục – dùng endpoint cấu hình, dễ chỉnh sau này
    const url = section.endpoint || `/products?category=${encodeURIComponent(section.category)}&limit=${limit}`;
    const data = await api(url);

    if (!data || !data.ok || !Array.isArray(data.items) || data.items.length === 0) {
      console.log('ℹ️ Không có sản phẩm cho danh mục', section.category);
      const sectionEl = el.closest('section');
      if (sectionEl) sectionEl.style.display = 'none';
      return;
    }

    const items = data.items;
    const cardPromises = items.map((item) => productCard(item));
    const cards = await Promise.all(cardPromises);
    el.innerHTML = cards.join('');

  } catch (error) {
    console.error('❌ Lỗi load category section:', section, error);
    el.innerHTML = '<div class="col-span-full text-center text-red-500 py-4">Không thể tải sản phẩm</div>';
  }
}

// Danh sách section danh mục hiển thị trên trang chủ
const HOME_CATEGORY_SECTIONS = [
  { title: 'Thiết Bị Điện Nước', category: 'thiet-bi-dien-nuoc', elementId: 'cat-thiet-bi-dien-nuoc', limit: 8 },
  { title: 'Nhà Cửa Đời Sống', category: 'nha-cua-doi-song', elementId: 'cat-nha-cua-doi-song', limit: 8 },
  { title: 'Hoá Chất Gia Dụng', category: 'hoa-chat-gia-dung', elementId: 'cat-hoa-chat-gia-dung', limit: 8 },
  { title: 'Dụng Cụ Tiện Ích', category: 'dung-cu-tien-ich', elementId: 'cat-dung-cu-tien-ich', limit: 8 },
];

// ✅ Cache sản phẩm để không gọi API nhiều lần
let __allProductsCache = null;

async function getAllProducts() {
  if (__allProductsCache) return __allProductsCache;
  
  try {
    const data = await api('/public/products?limit=200');
    __allProductsCache = data?.items || [];
    console.log('[Cache] ✅ Loaded', __allProductsCache.length, 'products');
    return __allProductsCache;
  } catch (e) {
    console.error('[Cache] ❌ Failed to load products:', e);
    return [];
  }
}

// ✅ Load category section từ cache (không gọi API riêng)
async function loadCategorySectionFromCache(section) {
  if (!section || !section.elementId) return;

  const el = document.getElementById(section.elementId);
  if (!el) return;

  try {
    el.innerHTML = `<div class="col-span-full text-center py-4 text-gray-400">Đang tải...</div>`;

    const allProducts = await getAllProducts();
    
    // Filter theo category_slug
    const filtered = allProducts.filter(p => {
      const cat = (p.category_slug || p.category || '').toLowerCase();
      return cat === section.category.toLowerCase();
    }).slice(0, section.limit || 8);

    if (filtered.length === 0) {
      const sectionEl = el.closest('section');
      if (sectionEl) sectionEl.style.display = 'none';
      return;
    }

    const cards = await Promise.all(filtered.map(item => productCard(item)));
    el.innerHTML = cards.join('');
    
    console.log(`[Category] ✅ ${section.category}:`, filtered.length, 'products');
  } catch (e) {
    console.error('[Category] ❌', section.category, e);
    el.innerHTML = '<div class="text-red-500 text-center py-4">Không thể tải</div>';
  }
}

// ==========================================
// INIT - OPTIMIZED (SONG SONG)
// ==========================================
(async function initTopProducts() {
  console.log('[Top Products] Starting optimized load...');

  try {
    // BƯỚC 1: Load Bestsellers (bỏ Newest vì không còn section này)
    loadBestsellers().catch(e => console.error('[Bestsellers] ❌', e));

    // BƯỚC 2: Load tất cả products + render categories SONG SONG
    const allProducts = await getAllProducts();
    
    if (allProducts.length > 0) {
      // Render tất cả categories SONG SONG (không chờ nhau)
      await Promise.all(
        HOME_CATEGORY_SECTIONS.map(section => 
          loadCategorySectionFromCache(section).catch(e => 
            console.error('[Category] ❌', section.category, e)
          )
        )
      );
    }

    console.log('[Top Products] ✅ All sections loaded');
  } catch (e) {
    console.error('[Top Products] ❌ Init error:', e);
  }
})();

console.log('✅ top-products-home.js loaded');
