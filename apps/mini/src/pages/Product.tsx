import React, { useEffect, useMemo, useState, useRef, lazy, Suspense } from 'react';
import Header from '../components/Header';
import Footer from '../components/Footer';
import { api } from '@shared/api';
import { fmtVND } from '@shared/utils/fmtVND';
import { pickPrice, priceRange } from '@shared/utils/price';
import { renderDescription } from '@shared/utils/md';
import { cldFetch } from '@shared/utils/cloudinary';
import cart from '@shared/cart';
import { routes } from '../routes';

const VariantModal = lazy(() => import('../components/VariantModal'));

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
    let isMounted = true;
    
    (async () => {
      try {
        if (!id) throw new Error('Thiếu id');
        const d = await api.products.detail(id);
        if (isMounted) setP(d);
      } catch (e: any) {
        if (isMounted) setError(e?.message || 'Lỗi tải sản phẩm');
      } finally {
        if (isMounted) setLoading(false);
      }
    })();
    
    return () => {
      isMounted = false;
    };
  }, [id]);

  const media: MediaItem[] = useMemo(() => {
    if (!p) return [];
    const imgs = (p.images || []).map((src: string) => ({ type: 'image' as const, src }));
    const vids = (p.videos || []).map((src: string) => ({ type: 'video' as const, src }));
    const first = p.image ? [{ type: 'image' as const, src: p.image }] : [];
    const list = vids.length ? [...vids, ...first, ...imgs] : [...first, ...imgs];
    return list.length ? list : [{ type: 'image', src: '/icon.png' }];
  }, [p]);

  const active = media[Math.min(activeIndex, Math.max(0, media.length - 1))];
  const variants = useMemo(() => Array.isArray(p?.variants) ? p.variants : [], [p]);
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

  useEffect(() => {
    if (active?.type !== 'video' || !videoRef.current) return;
    
    const v = videoRef.current;
    let mounted = true;
    
    const tryPlay = async () => {
      if (!mounted) return;
      try {
        await v.play();
        if (mounted) setIsPlaying(!v.paused);
      } catch {
        if (mounted) setIsPlaying(false);
      }
    };
    
    v.muted = true;
    (v as any).playsInline = true;
    v.preload = 'metadata';
    
    const onLoaded = () => tryPlay();
    v.addEventListener('loadeddata', onLoaded, { once: true });
    
    const onceGesture = () => tryPlay();
    window.addEventListener('touchend', onceGesture, { once: true, passive: true });
    
    return () => {
      mounted = false;
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

  useEffect(() => {
    if (media.length <= 1) return;
    
    const preloadIndices = [activeIndex - 1, activeIndex + 1].filter(i => i >= 0 && i < media.length);
    preloadIndices.forEach(i => {
      const item = media[i];
      if (item.type === 'image') {
        const img = new Image();
        img.src = cldFetch(item.src, 'w_800,dpr_auto,q_auto:eco,f_auto') || item.src;
      }
    });
  }, [activeIndex, media]);

  return (
    <div className="pb-24">
      <Header />
      <main className="max-w-4xl mx-auto p-3">
        {loading && (
          <div className="bg-white rounded-2xl p-3 shadow animate-pulse">
            <div className="aspect-square bg-gray-200 rounded-xl mb-3"></div>
            <div className="h-6 bg-gray-200 rounded mb-2"></div>
            <div className="h-4 bg-gray-200 rounded w-2/3"></div>
          </div>
        )}
        
        {!loading && error && (
          <div className="text-red-600 text-sm bg-red-50 p-4 rounded-xl">{error}</div>
        )}
        
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
                  <div key={`media-${i}-${m.type}-${m.src}`} className="w-full shrink-0">
                    {m.type === 'image' ? (
                      <img
                        src={cldFetch(m.src, i === 0 ? 'w_800,dpr_auto,q_auto:eco,f_auto' : 'w_400,dpr_auto,q_auto:eco,f_auto') || m.src}
                        className="w-full aspect-square object-cover"
                        loading={i === 0 ? 'eager' : 'lazy'}
                        decoding="async"
                        fetchPriority={i === 0 ? ('high' as any) : ('low' as any)}
                        alt={p?.name || 'image'}
                      />
                    ) : (
                      <div className="relative">
                        <video
                          ref={i === activeIndex ? videoRef : null}
                          className="w-full aspect-square"
                          muted
                          playsInline
                          preload="metadata"
                          src={cldFetch(m.src, 'q_auto:eco,vc_auto', 'video')}
                          poster={cldFetch(p?.image || (Array.isArray(p?.images) && p.images[0]) || undefined, 'w_400,dpr_auto,q_auto:eco,f_auto', 'image')}
                          onPlay={() => setIsPlaying(true)}
                          onPause={() => setIsPlaying(false)}
                          controls={false}
                          onClick={togglePlay}
                        />
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
                    <div className="absolute right-0 mt-2 w-40 bg-white/95 rounded-xl shadow-lg border p-2 text-sm z-50">
                      <button
                        onClick={() => {
                          const u = location.href;
                          const t = p?.name || '';
                          window.open(`https://zalo.me/share?url=${encodeURIComponent(u)}&title=${encodeURIComponent(t)}`, '_blank');
                          setShareOpen(false);
                        }}
                        className="block w-full text-left px-3 py-2 rounded-lg hover:bg-gray-100"
                      >
                        Chia sẻ Zalo
                      </button>
                      <button
                        onClick={() => {
                          const u = location.href;
                          window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(u)}`, '_blank');
                          setShareOpen(false);
                        }}
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

              {media.length > 1 && (
                <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1">
                  {media.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setActiveIndex(i)}
                      className={`w-1.5 h-1.5 rounded-full transition-all ${i === activeIndex ? 'bg-white w-4' : 'bg-white/50'}`}
                      aria-label={`Slide ${i + 1}`}
                    />
                  ))}
                </div>
              )}
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
              <div className="mt-4 relative">
                <div
                  className={'prose prose-sm max-w-none ' + (expanded ? '' : 'max-h-56 overflow-hidden')}
                  dangerouslySetInnerHTML={{ __html: descHTML }}
                />
                {!expanded && descHTML.length > 500 && (
                  <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-white to-transparent pointer-events-none"></div>
                )}
                {descHTML.length > 500 && (
                  <button
                    onClick={() => setExpanded((x) => !x)}
                    className="mt-2 text-sky-600 text-sm font-medium"
                  >
                    {expanded ? 'Thu gọn' : 'Xem thêm'}
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </main>

      {!loading && p && (
        <div className="fixed left-0 right-0 bottom-0 bg-white border-t shadow-lg z-50">
          <div className="max-w-4xl mx-auto px-3 py-2 flex items-center gap-2">
            <div className="flex flex-col">
              <span className="text-xs text-gray-500">Số lượng</span>
              <div className="flex items-center gap-1">
                <button
                  className="w-7 h-7 rounded border hover:bg-gray-50"
                  onClick={() => setQty((q) => Math.max(1, q - 1))}
                >
                  −
                </button>
                <input
                  type="number"
                  min={1}
                  value={qty}
                  onChange={(e) => setQty(Math.max(1, Number(e.target.value || 1)))}
                  className="w-14 rounded border px-1 py-1 text-center"
                />
                <button
                  className="w-7 h-7 rounded border hover:bg-gray-50"
                  onClick={() => setQty((q) => q + 1)}
                >
                  +
                </button>
              </div>
            </div>

            <button
              onClick={() => {
                setModalMode('cart');
                setModalOpen(true);
              }}
              className="ml-auto rounded-2xl border border-rose-500 text-rose-600 px-4 py-2 hover:bg-rose-50 transition-colors"
            >
              Thêm giỏ hàng
            </button>
            <button
              onClick={() => {
                setModalMode('buy');
                setModalOpen(true);
              }}
              className="rounded-2xl bg-rose-500 text-white px-4 py-2 hover:bg-rose-600 transition-colors"
            >
              MUA NGAY
            </button>
          </div>
        </div>
      )}

      <Suspense fallback={<div className="fixed inset-0 bg-black/20 z-50"></div>}>
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
      </Suspense>

      <Footer />
    </div>
  );
}