export function formatPrice(v){ return (v||0).toLocaleString('vi-VN') + 'đ'; }

// Pricing priority: variant (sale|price) > product (sale|price)
export function pickPrice(product, variant){
  if (variant) {
    const base = (variant.sale_price ?? variant.price) ?? (product.sale_price ?? product.price) ?? 0;
    const original = variant.sale_price ? variant.price : (product.sale_price ? product.price : base);
    return { base, original };
  }
  const base = (product.sale_price ?? product.price) ?? 0;
  const original = product.sale_price ? product.price : base;
  return { base, original };
}


export function pickLowestPrice(product){
  const vs = Array.isArray(product?.variants) ? product.variants : [];
  let best = { sale: null, regular: null };
  for(const v of vs){
    const s = (v.sale_price ?? v.price_sale ?? null);
    const r = (v.price ?? null);
    if (s!=null) best.sale = (best.sale==null) ? s : Math.min(best.sale, s);
    if (r!=null) best.regular = (best.regular==null) ? r : Math.min(best.regular, r);
  }
  if (best.sale==null && best.regular==null){
    best.sale = (product.sale_price ?? product.price_sale ?? null);
    best.regular = (product.price ?? null);
  }
  return best;
}
