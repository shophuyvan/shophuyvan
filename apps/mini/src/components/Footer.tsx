// apps/mini/src/components/Footer.tsx
import React, { FC, useMemo } from 'react';
import { BottomNavigation, Icon, useLocation, useNavigate } from 'zmp-ui';

// Thêm padding bottom cho body
if (typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.textContent = `
    body { padding-bottom: 80px !important; }
  `;
  document.head.appendChild(style);
}

// CSS custom cho Footer
// CSS global cho Footer - sử dụng selector mạnh hơn
const footerStyles = `
  /* Override ZMP-UI Bottom Navigation */
  div[class*="bottom-navigation"],
  .zaui-bottom-navigation,
  [role="tablist"] {
    background: white !important;
    border-top: 1px solid #e5e7eb !important;
    box-shadow: 0 -2px 10px rgba(0, 0, 0, 0.05) !important;
    padding-top: 8px !important;
    padding-bottom: 8px !important;
  }
  
  /* Items không active */
  div[class*="bottom-navigation"] > *,
  .zaui-bottom-navigation > *,
  [role="tab"] {
    color: #9ca3af !important;
    transition: all 0.2s ease !important;
  }
  
  /* Items active */
  div[class*="bottom-navigation"] > [class*="active"],
  .zaui-bottom-navigation > .active,
  [role="tab"][aria-selected="true"] {
    color: #3B82F6 !important;
    font-weight: 600 !important;
  }
  
  /* Icons */
  div[class*="bottom-navigation"] svg,
  .zaui-bottom-navigation svg,
  [role="tab"] svg {
    width: 24px !important;
    height: 24px !important;
    transition: all 0.2s ease !important;
  }
  
  /* Icons active */
  div[class*="bottom-navigation"] > [class*="active"] svg,
  .zaui-bottom-navigation > .active svg,
  [role="tab"][aria-selected="true"] svg {
    color: #3B82F6 !important;
    transform: scale(1.15) !important;
  }
  
  /* Labels */
  div[class*="bottom-navigation"] span,
  .zaui-bottom-navigation span,
  [role="tab"] span {
    font-size: 11px !important;
    margin-top: 4px !important;
  }
`;

const CartIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="9" cy="21" r="1"/>
    <circle cx="20" cy="21" r="1"/>
    <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
  </svg>
);

const tabs = [
  { path: '/', label: 'Trang chủ', icon: <Icon icon="zi-home" /> },
  { path: '/category', label: 'Sản phẩm', icon: <Icon icon="zi-list-1" /> },
  { path: '/cart', label: 'Giỏ hàng', icon: <CartIcon /> },
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
    if (shouldHide) return '/';

    // [FIX] Nếu đúng là trang chủ thì trả về '/'
    if (pathname === '/') return '/';

    // [FIX] Nếu không phải trang chủ, tìm các tab con trước (tránh bị khớp nhầm với '/')
    const matched = tabs.find((t) => t.path !== '/' && pathname.startsWith(t.path));
    return matched ? matched.path : '/';
  }, [pathname, shouldHide]);

  const handleChange = (key: string) => {
    zmpNavigate(key);
  };

  if (shouldHide) {
    return null;
  }

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: footerStyles }} />
      <div className="footer-wrapper" style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 1000,
        background: 'white',
        borderTop: '1px solid #e5e7eb',
        boxShadow: '0 -2px 10px rgba(0, 0, 0, 0.08)',
      }}>
        <BottomNavigation fixed={false} activeKey={activeTab} onChange={handleChange}>
          {tabs.map(({ path, label, icon }) => (
            <BottomNavigation.Item 
              key={path} 
              label={label} 
              icon={icon}
            />
          ))}
        </BottomNavigation>
      </div>
    </>
  );
};


export default Footer;