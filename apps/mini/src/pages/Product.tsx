/**
 * FILE PATH: shophuyvan-main/apps/mini/src/pages/Product.tsx
 *
 * CHANGES:
 * - ✅ Auto-select variant rẻ nhất còn hàng khi modal bật (không còn 0đ).
 * - ✅ Header modal dùng giá/ảnh/kho theo biến thể hiệu lực (selected || cheapest).
 * - ✅ Khu vực Actions của modal: 01 nút đỏ full-width (giống FE).
 */

import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'zmp-ui';
import { api } from '@shared/api';
import { fmtVND } from '@shared/utils/fmtVND';
import { pickPrice, priceRange } from '@shared/utils/price';
import cart from '@shared/cart';
import { routes } from '../routes';
import { navigate as openLink } from '@/lib/navigation';
import ProductCard from '@/components/ProductCard';

// ==========================================
// FLASH SALE COUNTDOWN HELPER
// ==========================================
function formatCountdown(endTime: string): string {
  try {
    const end = new Date(endTime).getTime();
    const now = Date.now();
    const diff = end - now;
    
    if (diff <= 0) return 'Đã kết thúc';
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);
    
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  } catch {
    return '';
  }
}

function useCountdown(endTime: string | null | undefined) {
  const [countdown, setCountdown] = React.useState('');
  
  React.useEffect(() => {
    if (!endTime) return;
    
    const update = () => {
      const text = formatCountdown(endTime);
      setCountdown(text);
      
      if (text === 'Đã kết thúc') {
        window.location.reload();
      }
    };
    
    update();
    const timer = setInterval(update, 1000);
    
    return () => clearInterval(timer);
  }, [endTime]);
  
  return countdown;
}

// ==========================================
// CART COUNT HOOK (Realtime)
// ==========================================
function useCartCount() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const updateCount = () => {
      try {
        const cartData = cart.get();
        const total = cartData.lines.reduce((s, l) => s + l.qty, 0);
        setCount(total);
      } catch {
        setCount(0);
      }
    };

    updateCount();
    window.addEventListener('storage', updateCount);
    window.addEventListener('shv:cart-changed', updateCount);

    const interval = setInterval(updateCount, 2000);

    return () => {
      window.removeEventListener('storage', updateCount);
      window.removeEventListener('shv:cart-changed', updateCount);
      clearInterval(interval);
    };
  }, []);

  return count;
}

