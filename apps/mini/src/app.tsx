import React, { useEffect, useState } from 'react';
import Home from './pages/Home';
import Category from './pages/Category';
import Product from './pages/Product';
import Cart from './pages/Cart';
import Checkout from './pages/Checkout';

// === SHV004: Inline Account page (white/blue) ===
import Header from './components/Header';
import Footer from './components/Footer';
const Account: React.FC = () => (
  <div className="pb-24">
    <Header />
    <section className="safe-x my-3">
      <div className="brand-card flex items-center gap-3 p-4">
        <div className="w-12 h-12 rounded-full ring-2 ring-brand/20 flex items-center justify-center text-brand/70">
          <svg viewBox="0 0 24 24" className="w-7 h-7" fill="none" stroke="currentColor"><circle cx="12" cy="8" r="4"/><path d="M4 20c2-4 6-6 8-6s6 2 8 6"/></svg>
        </div>
        <div className="flex-1"><div className="text-brand text-lg font-semibold">Chưa kích hoạt</div></div>
        <a href="#" className="text-brand text-sm">Sửa</a>
      </div>
    </section>
    <section className="safe-x">
      <div className="section-head">
        <h2>Đơn hàng của tôi</h2>
        <a href="#" className="section-more">Xem lịch sử mua hàng →</a>
      </div>
      <div className="mt-3 grid grid-cols-4 gap-3 text-center">
        <a href="#" className="flex flex-col items-center gap-1"><div className="w-11 h-11 rounded-xl bg-white shadow flex items-center justify-center text-2xl text-brand/80">⌛</div><div className="text-xs text-gray-700">Chờ xác nhận</div></a>
        <a href="#" className="flex flex-col items-center gap-1"><div className="w-11 h-11 rounded-xl bg-white shadow flex items-center justify-center text-2xl text-brand/80">📦</div><div className="text-xs text-gray-700">Chờ giao hàng</div></a>
        <a href="#" className="flex flex-col items-center gap-1"><div className="w-11 h-11 rounded-xl bg-white shadow flex items-center justify-center text-2xl text-brand/80">🚚</div><div className="text-xs text-gray-700">Đang giao hàng</div></a>
        <a href="#" className="flex flex-col items-center gap-1"><div className="w-11 h-11 rounded-xl bg-white shadow flex items-center justify-center text-2xl text-brand/80">⭐</div><div className="text-xs text-gray-700">Đánh giá</div></a>
      </div>
    </section>
    <section className="safe-x mt-4 grid grid-cols-2 gap-3">
      <a className="brand-card p-4 flex items-center gap-3" href="#"><div className="icon-box">🚛</div><div><div className="font-semibold">Sổ địa chỉ</div><div className="text-xs text-gray-500">Địa chỉ nhận hàng</div></div></a>
      <a className="brand-card p-4 flex items-center gap-3" href="#"><div className="icon-box">🎟️</div><div><div className="font-semibold">Kho Voucher</div><div className="text-xs text-gray-500">Các voucher khuyến mại</div></div></a>
    </section>
    <section className="safe-x mt-3">
      <div className="brand-card overflow-hidden">
        <a href="#" className="list-tile"><div className="flex items-center gap-3"><div className="icon-box">🧑‍💼</div><div><div className="font-medium">Thông tin tài khoản</div><div className="text-xs text-gray-500">Cập nhật thông tin định danh</div></div></div><span className="chev">›</span></a>
        <a href="#" className="list-tile"><div className="flex items-center gap-3"><div className="icon-box">📍</div><div><div className="font-medium">Danh sách cửa hàng</div><div className="text-xs text-gray-500">Vị trí và thông tin cửa hàng</div></div></div><span className="chev">›</span></a>
        <a href="#" className="list-tile"><div className="flex items-center gap-3"><div className="icon-box">📲</div><div><div className="font-medium">Tạo icon app trên màn hình chính</div><div className="text-xs text-gray-500">Dễ dàng truy cập miniapp hơn</div></div></div><span className="chev">›</span></a>
        <a href="#" className="list-tile"><div className="flex items-center gap-3"><div className="icon-box">📄</div><div><div className="font-medium">Về chúng tôi</div><div className="text-xs text-gray-500">Chính sách, điều khoản, giới thiệu</div></div></div><span className="chev">›</span></a>
        <a href="#" className="list-tile"><div className="flex items-center gap-3"><div className="icon-box">❓</div><div><div className="font-medium">Hỗ trợ và hỏi đáp</div><div className="text-xs text-gray-500">Gặp trực tiếp đội ngũ tư vấn viên</div></div></div><span className="chev">›</span></a>
      </div>
    </section>
    <section className="safe-x mt-4">
      <div className="brand-card p-4">
        <div className="font-semibold">Chia sẻ cửa hàng Shop Huy Vân với bạn bè để nhận điểm thưởng! QR này có chứa mã giới thiệu của bạn.</div>
        <a className="text-brand text-sm mt-1 inline-block" href="#">Xem chi tiết</a>
        <div className="qr-box mt-3"><div className="text-gray-400">QR</div></div>
        <div className="mt-3 grid grid-cols-3 gap-3 text-center">
          <button className="btn-light">Sao chép</button>
          <button className="btn-light">Tải xuống</button>
          <button className="btn-light">Chia sẻ link</button>
        </div>
      </div>
    </section>
    <Footer />
  </div>
);


/**
 * Minimal router: uses location.pathname (or hash) to choose a page component.
 * This avoids relying on zmp-react router APIs that vary by version.
 */
function usePath() {
  const get = () => (location.hash?.startsWith('#') ? location.hash.slice(1) : location.pathname) || '/';
  const [path, setPath] = useState(get());
  useEffect(() => {
    const onChange = () => setPath(get());
    window.addEventListener('popstate', onChange);
    window.addEventListener('hashchange', onChange);
    return () => {
      window.removeEventListener('popstate', onChange);
      window.removeEventListener('hashchange', onChange);
    };
  }, []);
  return path;
}

export default function App() {
  const path = usePath();
  let Page: React.FC = Home;

  if (path.startsWith('/category') || path.startsWith('category')) Page = Category;
  else if (path.startsWith('/product') || path.startsWith('product')) Page = Product;
  else if (path.startsWith('/cart') || path.startsWith('cart')) Page = Cart;
  else if (path.startsWith('/checkout') || path.startsWith('checkout')) Page = Checkout;
  else if (path.startsWith('/account') || path.startsWith('account')) Page = Account;
  else Page = Home;

  return <Page />;
}