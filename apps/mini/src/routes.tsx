// apps/mini/src/routes.ts
import React from 'react';
import PageLayout from '@/components/layout/PageLayout';

// Import trực tiếp (không lazy)
import HomePage from '@/pages/Home';
import CategoryPage from '@/pages/Category';
import ProductPage from '@/pages/Product';
import CartPage from '@/pages/Cart';
import CheckoutPage from '@/pages/Checkout';
import AccountPage from '@/pages/Account';
import OrderHistoryPage from '@/pages/OrderHistory';
import AddressListPage from '@/pages/AddressList';
import AddressEditPage from '@/pages/AddressEdit';
import VouchersPage from '@/pages/Vouchers'; // ✅ THÊM
import PointsPage from '@/pages/Points'; // ✅ THÊM
import MembershipPage from '@/pages/Membership'; // ✅ THÊM
import ProfilePage from '@/pages/Profile'; // ✅ THÊM
import StoresPage from '@/pages/Stores'; // ✅ THÊM
import AboutPage from '@/pages/About'; // ✅ THÊM
import SupportPage from '@/pages/Support'; // ✅ THÊM


export const routes = {
  home: '/',
  category: '/category',
  product: '/product',
  cart: '/cart',
  checkout: '/checkout',
  account: '/account',
  orders: '/orders',
  addressList: '/address/list', // ✅ SỬA: thêm /list
  addressEdit: '/address/edit',
  vouchers: '/vouchers', // ✅ THÊM
  points: '/points', // ✅ THÊM
  membership: '/membership', // ✅ THÊM
  profile: '/profile', // ✅ THÊM
  stores: '/stores', // ✅ THÊM
  about: '/about', // ✅ THÊM
  support: '/support', // ✅ THÊM
} as const;


// Wrap component với PageLayout
const withLayout = (Component: React.ComponentType<any>) => {
  const Wrapped: React.FC = () => (
    <PageLayout>
      <Component />
    </PageLayout>
  );
  // Đặt displayName để debug dễ hơn
  Wrapped.displayName = `WithLayout(${Component.displayName || Component.name})`;
  return Wrapped;
};

export const appRoutes = [
  { path: routes.home, component: withLayout(HomePage) },
  { path: routes.category, component: withLayout(CategoryPage) },
  { path: routes.product, component: withLayout(ProductPage) },
  { path: routes.cart, component: withLayout(CartPage) },
  { path: routes.checkout, component: withLayout(CheckoutPage) },
  { path: routes.account, component: withLayout(AccountPage) },
  { path: routes.orders, component: withLayout(OrderHistoryPage) },
  { path: routes.addressList, component: withLayout(AddressListPage) },
  { path: routes.addressEdit, component: withLayout(AddressEditPage) },
  { path: routes.vouchers, component: withLayout(VouchersPage) }, // ✅ THÊM
  { path: routes.points, component: withLayout(PointsPage) }, // ✅ THÊM
  { path: routes.membership, component: withLayout(MembershipPage) }, // ✅ THÊM
  { path: routes.profile, component: withLayout(ProfilePage) }, // ✅ THÊM
  { path: routes.stores, component: withLayout(StoresPage) }, // ✅ THÊM
  { path: routes.about, component: withLayout(AboutPage) }, // ✅ THÊM
  { path: routes.support, component: withLayout(SupportPage) }, // ✅ THÊM
];
