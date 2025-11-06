// Home.tsx - Trang chủ Mini App chạy được trên Zalo Mini + web dev
// Đường dẫn: apps/mini/src/pages/Home.tsx

import React, { useEffect, useState, lazy, Suspense } from 'react';
import { Page, Header, useNavigate } from 'zmp-ui';
import CategoryMenu from '../components/CategoryMenu';
import { api } from '@shared/api';
import { cldFetch, preloadImage } from '@shared/utils/cloudinary';
import { zmp } from '@/lib/zmp';

const ProductCard = lazy(() => import('../components/ProductCard'));

// Fallback danh mục tĩnh nếu API lỗi
const FALLBACK_CATS = [
  { slug: 'dien-nuoc', name: 'Thiết Bị Điện\n& Nước', icon: '🔌' },
  { slug: 'nha-cua-doi-song', name: 'Nhà Cửa\nĐời Sống', icon: '🏠' },
  { slug: 'hoa-chat-gia-dung', name: 'Hoá Chất\nGia Dụng', icon: '🧪' },
  {
    slug: 'dung-cu-thiet-bi-tien-ich',
    name: 'Dụng Cụ &\nThiết Bị Tiện Ích',
    icon: '🧰',
  },
];

const ICON_MAP: Record<string, string> = {
  'dien-nuoc': '🔌',
  'nha-cua-doi-song': '🏠',
  'hoa-chat-gia-dung': '🧪',
  'dung-cu-thiet-bi-tien-ich': '🧰',
};

function getIcon(slug: string): string {
  if (ICON_MAP[slug]) return ICON_MAP[slug];
  return '📦';
}

const ProductSkeleton: React.FC = () => (
  <div className="bg-white rounded-2xl p-3 shadow animate-pulse">
    <div className="aspect-square bg-gray-200 rounded-xl mb-2" />
    <div className="h-4 bg-gray-200 rounded mb-2" />
    <div className="h-4 bg-gray-200 rounded w-2/3" />
  </div>
);

type Product = any;
type Category = any;
type Banner = any;

