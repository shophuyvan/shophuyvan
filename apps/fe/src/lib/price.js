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
function getCustomerType() {
  try {
    const customerInfo = localStorage.getItem('customer_info');
    if (!customerInfo) return 'retail';
    const info = JSON.parse(customerInfo);
    return info.customer_type || 'retail';
  } catch {
    return 'retail';
  }
}

/**
 * Pick price based on customer type
 * Wholesale customers see wholesale_price if available
 */
export function pickPriceByCustomer(product, variant) {
  const customerType = getCustomerType();
  const basePrice = pickPrice(product, variant);
  
  // If retail customer, return normal price
  if (customerType === 'retail') {
    return basePrice;
  }
  
  // If wholesale customer, check for wholesale_price
  if (customerType === 'wholesale') {
    let wholesalePrice = null;
    
    if (variant) {
      wholesalePrice = num(variant.wholesale_price);
    }
    
    if (!wholesalePrice || wholesalePrice <= 0) {
      wholesalePrice = num(product.wholesale_price);
    }
    
    // If wholesale price exists and valid, use it
    if (wholesalePrice > 0) {
      return {
        base: wholesalePrice,
        original: basePrice.base > wholesalePrice ? basePrice.base : null,
        sale: wholesalePrice,
        regular: basePrice.base > wholesalePrice ? basePrice.base : null
      };
    }
  }
  
  // Fallback to normal price
  return basePrice;
}

/**
 * Format price with customer type consideration
 */
export function formatPriceByCustomer(product, variant) {
  const priceInfo = pickPriceByCustomer(product, variant);
  const customerType = getCustomerType();
  
  let html = '';
  
  if (priceInfo.original && priceInfo.base < priceInfo.original) {
    html = `<div>
      <b class="text-rose-600">${formatPrice(priceInfo.base)}</b>
      <span class="line-through opacity-70 text-sm ml-1">${formatPrice(priceInfo.original)}</span>
    </div>`;
  } else {
    html = `<div><b class="text-rose-600">${formatPrice(priceInfo.base)}</b></div>`;
  }
  
  // Add badge for wholesale customers
  if (customerType === 'wholesale') {
    html += `<div style="font-size:10px;color:#92400e;background:#fef3c7;padding:2px 6px;border-radius:4px;display:inline-block;margin-top:4px;">🪙 Giá sỉ</div>`;
  }
  
  return html;
}