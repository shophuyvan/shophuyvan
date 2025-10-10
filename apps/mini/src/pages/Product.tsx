import React, { useEffect, useMemo, useState } from 'react';
import Header from '../components/Header';
import Footer from '../components/Footer';
import VariantModal from '../components/VariantModal';
import { api } from '@shared/api';
import { fmtVND } from '@shared/utils/fmtVND';
import { pickPrice, priceRange } from '@shared/utils/price';
import { renderDescription } from '@shared/utils/md';
import cart from '@shared/cart';
import { routes } from '../routes';

type MediaItem = { type: 'image' | 'video'; src: string };

function useQuery() {
  const u = new URL(location.href);
  return Object.fromEntries(u.searchParams.entries());
}

export default function Product() {
  const { id } = useQuery() as { id?: string };
  const [p, setP] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [activeIndex, setActiveIndex] = useState(0);
  const [qty, setQty] = useState(1);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'cart' | 'buy'>('cart');

  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        if (!id) throw new Error('Thiếu id');
        const d = await api.products.detail(id);
        setP(d);
      } catch (e: any) {
        setError(e?.message || 'Lỗi tải sản phẩm');
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const media: MediaItem[] = useMemo(() => {
    if (!p) return [];
    const imgs = (p.images || []).map((src: string) => ({ type: 'image' as const, src }));
    const vids = (p.videos || []).map((src: string) => ({ type: 'video' as const, src }));
    const first = p.image ? [{ type: 'image' as const, src: p.image }] : [];
    const list = [...first, ...imgs, ...vids];
    return list.length ? list : [{ type: 'image', src: '/public/icon.png' }];
  }, [p]);

  const active = media[Math.min(activeIndex, Math.max(0, media.length - 1))];
  const variants = Array.isArray(p?.variants) ? p.variants : [];
  const range = useMemo(() => priceRange(variants), [variants]);

  const addLine = (variant: any, q: number) => {
    const price = pickPrice(p?.raw || p, variant);
    const line = { ...p, price, variantName: variant?.name || variant?.sku || '' };
    cart.add(line, q);
  };

  const descHTML = useMemo(
    () => renderDescription(p?.description || p?.raw?.description_html || p?.raw?.description || ''),
    [p]
  );

  return (
    <div className="pb-24">
      <Header />
      <main className="max-w-4xl mx-auto p-3">
        {loading && <div>Đang tải…</div>}
        {!loading && error && <div className="text-red-600 text-sm">{error}</div>}
        {!loading && p && (
          <div className="bg-white rounded-2xl p-3 shadow">
            {/* media */}
            <div className="w-full rounded-xl overflow-hidden bg-gray-100">
              {active?.type === 'image' ? (
                <img src={active.src} className="w-full aspect-square object-cover" />
              ) : (
                <video controls playsInline className="w-full aspect-square">
                  <source src={active.src} />
                </video>
              )}
            </div>

            {media.length > 1 && (
              <div className="mt-2 flex gap-2 overflow-auto">
                {media.map((m, i) => (
                  <button
                    key={i}
                    onClick={() => setActiveIndex(i)}
                    className={
                      'w-16 h-16 rounded-lg overflow-hidden ring-2 ' +
                      (i === activeIndex ? 'ring-sky-500' : 'ring-transparent')
                    }
                  >
                    {m.type === 'image' ? (
                      <img src={m.src} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-black/80 grid place-items-center text-white text-xs">
                        VIDEO
                      </div>
                    )}
                  </button>
                ))}
              </div>
            )}

            {/* title */}
            <h1 className="text-lg font-semibold mt-3">{p?.name}</h1>

            {/* price (range) */}
            {variants.length > 0 ? (
              <div className="mt-2">
                <div className="text-rose-600 font-bold">
                  {range.minBase ? fmtVND(range.minBase) : 'Liên hệ'}
                  {range.maxBase > range.minBase ? ` - ${fmtVND(range.maxBase)}` : ''}
                </div>
                {!!range.minOrig && (
                  <div className="text-gray-400 line-through text-sm">
                    {fmtVND(range.minOrig)}
                    {range.maxOrig > range.minOrig ? ` - ${fmtVND(range.maxOrig)}` : ''}
                  </div>
                )}
              </div>
            ) : null}

            {/* description */}
            {!!descHTML && (
              <div className="mt-4">
                <div
                  className={'prose prose-sm max-w-none ' + (expanded ? '' : 'max-h-56 overflow-hidden')}
                  dangerouslySetInnerHTML={{ __html: descHTML }}
                />
                <button onClick={() => setExpanded((x) => !x)} className="mt-2 text-sky-600 text-sm">
                  {expanded ? 'Thu gọn' : 'Xem thêm'}
                </button>
              </div>
            )}
          </div>
        )}
      </main>

      {/* fixed bottom bar */}
      {!loading && p && (
        <div className="fixed left-0 right-0 bottom-0 bg-white border-t">
          <div className="max-w-4xl mx-auto px-3 py-2 flex items-center gap-2">
            <div className="flex flex-col">
              <span className="text-xs text-gray-500">Số lượng</span>
              <div className="flex items-center gap-1">
                <button className="w-7 h-7 rounded border" onClick={() => setQty((q) => Math.max(1, q - 1))}>
                  −
                </button>
                <input
                  type="number"
                  min={1}
                  value={qty}
                  onChange={(e) => setQty(Math.max(1, Number(e.target.value || 1)))}
                  className="w-14 rounded border px-1 py-1 text-center"
                />
                <button className="w-7 h-7 rounded border" onClick={() => setQty((q) => q + 1)}>
                  +
                </button>
              </div>
            </div>

            <button
              onClick={() => {
                setModalMode('cart');
                setModalOpen(true);
              }}
              className="ml-auto rounded-2xl border border-rose-500 text-rose-600 px-4 py-2"
            >
              Thêm giỏ hàng
            </button>
            <button
              onClick={() => {
                setModalMode('buy');
                setModalOpen(true);
              }}
              className="rounded-2xl bg-rose-500 text-white px-4 py-2"
            >
              MUA NGAY
            </button>
          </div>
        </div>
      )}

      {/* choose variant modal */}
      <VariantModal
        product={p}
        variants={variants.length ? variants : [{ ...p, name: 'Mặc định' }]}
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onAdd={(variant: any, q: number) => {
          addLine(variant, q);
          if (modalMode === 'buy') {
            try {
              location.href = routes.checkout;
            } catch {}
          }
        }}
        mode={modalMode}
      />

      <Footer />
    </div>
  );
}
