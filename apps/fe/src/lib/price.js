export function formatPrice(v){ return (Number(v)||0).toLocaleString('vi-VN') + 'đ'; }
// apps/fe/src/lib/price.js
// Pricing priority: variant (sale|price) > product (sale|price)
// Return shape expected by UIs: { base, original } and keep aliases { sale, regular } for backwards-compat.
export function pickPrice(product, variant){
  if (variant) {
    const sale = num(variant.sale_price ?? variant.price_sale);
    const price = num(variant.price);
    const base = sale>0 ? sale : (price>0 ? price : 0);
    const original = (sale>0 && price>sale) ? price : null;
    return { base, original, sale: base, regular: original };
  }
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
      return window.currentCustomer;
    }
    
    // 2. Fallback về localStorage (cho lần tải đầu tiên)
    const customerInfo = localStorage.getItem('customer_info');
    if (!customerInfo) {
      return { tier: 'retail', customer_type: 'retail' }; // Khách vãng lai
    }
    
    const info = JSON.parse(customerInfo);
    const tier = info.tier || 'retail';
    
    // Ánh xạ tier sang discount %
    const tierMap = {
      'retail': { discount: 0, name: 'Thành viên thường', icon: '👤' },
      'silver': { discount: 3, name: 'Thành viên bạc', icon: '🥈' },
      'gold': { discount: 5, name: 'Thành viên vàng', icon: '🥇' },
      'diamond': { discount: 8, name: 'Thành viên kim cương', icon: '💎' }
    };
    
    const tierData = tierMap[tier] || tierMap['retail'];
    
    return {
      tier,
      discount: tierData.discount,
      tierName: tierData.name,
      icon: tierData.icon
    };
  } catch {
    return { tier: 'retail', discount: 0, tierName: 'Thành viên thường' };
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
    const vWholesale = num(variant?.wholesale_price ?? variant?.price_wholesale);
    const pWholesale = num(product?.wholesale_price ?? product?.price_wholesale);
    
    // Lấy giá sỉ (ưu tiên variant, fallback về product)
    const wholesalePrice = vWholesale > 0 ? vWholesale : (pWholesale > 0 ? pWholesale : 0);

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