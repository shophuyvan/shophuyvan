// Home.tsx - Mini App với danh mục động từ API
// Đường dẫn: apps/mini/src/pages/Home.tsx
// ✅ PATCHED: Thêm debug logs để trace React error #299

import React, { useEffect, useState, lazy, Suspense } from 'react';
import Header from '../components/Header';
import Footer from '../components/Footer';
import CategoryMenu from '../components/CategoryMenu';
import { api } from '@shared/api';
import { numLike } from '@shared/utils/price';
import { cldFetch, preloadImage } from '@shared/utils/cloudinary';
import { getUserInfo } from 'zmp-sdk/apis';

const ProductCard = lazy(() => import('../components/ProductCard'));

async function enrichPrices(list: any[]): Promise<any[]> {
  if (!list.length) return list;
  
  const needsFetch = list.filter(p => {
    const base = numLike((p as any)?.price?.base ?? (p as any)?.price);
    return base <= 0;
  });
  
  if (needsFetch.length === 0) return list;
  
  const BATCH_SIZE = 4;
  const results = [...list];
  
  for (let i = 0; i < needsFetch.length; i += BATCH_SIZE) {
    const batch = needsFetch.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.allSettled(
      batch.map(p => api.products.detail(p.id as any))
    );
    
    batchResults.forEach((result, idx) => {
      if (result.status === 'fulfilled' && result.value) {
        const d = result.value;
        const originalIndex = list.findIndex(p => p.id === batch[idx].id);
        if (originalIndex !== -1 && (d as any).price && numLike((d as any).price.base) > 0) {
          results[originalIndex] = {
            ...results[originalIndex],
            price: (d as any).price,
            raw: results[originalIndex].raw ?? results[originalIndex]
          };
        }
      }
    });
  }
  
  return results;
}

// ✅ FALLBACK: Danh mục tĩnh (nếu API lỗi)
const FALLBACK_CATS = [
  { slug: 'dien-nuoc', name: 'Thiết Bị Điện\n& Nước', icon: '🔌' },
  { slug: 'nha-cua-doi-song', name: 'Nhà Cửa\nĐời Sống', icon: '🏠' },
  { slug: 'hoa-chat-gia-dung', name: 'Hoá Chất\nGia Dụng', icon: '🧪' },
  { slug: 'dung-cu-thiet-bi-tien-ich', name: 'Dụng Cụ &\nThiết Bị Tiện Ích', icon: '🧰' },
];

// ✅ Icon map cho danh mục
const ICON_MAP: Record<string, string> = {
  'dien-nuoc': '🔌',
  'nha-cua-doi-song': '🏠',
  'hoa-chat-gia-dung': '🧪',
  'dung-cu-thiet-bi-tien-ich': '🧰',
  'dien': '⚡',
  'nuoc': '💧',
  'nha': '🏡',
  'cua': '🚪',
  'hoa-chat': '🧴',
  'dung-cu': '🔧',
  'thiet-bi': '⚙️',
};

function getIcon(slug: string): string {
  if (ICON_MAP[slug]) return ICON_MAP[slug];
  for (const [key, icon] of Object.entries(ICON_MAP)) {
    if (slug.includes(key)) return icon;
  }
  return '📦';
}

const ProductSkeleton = () => (
  <div className="bg-white rounded-2xl p-3 shadow animate-pulse">
    <div className="aspect-square bg-gray-200 rounded-xl mb-2"></div>
    <div className="h-4 bg-gray-200 rounded mb-2"></div>
    <div className="h-4 bg-gray-200 rounded w-2/3"></div>
  </div>
);

// ✅ PATCHED: Thêm debug parameter
const testMiniApi = async (e?: any) => {
  console.log('🔵 [DEBUG] testMiniApi called, event:', typeof e, e);
  try {
    console.log("[TestMiniAPI] Gọi https://api.shophuyvan.vn/mini/ping ...");
    const res = await fetch("https://api.shophuyvan.vn/mini/ping");
    const data = await res.json();
    console.log("[TestMiniAPI] Kết quả:", data);
    console.log('🔵 [DEBUG] data type:', typeof data, Object.prototype.toString.call(data));
    alert("API OK: " + JSON.stringify(data));
  } catch (err) {
    console.error("[TestMiniAPI] Lỗi:", err);
    console.error('🔴 [DEBUG] Error type:', typeof err, err);
    alert("API lỗi, mở console để xem chi tiết");
  }
};

