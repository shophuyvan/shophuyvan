import React, { useEffect, useState } from 'react';

/**
 * Tabbar 5 mục như screenshot: Trang chủ / Ưu đãi / Sản phẩm / Giỏ hàng / Tài khoản
 * Fixed dưới cùng, có safe area inset.
 */
const tabs = [
  { href: '/', label: 'Trang chủ', icon: '🏠' },
  { href: '/category?tag=deal', label: 'Ưu đãi', icon: '🎁' },
  { href: '/category', label: 'Sản phẩm', icon: '🧺' },
  { href: '/cart', label: 'Giỏ hàng', icon: '🛒' },
  { href: '/account', label: 'Tài khoản', icon: '👤' },
];

export default function Footer() {
  const [path, setPath] = useState('/');
  useEffect(() => {
    const get = () => (location.hash?.startsWith('#') ? location.hash.slice(1) : location.pathname) || '/';
    const onChange = () => setPath(get());
    setPath(get());
    window.addEventListener('popstate', onChange);
    window.addEventListener('hashchange', onChange);
    return () => { window.removeEventListener('popstate', onChange); window.removeEventListener('hashchange', onChange); };
  }, []);

  // === SHV005: Ẩn Footer khi ở trang chi tiết sản phẩm ===
  // Trang chi tiết sản phẩm có đường dẫn bắt đầu bằng '/product'
  if (path.startsWith('/product')) {
    return null;
  }
  // =======================================================

  return (
    <nav className="tabbar">
      {tabs.map(t => {
        const active = path === t.href || path.startsWith(t.href.replace('/', '')) || (t.href !== '/' && path.startsWith(t.href));
        return (
          <a key={t.href} href={t.href} className={`tabbar-item ${active ? 'is-active' : ''}`}>
            <span className="text-lg leading-none">{t.icon}</span>
            <span className="text-[11px]">{t.label}</span>
          </a>
        );
      })}
    </nav>
  );
}