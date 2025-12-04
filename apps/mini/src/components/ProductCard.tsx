import React from 'react';
import { useNavigate } from 'zmp-ui';
import { routes } from '../routes';
import { fmtVND } from '@shared/utils/fmtVND';
import { pickPrice, pickLowestPrice, numLike } from '@shared/utils/price';
import { computeFinalPriceByVariant } from '@/lib/flashPricing';
import cart from '@shared/cart';
import { cloudify } from '@shared/utils/cloudinary';
import { zmp } from '@/lib/zmp';


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


  const handleClick = () => {
    console.log('[PRODUCT CLICK]', p.id, href);
    try {
  navigate(href); // ✅ Chuẩn Mini App
} catch (e) {
      console.error('[PRODUCT CLICK ERROR]', e);
    }
  };

  let base = 0,
    original = 0;

  // [CORE SYNC] Ưu tiên dữ liệu đã chuẩn hóa từ Product Core (product-core.js)
  // Core trả về: price_final, price_original, is_flash_sale
  if ((p as any)?.price_final > 0) {
    base = Number((p as any).price_final);
    original = Number((p as any).price_original || 0);
  }

  // Nếu Core chưa tính (data cũ), mới dùng logic fallback bên dưới
  if (base <= 0) {
    // 1) Logic cũ: price_display...
    const pd = numLike((p as any)?.price_display);
    // ... (giữ nguyên phần code fallback cũ của bạn ở dưới để an toàn)
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
      base = numLike(
        (p as any)?.price?.base ??
          (p as any)?.price?.min ??
          (p as any)?.price?.from,
      );
      original = numLike(
        (p as any)?.price?.original ??
          (p as any)?.price?.max ??
          (p as any)?.price?.to,
      );
    }
  }

  // 3) Fallback sâu: pickPrice/pickLowestPrice từ raw (nếu cần)
  if (base <= 0) {
    const pair = pickPrice((p as any)?.raw || p);
    base = numLike(base || pair.base);
    original = numLike(original || (pair.original ?? 0));
  }
    if (base <= 0) {
    const raw: any = (p as any)?.raw || p;
    try {
      const vs = Array.isArray(raw?.variants) ? raw.variants : [];
      if (vs.length) {
        const rows = vs.map((v: any) => {
          const s = v?.flash_sale;
          const val = Number(s?.discount_value ?? s?.value ?? 0);
          const f = (s?.active && val > 0)
            ? { type: s?.discount_type || (s?.type === 'fixed' ? 'fixed' : 'percent'), value: val }
            : null;
          const { final, strike } = computeFinalPriceByVariant(v, f);
          return { final, strike };
        }).filter((r: any) => r.final > 0);

        if (rows.length) {
          base = Math.min(...rows.map((r: any) => r.final));
          const strikes = rows.map((r: any) => r.strike).filter(Boolean);
          if (!original && strikes.length) original = Math.max(...strikes);
        }
      }
    } catch {}
    // nếu vẫn chưa có → fallback cũ
    if (base <= 0) {
      const low = pickLowestPrice(raw);
      base = numLike(low?.base);
      original = numLike(original || (low?.original ?? 0));
    }
  }
  
  if (base <= 0) {
    const r = (p as any)?.raw || p;
    const baseCand = [
      r?.min_price,
      r?.price_min,
      r?.minPrice,
      r?.priceFrom,
      r?.price_from,
      r?.lowest_price,
      r?.sale_price,
      r?.price_sale,
      r?.deal_price,
      r?.special_price,
      r?.price,
      r?.regular_price,
      r?.base_price,
      r?.priceText,
      r?.price?.min,
      r?.price?.from,
      r?.price?.base,
    ];
    for (const v of baseCand) {
      const n = numLike(v);
      if (n > 0) {
        base = n;
        break;
      }
    }
    const origCand = [
      r?.max_price,
      r?.price_max,
      r?.original_price,
      r?.list_price,
      r?.price?.max,
      r?.price?.to,
    ];
    for (const v of origCand) {
      const n = numLike(v);
      if (n > base) {
        original = n;
        break;
      }
    }
  } 
  } // <--- [QUAN TRỌNG] Thêm dấu này để đóng cái "if (base <= 0)" ở dòng 48
  
  const hasOriginal = original > base && original > 0;
  const discount = hasOriginal
    ? Math.max(1, Math.round((1 - base / original) * 100))
    : 0;

  // ✅ Đọc rating từ nhiều nguồn
  const rating =
    Number(
      (p as any)?.rating ?? 
      (p as any)?.rating_avg ?? 
      (p as any)?.rating_average ??
      (p as any)?.raw?.rating ?? 
      (p as any)?.raw?.rating_avg ?? 
      0
    ) || 5.0;
    
  // ✅ Đọc sold từ nhiều nguồn
  const sold = Number(
    (p as any)?.sold ?? 
    (p as any)?.sold_count ?? 
    (p as any)?.sales ??
    (p as any)?.raw?.sold ?? 
    (p as any)?.raw?.sold_count ?? 
    0
  ) || 0;

  // ✅ Lấy số lượng đánh giá
  const ratingCount = Number(
    (p as any)?.rating_count ?? 
    (p as any)?.raw?.rating_count ?? 
    0
  );

  // ✅ Check Flash Sale flag từ Product Core
  const isFlashSale = (p as any)?.is_flash_sale === true || 
                      (p as any)?.flash_sale?.active === true;
  
  const onAdd = (e: React.MouseEvent) => {
    e.preventDefault();
    cart.add(p, 1);

    window.dispatchEvent(new Event('shv:cart-changed'));
try {
  // ✅ Chuẩn Mini App: Dùng toast (thông báo) thay vì alert
  zmp.toast.show({
    content: 'Đã thêm vào giỏ',
    duration: 1500,
  });
} catch (e) {
  console.warn('Lỗi zmp.toast.show:', e);
}
  };

  return (
    <div className="card p-2">
      <button
        type="button"
        onClick={handleClick}
        className="block relative w-full text-left"
      >
        <img
          src={p.image || '/public/icon.png'}
          alt={p.name}
          className="w-full aspect-square object-cover rounded-xl bg-gray-100"
          loading="lazy"
        />
        {/* Badge Giảm giá / Flash Sale */}
        <div className="absolute top-0 left-0 p-1 flex flex-col gap-1">
          {isFlashSale && (
             <span className="bg-red-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded shadow animate-pulse">
               ⚡ FLASH
             </span>
          )}
          {discount > 0 && (
            <span className="bg-yellow-400 text-red-700 text-[9px] font-bold px-1.5 py-0.5 rounded shadow">
              -{discount}%
            </span>
          )}
        </div>
      </button>

      <div className="mt-2 line-clamp-2 min-h-[40px] text-sm text-gray-800">{p.name}</div>

      <div className="mt-1 flex items-center justify-between text-xs text-gray-600">
        <div className="flex items-center gap-1">
          <span className="inline-block">⭐</span>
          <span>{rating > 0 ? rating.toFixed(1) : '5.0'} ({ratingCount || 0})</span>
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
          <span className="text-sky-600 font-semibold">
            {fmtVND(base)}
          </span>
        )}
      </div>

     {/* Đã ẩn nút thêm giỏ hàng theo yêu cầu */}
    </div>
  );
}