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

  // ✅ DÙNG PRODUCT-CORE: Giá đã tính sẵn từ API
  const priceDisplay = p.price_display || p.price_final || p.price || 0;
  const priceOriginal = p.compare_at_display || p.price_original || null;
  const discount = p.discount_percent || 0;

  let priceHtml = '';

  if (priceDisplay > 0) {
    // ✅ GIÁ SALE + GIÁ GỐC (CÙNG DÒNG)
    priceHtml = `<div style="display:flex;align-items:baseline;gap:6px;">
      <span style="font-size:16px;font-weight:700;color:#ef4444;">${formatPrice(priceDisplay)}</span>`;
    
    if (priceOriginal && priceOriginal > priceDisplay) {
      priceHtml += `<span style="font-size:13px;color:#9ca3af;text-decoration:line-through;">${formatPrice(priceOriginal)}</span>`;
    }
    
    priceHtml += `</div>`;
    
    // ✅ Badge giảm giá - LUÔN XUỐNG DÒNG RIÊNG
    if (discount > 0) {
      priceHtml += `<div style="margin-top:4px;"><span style="background:#10b981;color:white;font-size:9px;padding:2px 6px;border-radius:4px;font-weight:700;">-${discount}%</span></div>`;
    }
  } else {
    priceHtml = `<div class="text-gray-400 text-xs">Liên hệ</div>`;
  }
  
// Tier text tạm bỏ - giá đã tính sẵn từ API
  let tierText = '';

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


// ===================================================================
// LOGIC MỚI: TỐI ƯU HÓA (1 API CALL DUY NHẤT)
// ===================================================================

async function loadHomeSections() {
  console.log('[Home] 🚀 Bắt đầu tải dữ liệu trang chủ...');
  
  // Các container cần render
  const containers = {
    bestsellers: document.getElementById('best-products'),
    cat_dien_nuoc: document.getElementById('cat-thiet-bi-dien-nuoc'),
    cat_nha_cua: document.getElementById('cat-nha-cua-doi-song'),
    cat_hoa_chat: document.getElementById('cat-hoa-chat-gia-dung'),
    cat_dung_cu: document.getElementById('cat-dung-cu-tien-ich')
  };

  // Hiển thị skeleton/loading cho tất cả container có tồn tại
  Object.values(containers).forEach(el => {
    if (el) el.innerHTML = `
      <div class="col-span-full text-center py-8">
        <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-rose-600"></div>
      </div>`;
  });

  try {
    // 1. GỌI API DUY NHẤT
    const res = await api('/products/home-sections');
    
    if (!res || !res.ok || !res.data) {
      throw new Error('API Data missing');
    }

    const data = res.data;
    console.log(`[Home] ✅ Đã tải xong (Source: ${res.source})`);
    
    // [DEBUG] In ra số lượng sản phẩm từng mục
    console.table({
      'Bán chạy': data.bestsellers?.length || 0,
      'Điện nước': data.cat_dien_nuoc?.length || 0,
      'Nhà cửa': data.cat_nha_cua?.length || 0,
      'Hoá chất': data.cat_hoa_chat?.length || 0,
      'Tiện ích': data.cat_dung_cu?.length || 0
    });

    // 2. HÀM RENDER CHUNG
    const renderSection = async (container, items) => {
      if (!container) return;
      
      if (!items || items.length === 0) {
        // Ẩn section nếu không có bài
        const sectionEl = container.closest('section');
        if (sectionEl) sectionEl.style.display = 'none';
        return;
      }

      // Map qua productCard (đã có sẵn ở trên)
      // Lưu ý: productCard là hàm async vì nó check giá user
      const cardsHTML = await Promise.all(items.map(p => productCard(p)));
      container.innerHTML = cardsHTML.join('');
    };

    // 3. RENDER TỪNG PHẦN (Song song để nhanh hơn)
    await Promise.all([
      renderSection(containers.bestsellers, data.bestsellers),
      renderSection(containers.cat_dien_nuoc, data.cat_dien_nuoc),
      renderSection(containers.cat_nha_cua, data.cat_nha_cua),
      renderSection(containers.cat_hoa_chat, data.cat_hoa_chat),
      renderSection(containers.cat_dung_cu, data.cat_dung_cu)
    ]);

  } catch (error) {
    console.error('[Home] ❌ Lỗi tải trang chủ:', error);
    // Show error state
    Object.values(containers).forEach(el => {
      if(el) el.innerHTML = '<div class="col-span-full text-center text-red-400 py-4 text-xs">Lỗi kết nối</div>';
    });
  }
}

// Kích hoạt
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', loadHomeSections);
} else {
  loadHomeSections();
}

console.log('✅ top-products-home.js loaded');
