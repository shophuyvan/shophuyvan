export function formatPrice(v){ return (Number(v)||0).toLocaleString('vi-VN') + 'đ'; }
// apps/fe/src/lib/price.js
// Pricing priority: variant (sale|price) > product (sale|price)
// Return shape expected by UIs: { base, original } and keep aliases { sale, regular } for backwards-compat.
export function pickPrice(product, variant){
  // 1. Ưu tiên giá từ BIẾN THỂ (dùng ở trang chi tiết)
  if (variant) {
    const sale = num(variant.sale_price ?? variant.price_sale);
    const price = num(variant.price);
    const base = sale>0 ? sale : (price>0 ? price : 0);
    const original = (sale>0 && price>sale) ? price : null;
    return { base, original, sale: base, regular: original };
  }

  // 2. SỬA LỖI: Đọc giá từ 'price_display' (dùng ở trang chủ)
  // Trang chủ truyền vào 'product' tóm tắt, giá nằm ở 'price_display'
  const pSaleDisplay = num(product.price_display);
  const pOrigDisplay = num(product.compare_at_display);

  if (pSaleDisplay > 0) {
     const base = pSaleDisplay;
     const original = (pOrigDisplay > pSaleDisplay) ? pOrigDisplay : null;
     return { base, original, sale: base, regular: original };
  }
  // --- Hết SỬA LỖI ---

  // 3. Fallback: Đọc giá từ 'price' (dùng ở trang chi tiết, SP không có biến thể)
  const pSale = num(product.sale_price ?? product.price_sale);
  const pPrice = num(product.price);
  const base = pSale>0 ? pSale : (pPrice>0 ? pPrice : 0);
  const original = (pSale>0 && pPrice>pSale) ? pPrice : null;
  return { base, original, sale: base, regular: original };
}

function num(x){ try{ if(x==null||x==='') return 0; return Number(String(x).replace(/\./g,'').replace(/,/g,'.'))||0; }catch{ return 0; } }

// [BEGIN PATCH] pickLowestPrice – FE chỉ lấy sale → price, tuyệt đối không dùng cost
export function pickLowestPrice(product){
  const vs = Array.isArray(product?.variants) ? product.variants : [];
  let best = null;

  // ✅ Quét qua TẤT CẢ variants để tìm giá thấp nhất
  for (const v of vs) {
    // ✅ ƯU TIÊN: price_sale > sale_price > price
    const sale = num(v?.price_sale ?? v?.sale_price ?? 0);
    const price = num(v?.price ?? 0);
    
    // ✅ Nếu có sale > 0 thì dùng sale, không thì dùng price
    const base = sale > 0 ? sale : (price > 0 ? price : 0);
    if (base <= 0) continue;

    const original = (sale > 0 && price > sale) ? price : null;
    
    // ✅ Tìm giá thấp nhất
    if (!best || base < best.base) {
      best = { base, original };
    }
  }

  // ✅ Nếu KHÔNG CÓ variants hoặc variants không có giá hợp lệ
  if (!best) {
    // ⚠️ Fallback: Kiểm tra product level (trường hợp sản phẩm cũ)
    const pSale = num(product?.price_sale ?? product?.sale_price ?? 0);
    const pPrice = num(product?.price ?? 0);
    const base = pSale > 0 ? pSale : (pPrice > 0 ? pPrice : 0);
    const original = (pSale > 0 && pPrice > pSale) ? pPrice : null;
    best = { base, original };
  }

  // Backward compatibility aliases
  return { ...best, sale: best.base, regular: best.original };
}
// [END PATCH]

// ===================================================================
// WHOLESALE PRICE LOGIC
// ===================================================================

/**
 * Get customer type from localStorage
 */
/**
 * Lấy thông tin khách hàng từ global/localStorage
 * @returns {object} - customer object
 */
function getCustomerInfo() {
  try {
    // 1. Ưu tiên thông tin vừa tải (từ cart-badge)
    if (window.currentCustomer) {
      return window.currentCustomer; // Trả về toàn bộ thông tin (đã sửa)
    }
    
    // 2. Fallback về localStorage (cho lần tải đầu tiên)
    const customerInfo = localStorage.getItem('customer_info');
    if (!customerInfo) {
      return { tier: 'retail', customer_type: 'retail' }; // Khách vãng lai
    }
    
    // SỬA LỖI: Trả về toàn bộ 'info' object, không phải chỉ thông tin tier
    return JSON.parse(customerInfo);

  } catch {
    // Fallback an toàn
    return { tier: 'retail', customer_type: 'retail' };
  }
}

/**
 * Pick price based on customer type
 * Wholesale customers see wholesale_price if available
 */
