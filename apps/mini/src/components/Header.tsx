import React, { useEffect, useState } from "react";
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
        <div className="safe-x mx-auto flex items-center justify-between py-2 px-3">
          <div className="flex items-center gap-2">
            {showBack && (
              <button
                type="button"
                onClick={() => {
                  if (onBack) {
                    onBack();
                  } else if (typeof window !== 'undefined') {
                    // Fallback cho web dev: lùi lại 1 trang
                    window.history.back();
                  }
                }}
                className="mr-1 p-1 rounded-full hover:bg-gray-100 active:bg-gray-200 focus:outline-none"
                aria-label="Quay lại"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  className="w-5 h-5"
                >
                  <path
                    fillRule="evenodd"
                    d="M12.707 4.293a1 1 0 010 1.414L9.414 9H16a1 1 0 110 2H9.414l3.293 3.293a1 1 0 01-1.414 1.414l-4.707-4.707a1 1 0 010-1.414l4.707-4.707a1 1 0 011.414 0z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>
            )}

            <img
              src="/logo-hv.png"
              alt="Shop Huy Vân"
              className="w-8 h-8 object-contain rounded-md"
              loading="eager"
            />
            <div className="flex flex-col leading-tight">
              <span className="text-sm font-bold text-brand">Shop Huy Vân</span>
              <span className="text-[11px] text-gray-500">
                Mua sắm trên Zalo Mini
              </span>
            </div>
          </div>

          {count > 0 && (
            <div className="text-xs text-rose-600 font-semibold">
              {count} sản phẩm
            </div>
          )}
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

        {/* Ô tìm kiếm kéo dài */}
        <a
          href={routes.category}
          className="search-pill flex-1 flex items-center gap-2 min-h-[36px] ml-2"
          aria-label="Tìm kiếm sản phẩm"
        >
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
          <span className="text-gray-500 text-sm">Tìm kiếm sản phẩm</span>
        </a>

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

