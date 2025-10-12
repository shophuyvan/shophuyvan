import React, { useEffect, useState, lazy, Suspense } from 'react';
import Header from '../components/Header';
import Footer from '../components/Footer';
import { api } from '@shared/api';
import { numLike } from '@shared/utils/price';

// Lazy load ProductCard để giảm bundle size ban đầu
const ProductCard = lazy(() => import('../components/ProductCard'));

// Preload critical images
const preloadImage = (src: string) => {
  const link = document.createElement('link');
  link.rel = 'preload';
  link.as = 'image';
  link.href = src;
  document.head.appendChild(link);
};

// Cloudinary helpers - tối ưu với cache
const cloudCache = new Map<string, string>();

function __cldName(): string | undefined {
  try {
    const v = (import.meta as any)?.env?.VITE_CLOUDINARY_CLOUD || (window as any)?.__CLD_CLOUD__;
    return (typeof v === 'string' && v.trim()) ? v.trim() : undefined;
  } catch { return undefined; }
}

function cldFetch(u?: string, t: string = 'w_400,dpr_auto,q_auto:eco,f_auto', kind: 'image'|'video' = 'image'): string | undefined {
  if (!u) return u;
  
  const cacheKey = `${u}-${t}-${kind}`;
  if (cloudCache.has(cacheKey)) return cloudCache.get(cacheKey);
  
  try {
    const base = (typeof location !== 'undefined' && location.origin) ? location.origin : 'https://example.com';
    const url = new URL(u, base);
    const isCLD = /res\.cloudinary\.com/i.test(url.hostname);
    
    if (isCLD) {
      if (/\/upload\/[^/]+\//.test(url.pathname)) {
        cloudCache.set(cacheKey, url.toString());
        return url.toString();
      }
      if (/\/upload\//.test(url.pathname)) {
        url.pathname = url.pathname.replace('/upload/', `/upload/${t}/`);
        const result = url.toString();
        cloudCache.set(cacheKey, result);
        return result;
      }
      cloudCache.set(cacheKey, url.toString());
      return url.toString();
    }
    
    const cloud = __cldName();
    if (!cloud) return u;
    
    const enc = encodeURIComponent(u);
    const basePath = kind === 'video' ? 'video/fetch' : 'image/fetch';
    const result = `https://res.cloudinary.com/${cloud}/${basePath}/${t}/${enc}`;
    cloudCache.set(cacheKey, result);
    return result;
  } catch { return u; }
}

// Tăng giá trị hiển thị với batch processing
async function enrichPrices(list: any[]): Promise<any[]> {
  if (!list.length) return list;
  
  // Kiểm tra nhanh - nếu đã có giá thì không cần fetch
  const needsFetch = list.filter(p => {
    const base = numLike((p as any)?.price?.base ?? (p as any)?.price);
    return base <= 0;
  });
  
  if (needsFetch.length === 0) return list;
  
  // Batch fetch với concurrency limit
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
          results[originalIndex] = { ...results[originalIndex], price: (d as any).price, raw: results[originalIndex].raw ?? results[originalIndex] };
        }
      }
    });
  }
  
  return results;
}

const CATS = [
  { key: 'dien-nuoc', label: 'Thiết Bị Điện\n& Nước', href: '/category?c=dien-nuoc', icon: '🔌' },
  { key: 'nha-cua-doi-song', label: 'Nhà Cửa\nĐời Sống', href: '/category?c=nha-cua-doi-song', icon: '🏠' },
  { key: 'hoa-chat-gia-dung', label: 'Hoá Chất\nGia Dụng', href: '/category?c=hoa-chat-gia-dung', icon: '🧪' },
  { key: 'dung-cu-thiet-bi-tien-ich', label: 'Dụng Cụ &\nThiết Bị Tiện Ích', href: '/category?c=dung-cu-thiet-bi-tien-ich', icon: '🧰' },
];

// Skeleton loader component
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

  useEffect(() => {
    // Prefetch critical resources
    const prefetchData = async () => {
      try {
        // Lấy dữ liệu nhanh trước (không có giá)
        const list = await api.products.list({ limit: 12 });
        const arr = Array.isArray(list) ? list : [];
        
        // Hiển thị ngay để tăng perceived performance
        setItems(arr);
        setLoading(false);
        
        // Sau đó mới enrich prices trong background
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

  // Preload first product images
  useEffect(() => {
    if (items.length > 0) {
      const firstFew = items.slice(0, 4);
      firstFew.forEach(item => {
        const img = item.image || (Array.isArray(item.images) && item.images[0]);
        if (img) {
          const optimized = cldFetch(img, 'w_400,dpr_auto,q_auto:eco,f_auto');
          if (optimized) preloadImage(optimized);
        }
      });
    }
  }, [items]);

  return (
    <div className="pb-24">
      <Header />

      {/* Banner - lazy load background */}
      <section className="safe-x pt-3">
        <div className="rounded-2xl overflow-hidden bg-gradient-to-br from-gray-100 to-gray-200 aspect-[16/9] flex items-center justify-center">
          <span className="text-gray-400 text-sm">Banner</span>
        </div>
      </section>

      {/* Card kích hoạt - giữ nguyên gradient đẹp */}
      <section className="safe-x mt-3">
        <div className="bg-gradient-to-r from-blue-500 to-cyan-600 p-4 rounded-2xl text-white shadow-lg">
          <div className="text-sm opacity-90">Đặc biệt</div>
          <div className="text-lg font-semibold">Kích hoạt tài khoản</div>
          <div className="text-sm opacity-90 mt-1">Nhận nhiều ưu đãi đến từ Shop Huy Vân</div>
          <a href="/account" className="mt-3 inline-flex items-center gap-2 bg-white/90 text-gray-800 text-sm font-medium px-3 py-2 rounded-xl hover:bg-white transition-colors">
            <span>🎁 Kích hoạt ngay</span>
          </a>
        </div>
      </section>

      {/* Danh mục - critical content, không lazy load */}
      <section className="safe-x mt-4 grid grid-cols-4 gap-3 text-center">
        {CATS.map(c => (
          <a key={c.key} href={c.href} className="cat-item hover:opacity-80 transition-opacity">
            <div className="cat-icon text-3xl">{c.icon}</div>
            <div className="cat-label whitespace-pre-line text-xs mt-1">{c.label}</div>
          </a>
        ))}
      </section>

      {/* Sản phẩm bán chạy */}
      <section className="safe-x mt-5">
        <div className="section-head flex justify-between items-center mb-3">
          <h2 className="text-lg font-bold">Sản phẩm bán chạy</h2>
          <a href="/category" className="section-more text-sm text-sky-600">Xem thêm →</a>
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
              {items.map((p) => <ProductCard key={String(p.id)} p={p} />)}
              {items.length === 0 && <div className="col-span-2 text-center text-gray-500 py-8">Chưa có sản phẩm.</div>}
            </div>
          </Suspense>
        )}
      </section>

      <Footer />
    </div>
  );
}