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
