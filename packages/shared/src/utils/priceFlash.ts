// packages/shared/src/utils/priceFlash.ts
// Tính giá cuối cùng theo VARIANT + Flash Sale (giảm tiếp trên sale_price)

function num(v: any) { return Math.max(0, Number(v || 0)); }

// Tính giá cuối cùng cho 1 variant
export function computeFinalPriceByVariant(
  variant: { price?: number; price_sale?: number; sale_price?: number },
  flash?: { type: 'percent' | 'fixed'; value: number } | null
) {
  const base = num((variant as any)?.sale_price ?? (variant as any)?.price_sale ?? (variant as any)?.price);
  let final = base;

  if (flash && num(flash.value) > 0 && base > 0) {
    final = (flash.type === 'fixed')
      ? Math.max(0, base - num(flash.value))
      : Math.floor(base * (1 - num(flash.value) / 100));
  }

  return { final, strike: base };
}

// Tính MIN/MAX cho product theo danh sách variants
export function computeFlashPriceRangeByProduct(
  product: { variants?: any[] },
  flash?: { type: 'percent' | 'fixed'; value: number } | null
) {
  const vs = Array.isArray(product?.variants) ? product.variants : [];
  const rows = vs
    .map((v) => computeFinalPriceByVariant(v, flash))
    .filter((x) => x.final > 0);

  if (!rows.length) return { minFinal: 0, maxFinal: 0, minStrike: 0, maxStrike: 0 };

  const finals = rows.map((x) => x.final);
  const strikes = rows.map((x) => x.strike);
  return {
    minFinal: Math.min(...finals),
    maxFinal: Math.max(...finals),
    minStrike: Math.min(...strikes),
    maxStrike: Math.max(...strikes),
  };
}
