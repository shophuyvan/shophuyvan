export function formatPrice(v){ return (Number(v)||0).toLocaleString('vi-VN') + 'đ'; }

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

function num(x){ try{ if(x==null||x==='') return 0; return Number(String(x).replace(/\./g,'').replace(/,/g,'.'))||0; }catch(e){ return 0; } }

export function pickLowestPrice(product){
  const vs = Array.isArray(product?.variants) ? product.variants : [];
  let best = null;

  for(const v of vs){
    const sale = num(v?.sale_price ?? v?.price_sale);
    const price = num(v?.price);
    let base = sale>0 ? sale : (price>0 ? price : 0);
    if(base<=0) continue;
    let original = (sale>0 && price>sale) ? price : null;
    if(!best || base < best.base){
      best = { base, original };
    }
  }

  if(!best){
    const pSale = num(product?.sale_price ?? product?.price_sale);
    const pPrice = num(product?.price);
    const base = pSale>0 ? pSale : (pPrice>0 ? pPrice : 0);
    const original = (pSale>0 && pPrice>pSale) ? pPrice : null;
    best = { base, original };
  }

  // Backward compatibility aliases
  return { ...best, sale: best.base, regular: best.original };
}