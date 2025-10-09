// packages/shared/src/utils/price.ts
export function numLike(x: any): number {
  try {
    if (x == null || x === '') return 0;
    if (typeof x === 'number') return x;
    // when x is object like {min:12000}, try common fields
    if (typeof x === 'object') {
      const cand = [x.min, x.minPrice, x.minimum, x.price, x.base, x.base_price, x.value, x.amount];
      for (const v of cand) { const n = numLike(v); if (n>0) return n; }
      return 0;
    }
    const s = String(x).replace(/[^0-9.,-]/g, '');
    const norm = s.replace(/\.(?=\d{3}(\D|$))/g, '').replace(/,/g, '.');
    return Number(norm) || 0;
  } catch { return 0; }
}

// Sale/regular aliases
export function readSale(o: any): number {
  return numLike(o?.sale_price ?? o?.price_sale ?? o?.sale ?? o?.discount_price ?? o?.deal_price ?? o?.special_price ?? o?.promo_price ?? o?.promotion_price);
}
export function readPrice(o: any): number {
  // nested objects like {price:{min:.., max:..}} or {pricing:{from:..}}
  if (o?.price && typeof o.price === 'object') {
    const nested = numLike(o.price.min ?? o.price.minPrice ?? o.price.from ?? o.price.base ?? o.price.value);
    if (nested > 0) return nested;
  }
  if (o?.pricing && typeof o.pricing === 'object') {
    const nested = numLike(o.pricing.min ?? o.pricing.from ?? o.pricing.price);
    if (nested > 0) return nested;
  }
  const minLike = numLike(o?.min_price ?? o?.price_min ?? o?.minPrice ?? o?.priceFrom ?? o?.price_from ?? o?.lowest_price);
  if (minLike > 0) return minLike;
  return numLike(o?.price ?? o?.regular_price ?? o?.base_price ?? o?.original_price ?? o?.list_price ?? o?.priceText);
}

export function pickPrice(product: any, variant?: any) {
  if (variant) {
    const sale = readSale(variant);
    const price = readPrice(variant);
    const base = sale > 0 ? sale : (price > 0 ? price : 0);
    const original = (sale > 0 && price > sale) ? price : null;
    return { base, original };
  }
  const pSale = readSale(product);
  const pPrice = readPrice(product);
  const base = pSale > 0 ? pSale : (pPrice > 0 ? pPrice : 0);
  const pOrigNested = numLike(product?.price?.max ?? product?.price?.to);
  const pOrig = pOrigNested || numLike(product?.max_price ?? product?.price_max ?? product?.original_price ?? product?.list_price);
  const original = (pOrig > base) ? pOrig : ((pSale > 0 && pPrice > pSale) ? pPrice : null);
  return { base, original };
}

export function pickLowestPrice(product: any) {
  const vs = Array.isArray(product?.variants) ? product.variants : [];
  let best: { base: number; original: number | null } | null = null;
  for (const v of vs) {
    const sale = readSale(v);
    const price = readPrice(v);
    const base = sale > 0 ? sale : (price > 0 ? price : 0);
    if (base <= 0) continue;
    const original = (sale > 0 && price > sale) ? price : null;
    if (!best || base < best.base) best = { base, original };
  }
  if (!best) {
    const pSale = readSale(product);
    const pPrice = readPrice(product);
    const base = pSale > 0 ? pSale : (pPrice > 0 ? pPrice : 0);
    const pOrigNested = numLike(product?.price?.max ?? product?.price?.to);
    const pOrig = pOrigNested || numLike(product?.max_price ?? product?.price_max ?? product?.original_price ?? product?.list_price);
    const original = (pOrig > base) ? pOrig : ((pSale > 0 && pPrice > pSale) ? pPrice : null);
    best = { base, original };
  }
  return best;
}

export function priceRange(variants: any[]) {
  const bases = variants.map(v => pickPrice(null, v).base).filter(n => n > 0);
  const origs = variants.map(v => pickPrice(null, v).original || 0).filter(n => n > 0);
  const minBase = bases.length ? Math.min(...bases) : 0;
  const maxBase = bases.length ? Math.max(...bases) : 0;
  const minOrig = origs.length ? Math.min(...origs) : 0;
  const maxOrig = origs.length ? Math.max(...origs) : 0;
  return { minBase, maxBase, minOrig, maxOrig };
}
