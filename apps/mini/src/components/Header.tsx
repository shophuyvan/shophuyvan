import React, { useEffect, useState } from "react";
import { useNavigate } from "zmp-ui"; // ✅ Hook điều hướng
import { scanQRCode } from "zmp-sdk/apis"; // ✅ API Quét mã
import { routes } from "../routes";
import cart from "@shared/cart";

// === SHV Cloudinary helper (Mini Plan A) ===
function cloudify(u?: string, t: string = "w_800,q_auto,f_auto"): string | undefined {
  try {
    if (!u) return u;
    const base =
      typeof location !== "undefined" && location.origin
        ? location.origin
        : "https://example.com";
    const url = new URL(u, base);
    if (!/res\.cloudinary\.com/i.test(url.hostname)) return u;
    if (/\/upload\/[^/]+\//.test(url.pathname)) return url.toString();
    url.pathname = url.pathname.replace("/upload/", "/upload/" + t + "/");
    return url.toString();
  } catch {
    return u;
  }
}

/**
 * Header với logo thật (ảnh) ở góc trái, chữ "Shop Huy Vân" nhỏ nằm dưới logo,
 * màu chữ đồng bộ màu logo. Thanh tìm kiếm kéo dài chiếm phần còn lại.
 */
type HeaderProps = {
  forceShow?: boolean;
  variant?: 'default' | 'mini';
  showBack?: boolean;
  onBack?: () => void;
};

export default function Header({
  forceShow,
  variant = 'default',
  showBack,
  onBack,
}: HeaderProps) {
  const [count, setCount] = useState(cart.count());
  const [shouldHide, setShouldHide] = useState(false);
  const navigate = useNavigate();
  const [keyword, setKeyword] = useState(""); // ✅ Thêm state lưu từ khóa

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (keyword.trim()) {
      // ✅ Use routes constant + trim keyword
      navigate(`${routes.category}?q=${encodeURIComponent(keyword.trim())}`);
    }
  };

  const handleScan = async () => {
    try {
      const { content } = await scanQRCode({});
      if (content) {
        // Điều hướng sang trang danh mục để tìm kiếm sản phẩm theo mã vừa quét
        navigate(`${routes.category}?q=${encodeURIComponent(content)}`);
      }
    } catch (error) {
      console.error("Lỗi quét QR:", error);
    }
  };

  // Ẩn header ở trang product/cart/checkout (FE),
  // nhưng nếu forceShow = true (Mini) thì luôn hiển thị
  useEffect(() => {
    if (forceShow) {
      setShouldHide(false);
      return;
    }

    if (typeof window !== 'undefined') {
      try {
        const path = window.location.pathname;
        if (
          path.includes('/product') ||
          path.includes('/cart') ||
          path.includes('/checkout')
        ) {
          setShouldHide(true);
        } else {
          setShouldHide(false);
        }
      } catch (e) {
        setShouldHide(false);
      }
    }
  }, [forceShow]);


  // Đồng bộ số lượng giỏ hàng theo storage + custom event + polling
  useEffect(() => {
    if (typeof window === "undefined") return;

    const updateCount = () => {
      try {
        setCount(cart.count());
      } catch {
        // bỏ qua lỗi nhỏ, không làm app crash
      }
    };

    // Gọi 1 lần khi mount
    updateCount();

    const onStorage = (e: StorageEvent) => {
      // nếu không có key (clear storage) hoặc key liên quan tới giỏ hàng thì cập nhật
      if (!e.key || e.key.includes("shv_cart")) {
        updateCount();
      }
    };

    // Custom event "shv:cart-changed" (do app phát ra ở nơi khác)
    const onCartChanged = () => updateCount();

    window.addEventListener("storage", onStorage);
    window.addEventListener("shv:cart-changed", onCartChanged as any);

    // Fallback: mỗi 1s check lại 1 lần cho chắc
    const id = window.setInterval(updateCount, 1000);

    // Cleanup khi unmount
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("shv:cart-changed", onCartChanged as any);
      window.clearInterval(id);
    };
  }, []);

     // Nếu đang ở trang cần ẩn header thì không render gì
  if (shouldHide) {
    return null;
  }

