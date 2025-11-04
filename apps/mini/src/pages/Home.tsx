// Home.tsx - Trang Home Mini App
// Đường dẫn: apps/mini/src/pages/Home.tsx

import React, { useEffect, useState, lazy, Suspense } from 'react';
import Header from '../components/Header';
import Footer from '../components/Footer';
import CategoryMenu from '../components/CategoryMenu';
import { api } from '@shared/api';
import { cldFetch, preloadImage } from '@shared/utils/cloudinary';
import { getUserInfo } from 'zmp-sdk/apis';

const ProductCard = lazy(() => import('../components/ProductCard'));

type Banner = {
  id?: string | number;
  title?: string;
  image: string;
  link?: string;
};

const ProductSkeleton = () => (
  <div className="bg-white rounded-2xl p-3 shadow animate-pulse">
    <div className="aspect-square bg-gray-200 rounded-xl mb-2" />
    <div className="h-4 bg-gray-200 rounded mb-2" />
    <div className="h-4 bg-gray-200 rounded w-2/3" />
  </div>
);

async function testMiniApi() {
  try {
    const res = await fetch('https://api.shophuyvan.vn/mini/ping');
    const data = await res.json().catch(() => null);
    console.log('[MINI] /mini/ping =>', data);
    alert('Mini API ping OK');
  } catch (e) {
    console.error('❌ /mini/ping error:', e);
    alert('Mini API ping lỗi, xem console.');
  }
}

