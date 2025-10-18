import React, { useEffect, useMemo, useState, useRef } from 'react';
import { api } from '@shared/api';
import { fmtVND } from '@shared/utils/fmtVND';
import { pickPrice, priceRange } from '@shared/utils/price';
import { renderDescription } from '@shared/utils/md';
import { cldFetch } from '@shared/utils/cloudinary';
import cart from '@shared/cart';
import { routes } from '../routes';

// Cart count hook
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

// Variant Modal Component
function VariantModal({ open, onClose, product, variants = [], onConfirm, mode = 'cart' }) {
  const [selectedVariant, setSelectedVariant] = useState(null);
  const [quantity, setQuantity] = useState(1);
  
  useEffect(() => {
    if (variants.length > 0 && !selectedVariant) {
      let best = variants[0];
      let bestPrice = Infinity;
      
      variants.forEach(v => {
        const price = pickPrice(product, v);
        if (price.base > 0 && price.base < bestPrice) {
          best = v;
          bestPrice = price.base;
        }
      });
      
      setSelectedVariant(best);
    }
  }, [variants, selectedVariant, product]);
  
  const currentPrice = useMemo(() => {
    return selectedVariant ? pickPrice(product, selectedVariant) : pickPrice(product);
  }, [product, selectedVariant]);
  
  const getImages = (item) => {
    const imgs = [];
    if (Array.isArray(item?.images)) imgs.push(...item.images);
    if (item?.image) imgs.unshift(item.image);
    return imgs.filter(Boolean);
  };
  
  const currentImage = getImages(selectedVariant)[0] || getImages(product)[0] || '/icon.png';
  
  const handleConfirm = () => {
    if (!selectedVariant && variants.length > 0) {
      alert('Vui lòng chọn phân loại sản phẩm');
      return;
    }
    onConfirm?.(selectedVariant || product, quantity, mode);
    onClose?.();
  };
  
  if (!open) return null;
  
  return (
    <div className="fixed inset-0 z-[999] flex items-end justify-center bg-black/50" onClick={onClose}>
      <div className="w-full max-w-2xl bg-white rounded-t-3xl shadow-2xl animate-slide-up" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center"
        >
          ✕
        </button>
        
        <div className="p-4 border-b flex gap-3">
          <img src={currentImage} alt={product?.name} className="w-20 h-20 object-cover rounded-lg border bg-gray-50" />
          <div className="flex-1">
            <h3 className="font-semibold text-base line-clamp-2 mb-2">{product?.name}</h3>
            <div className="flex items-baseline gap-2">
              <span className="text-rose-600 font-bold text-xl">{fmtVND(currentPrice.base)}</span>
              {currentPrice.original && currentPrice.original > currentPrice.base && (
                <span className="text-gray-400 line-through text-sm">{fmtVND(currentPrice.original)}</span>
              )}
            </div>
          </div>
        </div>
        
        {variants.length > 0 && (
          <div className="p-4 border-b max-h-[45vh] overflow-y-auto">
            <h4 className="font-medium text-sm mb-3 text-gray-700">Chọn phân loại</h4>
            <div className="grid grid-cols-3 gap-2">
              {variants.map((variant, index) => {
                const isSelected = selectedVariant === variant;
                const price = pickPrice(product, variant);
                const image = getImages(variant)[0];
                
                return (
                  <button
                    key={index}
                    onClick={() => setSelectedVariant(variant)}
                    className={`relative flex flex-col items-center gap-2 p-3 rounded-xl border-2 ${
                      isSelected ? 'border-rose-500 bg-rose-50' : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    {image && <img src={image} alt={variant.name} className="w-16 h-16 object-cover rounded-lg" />}
                    <div className="text-center w-full">
                      <p className={`text-xs font-medium line-clamp-2 ${isSelected ? 'text-rose-600' : 'text-gray-700'}`}>
                        {variant.name || variant.sku || `Loại ${index + 1}`}
                      </p>
                      {price.base > 0 && (
                        <p className={`text-xs mt-1 font-semibold ${isSelected ? 'text-rose-600' : 'text-gray-500'}`}>
                          {fmtVND(price.base)}
                        </p>
                      )}
                    </div>
                    {isSelected && (
                      <div className="absolute top-2 right-2 w-5 h-5 bg-rose-500 rounded-full flex items-center justify-center">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white" className="w-3 h-3">
                          <path fillRule="evenodd" d="M19.916 4.626a.75.75 0 01.208 1.04l-9 13.5a.75.75 0 01-1.154.114l-6-6a.75.75 0 011.06-1.06l5.353 5.353 8.493-12.739a.75.75 0 011.04-.208z" clipRule="evenodd" />