// ==========================================
// VARIANT MODAL COMPONENT (local)
// ==========================================
function VariantModal({
  open,
  onClose,
  product,
  variants = [],
  onConfirm,
  mode = 'cart',
}: any) {
  const [selectedVariant, setSelectedVariant] = useState<any>(null);
  const [quantity, setQuantity] = useState(1);

  // ✅ CHỌN BIẾN THỂ RẺ NHẤT CÒN HÀNG (render frame đầu)
  const defaultVariant = useMemo(() => {
    if (!Array.isArray(variants) || variants.length === 0) return null;
    let best = variants[0];
    let bestPrice = Infinity;

    for (const v of variants) {
      const pz = pickPrice(product, v);
      const stock = v.stock || v.qty || v.quantity || 0;
      if (stock > 0 && pz.base > 0 && pz.base < bestPrice) {
        best = v;
        bestPrice = pz.base;
      }
    }
    return best;
  }, [variants, product]);

  // ✅ Biến thể hiệu lực dùng cho UI (đã chọn || rẻ nhất)
  const effectiveVariant = selectedVariant || defaultVariant;

  // ✅ ĐỒNG BỘ KHI MODAL BẬT: đảm bảo có biến thể được chọn ngay → tránh 0đ
  useEffect(() => {
    if (open && defaultVariant && !selectedVariant) {
      setSelectedVariant(defaultVariant);
    }
  }, [open, defaultVariant, selectedVariant]);

  // ⚡ Giá hiện tại: ưu tiên Flash Sale trước
  const currentPrice = useMemo(() => {
    if (hasFlashSale) {
      const flashInfo = effectiveVariant?.flash_sale || product?.flash_sale;
      return {
        base: flashInfo?.price || 0,
        original: flashInfo?.original_price || null
      };
    }
    
    if (Array.isArray(variants) && variants.length > 0) {
      return pickPrice(product, effectiveVariant as any);
    }
    return pickPrice(product);
  }, [product, variants, effectiveVariant, hasFlashSale]);
  
  // ⚡ CHECK FLASH SALE
  const hasFlashSale = useMemo(() => {
    if (effectiveVariant?.flash_sale?.active) return true;
    if (product?.flash_sale?.active) return true;
    return false;
  }, [effectiveVariant, product]);

  // ⚡ Flash Sale Info
  const flashSaleInfo = useMemo(() => {
    return effectiveVariant?.flash_sale || product?.flash_sale || null;
  }, [effectiveVariant, product]);

  const countdown = useCountdown(flashSaleInfo?.ends_at);

  // Helper ảnh
  const getImages = (item: any) => {
    const imgs: string[] = [];
    if (Array.isArray(item?.images)) imgs.push(...item.images);
    if (item?.image) imgs.unshift(item.image);
    return imgs.filter(Boolean);
  };

  // ✅ Ảnh header theo biến thể hiệu lực
  const currentImage =
    getImages(effectiveVariant)[0] || getImages(product)[0] || '/icon.png';

  // STEP: xác nhận hành động
  const handleConfirm = () => {
    if (!effectiveVariant && variants.length > 0) {
      alert('Vui lòng chọn phân loại sản phẩm');
      return;
    }
    // NOTE: onConfirm nhận (variant, qty, mode)
    onConfirm?.(effectiveVariant || product, quantity, mode);
    onClose?.();
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[999] flex items-end justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl bg-white rounded-t-3xl shadow-2xl animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center"
        >
          ✕
        </button>

        {/* Header */}
        <div className="p-4 border-b flex gap-3">
          <img
            src={currentImage}
            alt={product?.name}
            className="w-20 h-20 object-cover rounded-lg border bg-gray-50"
          />
          <div className="flex-1">
            <h3 className="font-semibold text-base line-clamp-2 mb-2">
              {product?.name}
            </h3>

            {/* ⚡ FLASH SALE BADGE + Giá */}
            <div className="space-y-1">
              {hasFlashSale && flashSaleInfo && (
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 px-2 py-1 bg-gradient-to-r from-red-500 to-pink-500 text-white text-xs font-bold rounded animate-pulse">
                    ⚡ FLASH SALE -{flashSaleInfo.discount_percent}%
                  </span>
                  {countdown && (
                    <span className="text-xs font-bold text-red-600 border-2 border-red-500 px-2 py-1 rounded">
                      {countdown}
                    </span>
                  )}
                </div>
              )}
              
              <div className="flex items-baseline gap-2">
                {currentPrice.original &&
                  currentPrice.original > currentPrice.base && (
                    <span className="text-gray-400 line-through text-sm">
                      {fmtVND(currentPrice.original)}
                    </span>
                  )}
                <span className={`font-bold text-xl ${hasFlashSale ? 'text-red-600' : 'text-rose-600'}`}>
                  {fmtVND(currentPrice.base)}
                </span>
              </div>
            </div>
            {/* ✅ Tồn kho theo biến thể hiệu lực */}
            {effectiveVariant && (
              <p className="text-xs text-gray-500 mt-1">
                Kho:{' '}
                {effectiveVariant.stock ||
                  effectiveVariant.qty ||
                  effectiveVariant.quantity ||
                  0}
              </p>
            )}
          </div>
        </div>

        {/* Variants */}
        {variants.length > 0 && (
          <div className="p-4 border-b max-h-[45vh] overflow-y-auto">
            <h4 className="font-medium text-sm mb-3 text-gray-700">
              Chọn phân loại
            </h4>
            <div className="grid grid-cols-3 gap-2">
              {variants.map((variant: any, index: number) => {
                const isSelected = selectedVariant === variant;
                const price = pickPrice(product, variant);
                const image = getImages(variant)[0];
                const stock =
                  variant.stock || variant.qty || variant.quantity || 0;
                const outOfStock = stock <= 0;

                return (
                  <button
                    key={index}
                    onClick={() => !outOfStock && setSelectedVariant(variant)}
                    disabled={outOfStock}
                    className={`relative flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all
                      ${
                        isSelected
                          ? 'border-rose-500 bg-rose-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }
                      ${outOfStock ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    {image && (
                      <img
                        src={image}
                        alt={variant.name}
                        className="w-16 h-16 object-cover rounded-lg"
                      />
                    )}

                    <div className="text-center w-full">
                      <p
                        className={`text-xs font-medium line-clamp-2 ${
                          isSelected ? 'text-rose-600' : 'text-gray-700'
                        }`}
                      >
                        {variant.name ||
                          variant.sku ||
                          `Loại ${index + 1}`}
                      </p>

                      {/* ⚡ Flash Sale Price hoặc giá thường */}
                      {variant.flash_sale?.active ? (
                        <div className="text-center">
                          {variant.flash_sale.original_price && (
                            <p className="text-[10px] text-gray-400 line-through">
                              {fmtVND(variant.flash_sale.original_price)}
                            </p>
                          )}
                          <p className={`text-xs mt-0.5 font-bold ${isSelected ? 'text-red-600' : 'text-red-500'}`}>
                            {fmtVND(variant.flash_sale.price)}
                          </p>
                          <span className="inline-block mt-1 px-1.5 py-0.5 bg-red-100 text-red-600 text-[9px] font-bold rounded">
                            ⚡ -{variant.flash_sale.discount_percent}%
                          </span>
                        </div>
                      ) : price.base > 0 ? (
                        <p
                          className={`text-xs mt-1 font-semibold ${
                            isSelected ? 'text-rose-600' : 'text-gray-500'
                          }`}
                        >
                          {fmtVND(price.base)}
                        </p>
                      ) : null}

                      {/* Stock indicator */}
                      <p
                        className={`text-[10px] mt-0.5 ${
                          stock > 0 ? 'text-gray-500' : 'text-red-600'
                        }`}
                      >
                        {stock > 0 ? `Còn ${stock}` : 'Hết hàng'}
                      </p>
                    </div>

                    {isSelected && (
                      <div className="absolute top-2 right-2 w-5 h-5 bg-rose-500 rounded-full flex items-center justify-center">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 24 24"
                          fill="white"
                          className="w-3 h-3"
                        >
                          <path
                            fillRule="evenodd"
                            d="M19.916 4.626a.75.75 0 01.208 1.04l-9 13.5a.75.75 0 01-1.154.114l-6-6a.75.75 0 011.06-1.06l5.353 5.353 8.493-12.739a.75.75 0 011.04-.208z"
                            clipRule="evenodd"
                          />
                        </svg>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Quantity */}
        <div className="p-4 border-b">
          <div className="flex items-center justify-between">
            <span className="font-medium text-sm text-gray-700">Số lượng</span>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                disabled={quantity <= 1}
                className="w-8 h-8 rounded-lg border-2 border-gray-300 hover:border-rose-500 disabled:opacity-30 flex items-center justify-center font-bold"
              >
                −
              </button>
              <input
                type="number"
                min="1"
                value={quantity}
                onChange={(e) =>
                  setQuantity(Math.max(1, parseInt(e.target.value) || 1))
                }
                className="w-16 h-8 text-center border-2 border-gray-300 rounded-lg font-medium focus:border-rose-500 focus:outline-none"
              />
              <button
                onClick={() => setQuantity((q) => q + 1)}
                className="w-8 h-8 rounded-lg border-2 border-gray-300 hover:border-rose-500 flex items-center justify-center font-bold"
              >
                +
              </button>
            </div>
          </div>
        </div>

        {/* ✅ Actions: 01 NÚT ĐỎ FULL-WIDTH (giống FE) */}
        <div className="p-4">
          <button
            onClick={handleConfirm}
            className="w-full py-3 bg-rose-500 text-white rounded-xl font-bold hover:bg-rose-600 shadow-lg"
          >
            {mode === 'buy' ? 'Mua ngay' : 'Thêm Vào Giỏ Hàng'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ==========================================
// MAIN PRODUCT COMPONENT
// ==========================================
function useQuery() {
  const u = new URL(location.href);
  return Object.fromEntries(u.searchParams.entries());
}

export default function Product() {
  const navigate = useNavigate();
  const query = useQuery();
  const id = query.id || '';
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [p, setP] = useState<any>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'cart' | 'buy'>('cart');
  const [shareOpen, setShareOpen] = useState(false);
  const [relatedProducts, setRelatedProducts] = useState<any[]>([]);
  const cartCount = useCartCount();

  useEffect(() => {
    let isMounted = true;

    (async () => {
      try {
        if (!id) throw new Error('Thiếu id');
        const d = await api.products.detail(id);

        // NOTE: debug/compat với backend trả { ok, item }
        const fullProduct = (d && (d as any).item) ? (d as any).item : d;
        if (isMounted) setP(fullProduct);
        
        // ✅ FETCH RELATED PRODUCTS
        if (fullProduct?.category) {
          try {
            const listRes = await api.get('/public/products');
            const items = listRes?.items || listRes?.products || [];
            
            const related = items.filter((item: any) => {
              const sameCategory = String(item.category || '').toLowerCase() === String(fullProduct.category || '').toLowerCase();
              const differentId = String(item.id || item._id || '') !== String(fullProduct.id || fullProduct._id || '');
              const isActive = item.is_active !== false;
              return sameCategory && differentId && isActive;
            });
            
            // Shuffle và lấy 8 sản phẩm
            const shuffled = related.sort(() => Math.random() - 0.5);
            if (isMounted) setRelatedProducts(shuffled.slice(0, 8));
          } catch (err) {
            console.error('[Related] Fetch error:', err);
          }
        }
      } catch (e: any) {
        if (isMounted) setError(e?.message || 'Lỗi tải sản phẩm');
      } finally {
        if (isMounted) setLoading(false);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [id]);

  const variants = useMemo(
    () => (Array.isArray(p?.variants) ? p.variants : []),
    [p]
  );
  const range = useMemo(() => priceRange(variants), [variants]);

  const handleBack = () => {
    try {
      window.history.back();
    } catch {}
  };

    const handleShare = (type: 'zalo' | 'facebook') => {
    const url = encodeURIComponent(window.location.href);
    const title = encodeURIComponent(p?.name || '');

    if (type === 'zalo') {
      openLink(`https://zalo.me/share?url=${url}&title=${title}`);
    } else {
      openLink(`https://www.facebook.com/sharer/sharer.php?u=${url}`);
    }

    setShareOpen(false);
  };

// NOTE: onConfirm của modal sẽ gọi hàm này
  const addLine = (variant: any, qty: number, mode: 'cart' | 'buy') => {
    // ⚡ Ưu tiên giá Flash Sale
    let finalPrice: any;
    let flashSaleData = null;
    
    if (variant?.flash_sale?.active) {
      finalPrice = { base: variant.flash_sale.price, original: variant.flash_sale.original_price };
      flashSaleData = {
        active: true,
        price: variant.flash_sale.price,
        original_price: variant.flash_sale.original_price,
        discount_percent: variant.flash_sale.discount_percent,
        ends_at: variant.flash_sale.ends_at,
        flash_sale_id: variant.flash_sale.flash_sale_id,
        flash_sale_name: variant.flash_sale.flash_sale_name
      };
    } else {
      finalPrice = pickPrice(p, variant);
    }

    // ✅ TÍNH TRỌNG LƯỢNG THỰC (GRAM) TỪ VARIANT → PRODUCT (không fallback)
    // ✅ Ưu tiên weight trên variant trước
    const w = Number(
      variant?.weight ??
        variant?.weight_gram ??
        variant?.weight_grams ??
        p?.weight ??
        p?.weight_gram ??
        p?.weight_grams ??
        0,
    );

    const line: any = {
      ...p,
      price: finalPrice,
      variantName: variant?.name || variant?.sku || '',
      variantImage:
        variant?.image ||
        (Array.isArray(variant?.images) ? variant.images[0] : undefined),

      // 📽 BẮT BUỘC: gắn đủ 3 alias để Checkout đọc đúng
      weight_gram: w,
      weight_grams: w,
      weight: w,
    };

    // ⚡ Lưu thông tin Flash Sale
    if (flashSaleData) {
      line.flash_sale = flashSaleData;
    }

    cart.add(line, qty);
    window.dispatchEvent(new Event('shv:cart-changed'));

    if (mode === 'buy') {
      setTimeout(() => {
        try {
          // Điều hướng SPA trong mini
          navigate(routes.checkout);
        } catch {
          // fallback khi chạy ngoài mini
          try {
            location.href = routes.checkout;
          } catch {}
        }
      }, 300);
    }
  };

  const soldCount = p?.sold || p?.sold_count || 0;
  const rating = p?.rating || 5;

  // ✅ GOM MEDIA (video + hình)
  const mediaList = useMemo(() => {
    const arr: string[] = [];
    if (Array.isArray(p?.videos) && p.videos.length > 0) arr.push(...p.videos);
    if (p?.video) arr.push(p.video);
    if (Array.isArray(p?.images)) arr.push(...p.images);
    return arr.length ? arr : [p?.image || '/icon.png'];
  }, [p]);

  // Slide video/ảnh
  const [currentMedia, setCurrentMedia] = useState(0);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const [touchEndX, setTouchEndX] = useState<number | null>(null);
  const goNext = () => {
    if (!mediaList || mediaList.length <= 1) return;
    setCurrentMedia((prev) => (prev + 1 < mediaList.length ? prev + 1 : prev));
  };
  const goPrev = () => {
    if (!mediaList || mediaList.length <= 1) return;
    setCurrentMedia((prev) => (prev - 1 >= 0 ? prev - 1 : prev));
  };

  return (
    <div className="min-h-screen bg-gray-100 pb-28">
      {/* Floating Header */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-b from-black/50 via-black/20 to-transparent p-3">
        <div className="flex items-center justify-between">
          <button
            onClick={handleBack}
            className="w-10 h-10 rounded-full bg-black/40 backdrop-blur text-white flex items-center justify-center"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="currentColor"
              className="w-5 h-5"
            >
              <path
                fillRule="evenodd"
                d="M15.75 19.5a.75.75 0 0 1-1.06 0l-7.5-7.5a.75.75 0 0 1 0-1.06l7.5-7.5a.75.75 0 1 1 1.06 1.06L9.06 11.25l6.69 6.69a.75.75 0 0 1 0 1.06z"
                clipRule="evenodd"
              />
            </svg>
          </button>

          <div className="flex items-center gap-2">
            <div className="relative">
              <button
                onClick={() => setShareOpen(!shareOpen)}
                className="w-10 h-10 rounded-full bg-black/40 backdrop-blur text-white flex items-center justify-center"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  className="w-5 h-5"
                >
                  <path
                    fillRule="evenodd"
                    d="M15.75 4.5a3 3 0 1 1 .825 2.066l-8.421 4.679a3.002 3.002 0 0 1 0 1.51l8.421 4.679a3 3 0 1 1-.729 1.31l-8.421-4.678a3 3 0 1 1 0-4.132l8.421-4.679a3 3 0 0 1-.096-.755Z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>

              {shareOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-xl border overflow-hidden">
                  <button
                    onClick={() => handleShare('zalo')}
                    className="w-full text-left px-4 py-3 hover:bg-gray-50 flex items-center gap-3"
                  >
                    <div className="w-8 h-8 rounded-full bg-blue-500 text-white font-bold flex items-center justify-center">
                      Z
                    </div>
                    <span className="font-medium text-sm">Chia sẻ Zalo</span>
                  </button>
                  <button
                    onClick={() => handleShare('facebook')}
                    className="w-full text-left px-4 py-3 hover:bg-gray-50 flex items-center gap-3 border-t"
                  >
                    <div className="w-8 h-8 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center">
                      f
                    </div>
                    <span className="font-medium text-sm">
                      Chia sẻ Facebook
                    </span>
                  </button>
                </div>
              )}
            </div>

            <button
               type="button"
               onClick={() => navigate(routes.cart)}
              className="w-10 h-10 rounded-full bg-black/40 backdrop-blur text-white flex items-center justify-center relative"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="currentColor"
                className="w-5 h-5"
              >
                <path d="M2.25 2.25a.75.75 0 0 0 0 1.5h1.386c.17 0 .318.114.362.278l2.558 9.592a3.752 3.752 0 0 0-2.806 3.63c0 .414.336.75.75.75h15.75a.75.75 0 0 0 0-1.5H5.378A2.25 2.25 0 0 1 7.5 15h11.218a.75.75 0 0 0 .674-.421 60.358 60.358 0 0 0 2.96-7.228.75.75 0 0 0-.525-.965A60.864 60.864 0 0 0 5.68 4.509l-.232-.867A1.875 1.875 0 0 0 3.636 2.25H2.25ZM3.75 20.25a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0ZM16.5 20.25a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0Z" />
              </svg>
              {cartCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1">
                  {cartCount > 99 ? '99+' : cartCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto p-3 pt-16">
        {loading && (
          <div className="bg-white rounded-2xl p-3 shadow animate-pulse">
            <div className="aspect-square bg-gray-200 rounded-xl mb-3"></div>
            <div className="h-6 bg-gray-200 rounded mb-2"></div>
            <div className="h-4 bg-gray-200 rounded w-2/3"></div>
          </div>
        )}

        {!loading && error && (
          <div className="text-red-600 bg-red-50 p-4 rounded-xl">{error}</div>
        )}

        {!loading && p && (
          <div className="bg-white rounded-2xl p-3 shadow">
            {/* Product Media (Video + Hình ảnh dạng slide) */}
            <div className="w-full rounded-xl overflow-hidden bg-gray-100 relative">
              {mediaList && mediaList.length > 0 ? (
                <div
                  className="flex transition-transform duration-700 ease-in-out"
                  style={{
                    width: `${mediaList.length * 100}%`,
                    transform: `translateX(-${
                      currentMedia * (100 / mediaList.length)
                    }%)`,
                  }}
                  onTouchStart={(e) => {
                    setTouchStartX(e.touches[0].clientX);
                    setTouchEndX(e.touches[0].clientX);
                  }}
                  onTouchMove={(e) => {
                    setTouchEndX(e.touches[0].clientX);
                  }}
                  onTouchEnd={() => {
                    if (touchStartX === null || touchEndX === null) return;
                    const diff = touchStartX - touchEndX;
                    const threshold = 40;
                    if (diff > threshold) goNext();
                    else if (diff < -threshold) goPrev();
                    setTouchStartX(null);
                    setTouchEndX(null);
                  }}
                >
                  {mediaList.map((m: string, i: number) => {
                    const isVideo = m.endsWith('.mp4');
                    return (
                      <div
                        key={i}
                        className="w-full flex-shrink-0 flex items-center justify-center bg-black rounded-xl overflow-hidden"
                        style={{
                          width: `${100 / mediaList.length}%`,
                          aspectRatio: '1 / 1',
                        }}
                      >
                        {isVideo ? (
                          <video
                            src={m}
                            className="max-w-full max-h-full object-contain cursor-pointer bg-black"
                            autoPlay
                            muted
                            loop
                            playsInline
                            controls
                            preload="auto"
                            onClick={(e) => {
                              const video = e.currentTarget as HTMLVideoElement;
                              if (video.muted) {
                                video.muted = false;
                                video
                                  .play()
                                  .catch(() => {});
                              } else {
                                video.muted = true;
                              }
                            }}
                            onEnded={() => {
                              // auto next slide nếu cần
                              goNext();
                            }}
                          />
                        ) : (
                          <img
                            src={m}
                            alt={`Media ${i + 1}`}
                            className="w-full h-full object-cover"
                            loading="lazy"
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <img
                  src={p.image || '/icon.png'}
                  alt={p.name}
                  className="w-full aspect-square object-cover"
                />
              )}

              {/* Dots */}
              {mediaList && mediaList.length > 1 && (
                <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1">
                  {mediaList.map((_, i) => (
                    <span
                      key={i}
                      className={`w-2 h-2 rounded-full transition-all duration-300 ${
                        i === currentMedia ? 'bg-white' : 'bg-white/50'
                      }`}
                    ></span>
                  ))}
                </div>
              )}
            </div>

            {/* Product Info */}
            <h1 className="text-lg font-semibold mt-3">{p?.name}</h1>

            {/* Rating & Sold */}
            <div className="flex items-center gap-4 text-sm mt-2">
              <div className="flex items-center gap-1 text-amber-500">
                <span>{rating}★</span>
              </div>
              <span className="text-gray-300">|</span>
              <span className="text-gray-600">
                <span className="font-semibold">
                  {soldCount.toLocaleString('vi-VN')}
                </span>{' '}
                Đã bán
              </span>
            </div>

            {/* Price Section (show range if variants) */}
            {(() => {
              // ⚡ Check Flash Sale
              const mainHasFlashSale = variants.some((v: any) => v.flash_sale?.active) || p?.flash_sale?.active;
              const mainFlashInfo = variants.find((v: any) => v.flash_sale?.active)?.flash_sale || p?.flash_sale;
              const mainCountdown = useCountdown(mainFlashInfo?.ends_at);
              
              return variants.length > 0 ? (
                <div className="mt-3 bg-gray-50 p-3 rounded-lg">
                  {mainHasFlashSale && mainFlashInfo && (
                    <div className="flex items-center gap-2 mb-2">
                      <span className="inline-flex items-center gap-1 px-3 py-1 bg-gradient-to-r from-red-500 to-pink-500 text-white text-sm font-bold rounded-lg animate-pulse">
                        ⚡ FLASH SALE -{mainFlashInfo.discount_percent}%
                      </span>
                      {mainCountdown && (
                        <span className="text-sm font-bold text-red-600 border-2 border-red-500 px-3 py-1 rounded-lg">
                          {mainCountdown}
                        </span>
                      )}
                    </div>
                  )}
                  
                  <div className="flex items-baseline gap-2">
                    {range.minOrig && range.minOrig > range.minBase && (
                      <span className="text-gray-400 line-through text-sm">
                        {fmtVND(range.minOrig)}
                        {range.maxOrig > range.minOrig
                          ? ` - ${fmtVND(range.maxOrig)}`
                          : ''}
                      </span>
                    )}
                  </div>
                  <div className={`font-bold text-xl mt-1 ${mainHasFlashSale ? 'text-red-600' : 'text-rose-600'}`}>
                    {range.minBase ? fmtVND(range.minBase) : 'Liên hệ'}
                    {range.maxBase > range.minBase
                      ? ` - ${fmtVND(range.maxBase)}`
                      : ''}
                  </div>
                </div>
              ) : (
                <div className="mt-3 bg-gray-50 p-3 rounded-lg">
                  {p?.flash_sale?.active && (
                    <div className="flex items-center gap-2 mb-2">
                      <span className="inline-flex items-center gap-1 px-3 py-1 bg-gradient-to-r from-red-500 to-pink-500 text-white text-sm font-bold rounded-lg animate-pulse">
                        ⚡ FLASH SALE -{p.flash_sale.discount_percent}%
                      </span>
                      {mainCountdown && (
                        <span className="text-sm font-bold text-red-600 border-2 border-red-500 px-3 py-1 rounded-lg">
                          {mainCountdown}
                        </span>
                      )}
                    </div>
                  )}
                  
                  {((p?.flash_sale?.original_price || p.price) && 
                    (p?.flash_sale?.original_price || p.price) > (p?.flash_sale?.price || p.sale_price)) && (
                    <div className="text-gray-400 line-through text-sm">
                      {fmtVND(p?.flash_sale?.original_price || p.price)}
                    </div>
                  )}
                  <div className={`font-bold text-xl ${p?.flash_sale?.active ? 'text-red-600' : 'text-rose-600'}`}>
                    {fmtVND(p?.flash_sale?.price || p.sale_price || p.price || 0)}
                  </div>
                </div>
              );
            })()}

            {/* Stock tổng */}
            <div className="mt-3">
              {(() => {
                let totalStock = 0;
                if (variants.length > 0) {
                  totalStock = variants.reduce(
                    (sum: number, v: any) =>
                      sum + (v.stock || v.qty || v.quantity || 0),
                    0
                  );
                } else {
                  totalStock = p.stock || p.qty || p.quantity || 0;
                }

                return totalStock > 0 ? (
                  <span className="inline-block px-3 py-1 bg-green-50 text-green-700 rounded-full text-sm font-semibold">
                    Còn {totalStock} sản phẩm
                  </span>
                ) : (
                  <span className="inline-block px-3 py-1 bg-red-50 text-red-700 rounded-full text-sm font-semibold">
                    Hết hàng
                  </span>
                );
              })()}
            </div>

            {/* Description */}
            {(p.desc || p.description) && (
              <div className="mt-4 pt-4 border-t">
                <h2 className="font-semibold mb-3 text-base text-gray-900">
                  Mô tả sản phẩm
                </h2>

                <div
                  className="text-[15px] leading-relaxed text-gray-700 bg-gray-50 border border-gray-200 rounded-xl p-3 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-gray-900 [&_h2]:mt-4 [&_h2]:mb-2 [&_h3]:text-base [&_h3]:font-semibold [&_h3]:text-gray-900 [&_h3]:mt-3 [&_h3]:mb-1 [&_p]:mb-3 [&_p]:text-gray-700 [&_p]:leading-relaxed [&_strong]:text-gray-900 [&_strong]:font-semibold [&_ul]:list-disc [&_ul]:pl-5 [&_li]:mb-1 [&_img]:max-w-full [&_img]:h-auto [&_img]:rounded-lg [&_img]:my-3 [&_img]:block"
                  dangerouslySetInnerHTML={{ __html: p.desc || p.description }}
                />
              </div>
            )}

            {/* Related Products */}
            {relatedProducts.length > 0 && (
              <div className="mt-6 pt-4 border-t">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-semibold text-base text-gray-900">
                    🔥 Sản phẩm cùng danh mục
                  </h2>
                  <button
                    onClick={() => {
                      try {
                        navigate(`${routes.category}?cat=${encodeURIComponent(p?.category || '')}`);
                      } catch {
                        console.error('Navigate error');
                      }
                    }}
                    className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                  >
                    Xem tất cả →
                  </button>
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  {relatedProducts.map((item: any) => (
                    <ProductCard key={item.id || item._id} product={item} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Bottom Action Bar */}
      {!loading && p && (
        <div className="fixed left-0 right-0 bottom-0 bg-white border-t shadow-2xl z-50">
          <div className="max-w-4xl mx-auto px-3 py-2.5 flex items-center gap-2.5">
            <a
              href="https://zalo.me/0933190000"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-1.5 px-3 py-2.5 border-2 border-blue-500 text-blue-600 rounded-xl hover:bg-blue-50 min-w-[70px]"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="currentColor"
                className="w-5 h-5"
              >
                <path d="M4.913 2.658c2.075-.27 4.19-.408 6.337-.408 2.147 0 4.262.139 6.337.408 1.922.25 3.291 1.861 3.405 3.727a4.403 4.403 0 00-1.032-.211 50.89 50.89 0 00-8.42 0c-2.358.196-4.04 2.19-4.04 4.434v4.286a4.47 4.47 0 002.433 3.984L7.28 21.53A.75.75 0 016 21v-4.03a48.527 48.527 0 01-1.087-.128C2.905 16.58 1.5 14.833 1.5 12.862V6.638c0-1.97 1.405-3.718 3.413-3.979z" />
              </svg>
              <span className="font-semibold text-sm">Chat</span>
            </a>

            <button
              onClick={() => {
                setModalMode('cart');
                setModalOpen(true);
              }}
              className="flex-1 py-2.5 border-2 border-rose-500 text-rose-600 bg-rose-50 rounded-xl font-semibold text-sm"
            >
              Thêm vào giỏ
            </button>

            <button
              onClick={() => {
                setModalMode('buy');
                setModalOpen(true);
              }}
              className="flex-1 py-2.5 bg-rose-500 text-white rounded-xl font-bold text-sm shadow-lg"
            >
              MUA NGAY
            </button>
          </div>
        </div>
      )}

      {/* Variant Modal */}
      <VariantModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        product={p}
        variants={variants.length ? variants : [{ ...p, name: 'Mặc định' }]}
        onConfirm={addLine}
        mode={modalMode}
      />
    </div>
  );
}
