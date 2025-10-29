/**
 * FILE PATH: shophuyvan-main/apps/mini/src/components/VariantModal.tsx
 *
 * CHANGES:
 * - ✅ Loại bỏ code trùng lặp currentPrice/currentImage.
 * - ✅ Auto-select variant rẻ nhất khi open = true.
 * - ✅ Header modal hiển thị theo biến thể hiệu lực (selected || cheapest).
 * - ✅ Actions: 01 nút đỏ full-width (giống FE).
 */

import React, { useState, useEffect, useMemo } from 'react';

// ---------------- Helper: format/price/images ----------------
function formatPrice(price: number) {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
  }).format(price);
}

// NOTE: pickPrice ưu tiên giá variant; fallback product
function pickPrice(product: any, variant?: any) {
  if (variant) {
    const sale = Number(variant.sale_price ?? variant.price_sale ?? 0);
    const price = Number(variant.price ?? 0);
    const base = sale > 0 ? sale : price > 0 ? price : 0;
    const original = sale > 0 && price > sale ? price : null;
    return { base, original };
  }
  const pSale = Number(product?.sale_price ?? product?.price_sale ?? 0);
  const pPrice = Number(product?.price ?? 0);
  const base = pSale > 0 ? pSale : pPrice > 0 ? pPrice : 0;
  const original = pSale > 0 && pPrice > pSale ? pPrice : null;
  return { base, original };
}

function getImages(item: any) {
  const imgs: string[] = [];
  if (Array.isArray(item?.images)) imgs.push(...item.images);
  if (item?.image) imgs.unshift(item.image);
  return imgs.filter(Boolean);
}

// ---------------- Props ----------------
interface VariantModalProps {
  open: boolean;
  onClose?: () => void;
  product: any;
  variants?: any[];
  onConfirm?: (variant: any, qty: number, mode: string) => void;
  mode?: string; // 'cart' | 'buy'
}

// ---------------- Component ----------------
export default function VariantModal({
  open,
  onClose,
  product,
  variants = [],
  onConfirm,
  mode = 'cart',
}: VariantModalProps) {
  const [selectedVariant, setSelectedVariant] = useState<any>(null);
  const [quantity, setQuantity] = useState<number>(1);

  // ✅ CHỌN BIẾN THỂ RẺ NHẤT (còn hàng) ĐỂ RENDER NGAY
  const defaultVariant = useMemo(() => {
    if (!Array.isArray(variants) || variants.length === 0) return null;
    let best = variants[0],
      bestPrice = Infinity;
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

  // ✅ Biến thể hiệu lực
  const effectiveVariant = selectedVariant || defaultVariant;

  // ✅ Khi modal mở → sync state để tránh 0đ
  useEffect(() => {
    if (open && defaultVariant && !selectedVariant) {
      setSelectedVariant(defaultVariant);
    }
  }, [open, defaultVariant, selectedVariant]);

  // ✅ Giá/Ảnh theo biến thể hiệu lực
  const currentPrice = useMemo(() => {
    if (Array.isArray(variants) && variants.length > 0) {
      return pickPrice(product, effectiveVariant);
    }
    return pickPrice(product);
  }, [product, variants, effectiveVariant]);

  const currentImage = useMemo(() => {
    const variantImages = getImages(effectiveVariant);
    const productImages = getImages(product);
    return variantImages[0] || productImages[0] || '/icon.png';
  }, [effectiveVariant, product]);

  // STEP: Quantity change
  const handleQuantityChange = (delta: number) => {
    setQuantity((prev) => Math.max(1, prev + delta));
  };

  // STEP: Confirm action
const handleConfirm = () => {
  if (!effectiveVariant && variants.length > 0) {
    alert('Vui lòng chọn phân loại sản phẩm');
    return;
  }

  // ✅ BỔ SUNG TRỌNG LƯỢNG THỰC (GRAM) TRƯỚC KHI ĐẨY RA NGOÀI
  const chosen = effectiveVariant || product;
  const w = Number(
    chosen?.weight_gram ??
    chosen?.weight_grams ??
    chosen?.weight ??
    chosen?.variant?.weight_gram ??
    0
  );

  const chosenWithWeight = {
    ...chosen,
    weight_gram: w,
    weight_grams: w,
    weight: w,
  };

  onConfirm?.(chosenWithWeight, quantity, mode);
  onClose?.();
};

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[999] flex items-end justify-center bg-black/50 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl bg-white rounded-t-3xl shadow-2xl animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors"
          aria-label="Đóng"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="currentColor"
            className="w-5 h-5"
          >
            <path
              fillRule="evenodd"
              d="M5.47 5.47a.75.75 0 011.06 0L12 10.94l5.47-5.47a.75.75 0 111.06 1.06L13.06 12l5.47 5.47a.75.75 0 11-1.06 1.06L12 13.06l-5.47 5.47a.75.75 0 01-1.06-1.06L10.94 12 5.47 6.53a.75.75 0 010-1.06z"
              clipRule="evenodd"
            />
          </svg>
        </button>

        {/* Header */}
        <div className="p-4 border-b flex gap-3">
          <img
            src={currentImage}
            alt={product?.name}
            className="w-20 h-20 object-cover rounded-lg border border-gray-200 bg-gray-50"
          />

          <div className="flex-1">
            <h3 className="font-semibold text-base line-clamp-2 mb-2">
              {product?.name || 'Sản phẩm'}
            </h3>

            {/* ✅ Giá theo biến thể hiệu lực */}
            <div className="flex items-baseline gap-2">
              <span className="text-rose-600 font-bold text-xl">
                {formatPrice(currentPrice.base)}
              </span>

              {currentPrice.original &&
                currentPrice.original > currentPrice.base && (
                  <span className="text-gray-400 line-through text-sm">
                    {formatPrice(currentPrice.original)}
                  </span>
                )}
            </div>

            {/* ✅ Thông tin đã chọn / kho */}
            {effectiveVariant && (
              <p className="text-xs text-gray-500 mt-1">
                Đã chọn:{' '}
                {effectiveVariant.name ||
                  effectiveVariant.sku ||
                  'Phân loại'}{' '}
                • Kho:{' '}
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
                          ? 'border-rose-500 bg-rose-50 shadow-md'
                          : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                      }
                      ${outOfStock ? 'opacity-50 cursor-not-allowed' : ''
