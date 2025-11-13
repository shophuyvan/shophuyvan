// apps/mini/src/lib/flashPricing.ts
// Mini App - Flash Pricing API Client (đồng bộ với FE)

const API_BASE = 'https://api.shophuyvan.vn';

/**
 * Tính giá cuối cho 1 variant + Flash Sale
 */
export async function computeFinalPriceByVariant(
  variant: any,
  flash: { type: 'percent' | 'fixed'; value: number } | null
): Promise<{ final: number; strike: number }> {
  try {
    const res = await fetch(`${API_BASE}/api/flash-pricing/compute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ variant, flash }),
    });

    if (!res.ok) {
      console.error('[Flash Pricing] API error:', res.status);
      return { final: 0, strike: 0 };
    }

    const data = await res.json();
    if (data.ok && data.data) {
      return data.data;
    }

    return { final: 0, strike: 0 };
  } catch (e) {
    console.error('[Flash Pricing] Network error:', e);
    return { final: 0, strike: 0 };
  }
}

/**
 * Tính MIN/MAX giá cho product + Flash Sale
 */
export async function computeFlashPriceRangeByProduct(
  product: any,
  flash: { type: 'percent' | 'fixed'; value: number } | null
): Promise<{
  minFinal: number;
  maxFinal: number;
  minStrike: number;
  maxStrike: number;
}> {
  try {
    const res = await fetch(`${API_BASE}/api/flash-pricing/range`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ product, flash }),
    });

    if (!res.ok) {
      console.error('[Flash Pricing] API error:', res.status);
      return { minFinal: 0, maxFinal: 0, minStrike: 0, maxStrike: 0 };
    }

    const data = await res.json();
    if (data.ok && data.data) {
      return data.data;
    }

    return { minFinal: 0, maxFinal: 0, minStrike: 0, maxStrike: 0 };
  } catch (e) {
    console.error('[Flash Pricing] Network error:', e);
    return { minFinal: 0, maxFinal: 0, minStrike: 0, maxStrike: 0 };
  }
}