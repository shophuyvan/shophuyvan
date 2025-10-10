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

// === Component Slider Ảnh/Video (ĐÃ DUY TRÌ) ===
// Hỗ trợ chuyển đổi ảnh/video với nút điều hướng và nút Play
const MediaSlider: React.FC<{ media: MediaItem[] }> = ({ media }) => {
  const [activeIndex, setActiveIndex] = useState(0);

  if (media.length === 0) return (
    <div className="rounded-none overflow-hidden bg-gray-100 aspect-[16/9] flex items-center justify-center">
      <span className="text-gray-400 text-sm">Chưa có ảnh/video</span>
    </div>
  );

  const current = media[activeIndex];

  const next = () => setActiveIndex(i => (i + 1) % media.length);
  const prev = () => setActiveIndex(i => (i - 1 + media.length) % media.length);

  return (
    <div className="relative aspect-[16/9] overflow-hidden">
      {/* Media Item hiện tại */}
      {current.type === 'image' ? (
        <img
          src={current.src}
          alt="Ảnh sản phẩm"
          className="w-full h-full object-cover"
          loading="eager"
        />
      ) : (
        <div className="w-full h-full bg-black flex items-center justify-center relative">
          {/* Thay thế bằng nút Play lồng bên ngoài nếu bạn không muốn control mặc định */}
          <video
            src={current.src}
            controls
            poster={media.find(m => m.type === 'image')?.src} // dùng ảnh đầu tiên làm poster
            className="w-full h-full object-contain"
          />
        </div>
      )}

      {/* Nút điều hướng Trái/Phải */}
      {media.length > 1 && (
        <>
          <button
            onClick={prev}
            className="absolute left-3 top-1/2 -translate-y-1/2 bg-black/50 text-white p-2 rounded-full z-10"
            aria-label="Ảnh trước"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5"><path fillRule="evenodd" d="M11.707 4.293a1 1 0 010 1.414L8.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
          </button>
          <button
            onClick={next}
            className="absolute right-3 top-1/2 -translate-y-1/2 bg-black/50 text-white p-2 rounded-full z-10"
            aria-label="Ảnh tiếp theo"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5"><path fillRule="evenodd" d="M8.293 15.707a1 1 0 01-1.414-1.414L11.586 10 6.879 5.293a1 1 0 111.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" /></svg>
          </button>
        </>
      )}

      {/* Chỉ báo Dots */}
      <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-1">
        {media.map((_, index) => (
          <span
            key={index}
            className={`w-2 h-2 rounded-full ${index === activeIndex ? 'bg-white' : 'bg-white/50'}`}
          />
        ))}
      </div>
    </div>
  );
}
// ========================================================


export default function Product() {
  const { id } = useQuery() as { id?: string };
  const [p, setP] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [qty, setQty] = useState(1); // Giữ lại state cho số lượng

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'cart' | 'buy'>('cart');

  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const d = await api.products.detail(id as any);
        setP(d);
      } catch (e: any) {
        console.error(e);
        setError(e?.message || 'Lỗi tải dữ liệu');
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const variants = useMemo(() => {
    if (!p) return [];
    return Array.isArray(p.variants) ? p.variants : [];
  }, [p]);

  const images: MediaItem[] = useMemo(() => {
    if (!p) return [];
    const media = p.images?.map((src: string) => ({ type: 'image', src })) || [];
    if (p.videoUrl) media.unshift({ type: 'video', src: p.videoUrl }); // Ưu tiên video
    return media;
  }, [p]);

  const currentPrice = useMemo(() => {
    if (!p) return { base: 0, sale: 0 };
    return pickPrice(p);
  }, [p]);

  const range = useMemo(() => {
    if (!p) return null;
    return priceRange(p);
  }, [p]);

  const addLine = (variant: any, q: number) => {
    const item = {
      id: variant.id,
      name: `${p.name} - ${variant.name}`,
      price: pickPrice(variant),
      image: p.images?.[0] || '/public/icon.png',
      qty: q,
    };
    cart.add(item);
  };

  if (loading) {
    return (
      <div>
        <Header />
        <div className="safe-x p-3">Đang tải chi tiết sản phẩm…</div>
      </div>
    );
  }

  if (error || !p) {
    return (
      <div>
        <Header />
        <div className="safe-x p-3 text-red-600">Lỗi: {error || 'Không tìm thấy sản phẩm.'}</div>
      </div>
    );
  }

  return (
    <div className="pb-20"> {/* Khoảng đệm cho thanh nút hành động cũ/mới */}
      <Header />

      {/* SLIDER ẢNH/VIDEO MỚI (ĐÃ CẬP NHẬT) */}
      <section>
        <MediaSlider media={images} />
      </section>

      {/* THUMBNAIL CŨ ĐÃ BỊ XÓA THEO YÊU CẦU */}
      
      <div className="safe-x">
        <div className="mt-3">
          <h1 className="text-xl font-bold">{p.name}</h1>

          <div className="mt-2 flex items-baseline gap-2">
            {currentPrice.sale > 0 && (
              <span className="text-2xl font-bold text-rose-600">{fmtVND(currentPrice.sale)}</span>
            )}
            <span className={`font-semibold ${currentPrice.sale > 0 ? 'text-gray-500 line-through text-sm' : 'text-2xl text-rose-600'}`}>
              {fmtVND(currentPrice.base)}
            </span>
          </div>

          {range && (
            <div className="mt-1 text-sm text-gray-500">
              {range}
            </div>
          )}

          {variants.length > 0 && (
            <div className="mt-3">
              <button
                onClick={() => setModalOpen(true)}
                className="rounded-xl border px-3 py-2 text-sm text-brand border-brand"
              >
                Chọn biến thể ({variants.length}) →
              </button>
            </div>
          )}
        </div>

        {/* Mô tả sản phẩm */}
        <div className="mt-5">
          <div className="section-head">
            <h2>Mô tả sản phẩm</h2>
          </div>
          <div className={`mt-2 text-sm text-gray-700 overflow-hidden ${expanded ? '' : 'max-h-24'}`}>
            {renderDescription(p.description)}
          </div>
          {!expanded && (
            <button
              onClick={() => setExpanded(true)}
              className="mt-2 text-sm text-brand"
            >
              Xem thêm...
            </button>
          )}
        </div>
      </div>

      <VariantModal
        product={p}
        variants={variants.length ? variants : [{ ...p, name: 'Mặc định' }]}
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onAdd={(variant: any, q: number) => {
          addLine(variant, q);
          if (modalMode === 'buy') {
            try {
              cart.checkout(true);
              location.assign(routes.checkout);
            } catch {
              location.assign(routes.cart);
            }
          }
          setModalOpen(false);
        }}
      />
      
      {/* KHÔNG THÊM LẠI KHU VỰC NÚT HÀNH ĐỘNG CỐ ĐỊNH Ở ĐÂY NỮA 
          (Sử dụng component cũ/nút đã có sẵn trong dự án của bạn) */}

    </div>
  );
}