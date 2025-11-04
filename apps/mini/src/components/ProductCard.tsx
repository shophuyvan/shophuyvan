import React from 'react';
import { routes } from '../routes';
import { fmtVND } from '@shared/utils/fmtVND';
import { numLike } from '@shared/utils/price';
import cart from '@shared/cart';

export type Product = {
  id: string | number;
  name: string;
  image?: string;
  price?: any;
  rating?: number;
  sold?: number;
  raw?: any;
};

export default function ProductCard({ p }: { p: Product }) {
  const href = `${routes.product}?id=${p.id}`;

  // Lấy giá bán & giá gạch từ các field phổ biến
  let base = 0;
  let original = 0;

  const pd = numLike((p as any)?.price_display);
  const cad = numLike((p as any)?.compare_at_display);

  if (pd > 0) {
    base = pd;
    if (cad > pd) original = cad;
  }

  if (base <= 0) {
    const priceObj = (p as any)?.price;
    if (typeof priceObj === 'number') {
      base = numLike(priceObj);
    } else if (priceObj) {
      base = numLike(priceObj.base ?? priceObj.min ?? priceObj.from);
      original = numLike(priceObj.original ?? priceObj.max ?? priceObj.to);
    }
  }

  const hasOriginal = original > base && original > 0;
  const discount = hasOriginal
    ? Math.max(1, Math.round((1 - base / original) * 100))
    : 0;

  const rating = Number((p as any)?.rating ?? (p as any)?.raw?.rating ?? 0) || 0;
  const sold = Number((p as any)?.sold ?? (p as any)?.raw?.sold ?? 0) || 0;

  const onAdd = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    try {
      cart.add(p, 1);
      window.dispatchEvent(new Event('shv:cart-changed'));
      setTimeout(() => {
        alert('Đã thêm vào giỏ');
      }, 50);
    } catch (err) {
      console.error('❌ Error adding to cart:', err);
    }
  };

  return (
    <div className="card p-2">
      <a href={href} className="block relative">
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
          <span className="inline-block" aria-label="Rating">
            ⭐
          </span>
          <span>{rating > 0 ? rating.toFixed(1) : '—'}</span>
        </div>
        <div>Đã bán {sold > 0 ? sold : 0}</div>
      </div>

      <div className="mt-1 flex items-center justify-between">
        {base <= 0 ? (
          <span className="text-gray-600 text-sm">Liên hệ</span>
        ) : hasOriginal ? (
          <>
            <span className="price-sale">{fmtVND(base)}</span>
            <span className="price-original">{fmtVND(original)}</span>
          </>
        ) : (
          <span className="text-sky-600 font-semibold">{fmtVND(base)}</span>
        )}

        {/* Nếu muốn bật lại nút giỏ hàng thì bỏ comment */}
        {/* <button
          onClick={onAdd}
          className="ml-2 px-2 py-1 rounded-lg bg-sky-500 text-white text-xs"
        >
          + Giỏ
        </button> */}
      </div>
    </div>
  );
}