const handleActivateAccount = async () => {
  try {
    console.log('🔵 [Activate] Bắt đầu kích hoạt tài khoản từ Mini App');

    // Gọi SDK chính thức – tự xử lý ready + permission
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

    try {
      const response = await fetch('https://api.shophuyvan.vn/api/users/activate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          zalo_id: userInfo.id,
          zalo_name: userInfo.name,
          zalo_avatar: userInfo.avatar,
          phone: (userInfo as any).phone || '',
          source: 'mini',
        }),
      });

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
    } catch (err) {
      console.error('❌ Lỗi gửi dữ liệu:', err);
      alert('Lỗi kích hoạt. Vui lòng thử lại.');
    }
  } catch (e: any) {
    console.error('⚠️ Lỗi kích hoạt / SDK:', e);

    // Trường hợp user từ chối cấp quyền, hoặc SDK lỗi
    if (e && typeof e === 'object' && 'code' in e) {
      console.warn('SDK error code:', (e as any).code);
    }

    alert(
      'Không thể kết nối Zalo hoặc người dùng chưa cấp quyền. Vui lòng thử lại trong Mini App.'
    );
  }
};


export default function Home() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [categories, setCategories] = useState<any[]>([]);
  const [catsLoading, setCatsLoading] = useState(true);
  const [banners, setBanners] = useState<any[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);

    // 🔧 Tắt eruda overlay của Zalo Test để không chặn click
  useEffect(() => {
    try {
      const killErudaOverlay = () => {
        try {
          const w: any = window;

          // Thử destroy instance eruda nếu có
          if (w.eruda && typeof w.eruda.destroy === "function") {
            console.log("[SHV] Destroy eruda debug overlay");
            try {
              w.eruda.destroy();
            } catch (e) {
              console.warn("[SHV] Không thể destroy eruda:", e);
            }
          }

          // Tắt luôn mọi DOM nghi là overlay của eruda
          const selectors = ['#eruda', '.eruda', '[class*="eruda"]', '[id*="eruda"]'];
          selectors.forEach((sel) => {
            const nodes = document.querySelectorAll(sel);
            nodes.forEach((node) => {
              const el = node as HTMLElement;
              el.style.display = "none";
              el.style.pointerEvents = "none";
            });
          });
        } catch (inner) {
          console.warn("[SHV] Lỗi khi xử lý eruda overlay:", inner);
        }
      };

      // Gọi ngay 1 lần
      killErudaOverlay();

      // Poll thêm một thời gian ngắn vì script eruda có thể inject trễ
      let tries = 0;
      const maxTries = 60; // 60 * 100ms = ~6s
      const timer = window.setInterval(() => {
        tries += 1;
        killErudaOverlay();
        if (tries >= maxTries) {
          window.clearInterval(timer);
        }
      }, 100);

      return () => {
        window.clearInterval(timer);
      };
    } catch (e) {
      console.warn("[SHV] Lỗi khi setup auto-kill eruda:", e);
    }
  }, []);


  useEffect(() => {
    const loadBanners = async () => {
      try {
        const res = await api.get('/banners?platform=mini');
        const data = res?.items || res?.data || [];
        const activeMini = data.filter(
          (b: any) => (!b.platform || b.platform === 'mini') && b.on !== false
        );
        setBanners(activeMini);
        console.log('✅ Loaded Mini Banners:', activeMini.length);
      } catch (e) {
        console.error('❌ Error loading banners:', e);
        setBanners([]);
      }
    };
    loadBanners();
  }, []);

  useEffect(() => {
    if (!banners || banners.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % banners.length);
    }, 3500);
    return () => clearInterval(interval);
  }, [banners]);

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
          console.log('✅ Loaded categories for Home:', roots.length);
        } else {
          setCategories(FALLBACK_CATS);
        }
      } catch (err) {
        console.error('❌ Error loading categories:', err);
        setCategories(FALLBACK_CATS);
      } finally {
        setCatsLoading(false);
      }
    };
    
    loadCategories();
  }, []);

  useEffect(() => {
    const prefetchData = async () => {
      try {
        const list = await api.products.list({ limit: 12 });
        const arr = Array.isArray(list) ? list : [];
        
        setItems(arr);
        setLoading(false);
        console.log('[PRICE] MINI list', { tier: arr?.[0]?.price_tier, price: arr?.[0]?.price_display, n: arr.length });
      } catch (e: any) {
        console.error(e);
        setError(e?.message || 'Lỗi tải dữ liệu');
        setLoading(false);
      }
    };

    prefetchData();
  }, []);

  useEffect(() => {
    if (items.length > 0) {
      const firstFew = items.slice(0, 4);
      firstFew.forEach(item => {
        const img = item.image || (Array.isArray(item.images) && item.images[0]);
        if (img) {
          const optimized = cldFetch(img, 'w_400,dpr_auto,q_auto:eco,f_auto');
          if (optimized) {
            preloadImage(optimized).catch(() => {});
          }
        }
      });
    }
  }, [items]);

  return (
    <div className="pb-24">
      <Header />

      {/* Banner Slide động từ API */}
      <section className="safe-x pt-3">
        {Array.isArray(banners) && banners.length > 0 ? (
          <div className="relative rounded-2xl overflow-hidden shadow-lg aspect-[3/2]">
            <div
              className="flex transition-transform duration-700 ease-in-out"
              style={{
                width: `${banners.length * 100}%`,
                transform: `translateX(-${currentIndex * (100 / banners.length)}%)`,
              }}
            >
              {banners.map((b, i) => (
                <a
                  key={b.id || i}
                  href={b.link || '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block w-full flex-shrink-0"
                  style={{ width: `${100 / banners.length}%` }}
                >
                  <img
                    src={b.image}
                    alt={b.title || 'Banner'}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                </a>
              ))}
            </div>

            <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1">
              {banners.map((_, i) => (
                <span
                  key={i}
                  className={`w-2 h-2 rounded-full transition-all duration-300 ${
                    i === currentIndex ? 'bg-white' : 'bg-white/50'
                  }`}
                ></span>
              ))}
            </div>
          </div>
        ) : (
          <div className="rounded-2xl overflow-hidden bg-gradient-to-br from-gray-100 to-gray-200 aspect-[16/9] flex items-center justify-center">
            <span className="text-gray-400 text-sm">Banner</span>
          </div>
        )}
      </section>

      {/* ✅ PATCHED: Debug button click */}
      <section className="safe-x mt-3">
        <button
          className="w-full px-4 py-2 rounded-xl bg-blue-500 text-white text-sm font-medium shadow"
          onClick={(e) => {
            e.preventDefault();
            console.log('🔵 [DEBUG] Test API button clicked, event:', typeof e);
            testMiniApi();
          }}
        >
          Test API Mini (api.shophuyvan.vn/mini/ping)
        </button>
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
            onClick={(e) => {
              e.preventDefault();
              handleActivateAccount();
            }}
            className="mt-3 inline-flex items-center gap-2 bg-white/90 text-sky-600 font-medium px-3 py-2 rounded-xl hover:bg-white transition-colors"
          >
            <span>🎁 Kích hoạt ngay</span>
          </button>
        </div>
      </section>



      {/* Menu Drawer + Grid danh mục */}
      <section className="safe-x mt-4">
        <div className="flex items-center gap-3 mb-3">
          <CategoryMenu />
          <span className="text-sm text-gray-500">hoặc chọn nhanh:</span>
        </div>
        
        {catsLoading ? (
          <div className="grid grid-cols-4 gap-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="aspect-square bg-gray-200 rounded-xl mb-1"></div>
                <div className="h-3 bg-gray-200 rounded"></div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-4 gap-3 text-center">
            {categories.map(c => (
              <a 
                key={c.slug || c.id} 
                href={`/category?c=${encodeURIComponent(c.slug)}`}
                className="cat-item hover:opacity-80 transition-opacity"
              >
                <div className="cat-icon text-3xl">
                  {getIcon(c.slug)}
                </div>
                <div className="cat-label whitespace-pre-line text-xs mt-1 line-clamp-2">
                  {c.name}
                </div>
              </a>
            ))}
          </div>
        )}
      </section>

      {/* Sản phẩm bán chạy */}
      <section className="safe-x mt-5">
        <div className="section-head flex justify-between items-center mb-3">
          <h2 className="text-lg font-bold">Sản phẩm bán chạy</h2>
          <a href="/category" className="section-more text-sm text-sky-600">
            Xem thêm →
          </a>
        </div>

        {loading && (
          <div className="grid grid-cols-2 gap-3">
            {[...Array(6)].map((_, i) => <ProductSkeleton key={i} />)}
          </div>
        )}
        
        {!loading && error && (
          <div className="text-red-600 text-sm bg-red-50 p-3 rounded-xl">
            Lỗi tải dữ liệu: {error}
          </div>
        )}
        
        {!loading && !error && (
          <Suspense fallback={
            <div className="grid grid-cols-2 gap-3">
              {[...Array(6)].map((_, i) => <ProductSkeleton key={i} />)}
            </div>
          }>
            <div className="grid grid-cols-2 gap-3">
              {(items || []).map((p) => (
                <ProductCard key={p.id || p.slug || `product-${Math.random()}`} p={p} />
              ))}
              {items.length === 0 && (
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
}

console.log('✅ Home.tsx loaded with dynamic categories (DEBUG PATCHED)');