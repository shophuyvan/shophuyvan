import React from 'react';
import { routes } from '../routes';
import { fmtVND } from '@shared/utils/fmtVND';
import { pickPrice, pickLowestPrice, numLike } from '@shared/utils/price';
import cart from '@shared/cart';

// === SHV Cloudinary helper (Mini Plan A) ===
function cloudify(u?: string, t: string = 'w_500,q_auto,f_auto,c_fill'): string | undefined {
  try {
    if (!u) return u;
    const base = (typeof location !== 'undefined' && location.origin) ? location.origin : 'https://example.com';
    const url = new URL(u, base);
    if (!/res\.cloudinary\.com/i.test(url.hostname)) return u;
    if (/\/upload\/[^/]+\//.test(url.pathname)) return url.toString();
    url.pathname = url.pathname.replace('/upload/', '/upload/' + t + '/');
    return url.toString();
  } catch { return u; }
}


export type Product = {
  id: string | number;
  name: string;
  image?: string;
  price?: { base: number; original: number | null } | number | any;
  rating?: number;
  sold?: number;
  raw?: any;
};

export default function ProductCard({ p }: { p: Product }) {
  const href = `${routes.product}?id=${p.id}`;

  let base = 0, original = 0;
  if (typeof (p as any)?.price === 'number') base = numLike((p as any).price);
  else {
    base = numLike((p as any)?.price?.base ?? (p as any)?.price?.min ?? (p as any)?.price?.from);
    original = numLike((p as any)?.price?.original ?? (p as any)?.price?.max ?? (p as any)?.price?.to);
  }
  if (base <= 0) {
    const pair = pickPrice((p as any)?.raw || p);
    base = numLike(base || pair.base);
    original = numLike(original || (pair.original ?? 0));
  }
  if (base <= 0) {
    const low = pickLowestPrice((p as any)?.raw || p);
    base = numLike(low?.base);
    original = numLike(original || (low?.original ?? 0));
  }
  if (base <= 0) {
    const r = (p as any)?.raw || p;
    const baseCand = [r?.min_price, r?.price_min, r?.minPrice, r?.priceFrom, r?.price_from, r?.lowest_price, r?.sale_price, r?.price_sale, r?.deal_price, r?.special_price, r?.price, r?.regular_price, r?.base_price, r?.priceText, r?.price?.min, r?.price?.from, r?.price?.base];
    for (const v of baseCand) { const n = numLike(v); if (n > 0) { base = n; break; } }
    const origCand = [r?.max_price, r?.price_max, r?.original_price, r?.list_price, r?.price?.max, r?.price?.to];
    for (const v of origCand) { const n = numLike(v); if (n > base) { original = n; break; } }
  }
  const hasOriginal = original > base && original > 0;
  const discount = hasOriginal ? Math.max(1, Math.round((1 - base / original) * 100)) : 0; // e.g. 31%

  const rating = Number((p as any)?.rating ?? (p as any)?.raw?.rating ?? 0) || 0;
  const sold = Number((p as any)?.sold ?? (p as any)?.raw?.sold ?? 0) || 0;

  const onAdd = (e: React.MouseEvent) => {
    e.preventDefault();
    cart.add(p, 1);
    try { alert('Đã thêm vào giỏ'); } catch {}
  };

  return (
    <div className="card p-2">
      <a href={href} className="block relative">
        <img src={cloudify(p.image || '/public/icon.png', 'w_500,q_auto,f_auto,c_fill')} srcSet={`${cloudify(p.image || '/public/icon.png', 'w_320,q_auto,f_auto,c_fill')} 320w, ${cloudify(p.image || '/public/icon.png', 'w_480,q_auto,f_auto,c_fill')} 480w, ${cloudify(p.image || '/public/icon.png', 'w_768,q_auto,f_auto,c_fill')} 768w, ${cloudify(p.image || '/public/icon.png', 'w_1024,q_auto,f_auto,c_fill')} 1024w`} sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 300px" loading="lazy" decoding="async" width="800" height="800" class="w-full aspect-square object-cover rounded-xl bg-gray-100" alt={p.name} />
        {discount > 0 && (
          <span className="badge-discount">-{discount}%</span>
        )}
      </a>

      <div className="mt-2 line-clamp-2 min-h-[40px]">{p.name}</div>

      <div className="mt-1 flex items-center justify-between text-xs text-gray-600">
        <div className="flex items-center gap-1">
          <span className="inline-block">⭐</span>
          <span>{rating > 0 ? rating.toFixed(1) : '—'}</span>
        </div>
        <div>Đã bán {sold || 0}</div>
      </div>

      <div className="mt-1 flex items-baseline gap-2">
        {base <= 0 ? (
          <span>Liên hệ</span>
        ) : hasOriginal ? (
          <>
            <span className="price-sale">{fmtVND(base)}</span>
            <span className="price-original">{fmtVND(original)}</span>
          </>
        ) : (
          <span className="text-sky-600 font-semibold">{fmtVND(base)}</span>
        )}
      </div>

      <button onClick={onAdd} className="btn-primary mt-3 text-center w-full">
        Thêm giỏ hàng
      </button>
    </div>
  );
}