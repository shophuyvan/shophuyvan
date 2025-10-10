import React, { useEffect, useState } from 'react';
import Header from '../components/Header';
import Footer from '../components/Footer';
import ProductCard from '../components/ProductCard';
import { api } from '@shared/api';

const LABELS: Record<string, string> = {
  'dien-nuoc': 'Thiết Bị Điện & Nước',
  'nha-cua-doi-song': 'Nhà Cửa Đời Sống',
  'hoa-chat-gia-dung': 'Hoá Chất Gia Dụng',
  'dung-cu-thiet-bi-tien-ich': 'Dụng Cụ & Thiết Bị Tiện Ích',
};

function useSlug() {
  const get = () => {
    try {
      const u = new URL(location.href);
      return (u.searchParams.get('c') || '').trim();
    } catch {
      const m = location.search?.match(/[?&]c=([^&]+)/);
      return m ? decodeURIComponent(m[1]) : '';
    }
  };
  const [slug, setSlug] = useState(get());
  useEffect(() => {
    const fn = () => setSlug(get());
    window.addEventListener('popstate', fn);
    window.addEventListener('hashchange', fn);
    return () => { window.removeEventListener('popstate', fn); window.removeEventListener('hashchange', fn); };
  }, []);
  return slug;
}

export default function Category() {
  const slug = useSlug();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);
      try {
        // Quick-first list by category
        const first = await api.products.list({ limit: 24, category: slug || undefined });
        setItems(first || []);
        // Enrich prices in-place with concurrency
        const full = await api.products.listWithPrices({ limit: 24, category: slug || undefined, concurrency: 4 });
        if (Array.isArray(full) && full.length) setItems(full);
      } catch (e:any) {
        console.error(e);
        setError(e?.message || 'Lỗi tải dữ liệu');
      } finally {
        setLoading(false);
      }
    })();
  }, [slug]);

  const title = LABELS[slug] || 'Danh mục';

  return (
    <div>
      <Header />
      <main className="max-w-4xl mx-auto p-3">
        <h1 className="text-xl font-bold mb-3">{title}</h1>
        {loading && <div>Đang tải…</div>}
        {!loading && error && <div className="text-red-600 text-sm">{error}</div>}
        {!loading && !error && (
          <div className="grid grid-cols-2 gap-3">
            {items.map((p) => <ProductCard key={String(p.id)} p={p as any} />)}
            {items.length === 0 && <div>Chưa có sản phẩm.</div>}
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}