const Home: React.FC = () => {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [banners, setBanners] = useState<Banner[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  // Load banners
  useEffect(() => {
    const loadBanners = async () => {
      try {
        const res = await api.get('/banners?platform=mini');
        const list = Array.isArray(res) ? res : res?.data || [];
        setBanners(list || []);
      } catch (e) {
        console.warn('⚠️ Load banners fail:', e);
        setBanners([]);
      }
    };
    loadBanners();
  }, []);

  // Prefetch product list
  useEffect(() => {
    const loadProducts = async () => {
      try {
        const list = await api.products.list({ limit: 12 });
        const arr = Array.isArray(list) ? list : [];
        setItems(arr);
        setLoading(false);

        // Prefetch ảnh nhẹ
        const firstFew = arr.slice(0, 4);
        firstFew.forEach((item) => {
          const img = item.image || (Array.isArray(item.images) && item.images[0]);
          if (img) {
            const optimized = cldFetch(img, 'w_400,dpr_auto,q_auto:eco,f_auto');
            if (optimized) {
              preloadImage(optimized).catch(() => undefined);
            }
          }
        });
      } catch (e: any) {
        console.error('❌ Load products error:', e);
        setError(e?.message || 'Lỗi tải dữ liệu');
        setLoading(false);
      }
    };

    loadProducts();
  }, []);

  // Auto slide banner
  useEffect(() => {
    if (!banners || banners.length <= 1) return;
    const timer = window.setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % banners.length);
    }, 5000);
    return () => window.clearInterval(timer);
  }, [banners]);

  const handlePrevBanner = () => {
    if (!banners || banners.length <= 1) return;
    setCurrentIndex((prev) => (prev - 1 + banners.length) % banners.length);
  };

  const handleNextBanner = () => {
    if (!banners || banners.length <= 1) return;
    setCurrentIndex((prev) => (prev + 1) % banners.length);
  };

  // Kích hoạt tài khoản qua Zalo Mini
  const handleActivateAccount = async () => {
    try {
      const result: any = await getUserInfo({
        autoRequestPermission: true,
        avatarType: 'normal',
      });

      const userInfo = result?.userInfo || result;
      console.log('✅ Zalo User Info:', userInfo);

      if (!userInfo || !userInfo.id) {
        alert('Không lấy được thông tin Zalo. Vui lòng thử lại.');
        return;
      }

      const response = await fetch(
        'https://api.shophuyvan.vn/api/users/activate',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            zalo_id: userInfo.id,
            zalo_name: userInfo.name,
            zalo_avatar: userInfo.avatar,
            phone: (userInfo as any).phone || '',
            source: 'mini',
          }),
        },
      );

      const data = await response.json();
      console.log('✅ Activate response:', data);

      if (data.ok || data.id) {
        alert('Kích hoạt thành công! Chào mừng bạn đến với Shop Huy Vân');
        setTimeout(() => {
          window.location.href = '/member';
        }, 800);
      } else {
        alert(data.message || 'Kích hoạt thất bại, vui lòng thử lại');
        console.error('❌ Activate failed:', data);
      }
    } catch (e: any) {
      console.error('⚠️ Lỗi kích hoạt / SDK:', e);
      alert(
        'Không thể kết nối Zalo hoặc người dùng chưa cấp quyền. Vui lòng thử lại trong Mini App.',
      );
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Header />

      {/* Menu danh mục mở bằng nút hamburger */}
      <CategoryMenu />

      {/* Banner */}
      <section className="safe-x mt-3">
        {banners && banners.length > 0 ? (
          <div className="relative rounded-2xl overflow-hidden bg-gray-100">
            <div className="aspect-[16/9] w-full">
              <img
                src={banners[currentIndex]?.image}
                alt={banners[currentIndex]?.title || 'Banner'}
                className="w-full h-full object-cover"
                loading="lazy"
              />
            </div>

            {banners.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={handlePrevBanner}
                  className="absolute inset-y-0 left-0 px-2 flex items-center text-white/80"
                >
                  ‹
                </button>
                <button
                  type="button"
                  onClick={handleNextBanner}
                  className="absolute inset-y-0 right-0 px-2 flex items-center text-white/80"
                >
                  ›
                </button>
                <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1">
                  {banners.map((_, i) => (
                    <span
                      key={i}
                      className={`w-2 h-2 rounded-full ${
                        i === currentIndex ? 'bg-white' : 'bg-white/50'
                      }`}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="rounded-2xl overflow-hidden bg-gray-100 aspect-[16/9] flex items-center justify-center">
            <span className="text-gray-400 text-sm">Banner</span>
          </div>
        )}
      </section>

      {/* Card kích hoạt */}
      <section className="safe-x mt-3">
        <div className="bg-gradient-to-r from-blue-500 to-cyan-600 p-4 rounded-2xl text-white shadow-lg">
          <div className="text-sm opacity-90">Đặc biệt</div>
          <div className="text-lg font-semibold">Kích hoạt tài khoản</div>
          <div className="text-sm opacity-90 mt-1">
            Nhận nhiều ưu đãi đến từ Shop Huy Vân
          </div>

          <button
            type="button"
            onClick={handleActivateAccount}
            className="mt-3 inline-flex items-center gap-2 bg-white/90 text-sky-600 font-medium px-3 py-2 rounded-xl hover:bg-white transition-colors"
          >
            <span>🎁 Kích hoạt ngay</span>
          </button>
        </div>
      </section>

      {/* Sản phẩm bán chạy */}
      <section className="safe-x mt-4 mb-20 flex-1">
        <div className="flex justify-between items-center mb-3">
          <h2 className="text-lg font-bold">Sản phẩm bán chạy</h2>
          <a href="/category" className="text-sm text-sky-600">
            Xem thêm →
          </a>
        </div>

        {error && (
          <div className="text-sm text-red-600 mb-2">
            Lỗi: {error}
          </div>
        )}

        {loading ? (
          <div className="grid grid-cols-2 gap-3">
            {Array.from({ length: 4 }).map((_, idx) => (
              <ProductSkeleton key={idx} />
            ))}
          </div>
        ) : (
          <Suspense
            fallback={
              <div className="grid grid-cols-2 gap-3">
                {Array.from({ length: 4 }).map((_, idx) => (
                  <ProductSkeleton key={idx} />
                ))}
              </div>
            }
          >
            <div className="grid grid-cols-2 gap-3">
              {items && items.length > 0 ? (
                items.map((p) => <ProductCard key={p.id} p={p} />)
              ) : (
                <div className="col-span-2 text-center text-gray-500 py-8">
                  Chưa có sản phẩm.
                </div>
              )}
            </div>
          </Suspense>
        )}
      </section>

      <Footer />
    </div>
  );
};

export default Home;

console.log('✅ Home.tsx loaded (clean version)');
