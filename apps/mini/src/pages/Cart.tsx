import React, { useEffect, useState, useCallback } from 'react';
import cart from '@shared/cart';
import { fmtVND } from '@shared/utils/fmtVND';
import { cloudify } from '@shared/utils/cloudinary';
import { routes } from '../routes';

export default function CartPage() {
  const [state, setState] = useState(cart.get());

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'shv_cart_v1') setState(cart.get());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const update = useCallback(() => setState(cart.get()), []);

  const handleQtyChange = useCallback((lineId: any, newQty: number) => {
    cart.setQty(lineId, Math.max(1, newQty));
    update();
  }, [update]);

  const handleRemove = useCallback((lineId: any) => {
    cart.remove(lineId);
    update();
  }, [update]);

  const getLineImage = useCallback((l: any) => {
    const rawImg = l.variantImage || 
                   (l.variant && (l.variant.image || (Array.isArray(l.variant.images) ? l.variant.images[0] : undefined))) || 
                   l.image || 
                   '/icon.png';
    return cloudify(rawImg, 'w_160,q_auto:eco,f_auto,c_fill');
  }, []);

  const isEmpty = state.lines.length === 0;

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="max-w-4xl mx-auto p-3">
        <h1 className="text-xl font-bold mb-3">Giỏ hàng</h1>

        {isEmpty ? (
          <div className="bg-white rounded-2xl p-8 shadow text-center">
            <div className="text-6xl mb-3">🛒</div>
            <div className="text-gray-500 mb-4">Giỏ hàng trống.</div>
            <a 
              href="/" 
              className="inline-block px-6 py-2 bg-sky-500 text-white rounded-xl hover:bg-sky-600 transition-colors"
            >
              Tiếp tục mua sắm
            </a>
          </div>
        ) : (
          <div className="space-y-3">
            {state.lines.map((l) => (
              <div 
                key={String(l.id)} 
                className="bg-white rounded-2xl p-3 shadow flex gap-3 hover:shadow-md transition-shadow"
              >
                <img
                  src={getLineImage(l)}
                  className="w-20 h-20 rounded-xl object-cover flex-shrink-0"
                  alt={l.variantName || l.name}
                  loading="lazy"
                />
                <div className="flex-1 min-w-0">
                  <div className="font-medium line-clamp-2">
                    {l.variantName || (l.variant && (l.variant.name || l.variant.sku)) || l.name}
                  </div>
                  <div className="text-sm mt-1">
                    <span className="text-sky-600 font-semibold mr-2">
                      {fmtVND(l.price)}
                    </span>
                    {l.original && l.original > l.price && (
                      <span className="line-through text-gray-400">
                        {fmtVND(l.original)}
                      </span>
                    )}
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <div className="flex items-center border rounded-lg overflow-hidden">
                      <button
                        onClick={() => handleQtyChange(l.id, l.qty - 1)}
                        className="px-3 py-1 hover:bg-gray-100 transition-colors"
                        aria-label="Giảm số lượng"
                      >
                        −
                      </button>
                      <input
                        type="number"
                        min={1}
                        value={l.qty}
                        onChange={e => handleQtyChange(l.id, Number(e.target.value || 1))}
                        className="w-12 text-center border-x py-1 outline-none"
                      />
                      <button
                        onClick={() => handleQtyChange(l.id, l.qty + 1)}
                        className="px-3 py-1 hover:bg-gray-100 transition-colors"
                        aria-label="Tăng số lượng"
                      >
                        +
                      </button>
                    </div>
                    <button
                      onClick={() => handleRemove(l.id)}
                      className="ml-auto rounded-xl border border-red-500 text-red-600 px-3 py-1 text-sm hover:bg-red-50 transition-colors"
                    >
                      Xoá
                    </button>
                  </div>
                </div>
              </div>
            ))}

            <div className="bg-white rounded-2xl p-4 shadow sticky bottom-3">
              <div className="flex justify-between py-1 text-sm">
                <span>Tạm tính ({state.lines.length} sản phẩm)</span>
                <span>{fmtVND(state.subtotal)}</span>
              </div>
              {state.savings > 0 && (
                <div className="flex justify-between py-1 text-sm text-green-600">
                  <span>Tiết kiệm</span>
                  <span>-{fmtVND(state.savings)}</span>
                </div>
              )}
              <div className="flex justify-between py-2 text-lg font-semibold border-t mt-2">
                <span>Tổng cộng</span>
                <span className="text-rose-600">{fmtVND(state.total)}</span>
              </div>
              <a
                href={routes.checkout}
                className="mt-3 block text-center rounded-2xl bg-sky-500 text-white py-3 font-semibold hover:bg-sky-600 transition-colors"
              >
                Thanh toán
              </a>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}