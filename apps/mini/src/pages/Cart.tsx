import React, { useEffect, useState } from 'react';
import cart from '@shared/cart';
import { fmtVND } from '@shared/utils/fmtVND';
import { routes } from '../routes';

// === SHV Cloudinary helper (Mini Plan A) ===
function cloudify(u?: string, t: string = 'w_160,q_auto,f_auto,c_fill'): string | undefined {
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


export default function CartPage() {
  const [state, setState] = useState(cart.get());

  useEffect(() => {
    const onStorage = (e: StorageEvent) => { if (e.key === 'shv_cart_v1') setState(cart.get()); };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const update = () => setState(cart.get());

  return (
    <div>
      
      <main className="max-w-4xl mx-auto p-3">
        <h1 className="text-xl font-bold mb-3">Giỏ hàng</h1>

        {state.lines.length === 0 ? (
          <div>Giỏ hàng trống.</div>
        ) : (
          <div className="space-y-3">
            {state.lines.map((l) => (
              <div key={String(l.id)} className="bg-white rounded-2xl p-3 shadow flex gap-3">
                <img src={(l.variantImage || (l.variant && (l.variant.image || (Array.isArray(l.variant.images)?l.variant.images[0]:undefined))) || l.image) || '/public/icon.png'} className="w-20 h-20 rounded-xl object-cover" />
                <div className="flex-1">
                  <div className="font-medium line-clamp-2">{l.variantName || (l.variant && (l.variant.name || l.variant.sku)) || l.name}</div>
                  <div className="text-sm mt-1">
                    <span className="text-sky-600 font-semibold mr-2">{fmtVND(l.price)}</span>
                    {l.original && l.original > l.price && (
                      <span className="line-through text-gray-400">{fmtVND(l.original)}</span>
                    )}
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <input
                      type="number"
                      min={1}
                      value={l.qty}
                      onChange={e => { cart.setQty(l.id, Math.max(1, Number(e.target.value||1))); update(); }}
                      className="w-16 rounded-lg border px-2 py-1"
                    />
                    <button onClick={() => { cart.remove(l.id); update(); }} className="ml-auto rounded-xl border px-3 py-1">
                      Xoá
                    </button>
                  </div>
                </div>
              </div>
            ))}

            <div className="bg-white rounded-2xl p-3 shadow">
              <div className="flex justify-between py-1">
                <span>Tạm tính</span><span>{fmtVND(state.subtotal)}</span>
              </div>
              {state.savings > 0 && (
                <div className="flex justify-between py-1 text-green-600">
                  <span>Tiết kiệm</span><span>-{fmtVND(state.savings)}</span>
                </div>
              )}
              <div className="flex justify-between py-2 text-lg font-semibold border-t mt-2">
                <span>Tổng cộng</span><span>{fmtVND(state.total)}</span>
              </div>
              <a href={routes.checkout} className="mt-2 block text-center rounded-2xl bg-sky-500 text-white py-2">Thanh toán</a>
            </div>
          </div>
        )}
      </main>
      
    </div>
  );
}

    // R2 storage logic added for Cloudinary images
    const r2Url = (cloudinaryUrl) => {
        const cloudinaryDomain = "https://res.cloudinary.com/dtemskptf/image/upload/";
        return cloudinaryUrl.replace(cloudinaryDomain, "https://r2-cloud-storage.example.com/");
    };
    