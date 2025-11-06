// apps/mini/src/components/Footer.tsx
import React, { FC, useMemo } from 'react';
import { BottomNavigation, Icon, useLocation, useNavigate } from 'zmp-ui';

const tabs = [
  { path: '/', label: 'Trang chủ', icon: <Icon icon="zi-home" /> },
  { path: '/category', label: 'Sản phẩm', icon: <Icon icon="zi-list-1" /> },
  { path: '/cart', label: 'Giỏ hàng', icon: <Icon icon="zi-cart" /> },
  { path: '/account', label: 'Tài khoản', icon: <Icon icon="zi-user" /> },
];

const Footer: FC = () => {
  const location = useLocation();
  const zmpNavigate = useNavigate();

  const pathname = location.pathname || '/';

  // Ẩn footer ở trang chi tiết sản phẩm, giỏ hàng, thanh toán
  const shouldHide = useMemo(
    () => ['/product', '/cart', '/checkout'].some((p) => pathname.startsWith(p)),
    [pathname],
  );

  // Lấy activeTab từ location.pathname (thuần zmp-ui)
  const activeTab = useMemo(() => {
    if (shouldHide) {
      // Footer đang ẩn, trả về '/' để tránh lỗi
      return '/';
    }
    const matched = tabs.find((t) => pathname.startsWith(t.path));
    return matched ? matched.path : '/';
  }, [pathname, shouldHide]);

  const handleChange = (key: string) => {
    zmpNavigate(key);
  };

  if (shouldHide) {
    return null;
  }

  return (
    <BottomNavigation fixed activeKey={activeTab} onChange={handleChange}>
      {tabs.map(({ path, label, icon }) => (
        <BottomNavigation.Item key={path} label={label} icon={icon} />
      ))}
    </BottomNavigation>
  );
};


export default Footer;