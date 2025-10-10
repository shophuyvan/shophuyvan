import React, { useEffect, useState } from 'react';
import Header from '../components/Header';
import Footer from '../components/Footer';
import ProductCard, { Product } from '../components/ProductCard';
import { api } from '@shared/api';
import { numLike } from '@shared/utils/price';

/** Tăng giá trị hiển thị: nếu list không có giá, gọi detail để bù */
async function enrichPrices(list: Product[]): Promise<Product[]> {
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

const CATS = [
  { key: 'dien-nuoc', label: `Thiết Bị Điện\n& Nước`, href: '/category?c=dien-nuoc', icon: '🔌' },
  { key: 'nha-cua-doi-song', label: `Nhà Cửa\nĐời Sống`, href: '/category?c=nha-cua-doi-song', icon: '🏠' },
  { key: 'hoa-chat-gia-dung', label: `Hoá Chất\nGia Dụng`, href: '/category?c=hoa-chat-gia-dung', icon: '🧪' },
  { key: 'dung-cu-thiet-bi-tien-ich', label: `Dụng Cụ &\nThiết Bị Tiện Ích`, href: '/category?c=dung-cu-thiet-bi-tien-ich', icon: '🧰' },
];

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
    <div className="pb-24"> {/* chừa chỗ cho tabbar */}
      <Header />

      {/* Banner */}
      <section className="safe-x pt-3">
        <div className="rounded-2xl overflow-hidden bg-gray-100 aspect-[16/9] flex items-center justify-center">
          <span className="text-gray-400 text-sm">Banner</span>
        </div>
      </section>

      {/* Card kích hoạt tài khoản đã đổi màu xanh dương */}
      <section className="safe-x mt-3">
        {/* Đã thay thế card-gradient bằng gradient xanh dương trực tiếp */}
        <div className="bg-gradient-to-r from-blue-500 to-cyan-600 p-4 rounded-2xl text-white">
          <div className="text-sm opacity-90">Đặc biệt</div>
          <div className="text-lg font-semibold">Kích hoạt tài khoản</div>
          <div className="text-sm opacity-90 mt-1">Nhận nhiều ưu đãi đến từ Shop Huy Vân </div>
          <a href="/account" className="mt-3 inline-flex items-center gap-2 bg-white/90 text-gray-800 text-sm font-medium px-3 py-2 rounded-xl">
            <span>🎁 Kích hoạt ngay</span>
          </a>
        </div>
      </section>

      {/* Danh mục icon */}
      <section className="safe-x mt-4 grid grid-cols-4 gap-3 text-center">
        {CATS.map(c => (
          <a key={c.key} href={c.href} className="cat-item">
            <div className="cat-icon">{c.icon}</div>
            <div className="cat-label whitespace-pre-line">{c.label}</div>
          </a>
        ))}
      </section>

      {/* Sản phẩm bán chạy */}
      <section className="safe-x mt-5">
        <div className="section-head">
          <h2>Sản phẩm bán chạy</h2>
          <a href="/category" className="section-more">Xem thêm →</a>
        </div>

        {loading && <div className="mt-2">Đang tải…</div>}
        {!loading && error && (
          <div className="text-red-600 text-sm break-all">HTTP lỗi: {error}</div>
        )}
        {!loading && !error && (
          <div className="grid grid-cols-2 gap-3">
            {items.map((p) => <ProductCard key={String(p.id)} p={p} />)}
            {items.length === 0 && <div>Chưa có sản phẩm.</div>}
          </div>
        )}
      </section>

      <Footer />
    </div>
  );
}