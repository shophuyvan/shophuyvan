import React, { useEffect, useState } from 'react';

/**
 * Tabbar: Trang chủ / Ưu đãi / Sản phẩm / Giỏ hàng / Tài khoản
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
    const getPath = () => {
      const { hash, pathname } = window.location;
      if (hash && hash.startsWith('#')) {
        return hash.slice(1) || '/';
      }
      return pathname || '/';
    };

    const handleChange = () => setPath(getPath());

    handleChange();
    window.addEventListener('hashchange', handleChange);
    window.addEventListener('popstate', handleChange);

    return () => {
      window.removeEventListener('hashchange', handleChange);
      window.removeEventListener('popstate', handleChange);
    };
  }, []);

  return (
    <nav className="tabbar">
      {tabs.map((t) => {
        const active =
          path === t.href ||
          path.startsWith(`${t.href}?`) ||
          (t.href !== '/' && path.startsWith(`${t.href}/`));

        return (
          <a
            key={t.href}
            href={t.href}
            className={`tabbar-item ${active ? 'is-active' : ''}`}
          >
            <span className="text-lg leading-none">{t.icon}</span>
            <span className="text-[11px]">{t.label}</span>
          </a>
        );
      })}
    </nav>
  );
}
