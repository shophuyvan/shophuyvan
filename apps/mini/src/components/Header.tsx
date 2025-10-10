import React, { useEffect, useState } from 'react';
import { routes } from '../routes';
import cart from '@shared/cart';

/**
 * Header với logo thật (ảnh) ở góc trái, chữ "Shop Huy Vân" nhỏ nằm dưới logo,
 * màu chữ đồng bộ màu logo. Thanh tìm kiếm kéo dài chiếm phần còn lại.
 */
export default function Header() {
  // Ẩn header ở trang chi tiết sản phẩm
  if (typeof window !== 'undefined') {
    try {
      const path = window.location.pathname;
      if (path.includes('/product') || path.includes('/cart') || path.includes('/checkout')) {
        return null;
      }
    } catch (e) {}
  }

  const [count, setCount] = useState(cart.count());
  useEffect(() => {
    const fn = () => setCount(cart.count());
    const onStorage = (e: StorageEvent) => { if (e.key === 'shv_cart_v1') fn(); };
    window.addEventListener('storage', onStorage);
    const id = setInterval(fn, 1000);
    return () => { window.removeEventListener('storage', onStorage); clearInterval(id); };
  }, []);

  return (
    <header className="sticky top-0 z-20 bg-white/95 backdrop-blur border-b">
      {/* Giảm padding-y (p-3 -> py-2) và giảm gap (gap-2 -> gap-3) */}
      <div className="safe-x mx-auto flex items-center gap-3 py-2 px-3"> 
        
        {/* Logo + text đã chỉnh sửa */}
        <a href={routes.home} className="shrink-0 flex items-center gap-1"> 
          <img
            src="/logo-hv.png"
            alt="Shop Huy Vân"
            // Tăng kích thước w-7 h-7 lên w-8 h-8
            className="w-8 h-8 object-contain rounded-md" 
            loading="eager"
          />
          {/* Tên thương hiệu được đặt cạnh logo */}
          <span className="text-sm font-bold text-brand"> 
            Shop Huy Vân
          </span>
        </a>

        {/* Ô tìm kiếm kéo dài, thêm margin-left để đẩy ra xa logo hơn */}
        <a
          href={routes.category}
          className="search-pill flex-1 flex items-center gap-2 min-h-[36px] ml-2" 
          aria-label="Tìm kiếm sản phẩm"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 opacity-70">
            <path fillRule="evenodd" d="M8 4a4 4 0 015.292 5.708l3 3a1 1 0 01-1.414 1.414l-3-3A4 4 0 118 4zm0 2a2 2 0 100 4 2 2 0 000-4z" clipRule="evenodd" />
          </svg>
          <span className="text-gray-500 text-sm">Tìm kiếm sản phẩm</span>
        </a>

        {/* Nút giỏ hàng */}
        <a href={routes.cart} className="relative shrink-0 p-2 rounded-full bg-gray-100">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
            <path d="M7 18c-1.1 0-1.99.9-1.99 2S5.9 22 7 22s2-.9 2-2-.9-2-2-2zm10 0c-1.1 
              0-1.99.9-1.99 2S15.9 22 17 22s2-.9 2-2-.9-2-2-2zM7.16 14h9.45c.75 0 1.41-.41 1.75-1.03l3.24-5.88
              a1 1 0 00-.88-1.47H6.21L5.27 2H2v2h2l3.6 7.59-1.35 2.44C5.52 14.37 6.24 15 7.16 15H19v-2H7.42l.74-1.34z"/>
          </svg>
          {count > 0 && (
            <span className="absolute -top-1 -right-1 bg-rose-600 text-white text-[10px] px-1.5 py-0.5 rounded-full">
              {count}
            </span>
          )}
        </a>
      </div>
    </header>
  );
}