const Home: React.FC = () => {
  const navigate = useNavigate();
  const [items, setItems] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [catsLoading, setCatsLoading] = useState(true);
  const [banners, setBanners] = useState<Banner[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  
    const handleActivateClick = async () => {
    try {
      console.log('[ACCOUNT ACTIVATE] Bắt đầu kích hoạt từ Home');

      const payload: any = { source: 'zalo-mini' };

            // Lấy thông tin user từ Zalo (nếu SDK hỗ trợ)
      const z: any = zmp as any;
      if (z && typeof z.getUserInfo === "function") {
        try {
          const info = await new Promise<any>((resolve, reject) => {
            z.getUserInfo({
              success: (res: any) => resolve(res?.userInfo || res),
              fail: reject,
            });
          });

          if (info) {
            // lưu full profile để debug
            payload.profile = info;

            // BẮT BUỘC cho backend: map zalo_id & zalo_name
            payload.zalo_id =
              info.id ||
              info.userId ||
              info.zaloId ||
              info.openId ||
              info.uid ||
              "";

            payload.zalo_name =
              info.name ||
              info.displayName ||
              info.zaloName ||
              info.full_name ||
              "";
          }
        } catch (e) {
          console.warn("[ACCOUNT ACTIVATE] getUserInfo lỗi, vẫn tiếp tục:", e);
        }
      }



      const res = await fetch('https://api.shophuyvan.vn/api/users/activate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(
          (data && (data.message || data.error)) || `HTTP ${res.status}`,
        );
      }

      console.log('[ACCOUNT ACTIVATE] Thành công:', data);

      try {
        (zmp as any)?.toast?.show?.({
          content: 'Kích hoạt tài khoản thành công',
          duration: 2000,
        });
      } catch {
        console.log('Kích hoạt tài khoản thành công');
      }

      // Sau khi kích hoạt xong thì sang trang Tài khoản
      navigate('/account');
    } catch (err: any) {
      console.error('[ACCOUNT ACTIVATE] Lỗi:', err);
      const message =
        err?.message ||
        'Không kích hoạt được tài khoản, vui lòng thử lại sau.';
      try {
        (zmp as any)?.dialog?.alert?.({
          title: 'Kích hoạt thất bại',
          message,
        });
      } catch {
        alert(message);
      }
    }
  };


  // Load sản phẩm
  useEffect(() => {
    const loadProducts = async () => {
      try {
        const list = await api.products.list({ limit: 12 });
        const arr = Array.isArray(list) ? list : [];
        setItems(arr);
        setLoading(false);

        // Prefetch ảnh cho vài sản phẩm đầu
        const firstFew = arr.slice(0, 4);
        firstFew.forEach((item: any) => {
          const img =
            item.image || (Array.isArray(item.images) && item.images[0]);
          if (img) {
            const optimized = cldFetch(
              img,
              'w_400,dpr_auto,q_auto:eco,f_auto',
            );
            if (optimized) {
              preloadImage(optimized).catch(() => {});
            }
          }
        });
      } catch (e: any) {
        console.error(e);
        setError(e?.message || 'Lỗi tải sản phẩm');
        setLoading(false);
      }
    };

    loadProducts();
  }, []);

  // Load danh mục từ API
  useEffect(() => {
    const loadCategories = async () => {
      try {
        setCatsLoading(true);
        const response = await api.categories.list();

        if (Array.isArray(response) && response.length > 0) {
          const roots = response
            .filter((cat: any) => !cat.parent)
            .sort((a: any, b: any) => (a.order || 0) - (b.order || 0))
            .slice(0, 4);

          setCategories(roots);
        } else {
          setCategories(FALLBACK_CATS);
        }
      } catch (err) {
        console.error('Error loading categories:', err);
        setCategories(FALLBACK_CATS);
      } finally {
        setCatsLoading(false);
      }
    };

    loadCategories();
  }, []);

  // (Tuỳ ý) Load banner từ API riêng nếu có
  useEffect(() => {
    const loadBanners = async () => {
      try {
        if ((api as any).banners?.list) {
          const res = await (api as any).banners.list();
          if (Array.isArray(res)) {
            setBanners(res);
          }
        }
      } catch (err) {
        console.warn('Không load được banner, dùng nền xám mặc định.');
      }
    };

    loadBanners();
  }, []);

  // Auto slide banner
  useEffect(() => {
    if (!banners.length) return;
    const timer = setInterval(() => {
      setCurrentIndex((idx) => (idx + 1) % banners.length);
    }, 4000);
    return () => clearInterval(timer);
  }, [banners.length]);

  return (
    <Page className="bg-gray-100">
      <Header title="Shop Huy Vân" />

            {/* Banner */}
      <section className="safe-x pt-3">
        {banners && banners.length > 0 ? (
          <div className="relative rounded-2xl overflow-hidden shadow-lg aspect-[3/2]">
            <div
              className="flex transition-transform duration-700 ease-in-out"
              style={{
                width: `${banners.length * 100}%`,
                transform: `translateX(-${
                  currentIndex * (100 / banners.length)
                }%)`,
              }}
            >
              {banners.map((b: any, idx: number) => (
                <img
                  key={b.id || idx}
                  src={b.image}
                  alt={b.title || ''}
                  className="w-full object-cover"
                  loading={idx === 0 ? 'eager' : 'lazy'}
                />
              ))}
            </div>
          </div>
        ) : (
          <div className="rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-500 h-32 shadow-lg" />
        )}
      </section>

      {/* Kích hoạt tài khoản */}
      <section className="safe-x mt-3">
        <div className="bg-gradient-to-r from-cyan-500 to-blue-600 rounded-2xl p-4 text-white shadow-lg">
          <div className="text-xs opacity-80 mb-1">Đặc biệt</div>
          <div className="text-base font-semibold">Kích hoạt tài khoản</div>
          <div className="text-xs opacity-90 mb-3">
            Nhận nhiều ưu đãi từ Shop Huy Vân
          </div>
                    <button
            type="button"
            onClick={handleActivateClick}
            className="inline-flex items-center px-3 py-1.5 bg-white text-cyan-700 text-xs font-medium rounded-full shadow-sm"
          >
            <span className="mr-1">🎁</span>
            Kích hoạt ngay
          </button>

        </div>
      </section>

      {/* Menu danh mục cũ (icon to) */}
      <section className="safe-x mt-3">
        <CategoryMenu />
      </section>


      {/* Danh mục từ API */}
      <section className="safe-x mt-3">
        <div className="flex justify-between items-center mb-2">
          <h2 className="text-base font-semibold">Danh mục nổi bật</h2>
          <button
            type="button"
            className="text-xs text-blue-600"
            onClick={() => navigate('/category')}
          >
            Xem tất cả
          </button>
        </div>

        {catsLoading ? (
          <div className="grid grid-cols-4 gap-3 text-center">
            {[...Array(4)].map((_, i) => (
              <div
                key={i}
                className="rounded-2xl bg-gray-100 py-3 animate-pulse flex flex-col items-center"
              >
                <div className="w-10 h-10 rounded-full bg-gray-200 mb-2" />
                <div className="w-14 h-3 rounded bg-gray-200" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-4 gap-3 text-center">
            {categories.map((c: any) => (
              <button
                key={c.slug || c.id}
                type="button"
                onClick={() => {
                  const slug = c.slug || c.id;
                  navigate(`/category?c=${encodeURIComponent(slug)}`);
                }}
                className="hover:opacity-80 transition-opacity text-center focus:outline-none"
              >
                <div className="text-3xl">{getIcon(c.slug || '')}</div>
                <div className="whitespace-pre-line text-xs mt-1 line-clamp-2">
                  {c.name}
                </div>
              </button>
            ))}
          </div>
        )}
      </section>

      {/* Sản phẩm bán chạy */}
      <section className="safe-x mt-5 pb-24">
        <div className="flex justify-between items-center mb-3">
          <h2 className="text-lg font-bold">Sản phẩm bán chạy</h2>
          <button
            type="button"
            className="text-xs text-blue-600"
            onClick={() => navigate('/category')}
          >
            Xem thêm
          </button>
        </div>

        {error && (
          <div className="text-red-500 text-sm mb-3">{error}</div>
        )}

        {loading ? (
          <div className="grid grid-cols-2 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <ProductSkeleton key={i} />
            ))}
          </div>
        ) : (
          <Suspense
            fallback={
              <div className="grid grid-cols-2 gap-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <ProductSkeleton key={i} />
                ))}
              </div>
            }
          >
            <div className="grid grid-cols-2 gap-3">
              {items.map((p: any) => (
                <ProductCard key={String(p.id)} p={p} />
              ))}
              {!items.length && (
                <div className="col-span-2 text-center text-gray-500 py-8">
                  Chưa có sản phẩm.
                </div>
              )}
            </div>
          </Suspense>
        )}
     </section>
    </Page>
  );
};

export default Home;
