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
 * Lấy thông tin tier từ localStorage
 * @returns {object} - { tier, discount, tierName }
 */
function getTierInfo() {
  try {
    const customerInfo = localStorage.getItem('customer_info');
    if (!customerInfo) return { tier: 'retail', discount: 0, tierName: 'Thành viên thường' };
    
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
  const tierInfo = getTierInfo();
  const basePrice = pickPrice(product, variant);
  
  // ✅ Tính giá giảm theo tier
  let discountedBase = basePrice.base;
  
  if (tierInfo.discount > 0 && basePrice.base > 0) {
    const discountAmount = basePrice.base * (tierInfo.discount / 100);
    discountedBase = Math.floor(basePrice.base - discountAmount);
  }
  
  // ✅ Nếu có giá gốc, hãy hiển thị
  let original = basePrice.original;
  if (!original && basePrice.base > 0 && discountedBase < basePrice.base) {
    original = basePrice.base; // Giá ban đầu là basePrice
  }
  
  return {
    base: discountedBase,
    original: original,
    sale: discountedBase,
    regular: original,
    tier: tierInfo.tier,
    discount: tierInfo.discount,
    tierName: tierInfo.tierName
  };
}


/**
 * Format price with customer type consideration
 */
export function formatPriceByCustomer(product, variant) {
  const priceInfo = pickPriceByCustomer(product, variant);
  const tierInfo = getTierInfo();
  
  let html = '';
  
  // Hiển thị giá với discount
  if (priceInfo.original && priceInfo.base < priceInfo.original) {
    html = `<div>
      <b class="text-rose-600">${formatPrice(priceInfo.base)}</b>
      <span class="line-through opacity-70 text-sm ml-1">${formatPrice(priceInfo.original)}</span>`;
    
    // ✅ Thêm badge giảm giá theo tier
    if (tierInfo.discount > 0) {
      html += `<span style="background:#10b981;color:white;font-size:10px;padding:2px 6px;border-radius:4px;margin-left:6px;font-weight:700;">${tierInfo.icon} -${tierInfo.discount}%</span>`;
    }
    
    html += `</div>`;
  } else {
    html = `<div><b class="text-rose-600">${formatPrice(priceInfo.base)}</b>`;
    
    // ✅ Thêm badge nếu có discount
    if (tierInfo.discount > 0) {
      html += `<span style="background:#10b981;color:white;font-size:10px;padding:2px 6px;border-radius:4px;margin-left:6px;font-weight:700;">${tierInfo.icon} -${tierInfo.discount}%</span>`;
    }
    
    html += `</div>`;
  }
  
  // ✅ Hiển thị tier name
  if (tierInfo.discount > 0) {
    html += `<div style="font-size:11px;color:#059669;margin-top:4px;font-weight:600;">${tierInfo.tierName}</div>`;
  }
  
  return html;
}