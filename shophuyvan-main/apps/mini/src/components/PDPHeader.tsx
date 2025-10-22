import React, { useState, useEffect } from 'react';

// Cart badge hook with realtime sync
function useCartCount() {
  const [count, setCount] = useState(0);
  
  useEffect(() => {
    const updateCount = () => {
      try {
        const raw = localStorage.getItem('cart') || localStorage.getItem('shv_cart_v1');
        if (!raw) { setCount(0); return; }
        
        const data = JSON.parse(raw);
        let total = 0;
        
        if (Array.isArray(data)) {
          total = data.reduce((s, item) => s + (Number(item.qty) || 1), 0);
        } else if (data?.lines && Array.isArray(data.lines)) {
          total = data.lines.reduce((s, item) => s + (Number(item.qty) || 1), 0);
        }
        
        setCount(total);
      } catch (e) {
        console.error('[CartBadge] Count error:', e);
        setCount(0);
      }
    };
    
    updateCount();
    
    // Listen to cart changes
    window.addEventListener('storage', updateCount);
    window.addEventListener('shv:cart-changed', updateCount);
    
    // Poll every 2s for cross-tab sync
    const interval = setInterval(updateCount, 2000);
    
    return () => {
      window.removeEventListener('storage', updateCount);
      window.removeEventListener('shv:cart-changed', updateCount);
      clearInterval(interval);
    };
  }, []);
  
  return count;
}

export default function PDPHeader({ 
  productName = 'Sản phẩm',
  onBack,
  cartUrl = '/cart.html',
  zaloShareUrl,
  fbShareUrl
}) {
  const cartCount = useCartCount();
  const [shareOpen, setShareOpen] = useState(false);
  
  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      try { window.history.back(); } catch {}
    }
  };
  
  const handleShare = (type) => {
    const url = encodeURIComponent(window.location.href);
    const title = encodeURIComponent(productName);
    
    if (type === 'zalo') {
      const shareUrl = zaloShareUrl || `https://zalo.me/share?url=${url}&title=${title}`;
      window.open(shareUrl, '_blank');
    } else if (type === 'facebook') {
      const shareUrl = fbShareUrl || `https://www.facebook.com/sharer/sharer.php?u=${url}`;
      window.open(shareUrl, '_blank');
    }
    
    setShareOpen(false);
  };
  
  return (
    <div className="fixed top-0 left-0 right-0 z-50">
      {/* Transparent overlay for header */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/20 to-transparent pointer-events-none" />
      
      {/* Header buttons */}
      <div className="relative flex items-center justify-between p-3">
        {/* Back button */}
        <button
          onClick={handleBack}
          className="w-10 h-10 rounded-full bg-black/40 backdrop-blur-sm text-white flex items-center justify-center hover:bg-black/60 transition-colors"
          aria-label="Quay lại"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
            <path fillRule="evenodd" d="M15.75 19.5a.75.75 0 0 1-1.06 0l-7.5-7.5a.75.75 0 0 1 0-1.06l7.5-7.5a.75.75 0 1 1 1.06 1.06L9.06 11.25l6.69 6.69a.75.75 0 0 1 0 1.06z" clipRule="evenodd" />
          </svg>
        </button>
        
        {/* Right buttons */}
        <div className="flex items-center gap-2">
          {/* Share button */}
          <div className="relative">
            <button
              onClick={() => setShareOpen(!shareOpen)}
              className="w-10 h-10 rounded-full bg-black/40 backdrop-blur-sm text-white flex items-center justify-center hover:bg-black/60 transition-colors"
              aria-label="Chia sẻ"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                <path fillRule="evenodd" d="M15.75 4.5a3 3 0 1 1 .825 2.066l-8.421 4.679a3.002 3.002 0 0 1 0 1.51l8.421 4.679a3 3 0 1 1-.729 1.31l-8.421-4.678a3 3 0 1 1 0-4.132l8.421-4.679a3 3 0 0 1-.096-.755Z" clipRule="evenodd" />
              </svg>
            </button>
            
            {/* Share dropdown */}
            {shareOpen && (
              <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-xl border overflow-hidden">
                <button
                  onClick={() => handleShare('zalo')}
                  className="w-full text-left px-4 py-3 hover:bg-gray-50 flex items-center gap-3 text-sm transition-colors"
                >
                  <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white font-bold text-xs">
                    Z
                  </div>
                  <span className="font-medium">Chia sẻ Zalo</span>
                </button>
                
                <button
                  onClick={() => handleShare('facebook')}
                  className="w-full text-left px-4 py-3 hover:bg-gray-50 flex items-center gap-3 text-sm border-t transition-colors"
                >
                  <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-xs">
                    f
                  </div>
                  <span className="font-medium">Chia sẻ Facebook</span>
                </button>
              </div>
            )}
          </div>
          
          {/* Cart button with badge */}
          <a
            href={cartUrl}
            className="w-10 h-10 rounded-full bg-black/40 backdrop-blur-sm text-white flex items-center justify-center hover:bg-black/60 transition-colors relative"
            aria-label="Giỏ hàng"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
              <path d="M2.25 2.25a.75.75 0 0 0 0 1.5h1.386c.17 0 .318.114.362.278l2.558 9.592a3.752 3.752 0 0 0-2.806 3.63c0 .414.336.75.75.75h15.75a.75.75 0 0 0 0-1.5H5.378A2.25 2.25 0 0 1 7.5 15h11.218a.75.75 0 0 0 .674-.421 60.358 60.358 0 0 0 2.96-7.228.75.75 0 0 0-.525-.965A60.864 60.864 0 0 0 5.68 4.509l-.232-.867A1.875 1.875 0 0 0 3.636 2.25H2.25ZM3.75 20.25a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0ZM16.5 20.25a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0Z" />
            </svg>
            
            {/* Badge */}
            {cartCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1 shadow-lg animate-bounce">
                {cartCount > 99 ? '99+' : cartCount}
              </span>
            )}
          </a>
        </div>
      </div>
    </div>
  );
}