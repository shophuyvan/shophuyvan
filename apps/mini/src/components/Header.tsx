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
  // Mini App truyền forceShow = true để luôn hiển thị header
  forceShow?: boolean;
  // variant = 'mini' dùng cho Zalo Mini (không dùng link FE)
  variant?: 'default' | 'mini';
  // Hiển thị nút back (dùng ở Mini)
  showBack?: boolean;
  // Handler khi bấm back (Mini truyền vào để dùng useNavigate)
  onBack?: () => void;
};


/**
 * Header với logo thật (ảnh) ở góc trái, chữ "Shop Huy Vân" nhỏ nằm dưới logo,
 * màu chữ đồng bộ màu logo. Thanh tìm kiếm kéo dài chiếm phần còn lại.
 */
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
      navigate(`/category?q=${encodeURIComponent(keyword)}`);
    }
  };

  const handleScan = async () => {
    try {
      const { content } = await scanQRCode({});
      if (content) {
        // Điều hướng sang trang danh mục để tìm kiếm sản phẩm theo mã vừa quét
        navigate(`/category?q=${encodeURIComponent(content)}`);
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
      <header className="sticky top-0 z-20 bg-white/95 backdrop-blur border-b">
        <div className="safe-x mx-auto flex items-center gap-2 py-2 px-3">
          {/* Nút Back */}
          {showBack && (
            <button
              type="button"
              onClick={() => {
                if (onBack) {
                  onBack();
                } else if (typeof window !== 'undefined') {
                  window.history.back();
                }
              }}
              className="shrink-0 p-1 rounded-full hover:bg-gray-100 active:bg-gray-200 focus:outline-none"
              aria-label="Quay lại"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
                className="w-6 h-6 text-gray-600"
              >
                <path
                  fillRule="evenodd"
                  d="M12.707 4.293a1 1 0 010 1.414L9.414 9H16a1 1 0 110 2H9.414l3.293 3.293a1 1 0 01-1.414 1.414l-4.707-4.707a1 1 0 010-1.414l4.707-4.707a1 1 0 011.414 0z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
          )}

          {/* ✅ Form Tìm kiếm + QR Code mới */}
          <form 
            onSubmit={handleSearch}
            className="flex-1 flex items-center gap-2 bg-gray-100 rounded-full px-3 py-1.5 h-10 border border-transparent focus-within:border-blue-400 focus-within:bg-white transition-all"
          >
            {/* Icon Kính lúp */}
            <button type="submit" className="shrink-0 text-gray-400">
               <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                <path fillRule="evenodd" d="M8 4a4 4 0 015.292 5.708l3 3a1 1 0 01-1.414 1.414l-3-3A4 4 0 118 4zm0 2a2 2 0 100 4 2 2 0 000-4z" clipRule="evenodd" />
              </svg>
            </button>
            
            {/* Input nhập liệu thật */}
            <input
              type="text"
              className="flex-1 bg-transparent border-none outline-none text-sm text-gray-700 placeholder-gray-400 min-w-0"
              placeholder="Tìm kiếm sản phẩm..."
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
            />
            
            {/* ✅ Nút QR Scan (Icon đẹp hơn) */}
            <button 
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleScan();
              }}
              className="p-1.5 -mr-1.5 text-gray-500 hover:text-blue-600 rounded-full hover:bg-gray-100"
              title="Quét mã QR"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v1m6 11h2m-6 0h-2v4h-4v-2h-.972a4 4 0 01-3.832-5.02l.465-2.09a1.996 1.996 0 00-.868-2.106l-1.487-.798A2 2 0 012.392 6.57l.617-2.775a2 2 0 012.42-1.52l1.98.44M13 12a1 1 0 11-2 0 1 1 0 012 0zm1.5-6.5l-2.023 5.56a1 1 0 01-1.883-.133l-1.096-4.93a1 1 0 011.64-1.076l3.362 1.58z" />
              </svg>
            </button>
          </form>

          {/* Biểu tượng Giỏ hàng */}
          <button
            onClick={() => navigate('/cart')}
            className="shrink-0 relative p-2 text-gray-600 hover:text-blue-600 transition-colors"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5} 
              stroke="currentColor"
              className="w-7 h-7"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 00-16.536-1.84M7.5 14.25L5.106 5.272M6 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm12.75 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" />
            </svg>
            {count > 0 && (
              <span className="absolute top-0 right-0 bg-red-500 text-white text-[10px] h-4 min-w-[16px] flex items-center justify-center rounded-full px-1 border border-white font-bold shadow-sm">
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

