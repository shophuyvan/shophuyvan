import React, { useEffect, useState } from 'react';
import Header from '../components/Header';
import Footer from '../components/Footer';
import ProductCard from '../components/ProductCard';
import { api } from '@shared/api';

export default function Category() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        // First paint quickly, then enrich prices in-place
        const first = await api.products.list({ limit: 20 });
        setItems(first || []);
        setLoading(false);
        // Enrich if needed
        const full = await api.products.listWithPrices({ limit: 20, concurrency: 4 });
        setItems(full || []);
      } catch (e: any) {
        console.error(e);
        setError(e?.message || 'Lỗi tải dữ liệu');
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div>
      <Header />
      <main className="max-w-4xl mx-auto p-3">
        <h1 className="text-xl font-bold mb-3">Danh mục</h1>
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
