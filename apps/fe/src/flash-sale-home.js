// apps/fe/src/flash-sale-home.js
// Component Flash Sale cho trang chủ - Phương án 2

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
// TÍNH GIÁ FLASH SALE
// ==========================================
function calculateFlashPrice(product, discountType, discountValue) {
  // Lấy giá gốc từ product
  let basePrice = 0;
  
  if (product.price_display && product.price_display > 0) {
    basePrice = Number(product.price_display);
  } else if (product.variants && product.variants.length > 0) {
    // Lấy giá thấp nhất từ variants
    const prices = product.variants
      .map(v => Number(v.price || v.unit_price || v.regular_price || 0))
      .filter(p => p > 0);
    basePrice = prices.length > 0 ? Math.min(...prices) : 0;
  } else {
    basePrice = Number(product.price || 0);
  }

  if (basePrice === 0) return { flashPrice: 0, originalPrice: 0 };

  // Tính giá Flash Sale
  let flashPrice = basePrice;
  
  if (discountType === 'percent') {
    // Giảm theo %
    flashPrice = basePrice * (1 - discountValue / 100);
  } else if (discountType === 'fixed') {
    // Giảm cố định
    flashPrice = basePrice - discountValue;
  }

  // Đảm bảo giá Flash Sale không âm
  flashPrice = Math.max(0, flashPrice);

  return {
    flashPrice: Math.round(flashPrice),
    originalPrice: basePrice
  };
}

// ==========================================
// RENDER PRODUCT CARD
// ==========================================
function flashCard(p, discountType, discountValue) {
  const thumb = cloudify(p?.images?.[0]);
  const { flashPrice, originalPrice } = calculateFlashPrice(p, discountType, discountValue);

  // Tính % giảm giá
  const discountPercent = originalPrice > 0 
    ? Math.round(((originalPrice - flashPrice) / originalPrice) * 100)
    : 0;

  const priceHtml = flashPrice > 0
    ? `
      <div class="flex items-center gap-2">
        <span class="text-rose-600 font-bold text-lg">${formatPrice(flashPrice)}</span>
        ${originalPrice > flashPrice ? `<span class="line-through text-gray-400 text-sm">${formatPrice(originalPrice)}</span>` : ''}
      </div>
      ${discountPercent > 0 ? `<div class="inline-block bg-red-100 text-red-600 text-xs font-bold px-2 py-1 rounded mt-1">-${discountPercent}%</div>` : ''}
    `
    : `<div class="text-gray-400 text-sm">Liên hệ</div>`;

  return `
  <a class="product-card-horizontal" href="/product?id=${encodeURIComponent(p.id)}">
    <!-- Flash Sale Badge -->
    <div class="absolute top-2 left-2 bg-gradient-to-r from-red-500 to-orange-500 text-white text-xs font-bold px-3 py-1 rounded-full z-10 shadow-lg">
      ⚡ FLASH SALE
    </div>
    
    <div class="aspect-square bg-gray-50 overflow-hidden">
      <img loading="lazy" class="w-full h-full object-cover hover:scale-110 transition-transform duration-300" src="${thumb}" alt="${p.name || 'Sản phẩm'}">
    </div>
    
<div class="p-2">
      <div class="text-xs h-8 line-clamp-2 mb-1" style="font-size:11px;line-height:1.3;">${p.name || 'Sản phẩm'}</div>
      ${priceHtml}
    </div>
  </a>`;
}

// ==========================================
// COUNTDOWN TIMER
// ==========================================
let countdownInterval = null;

function startCountdown(endTime) {
  const countdownEl = document.getElementById('flash-countdown');
  if (!countdownEl) return;

  // Clear interval cũ nếu có
  if (countdownInterval) {
    clearInterval(countdownInterval);
  }

  const endDate = new Date(endTime).getTime();

  function updateCountdown() {
    const now = Date.now();
    const distance = endDate - now;

    if (distance < 0) {
      countdownEl.textContent = '⏰ Đã kết thúc';
      clearInterval(countdownInterval);
      // Ẩn section Flash Sale khi hết hạn
      hideFlashSaleSection();
      return;
    }

    const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((distance % (1000 * 60)) / 1000);

    countdownEl.textContent = `⏰ Kết thúc sau: ${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }

  // Update ngay lập tức
  updateCountdown();

  // Update mỗi giây
  countdownInterval = setInterval(updateCountdown, 1000);
}

// ==========================================
// ẨN/HIỆN SECTION
// ==========================================
function hideFlashSaleSection() {
  const section = document.querySelector('#flash-products').closest('section');
  if (section) {
    section.style.display = 'none';
  }
}

function showFlashSaleSection() {
  const section = document.querySelector('#flash-products').closest('section');
  if (section) {
    section.style.display = 'block';
  }
}

// ==========================================
// INIT - LOAD FLASH SALE
// ==========================================
(async function initFlashSale() {
  const flashProductsEl = document.getElementById('flash-products');
  
  if (!flashProductsEl) {
    console.warn('⚠️ #flash-products element not found');
    return;
  }

  try {
    // Gọi API Flash Sale active
    const data = await api('/flash-sales/active');
    
    if (!data || !data.ok || !data.flash_sale) {
      console.log('ℹ️ Không có Flash Sale đang chạy');
      hideFlashSaleSection();
      return;
    }

    const flashSale = data.flash_sale;
    console.log('✅ Flash Sale active:', flashSale);

    // Kiểm tra có sản phẩm không
    if (!flashSale.products || flashSale.products.length === 0) {
      console.warn('⚠️ Flash Sale không có sản phẩm');
      hideFlashSaleSection();
      return;
    }

    // Hiện section
    showFlashSaleSection();

    // Start countdown
    startCountdown(flashSale.end_time);

    // Lấy chi tiết sản phẩm
    const productPromises = flashSale.products.map(async (fsProduct) => {
      try {
        // Gọi API lấy thông tin chi tiết sản phẩm
        const productData = await api(`/public/products/${fsProduct.product_id}`);
        
        if (!productData || !productData.ok) {
          return null;
        }

        return {
          product: productData.data || productData.product || productData,
          discountType: fsProduct.discount_type,
          discountValue: fsProduct.discount_value
        };
      } catch (e) {
        console.error('Lỗi load sản phẩm Flash Sale:', fsProduct.product_id, e);
        return null;
      }
    });

    const products = (await Promise.all(productPromises)).filter(p => p !== null);

    if (products.length === 0) {
      console.warn('⚠️ Không thể load sản phẩm Flash Sale');
      flashProductsEl.innerHTML = '<div class="col-span-full text-center text-gray-500 py-8">Không có sản phẩm</div>';
      return;
    }

    // Render sản phẩm
    flashProductsEl.innerHTML = products
      .map(({ product, discountType, discountValue }) => 
        flashCard(product, discountType, discountValue)
      )
      .join('');

    console.log(`✅ Đã render ${products.length} sản phẩm Flash Sale`);

  } catch (error) {
    console.error('❌ Lỗi load Flash Sale:', error);
    hideFlashSaleSection();
  }
})();

// Cleanup khi rời trang
window.addEventListener('beforeunload', () => {
  if (countdownInterval) {
    clearInterval(countdownInterval);
  }
});

console.log('✅ flash-sale-home.js loaded');










