// Home.tsx - Trang chủ Mini App chạy được trên Zalo Mini + web dev
// Đường dẫn: apps/mini/src/pages/Home.tsx

import React, { useEffect, useState, lazy, Suspense } from 'react';
import { Page, useNavigate } from 'zmp-ui';
import Header from '../components/Header';
import CategoryMenu from '../components/CategoryMenu';
import { api } from '@shared/api';
import { cldFetch, preloadImage } from '@shared/utils/cloudinary';
import { zmp } from '@/lib/zmp';
import { storage } from '@/lib/storage';

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
  // State cho các nhóm sản phẩm
  const [items, setItems] = useState<Product[]>([]); // Best Seller
  const [flashSales, setFlashSales] = useState<Product[]>([]);
  const [cheapProducts, setCheapProducts] = useState<Product[]>([]);

  // [NEW] State cho 4 danh mục chính
  const [catDienNuoc, setCatDienNuoc] = useState<Product[]>([]);
  const [catNhaCua, setCatNhaCua] = useState<Product[]>([]);
  const [catHoaChat, setCatHoaChat] = useState<Product[]>([]);
  const [catTienIch, setCatTienIch] = useState<Product[]>([]);
  
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

      // Lưu token trả về để các trang Account / Points / Membership dùng
      const token = data && data.token;
      if (token) {
        try {
          await Promise.all([
            storage.set('customer_token', token),
            storage.set('x-customer-token', token),
            storage.set('x-token', token),
          ]);
        } catch (e) {
          console.warn('[ACCOUNT ACTIVATE] Không lưu được token:', e);
        }
      } else {
        console.warn('[ACCOUNT ACTIVATE] Backend không trả token, luồng auto login có thể không hoạt động.');
      }

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


  // Load dữ liệu trang chủ (FlashSale, <10k, Bán chạy, 4 Danh mục)
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);

        // [UPDATE] Gọi 3 API song song: Flash Sale, Giá rẻ (API mới), Home Sections (API mới)
        const [flashRes, cheapRes, sectionsRes] = await Promise.all([
          api.products.list({ limit: 6, is_flash_sale: true }), // Giữ flash sale cũ
          api.products.cheap(18, 15000), // API mới: Lấy 18 sp dưới 15k
          api.products.homeSections()    // API mới: Lấy Bestseller + 4 Danh mục
        ]);

        // 1. Xử lý Flash Sale
        const flashArr = Array.isArray(flashRes) ? flashRes : (flashRes as any)?.data || [];
        setFlashSales(flashArr);

        // 2. Xử lý Cheap Products (Đã lọc sẵn từ server)
        if (Array.isArray(cheapRes)) {
           setCheapProducts(cheapRes);
        }

        // 3. Xử lý Home Sections (Chia về các state)
        if (sectionsRes) {
          setItems(sectionsRes.bestsellers || []); // Cập nhật Best Seller
          setCatDienNuoc(sectionsRes.cat_dien_nuoc || []);
          setCatNhaCua(sectionsRes.cat_nha_cua || []);
          setCatHoaChat(sectionsRes.cat_hoa_chat || []);
          setCatTienIch(sectionsRes.cat_dung_cu || []); // cat_dung_cu là tên field backend trả về
        }

        setLoading(false);
      } catch (e: any) {
        console.error("Home Load Error:", e);
        setError(e?.message || 'Lỗi tải dữ liệu');
        setLoading(false);
      }
    };

    loadData();
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

  // [NEW] Helper vẽ danh mục ngang
  const renderSection = (title: string, products: Product[], linkCat?: string) => {
    if (!products || products.length === 0) return null;
    return (
      <section className="safe-x mt-4 px-1">
        <div className="flex justify-between items-center mb-3 px-2">
          <h2 className="text-base font-bold text-gray-800 uppercase border-l-4 border-blue-600 pl-2 leading-none">
            {title}
          </h2>
          {linkCat && (
            <button
              onClick={() => navigate(`/category?c=${linkCat}`)}
              className="text-xs text-blue-600 font-medium"
            >
              Xem tất cả &gt;
            </button>
          )}
        </div>
        <div className="flex overflow-x-auto gap-3 pb-4 scroll-smooth snap-x snap-mandatory no-scrollbar px-1">
          {products.map((p) => (
            <div key={p.id} className="w-[140px] flex-shrink-0 snap-start">
              <ProductCard p={p} />
            </div>
          ))}
        </div>
      </section>
    );
  };

    return (
    <Page className="bg-gray-100 pb-20">
      <Header forceShow variant="mini" />

      {/* Banner */}
      <section className="safe-x pt-3">
        {banners && banners.length > 0 ? (
          <div className="relative rounded-2xl overflow-hidden shadow-lg aspect-[3/2]">
            <div
              className="flex h-full transition-transform duration-700 ease-in-out"
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
                  className="h-full object-cover flex-shrink-0"
                  style={{ width: `${100 / banners.length}%` }}
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
        {/* CSS ẩn thanh cuộn cho toàn bộ trang */}
        <style>{`
          .no-scrollbar::-webkit-scrollbar { display: none; }
          .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        `}</style>

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

      {/* [ĐÃ ẨN] Menu danh mục cũ theo yêu cầu */}

      {/* 🔥 KHỐI 1: FLASH SALE */}
      {flashSales.length > 0 && (
        <section className="safe-x mt-4">
          <div className="flex items-center gap-2 mb-3">
            <h2 className="text-lg font-bold text-red-600 animate-pulse">⚡ FLASH SALE</h2>
            <div className="text-xs bg-black text-white px-2 py-0.5 rounded font-mono">
              Đang diễn ra
            </div>
          </div>
          {/* [FIX] Thêm snap-x snap-mandatory để vuốt mượt như app Native */}
          <div className="flex overflow-x-auto gap-3 pb-4 scroll-smooth snap-x snap-mandatory no-scrollbar px-1">
            {flashSales.map((p: any) => (
               <div key={`fs-${p.id}`} className="w-[140px] flex-shrink-0 snap-start">
                 <ProductCard p={p} />
               </div>
            ))}
          </div>
        </section>
      )}

      {/* 💰 KHỐI 2: ĐỒNG GIÁ / DƯỚI 10K (TRƯỢT NGANG) */}
      {cheapProducts.length > 0 && (
        <section className="safe-x mt-4 bg-yellow-50 py-3 rounded-xl border border-yellow-200">
           <div className="flex justify-between items-center mb-3 px-3">
            <h2 className="text-base font-bold text-amber-700">💰 Săn Deal Giá Rẻ</h2>
            <button 
              onClick={() => navigate('/category?price_max=15000')}
              className="text-xs text-amber-600 font-medium"
            >
              Xem thêm &gt;
            </button>
          </div>
          {/* Chuyển từ Grid sang Flex trượt ngang */}
          <div className="flex overflow-x-auto gap-3 px-3 pb-2 scroll-smooth snap-x snap-mandatory no-scrollbar">
             {cheapProducts.map((p: any) => (
                <div key={`cp-${p.id}`} className="w-[130px] flex-shrink-0 snap-start">
                  <ProductCard p={p} />
                </div>
             ))}
          </div>
        </section>
      )}

      {/* Sản phẩm bán chạy (TRƯỢT NGANG) */}
      <section className="safe-x mt-5 pb-4">
        <div className="flex justify-between items-center mb-3 px-2">
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
          <div className="text-red-500 text-sm mb-3 px-2">{error}</div>
        )}

        {loading ? (
          <div className="flex overflow-x-auto gap-3 px-2 no-scrollbar">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="w-[140px] flex-shrink-0"><ProductSkeleton /></div>
            ))}
          </div>
        ) : (
          <div className="flex overflow-x-auto gap-3 px-2 pb-2 scroll-smooth snap-x snap-mandatory no-scrollbar">
            {items.map((p: any) => (
              <div key={String(p.id)} className="w-[140px] flex-shrink-0 snap-start">
                <ProductCard p={p} />
              </div>
            ))}
            {!items.length && (
              <div className="w-full text-center text-gray-500 py-8">
                Chưa có sản phẩm.
              </div>
            )}
          </div>
        )}
     </section>
	 {/* --- CÁC DANH MỤC SẢN PHẨM --- */}
      {renderSection("Thiết Bị Điện & Nước", catDienNuoc, "dien-nuoc")}
      {renderSection("Nhà Cửa & Đời Sống", catNhaCua, "nha-cua-doi-song")}
      {renderSection("Hoá Chất Gia Dụng", catHoaChat, "hoa-chat-gia-dung")}
      {renderSection("Dụng Cụ & Tiện Ích", catTienIch, "dung-cu-thiet-bi-tien-ich")}

      <div className="h-4"></div>
    </Page>
  );
};

export default Home;
