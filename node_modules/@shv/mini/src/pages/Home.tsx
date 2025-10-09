import React, { useEffect, useState } from 'react';
import Header from '../components/Header';
import Footer from '../components/Footer';
import ProductCard, { Product } from '../components/ProductCard';
import { api } from '@shared/api';
import { numLike } from '@shared/utils/price';

async function enrichPrices(list: Product[]): Promise<Product[]> {
  // Với item không có giá, gọi detail để lấy giá đầy đủ
  const tasks = list.map(async (p) => {
    const base = numLike((p as any)?.price?.base ?? (p as any)?.price);
    if (base > 0) return p;
    try {
      const d = await api.products.detail(p.id as any);
      if (d && (d as any).price && numLike((d as any).price.base) > 0) {
        return { ...p, price: (d as any).price, raw: (p as any).raw ?? p };
      }
    } catch {}
    return p;
  });
  return Promise.all(tasks);
}

export default function Home() {
  const [items, setItems] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const list = await api.products.list({ limit: 12 });
        const arr = Array.isArray(list) ? (list as Product[]) : [];
        const withPrice = await enrichPrices(arr);
        setItems(withPrice);
      } catch (e: any) {
        console.error(e);
        setError(e?.message || 'Lỗi tải dữ liệu');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div>
      <Header />
      <main className="max-w-4xl mx-auto p-3">
        <h1 className="text-xl font-bold mb-3">Sản phẩm nổi bật</h1>
        {loading && <div>Đang tải…</div>}
        {!loading && error && (
          <div className="text-red-600 text-sm break-all">HTTP lỗi: {error}</div>
        )}
        {!loading && !error && (
          <div className="grid grid-cols-2 gap-3">
            {items.map((p) => <ProductCard key={String(p.id)} p={p} />)}
            {items.length === 0 && <div>Chưa có sản phẩm.</div>}
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
