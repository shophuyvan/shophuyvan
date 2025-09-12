export function formatPrice(v){ return (v||0).toLocaleString('vi-VN') + 'đ'; }
export function pickPrice(product, variant) {
  const v = variant || {};
  const base = (v.sale_price ?? v.price) ?? (product.sale_price ?? product.price) ?? 0;
  const original = v.sale_price != null ? (v.price ?? product.price ?? 0)
                  : product.sale_price != null ? (product.price ?? 0)
                  : 0;
  return { base, original };
}
export function pickLowestPrice(product){
  const vs = Array.isArray(product?.variants) ? product.variants : [];
  if (!vs.length) return pickPrice(product, null);
  let best = { base: Infinity, original: 0 };
  for (const v of vs){
    const { base, original } = pickPrice(product, v);
    if (base < best.base) best = { base, original };
  }
  if (!isFinite(best.base)) return { base: 0, original: 0 };
  return best;
}