// Header đơn giản cho Zalo Mini App: không dùng link FE để tránh nhảy khỏi Mini
  if (variant === 'mini') {
    return (
      <header className="sticky top-0 z-20 bg-white shadow-sm border-b border-gray-100">
        <div className="safe-x mx-auto flex items-center gap-3 py-2 px-3 h-14">
          {/* Nút Back (chỉ hiện khi cần) */}
          {showBack && (
            <button
              type="button"
              onClick={() => {
                if (onBack) onBack();
                else if (typeof window !== 'undefined') window.history.back();
              }}
              className="shrink-0 -ml-1 p-1.5 rounded-full hover:bg-gray-50 text-gray-600"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
                <path fillRule="evenodd" d="M7.72 12.53a.75.75 0 010-1.06l7.5-7.5a.75.75 0 111.06 1.06L9.31 12l6.97 6.97a.75.75 0 11-1.06 1.06l-7.5-7.5z" clipRule="evenodd" />
              </svg>
            </button>
          )}

          {/* Form Tìm kiếm + QR Code (Style hiện đại) */}
          <form 
            onSubmit={handleSearch}
            className="flex-1 relative group"
          >
            {/* Input nhập liệu */}
            <input
              type="text"
              className="w-full bg-gray-100 text-sm text-gray-800 rounded-full pl-9 pr-10 py-2 outline-none focus:bg-white focus:ring-1 focus:ring-blue-500 transition-all placeholder-gray-400"
              placeholder="Tìm sản phẩm..."
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
            />

            {/* Icon Search (Kính lúp - nằm bên trái) */}
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                <path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z" clipRule="evenodd" />
              </svg>
            </div>

            {/* Icon QR Scan (Khung ngắm - nằm bên phải) */}
            <button 
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleScan();
              }}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1.5 text-gray-500 hover:text-blue-600 rounded-full hover:bg-gray-200 transition-colors"
              title="Quét mã QR"
            >
              <svg 
                xmlns="http://www.w3.org/2000/svg" 
                viewBox="0 0 24 24" 
                fill="currentColor" 
                className="w-6 h-6" // Tăng kích thước lên 6 cho rõ
              >
                <path d="M3 4a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H4a1 1 0 01-1-1V4zm2 1v2h2V5H5zm9-2a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1V4zm2 1v2h2V5h-2zM3 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H4a1 1 0 01-1-1v-4zm2 1v2h2v-2H5zm13-1a1 1 0 011-1h1a1 1 0 011 1v1a1 1 0 01-1 1h-1a1 1 0 01-1-1v-1zm-4 0a1 1 0 011-1h1a1 1 0 011 1v1a1 1 0 01-1 1h-1a1 1 0 01-1-1v-1zm4 4a1 1 0 011-1h1a1 1 0 011 1v1a1 1 0 01-1 1h-1a1 1 0 01-1-1v-1zm-4 0a1 1 0 011-1h1a1 1 0 011 1v1a1 1 0 01-1 1h-1a1 1 0 01-1-1v-1z" />
              </svg>
            </button>
          </form>

          {/* Icon Giỏ hàng (Túi xách nét mảnh) */}
          <button
            onClick={() => navigate('/cart')}
            className="shrink-0 relative p-2 text-gray-700 hover:text-blue-600 active:scale-95 transition-transform"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-7 h-7">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007zM8.625 10.5a.375.375 0 11-.75 0 .375.375 0 01.75 0zm7.5 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
            </svg>
            
            {/* Badge số lượng */}
            {count > 0 && (
              <span className="absolute top-1 right-0 bg-red-500 text-white text-[10px] h-4 min-w-[16px] flex items-center justify-center rounded-full px-1 border-2 border-white shadow-sm font-bold">
                {count > 99 ? '99+' : count}
              </span>
            )}
          </button>
        </div>
      </header>
    );
  }

  // Mặc định: header đầy đủ cho FE
  return (
    <header className="sticky top-0 z-20 bg-white/95 backdrop-blur border-b">
      {/* Giảm padding-y (p-3 -> py-2) và giảm gap (gap-2 -> gap-3) */}
      <div className="safe-x mx-auto flex items-center gap-3 py-2 px-3">
        {/* Logo + text đã chỉnh sửa */}
        <a href={routes.home} className="shrink-0 flex items-center gap-1">
          <img
            src="/logo-hv.png"
            alt="Shop Huy Vân"
            className="w-8 h-8 object-contain rounded-md"
            loading="eager"
          />
          {/* Tên thương hiệu được đặt cạnh logo */}
          <span className="text-sm font-bold text-brand">Shop Huy Vân Ver 0.4</span>
        </a>

        {/* Ô tìm kiếm + QR Code */}
        <div className="search-pill flex-1 flex items-center gap-2 min-h-[36px] ml-2 bg-gray-100 rounded-full px-3">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            className="w-4 h-4 opacity-70"
          >
            <path
              fillRule="evenodd"
              d="M8 4a4 4 0 015.292 5.708l3 3a1 1 0 01-1.414 1.414l-3-3A4 4 0 118 4zm0 2a2 2 0 100 4 2 2 0 000-4z"
              clipRule="evenodd"
            />
          </svg>
          <span 
            className="text-gray-500 text-sm flex-1 truncate cursor-pointer"
            onClick={() => navigate(routes.category)}
          >
            Tìm kiếm sản phẩm
          </span>
          
          {/* ✅ Nút QR nhỏ trong thanh tìm kiếm */}
          <button 
            onClick={(e) => {
              e.stopPropagation();
              handleScan();
            }}
            className="p-1 -mr-1 text-gray-500 hover:text-gray-700"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v1m6 11h2m-6 0h-2v4h-4v-2h-.972a4 4 0 01-3.832-5.02l.465-2.09a1.996 1.996 0 00-.868-2.106l-1.487-.798A2 2 0 012.392 6.57l.617-2.775a2 2 0 012.42-1.52l1.98.44M13 12a1 1 0 11-2 0 1 1 0 012 0zm1.5-6.5l-2.023 5.56a1 1 0 01-1.883-.133l-1.096-4.93a1 1 0 011.64-1.076l3.362 1.58z" /></svg>
          </button>
        </div>

        {/* Nút giỏ hàng */}
        <a
          href={routes.cart}
          className="relative shrink-0 p-2 rounded-full bg-gray-100"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="currentColor"
            className="w-5 h-5"
          >
            <path
              d="M7 18c-1.1 0-1.99.9-1.99 2S5.9 22 7 22s2-.9 2-2-.9-2-2-2zm10 0c-1.1 
              0-1.99.9-1.99 2S15.9 22 17 22s2-.9 2-2-.9-2-2-2zM7.16 14h9.45c.75 0 1.41-.4
              1.75-1.03l3.24-5.88
              a1 1 0 00-.88-1.47H6.21L5.27 2H2v2h2l3.6 7.59-1.35 2.44C5.52 14.37 6.24 15 7.16 15H19v-2H7.42l.74-1.34z"
            />
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

