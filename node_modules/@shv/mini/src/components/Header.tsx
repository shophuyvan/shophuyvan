import React, { useEffect, useState } from 'react';
import { routes } from '../routes';
import cart from '@shared/cart';

export default function Header() {
  const [count, setCount] = useState(cart.count());
  useEffect(() => {
    const fn = () => setCount(cart.count());
    const onStorage = (e: StorageEvent) => { if (e.key === 'shv_cart_v1') fn(); };
    window.addEventListener('storage', onStorage);
    const id = setInterval(fn, 1000);
    return () => { window.removeEventListener('storage', onStorage); clearInterval(id); };
  }, []);

  return (
    <header className="sticky top-0 z-10 bg-sky-500 text-white">
      <div className="max-w-4xl mx-auto flex items-center justify-between p-3">
        <a href={routes.home} className="font-bold">Shop Huy Vân</a>
        <nav className="flex gap-4 text-sm items-center">
          <a href={routes.category}>Danh mục</a>
          <a href={routes.cart} className="relative">
            Giỏ hàng
            {count > 0 && (
              <span className="absolute -top-2 -right-3 bg-rose-600 text-white text-[10px] px-1.5 py-0.5 rounded-full">
                {count}
              </span>
            )}
          </a>
        </nav>
      </div>
    </header>
  );
}
