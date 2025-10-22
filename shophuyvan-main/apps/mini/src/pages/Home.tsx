// Home.tsx - Mini App với danh mục động từ API
// Đường dẫn: apps/mini/src/pages/Home.tsx

import React, { useEffect, useState, lazy, Suspense } from 'react';
import Header from '../components/Header';
import Footer from '../components/Footer';
import CategoryMenu from '../components/CategoryMenu';
import { api } from '@shared/api';
import { numLike } from '@shared/utils/price';
import { cldFetch, preloadImage } from '@shared/utils/cloudinary';

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
  // Tìm icon theo slug
  if (ICON_MAP[slug]) return ICON_MAP[slug];
  
  // Tìm theo keyword trong slug
  for (const [key, icon] of Object.entries(ICON_MAP)) {
    if (slug.includes(key)) return icon;
  }
  
  // Default icon
  return '📦';
}

const ProductSkeleton = () => (
  <div className="bg-white rounded-2xl p-3 shadow animate-pulse">
    <div className="aspect-square bg-gray-200 rounded-xl mb-2"></div>
    <div className="h-4 bg-gray-200 rounded mb-2"></div>
    <div className="h-4 bg-gray-200 rounded w-2/3"></div>
  </div>
);

export default function Home() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // ✅ State cho danh mục động
  const [categories, setCategories] = useState<any[]>([]);
  const [catsLoading, setCatsLoading] = useState(true);

  // ✅ Load danh mục từ API
  useEffect(() => {
    const loadCategories = async () => {
      try {
        setCatsLoading(true);
        const response = await api.categories.list();
        
        if (Array.isArray(response) && response.length > 0) {
          // Chỉ lấy danh mục gốc (không có parent)
          const roots = response
            .filter((cat: any) => !cat.parent)
            .sort((a: any, b: any) => (a.order || 0) - (b.order || 0))
            .slice(0, 4); // Chỉ hiển thị 4 danh mục
          
          setCategories(roots);
          console.log('✅ Loaded categories for Home:', roots.length);
        } else {
          // Fallback
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

  // Load sản phẩm
  useEffect(() => {
    const prefetchData = async () => {
      try {
        const list = await api.products.list({ limit: 12 });
        const arr = Array.isArray(list) ? list : [];
        
        setItems(arr);
        setLoading(false);
        
        if (arr.length > 0) {
          const withPrice = await enrichPrices(arr);
          setItems(withPrice);
        }
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

      {/* Banner */}
      <section className="safe-x pt-3">
        <div className="rounded-2xl overflow-hidden bg-gradient-to-br from-gray-100 to-gray-200 aspect-[16/9] flex items-center justify-center">
          <span className="text-gray-400 text-sm">Banner</span>
        </div>
      </section>

      {/* Card kích hoạt */}
      <section className="safe-x mt-3">
        <div className="bg-gradient-to-r from-blue-500 to-cyan-600 p-4 rounded-2xl text-white shadow-lg">
          <div className="text-sm opacity-90">Đặc biệt</div>
          <div className="text-lg font-semibold">Kích hoạt tài khoản</div>
          <div className="text-sm opacity-90 mt-1">Nhận nhiều ưu đãi đến từ Shop Huy Vân</div>
          <a 
            href="/account" 
            className="mt-3 inline-flex items-center gap-2 bg-white/90 text-gray-800 text-sm font-medium px-3 py-2 rounded-xl hover:bg-white transition-colors"
          >
            <span>🎁 Kích hoạt ngay</span>
          </a>
        </div>
      </section>

      {/* ✅ Menu Drawer + Grid danh mục */}
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
              {items.map((p) => (
                <ProductCard key={String(p.id)} p={p} />
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

console.log('✅ Home.tsx loaded with dynamic categories');