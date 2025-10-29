import React, { useState, useEffect, useMemo } from 'react';

// Helper functions
function formatPrice(price) {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(price);
}

function pickPrice(product: any, variant?: any) {
  if (variant) {
    const sale = Number(variant.sale_price ?? variant.price_sale ?? 0);
    const price = Number(variant.price ?? 0);
    const base = sale > 0 ? sale : (price > 0 ? price : 0);
    const original = (sale > 0 && price > sale) ? price : null;
    return { base, original };
  }
  const pSale = Number(product?.sale_price ?? product?.price_sale ?? 0);
  const pPrice = Number(product?.price ?? 0);
  const base = pSale > 0 ? pSale : (pPrice > 0 ? pPrice : 0);
  const original = (pSale > 0 && pPrice > pSale) ? pPrice : null;
  return { base, original };
}

function getImages(item) {
  const imgs = [];
  if (Array.isArray(item?.images)) imgs.push(...item.images);
  if (item?.image) imgs.unshift(item.image);
  return imgs.filter(Boolean);
}

interface VariantModalProps {
  open: boolean;
  onClose?: () => void;
  product: any;
  variants?: any[];
  onConfirm?: (variant: any, qty: number, mode: string) => void;
  mode?: string; // 'cart' | 'buy'
}

export default function VariantModal({
  open,
  onClose,
  product,
  variants = [],
  onConfirm,
  mode = 'cart', // 'cart' or 'buy'
}: VariantModalProps) {

  const [selectedVariant, setSelectedVariant] = useState<any>(null);
const [quantity, setQuantity] = useState<number>(1);

  // Auto-select first variant or cheapest variant
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
    return selectedVariant ? pickPrice(product, selectedVariant) : pickPrice(product, null as any);
  }, [product, selectedVariant]);
  
  const currentImage = useMemo(() => {
    const variantImages = getImages(selectedVariant);
    const productImages = getImages(product);
    return variantImages[0] || productImages[0] || '/icon.png';
  }, [selectedVariant, product]);
  
  const handleQuantityChange = (delta: number) => {
    setQuantity(prev => Math.max(1, prev + delta));
  };
  
  
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
    <div 
      className="fixed inset-0 z-[999] flex items-end justify-center bg-black/50 animate-fade-in"
      onClick={onClose}
    >
      <div 
        className="w-full max-w-2xl bg-white rounded-t-3xl shadow-2xl animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors"
          aria-label="Đóng"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
            <path fillRule="evenodd" d="M5.47 5.47a.75.75 0 011.06 0L12 10.94l5.47-5.47a.75.75 0 111.06 1.06L13.06 12l5.47 5.47a.75.75 0 11-1.06 1.06L12 13.06l-5.47 5.47a.75.75 0 01-1.06-1.06L10.94 12 5.47 6.53a.75.75 0 010-1.06z" clipRule="evenodd" />
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
            
            <div className="flex items-baseline gap-2">
              <span className="text-rose-600 font-bold text-xl">
                {formatPrice(currentPrice.base)}
              </span>
              
              {currentPrice.original && currentPrice.original > currentPrice.base && (
                <span className="text-gray-400 line-through text-sm">
                  {formatPrice(currentPrice.original)}
                </span>
              )}
            </div>
            
            {selectedVariant && (
              <p className="text-xs text-gray-500 mt-1">
                Đã chọn: {selectedVariant.name || selectedVariant.sku || 'Phân loại'}
              </p>
            )}
          </div>
        </div>
        
        {/* Variants */}
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
                    className={`
                      relative flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all
                      ${isSelected 
                        ? 'border-rose-500 bg-rose-50 shadow-md' 
                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                      }
                    `}
                  >
                    {image && (
                      <img
                        src={image}
                        alt={variant.name}
                        className="w-16 h-16 object-cover rounded-lg"
                      />
                    )}
                    
                    <div className="text-center w-full">
                      <p className={`text-xs font-medium line-clamp-2 ${isSelected ? 'text-rose-600' : 'text-gray-700'}`}>
                        {variant.name || variant.sku || `Loại ${index + 1}`}
                      </p>
                      
                      {price.base > 0 && (
                        <p className={`text-xs mt-1 font-semibold ${isSelected ? 'text-rose-600' : 'text-gray-500'}`}>
                          {formatPrice(price.base)}
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
        
        {/* Quantity */}
        <div className="p-4 border-b">
          <div className="flex items-center justify-between">
            <span className="font-medium text-sm text-gray-700">Số lượng</span>
            
            <div className="flex items-center gap-3">
              <button
                onClick={() => handleQuantityChange(-1)}
                disabled={quantity <= 1}
                className="w-8 h-8 rounded-lg border-2 border-gray-300 hover:border-rose-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors flex items-center justify-center font-bold text-gray-600"
              >
                −
              </button>
              
              <input
                type="number"
                min="1"
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-16 h-8 text-center border-2 border-gray-300 rounded-lg font-medium focus:border-rose-500 focus:outline-none"
              />
              
              <button
                onClick={() => handleQuantityChange(1)}
                className="w-8 h-8 rounded-lg border-2 border-gray-300 hover:border-rose-500 transition-colors flex items-center justify-center font-bold text-gray-600"
              >
                +
              </button>
            </div>
          </div>
        </div>
        
        {/* Actions */}
        <div className="p-4 flex gap-3">
          {mode === 'cart' ? (
            <>
              <button
                onClick={() => {
                  handleConfirm();
                }}
                className="flex-1 py-3 bg-rose-50 border-2 border-rose-500 text-rose-600 rounded-xl font-bold hover:bg-rose-100 transition-all active:scale-95"
              >
                Thêm vào giỏ
              </button>
              
              <button
                onClick={() => {
                  onConfirm?.(selectedVariant || product, quantity, 'buy');
                  onClose?.();
                }}
                className="flex-1 py-3 bg-rose-500 text-white rounded-xl font-bold hover:bg-rose-600 transition-all active:scale-95 shadow-lg shadow-rose-500/30"
              >
                Mua ngay
              </button>
            </>
          ) : (
            <button
              onClick={handleConfirm}
              className="w-full py-3 bg-rose-500 text-white rounded-xl font-bold hover:bg-rose-600 transition-all active:scale-95 shadow-lg shadow-rose-500/30"
            >
              Xác nhận
            </button>
          )}
        </div>
        
        {/* Safe area padding */}
        <div className="h-[env(safe-area-inset-bottom,0px)]" />
      </div>
      
      <style >{`
        @keyframes fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        
        @keyframes slide-up {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
        
        .animate-fade-in {
          animation: fade-in 0.2s ease-out;
        }
        
        .animate-slide-up {
          animation: slide-up 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}

// Demo
function Demo() {
  const [open, setOpen] = React.useState(false);
  
  const demoProduct = {
    name: 'iPhone 15 Pro Max',
    image: 'https://via.placeholder.com/300',
    price: 29990000,
    sale_price: 27990000
  };
  
  const demoVariants = [
    { id: 1, name: '128GB - Titan Tự nhiên', price: 27990000, image: 'https://via.placeholder.com/100/blue' },
    { id: 2, name: '256GB - Titan Tự nhiên', price: 31990000, image: 'https://via.placeholder.com/100/gray' },
    { id: 3, name: '512GB - Titan Tự nhiên', price: 37990000, image: 'https://via.placeholder.com/100/black' },
    { id: 4, name: '128GB - Titan Trắng', price: 27990000, image: 'https://via.placeholder.com/100/white' },
    { id: 5, name: '256GB - Titan Trắng', price: 31990000, image: 'https://via.placeholder.com/100/silver' },
    { id: 6, name: '512GB - Titan Trắng', price: 37990000, image: 'https://via.placeholder.com/100/platinum' },
  ];
  
  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <div className="max-w-md mx-auto bg-white rounded-xl p-6">
        <h1 className="text-xl font-bold mb-4">Variant Modal Demo</h1>
        
        <button
          onClick={() => setOpen(true)}
          className="w-full py-3 bg-rose-500 text-white rounded-xl font-bold"
        >
          Mở Modal
        </button>
        
        <VariantModal
          open={open}
          onClose={() => setOpen(false)}
          product={demoProduct}
          variants={demoVariants}
          onConfirm={(variant, qty, mode) => {
            console.log('Selected:', variant, 'Qty:', qty, 'Mode:', mode);
            alert(`Added ${qty}x ${variant.name} - Mode: ${mode}`);
          }}
          mode="cart"
        />
      </div>
    </div>
  );
}