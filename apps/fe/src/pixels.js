// apps/fe/src/pixels.js
// TRACKING: Facebook Pixel, Google Analytics, Tiktok, Zalo...
// ===================================================================

(function(){
  try{
    // Cache buster cho UI PDP
    const BUILD = String(Date.now()).substring(0, 8);
    const tag = document.querySelector('script[type="module"][src*="/src/ui-pdp.js"]');
    if(tag){
      const u = new URL(tag.getAttribute('src'), location.origin);
      if(!u.searchParams.has('v')){
        u.searchParams.set('v', BUILD);
        tag.setAttribute('src', u.pathname + '?' + u.searchParams.toString());
      }
    }
  }catch(e){}
})();

import api from './lib/api.js';

// 👇 ID PIXEL CỦA BẠN
const FB_PIXEL_ID = '1974425449800007'; 

(async () => {
  try {
    // 1. Khởi tạo hàm inject script
    const inject = (html) => {
      const el = document.createElement('div'); 
      el.innerHTML = html.trim();
      const node = el.firstChild;
      if(document.head.firstChild) {
        document.head.insertBefore(node, document.head.firstChild);
      } else {
        document.head.appendChild(node);
      }
    };

    // 2. Lấy settings bổ sung từ API (GA, Zalo)
    let settings = {};
    try {
      const r = await api.get('/public/settings');
      settings = (r && (r.settings || r)) || {};
    } catch (e) { 
      console.warn('[Pixels] API settings failed, using defaults');
    }
    
    const { ga='', zl='' } = settings.ads || {};

    // ============================================================
    // 3. FACEBOOK PIXEL (CORE)
    // ============================================================
    if (FB_PIXEL_ID) {
      console.log('[Pixels] Init FB:', FB_PIXEL_ID);
      
      // --- KHỞI TẠO PIXEL CHUẨN (Chạy trực tiếp JS) ---
      if(!window.fbq) {
        let n = window.fbq = function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};
        if(!window._fbq) window._fbq = n;
        n.push = n; n.loaded = !0; n.version = '2.0'; n.queue = [];
        
        let t = document.createElement('script'); 
        t.async = !0; t.src = 'https://connect.facebook.net/en_US/fbevents.js';
        let s = document.getElementsByTagName('script')[0];
        s.parentNode.insertBefore(t, s);
      }

      // Kích hoạt PageView ngay lập tức
      console.log('[Pixel] Force Init & Track:', FB_PIXEL_ID);
      window.fbq('init', FB_PIXEL_ID);
      window.fbq('track', 'PageView');

      // --- A. TRACKING THEO URL (Cơ bản) ---
      const path = location.pathname;
      
      if (path.includes('/product')) { 
        setTimeout(() => { if(window.fbq) window.fbq('track', 'ViewContent'); }, 1000);
      }
      if (path.includes('/cart')) { 
        if(window.fbq) window.fbq('track', 'AddToCart'); 
      }
      if (path.includes('/checkout-success') || path.includes('/order-received')) {
         const params = new URLSearchParams(location.search);
         const val = Number(params.get('total') || 0);
         if(window.fbq) window.fbq('track', 'Purchase', { value: val, currency: 'VND' });
      }

      // --- B. TRACKING THEO HÀNH VI CLICK (Nâng cao - Mới thêm) ---
      // Bắt sự kiện khi bấm nút Thêm giỏ / Mua ngay
      document.addEventListener('click', (e) => {
        // Tìm nút được bấm (hoặc cha của nó)
        const btn = e.target.closest('button, a, .btn, [role="button"]'); 
        if (!btn) return;

        const text = (btn.innerText || '').toLowerCase();
        const id = (btn.id || '').toLowerCase();
        const href = (btn.getAttribute('href') || '').toLowerCase();

        // Logic nhận diện nút
        const isAddToCart = text.includes('thêm') && (text.includes('giỏ') || text.includes('cart')) || id.includes('add-to-cart');
        const isBuyNow = text.includes('mua ngay') || text.includes('thanh toán') || href.includes('checkout');

        if (isAddToCart && window.fbq) {
            console.log('[Pixels] Track Click: AddToCart');
            window.fbq('track', 'AddToCart');
        }

        if (isBuyNow && window.fbq) {
            console.log('[Pixels] Track Click: InitiateCheckout');
            window.fbq('track', 'InitiateCheckout');
        }
      });
    }

    // 4. Google Analytics
    if (ga) {
      inject(`<script async src="https://www.googletagmanager.com/gtag/js?id=${ga}"></script>`);
      inject(`<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js', new Date());gtag('config','${ga}');</script>`);
    }

    // 5. Zalo Pixel
    if (zl) {
      inject(`<script src="https://sp.zalo.me/plugins/sdk.js"></script>`);
    }

  } catch (e) { 
    console.error('[Pixels] Global Error:', e); 
  }
})();