export function pickPriceByCustomer(product, variant) {
  const customer = getCustomerInfo();
  const basePrice = pickPrice(product, variant); // Giá bán lẻ gốc
  const tier = customer.tier || 'retail';
  const type = customer.customer_type || 'retail';

  // --- 1. ƯU TIÊN: GIÁ SỈ ---
  // (Giả sử loại khách hàng 'wholesale' hoặc 'si')
  if (type === 'wholesale' || type === 'si') {
    
    let wholesalePrice = 0;

    // ✅ ƯU TIÊN 1: Lấy từ product level TRƯỚC (vì API bestsellers không trả về variants)
    wholesalePrice = num(product?.wholesale_price ?? product?.price_wholesale);

    // ✅ ƯU TIÊN 2: Nếu không có ở product level, mới tìm từ variants
    if (wholesalePrice === 0) {
      if (variant) {
        // 2a. Nếu đang ở trang chi tiết (có chọn variant)
        wholesalePrice = num(variant.wholesale_price ?? variant.price_wholesale);
      
      } else if (product && Array.isArray(product.variants) && product.variants.length > 0) {
        // 2b. Nếu ở trang chủ (không có variant), tìm giá sỉ THẤP NHẤT từ variants
        let minWholesale = Infinity;
        for (const v of product.variants) {
          const vPrice = num(v.wholesale_price ?? v.price_wholesale);
          if (vPrice > 0 && vPrice < minWholesale) {
            minWholesale = vPrice;
          }
        }
        if (minWholesale !== Infinity) {
          wholesalePrice = minWholesale;
        }
      }
    }

    if (wholesalePrice > 0) {
      return {
        base: wholesalePrice,
        original: basePrice.base > wholesalePrice ? basePrice.base : null, // Giá gốc là giá bán lẻ
        sale: wholesalePrice,
        regular: basePrice.base > wholesalePrice ? basePrice.base : null,
        tier: tier,
        customer_type: type
      };
    }
  }

  // --- 2. GIÁ THEO HẠNG THÀNH VIÊN (cho khách lẻ) ---
  const tierMap = {
    'retail': 0, 'silver': 3, 'gold': 5, 'diamond': 8
  };
  const discountPercent = tierMap[tier] || 0;

  if (discountPercent > 0 && basePrice.base > 0) {
    const discountAmount = basePrice.base * (discountPercent / 100);
    const discountedBase = Math.floor(basePrice.base - discountAmount);
    
    let original = basePrice.original;
    // Nếu giá gốc không có (do SP không sale), thì giá gốc chính là giá base
    if (!original && discountedBase < basePrice.base) {
      original = basePrice.base;
    }

    return {
      base: discountedBase,
      original: original,
      sale: discountedBase,
      regular: original,
      tier: tier,
      customer_type: type,
      discount: discountPercent // Lưu % giảm giá
    };
  }

  // --- 3. FALLBACK: GIÁ BÁN LẺ (cho khách vãng lai) ---
  return {
    ...basePrice,
    tier: tier,
    customer_type: type
  };
}


/**
 * Format price with customer type consideration
 */
export function formatPriceByCustomer(product, variant) {
  const priceInfo = pickPriceByCustomer(product, variant);
  
  // Cấu hình tier (để lấy icon và tên)
  const tierMap = {
    'retail': { name: 'Thành viên thường', icon: '👤' },
    'silver': { name: 'Thành viên bạc', icon: '🥈' },
    'gold': { name: 'Thành viên vàng', icon: '🥇' },
    'diamond': { name: 'Thành viên kim cương', icon: '💎' }
  };
  const tierInfo = tierMap[priceInfo.tier] || tierMap['retail'];
  
  let html = '';
  const baseFormatted = formatPrice(priceInfo.base);
  const originalFormatted = priceInfo.original ? formatPrice(priceInfo.original) : null;

  // 1. Luôn hiển thị giá cơ sở
  html = `<div><b class="text-rose-600">${baseFormatted}</b>`;

  // 2. Hiển thị giá gốc (nếu có)
  if (originalFormatted) {
    html += ` <span class="line-through opacity-70 text-sm ml-1">${originalFormatted}</span>`;
  }

  // 3. Hiển thị Huy hiệu (Badge)
  // Ưu tiên Badge "Giá sỉ"
  if ((priceInfo.customer_type === 'wholesale' || priceInfo.customer_type === 'si') && priceInfo.original) {
    html += ` <span style="background:#4f46e5;color:white;font-size:10px;padding:2px 6px;border-radius:4px;margin-left:6px;font-weight:700;">Giá sỉ</span>`;
  } 
  // Nếu không phải sỉ, hiển thị Badge "Hạng thành viên" (nếu có giảm giá)
  else if (priceInfo.discount > 0) {
    html += ` <span style="background:#10b981;color:white;font-size:10px;padding:2px 6px;border-radius:4px;margin-left:6px;font-weight:700;">${tierInfo.icon} -${priceInfo.discount}%</span>`;
  }
  
  html += `</div>`;
  
  // 4. Hiển thị Tên hạng (chỉ cho khách lẻ có hạng)
  if (priceInfo.customer_type === 'retail' && priceInfo.tier !== 'retail') {
    html += `<div style="font-size:11px;color:#059669;margin-top:4px;font-weight:600;">${tierInfo.name}</div>`;
  }
  
  return html;
}