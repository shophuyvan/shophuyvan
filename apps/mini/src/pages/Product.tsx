import React, { useEffect, useMemo, useState, useRef } from 'react';
import Header from '../components/Header';
import Footer from '../components/Footer';
import VariantModal from '../components/VariantModal';
import { api } from '@shared/api';
import { fmtVND } from '@shared/utils/fmtVND';
import { pickPrice, priceRange } from '@shared/utils/price';
import { renderDescription } from '@shared/utils/md';
import cart from '@shared/cart';
import { routes } from '../routes';

// === SHV Cloudinary helper (perf) ===
function cloudify(u?: string, t: string = 'w_1200,dpr_auto,q_auto,f_auto'): string | undefined {
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
  const [shareOpen, setShareOpen] = useState(false);

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

  // ⬇️ Quan trọng: Cho video đứng đầu để auto-play khi vào trang
  const media: MediaItem[] = useMemo(() => {
    if (!p) return [];
    const imgs = (p.images || []).map((src: string) => ({ type: 'image' as const, src }));
    const vids = (p.videos || []).map((src: string) => ({ type: 'video' as const, src }));
    const first = p.image ? [{ type: 'image' as const, src: p.image }] : [];
    // Nếu có video -> video trước, sau đó đến ảnh đại diện & các ảnh còn lại
    const list = vids.length ? [...vids, ...first, ...imgs] : [...first, ...imgs];
    return list.length ? list : [{ type: 'image', src: '/public/icon.png' }];
  }, [p]);

  const active = media[Math.min(activeIndex, Math.max(0, media.length - 1))];
  const variants = Array.isArray(p?.variants) ? p.variants : [];
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const range = useMemo(() => priceRange(variants), [variants]);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const startXRef = useRef<number | null>(null);
  const [dragPct, setDragPct] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  const onTouchStart = (e: React.TouchEvent) => {
    startXRef.current = e.touches[0].clientX;
    setDragPct(0);
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (startXRef.current == null || !containerRef.current) return;
    const dx = e.touches[0].clientX - startXRef.current;
    const pct = (dx / containerRef.current.clientWidth) * 100;
    setDragPct(pct);
  };
  const onTouchEnd = () => {
    if (startXRef.current == null || !containerRef.current) return;
    const threshold = 15;
    if (dragPct > threshold && activeIndex > 0) {
      setActiveIndex((i) => i - 1);
    } else if (dragPct < -threshold && activeIndex < media.length - 1) {
      setActiveIndex((i) => i + 1);
    }
    startXRef.current = null;
    setDragPct(0);
  };

  // Tự phát khi phần tử đang hiển thị là video
  useEffect(() => {
    if (active?.type !== 'video' || !videoRef.current) return;
    const v = videoRef.current;
    const tryPlay = () =>
      v.play().then(() => setIsPlaying(!v.paused)).catch(() => setIsPlaying(false));
    v.muted = true;
    (v as any).playsInline = true;
    v.preload = 'auto';
    tryPlay();
    const onLoaded = () => tryPlay();
    v.addEventListener('loadeddata', onLoaded, { once: true });
    // Một số trình duyệt cần tương tác người dùng lần đầu
    const onceGesture = () => tryPlay();
    window.addEventListener('touchend', onceGesture, { once: true, passive: true });
    return () => {
      v.removeEventListener('loadeddata', onLoaded);
    };
  }, [active?.type, active?.src, activeIndex]);

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      v.play().then(() => setIsPlaying(true)).catch(() => {});
    } else {
      v.pause();
      setIsPlaying(false);
    }
  };

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
            <div
              className="w-full rounded-xl overflow-hidden bg-gray-100 relative"
              ref={containerRef}
              onTouchStart={onTouchStart}
              onTouchMove={onTouchMove}
              onTouchEnd={onTouchEnd}
            >
              <div
                className={'flex w-full ' + (startXRef.current == null ? 'transition-transform duration-300' : '')}
                style={{ transform: `translateX(calc(-${activeIndex * 100}% + ${dragPct}%))` }}
              >
                {media.map((m, i) => (
                  <div key={'media-'+i+'-'+m.type+'-'+(m.src||'')} className="w-full shrink-0">
                    {m.type === 'image' ? (
                      <img
                        src={m.src}
                        className="w-full aspect-square object-cover"
                        // Ưu tiên tải ảnh đang hiển thị để nhanh hơn
                        loading={i === activeIndex ? 'eager' : 'lazy'}
                        decoding="async"
                        fetchpriority={i === activeIndex ? ('high' as any) : ('low' as any)}
                        alt={p?.name || 'image'}
                      />
                    ) : (
                      <div className="relative">
                        <video
                          ref={i === activeIndex ? videoRef : null}
                          
                          muted
                          playsInline
                          preload="auto"
                          className="w-full aspect-square"
                          onPlay={() => setIsPlaying(true)}
                          onPause={() => setIsPlaying(false)}
                          onLoadedData={() => {
                            const v = videoRef.current;
                            if (i === activeIndex && v) v.play().catch(() => {});
                          }}
                          controls={false}
                          onClick={togglePlay}
                        >
                          <source src={m.src} />
                        </video>
                        {i === activeIndex && !isPlaying && (
                          <button
                            onClick={togglePlay}
                            className="absolute inset-0 grid place-items-center"
                            aria-label="Play video"
                          >
                            <span className="w-14 h-14 rounded-full bg-black/60 text-white grid place-items-center text-lg">
                              ▶
                            </span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Nút nổi */}
              <div className="absolute left-2 top-2 z-10">
                <button
                  onClick={() => { try { history.back(); } catch {} }}
                  className="w-9 h-9 rounded-full bg-black/40 text-white grid place-items-center backdrop-blur"
                  aria-label="Quay lại"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                    <path fillRule="evenodd" d="M15.75 19.5a.75.75 0 0 1-1.06 0l-7.5-7.5a.75.75 0 0 1 0-1.06l7.5-7.5a.75.75 0 1 1 1.06 1.06L9.06 11.25l6.69 6.69a.75.75 0 0 1 0 1.06z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>

              <div className="absolute right-2 top-2 z-10 flex items-center gap-2">
                <div className="relative">
                  <button
                    onClick={() => setShareOpen((x) => !x)}
                    className="w-9 h-9 rounded-full bg-black/40 text-white grid place-items-center backdrop-blur"
                    aria-label="Chia sẻ"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                      <path d="M7.5 12a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Zm9-9a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Zm0 12a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Z" />
                      <path d="M8.67 13.06 15.33 9a3 3 0 0 1 .34-.16l.39-.13m-.73 9.39-6.66-4.07" stroke="currentColor" strokeWidth="1.2" />
                    </svg>
                  </button>
                  {shareOpen && (
                    <div className="absolute right-0 mt-2 w-40 bg-white/95 rounded-xl shadow-lg border p-2 text-sm">
                      <button
                        onClick={() => { const u = location.href; const t = (p?.name||''); window.open('https://zalo.me/share?url='+encodeURIComponent(u)+'&title='+encodeURIComponent(t),'_blank'); setShareOpen(false); }}
                        className="block w-full text-left px-3 py-2 rounded-lg hover:bg-gray-100"
                      >
                        Chia sẻ Zalo
                      </button>
                      <button
                        onClick={() => { const u = location.href; window.open('https://www.facebook.com/sharer/sharer.php?u='+encodeURIComponent(u),'_blank'); setShareOpen(false); }}
                        className="block w-full text-left px-3 py-2 rounded-lg hover:bg-gray-100"
                      >
                        Chia sẻ Facebook
                      </button>
                    </div>
                  )}
                </div>

                <button
                  onClick={() => { try { location.href = routes.cart; } catch {} }}
                  className="w-9 h-9 rounded-full bg-black/40 text-white grid place-items-center backdrop-blur"
                  aria-label="Giỏ hàng"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                    <path d="M3 3h2l.4 2M7 13h10l3-7H6.4M7 13l-1.6-8H3" stroke="currentColor" strokeWidth="1.2" fill="none"/>
                    <circle cx="9" cy="19" r="1.8" />
                    <circle cx="17" cy="19" r="1.8" />
                  </svg>
                </button>
              </div>
            </div>

            <h1 className="text-lg font-semibold mt-3">{p?.name}</h1>

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

      {!loading && p && (
        <div className="fixed left-0 right-0 bottom-0 bg-white border">
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
