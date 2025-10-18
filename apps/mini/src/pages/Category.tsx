// === Category.tsx (đã vá hoàn chỉnh) ===
// Mini App hiển thị sản phẩm theo danh mục slug
// Đồng bộ danh mục từ /api/categories của Admin

import { useEffect, useState } from 'react';
import { api } from '@shared/api';

export default function Category() {
  const [items, setItems] = useState<any[]>([]);
  const [cats, setCats] = useState<any[]>([]);
  const [slug, setSlug] = useState('');
  const [loading, setLoading] = useState(true);

  // Lấy slug danh mục từ URL (?c=slug)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setSlug(params.get('c') || '');
  }, []);

  // Gọi API lấy danh mục & sản phẩm
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        // 1️⃣ Lấy danh mục
        const catRes = await api.get('/api/categories');
        const allCats = catRes?.items || catRes?.data || [];
        setCats(allCats);

        // 2️⃣ Lấy sản phẩm theo danh mục
        const res = await api.get(`/api/products?category=${encodeURIComponent(slug || '')}`);
        const data = res?.items || res?.data || [];
        const filtered = slug
          ? data.filter((p) => (p.category || '').toLowerCase() === slug.toLowerCase())
          : data;
        setItems(filtered);
      } catch (err) {
        console.error('Lỗi tải sản phẩm hoặc danh mục:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, [slug]);

  if (loading)
    return <div className="p-4 text-center text-gray-400">Đang tải...</div>;

  return (
    <div className="p-4">
      <h1 className="text-lg font-bold mb-3">
        {slug ? `Danh mục: ${slug}` : 'Tất cả sản phẩm'}
      </h1>

      <div className="grid grid-cols-2 gap-3">
        {items.length === 0 && (
          <div className="col-span-2 text-gray-400">Không có sản phẩm.</div>
        )}
        {items.map((p) => (
          <div
            key={p.id}
            className="bg-white rounded-lg shadow p-2 text-center"
          >
            <img
              src={p.image}
              alt={p.name}
              className="w-full h-32 object-cover rounded"
            />
            <h3 className="mt-2 text-sm font-medium">{p.name}</h3>
            <p className="text-red-500 text-xs">
              {p.price?.toLocaleString('vi-VN')} ₫
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
