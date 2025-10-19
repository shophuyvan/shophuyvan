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
                        </svg>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}
        
        <div className="p-4 flex items-center gap-3">
          <div className="flex items-center gap-2 border rounded-lg overflow-hidden">
            <button
              onClick={() => setQuantity(Math.max(1, quantity - 1))}
              className="px-3 py-2 bg-gray-100 hover:bg-gray-200 font-bold"
            >
              −
            </button>
            <input
              type="number"
              value={quantity}
              onChange={(e) => {
                const val = parseInt(e.target.value) || 1;
                setQuantity(Math.max(1, val));
              }}
              className="w-16 text-center border-0 outline-none"
              min="1"
            />
            <button
              onClick={() => setQuantity(quantity + 1)}
              className="px-3 py-2 bg-gray-100 hover:bg-gray-200 font-bold"
            >
              +
            </button>
          </div>
          
          <button
            onClick={handleConfirm}
            className="flex-1 bg-rose-500 hover:bg-rose-600 text-white py-3 rounded-lg font-semibold"
          >
            {mode === 'buy' ? 'Mua ngay' : 'Thêm vào giỏ'}
          </button>
        </div>
      </div>
    </div>
  );
}

// Main Product Component
export default function Product() {
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedImage, setSelectedImage] = useState(0);
  const [showModal, setShowModal] = useState(false);
  const [buyMode, setBuyMode] = useState(false);
  const scrollRef = useRef(null);
  const cartCount = useCartCount();
  
  const productId = useMemo(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      return params.get('id') || '';
    } catch {
      return '';
    }
  }, []);
  
  useEffect(() => {
    if (!productId) {
      setError('Không tìm thấy sản phẩm');
      setLoading(false);
      return;
    }
    
    (async () => {
      try {
        setLoading(true);
        const data = await api.products.detail(productId);
        setProduct(data);
        setError(null);
      } catch (err) {
        console.error('Error loading product:', err);
        setError(err.message || 'Lỗi tải sản phẩm');
      } finally {
        setLoading(false);
      }
    })();
  }, [productId]);
  
  const images = useMemo(() => {
    if (!product) return [];
    const imgs = [];
    if (Array.isArray(product.images)) imgs.push(...product.images);
    if (product.image && !imgs.includes(product.image)) imgs.unshift(product.image);
    return imgs.filter(Boolean);
  }, [product]);
  
  const currentPrice = useMemo(() => {
    if (!product) return { base: 0, original: 0 };
    return priceRange(product);
  }, [product]);
  
  const variants = useMemo(() => {
    if (!product) return [];
    return Array.isArray(product.variants) ? product.variants : [];
  }, [product]);
  
  const hasVariants = variants.length > 0;
  
  const handleAddToCart = (selectedItem, quantity, mode) => {
    try {
      const basePrice = pickPrice(product, selectedItem);
      
      cart.add({
        id: selectedItem?.id || selectedItem?.sku || product?.id || '',
        name: selectedItem?.name || product?.name || '',
        price: basePrice.base,
        image: (selectedItem?.image || product?.image || ''),
        qty: quantity,
        variant: selectedItem !== product ? selectedItem : null
      });
      
      if (mode === 'buy') {
        window.location.href = routes.cart;
      }
    } catch (err) {
      console.error('Error adding to cart:', err);
      alert('Có lỗi khi thêm vào giỏ hàng');
    }
  };
  
  const handleBuyNow = () => {
    if (hasVariants) {
      setBuyMode(true);
      setShowModal(true);
    } else {
      handleAddToCart(product, 1, 'buy');
    }
  };
  
  const handleAddCart = () => {
    if (hasVariants) {
      setBuyMode(false);
      setShowModal(true);
    } else {
      handleAddToCart(product, 1, 'cart');
    }
  };
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-rose-500"></div>
          <p className="mt-4 text-gray-600">Đang tải...</p>
        </div>
      </div>
    );
  }
  
  if (error || !product) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center">
          <div className="text-6xl mb-4">😕</div>
          <h2 className="text-xl font-bold mb-2">Không tìm thấy sản phẩm</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <a href={routes.home} className="inline-block bg-rose-500 text-white px-6 py-2 rounded-lg">
            Về trang chủ
          </a>
        </div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Header */}
      <header className="sticky top-0 z-20 bg-white border-b">
        <div className="flex items-center justify-between px-4 py-3">
          <a href={routes.home} className="p-2 -ml-2">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
              <path fillRule="evenodd" d="M7.28 7.72a.75.75 0 010 1.06l-2.47 2.47H21a.75.75 0 010 1.5H4.81l2.47 2.47a.75.75 0 11-1.06 1.06l-3.75-3.75a.75.75 0 010-1.06l3.75-3.75a.75.75 0 011.06 0z" clipRule="evenodd" />
            </svg>
          </a>
          
          <h1 className="flex-1 text-center font-semibold text-lg line-clamp-1">Chi tiết sản phẩm</h1>
          
          <a href={routes.cart} className="relative p-2 -mr-2">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
              <path d="M2.25 2.25a.75.75 0 000 1.5h1.386c.17 0 .318.114.362.278l2.558 9.592a3.752 3.752 0 00-2.806 3.63c0 .414.336.75.75.75h15.75a.75.75 0 000-1.5H5.378A2.25 2.25 0 017.5 15h11.218a.75.75 0 00.674-.421 60.358 60.358 0 002.96-7.228.75.75 0 00-.525-.965A60.864 60.864 0 005.68 4.509l-.232-.867A1.875 1.875 0 003.636 2.25H2.25zM3.75 20.25a1.5 1.5 0 113 0 1.5 1.5 0 01-3 0zM16.5 20.25a1.5 1.5 0 113 0 1.5 1.5 0 01-3 0z" />
            </svg>
            {cartCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-rose-600 text-white text-xs px-1.5 py-0.5 rounded-full min-w-[20px] text-center">
                {cartCount}
              </span>
            )}
          </a>
        </div>
      </header>
      
      {/* Image Gallery */}
      <div className="bg-white">
        <div className="relative aspect-square">
          <img
            src={cldFetch(images[selectedImage] || '/icon.png', 'w_800,q_auto,f_auto')}
            alt={product.name}
            className="w-full h-full object-contain bg-gray-50"
          />
          <div className="absolute bottom-4 right-4 bg-black/50 text-white px-3 py-1 rounded-full text-sm">
            {selectedImage + 1} / {images.length}
          </div>
        </div>
        
        {images.length > 1 && (
          <div className="flex gap-2 p-3 overflow-x-auto" ref={scrollRef}>
            {images.map((img, idx) => (
              <button
                key={idx}
                onClick={() => setSelectedImage(idx)}
                className={`flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 ${
                  idx === selectedImage ? 'border-rose-500' : 'border-gray-200'
                }`}
              >
                <img src={cldFetch(img, 'w_200,q_auto,f_auto')} alt="" className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        )}
      </div>
      
      {/* Product Info */}
      <div className="bg-white mt-2 p-4">
        <h1 className="text-xl font-bold mb-3">{product.name}</h1>
        
        <div className="flex items-baseline gap-3 mb-4">
          {currentPrice.hasRange ? (
            <span className="text-2xl font-bold text-rose-600">
              {fmtVND(currentPrice.min)} - {fmtVND(currentPrice.max)}
            </span>
          ) : (
            <>
              <span className="text-2xl font-bold text-rose-600">{fmtVND(currentPrice.base)}</span>
              {currentPrice.original && currentPrice.original > currentPrice.base && (
                <>
                  <span className="text-lg text-gray-400 line-through">{fmtVND(currentPrice.original)}</span>
                  <span className="text-sm bg-rose-100 text-rose-600 px-2 py-1 rounded">
                    -{Math.round(((currentPrice.original - currentPrice.base) / currentPrice.original) * 100)}%
                  </span>
                </>
              )}
            </>
          )}
        </div>
        
        {product.shortDesc && (
          <p className="text-gray-600 text-sm leading-relaxed">{product.shortDesc}</p>
        )}
      </div>
      
      {/* Description */}
      {product.description && (
        <div className="bg-white mt-2 p-4">
          <h2 className="font-bold text-lg mb-3">Mô tả sản phẩm</h2>
          <div 
            className="prose prose-sm max-w-none"
            dangerouslySetInnerHTML={{ __html: renderDescription(product.description) }}
          />
        </div>
      )}
      
      {/* Bottom Actions */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t p-4 safe-bottom z-30">
        <div className="flex gap-3">
          <button
            onClick={handleAddCart}
            className="flex-1 border-2 border-rose-500 text-rose-500 py-3 rounded-lg font-semibold hover:bg-rose-50"
          >
            Thêm vào giỏ
          </button>
          <button
            onClick={handleBuyNow}
            className="flex-1 bg-rose-500 text-white py-3 rounded-lg font-semibold hover:bg-rose-600"
          >
            Mua ngay
          </button>
        </div>
      </div>
      
      {/* Variant Modal */}
      <VariantModal
        open={showModal}
        onClose={() => setShowModal(false)}
        product={product}
        variants={variants}
        onConfirm={handleAddToCart}
        mode={buyMode ? 'buy' : 'cart'}
      />
    </div>
  );
}

console.log('✅ Product.tsx loaded');