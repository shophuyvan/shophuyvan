import React from 'react';
import { useNavigate } from 'zmp-ui';
import { routes } from '../routes';
import { fmtVND } from '@shared/utils/fmtVND';
import { pickPrice, pickLowestPrice, numLike } from '@shared/utils/price';
import cart from '@shared/cart';
import { cloudify } from '@shared/utils/cloudinary';

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
  const navigate = useNavigate();
  const href = `${routes.product}?id=${p.id}`;

  let base = 0, original = 0;

  // 1) ƯU TIÊN GIÁ DO SERVER TÍNH TỪ VARIANTS
  const pd  = numLike((p as any)?.price_display);
  const cad = numLike((p as any)?.compare_at_display);
  if (pd > 0) {
    base = pd;
    if (cad > pd) original = cad;
  }

  // 2) Fallback: đọc từ p.price (cấu trúc cũ) nếu chưa có
  if (base <= 0) {
    if (typeof (p as any)?.price === 'number') {
      base = numLike((p as any).price);
    } else {
      base = numLike((p as any)?.price?.base ?? (p as any)?.price?.min ?? (p as any)?.price?.from);
      original = numLike((p as any)?.price?.original ?? (p as any)?.price?.max ?? (p as any)?.price?.to);
    }
  }

  // 3) Fallback sâu: pickPrice/pickLowestPrice từ raw (nếu cần)
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
    e.stopPropagation();
    
    try {
      cart.add(p, 1);
      window.dispatchEvent(new Event('shv:cart-changed'));
      
      // ✅ Sử dụng setTimeout để không block render
      setTimeout(() => {
        alert('Đã thêm vào giỏ');
      }, 50);
    } catch (err) {
      console.error('❌ Error adding to cart:', err);
    }
  };

    return (
    <div className="card p-2">
      <a
        href={href}
        onClick={(e) => {
          e.preventDefault();
          navigate(href);
        }}
        className="block relative"
      >
        <img
          src={p.image || '/public/icon.png'}
          alt={p.name || 'Product image'}
          className="w-full aspect-square object-cover rounded-xl bg-gray-100"
          loading="lazy"
        />
        {discount > 0 && (
          <span className="badge-discount">-{discount}%</span>
        )}
      </a>


      <div className="mt-2 line-clamp-2 min-h-[40px]">{p.name}</div>

      <div className="mt-1 flex items-center justify-between text-xs text-gray-600">
        <div className="flex items-center gap-1">
          <span className="inline-block" aria-label="Rating">⭐</span>
          <span>{rating > 0 ? rating.toFixed(1) : '—'}</span>
        </div>
        <div>Đã bán {sold > 0 ? sold : 0}</div>
      </div>

      <div className="mt-1 flex items-baseline gap-2">
        {base <= 0 ? (
          <span className="text-gray-600 text-sm">Liên hệ</span>
        ) : hasOriginal && original > 0 ? (
          <>
            <span className="price-sale">{fmtVND(base)}</span>
            <span className="price-original">{fmtVND(original)}</span>
          </>
        ) : (
          <span className="text-sky-600 font-semibold">{fmtVND(base)}</span>
        )}
      </div>

      {/* Đã ẩn nút thêm giỏ hàng theo yêu cầu */}
    </div>
  );
}