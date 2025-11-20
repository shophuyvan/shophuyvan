// apps/fe/src/pixels.js
// TRACKING: Facebook Pixel, Google Analytics, Tiktok, Zalo...
// ===================================================================

(function(){
  try{
    // Cache buster
    const BUILD = String(Date.now()).substring(0, 8); // Lấy 8 số đầu cho gọn
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

// 👇👇👇 ID PIXEL CỦA BẠN 👇👇👇
const FB_PIXEL_ID = '1974425449800007'; 

(async () => {
  try {
    // 1. Khởi tạo hàm inject script
    const inject = (html) => {
      const el = document.createElement('div'); 
      el.innerHTML = html.trim();
      const node = el.firstChild;
      // Chèn vào đầu <head> để load sớm nhất
      if(document.head.firstChild) {
        document.head.insertBefore(node, document.head.firstChild);
      } else {
        document.head.appendChild(node);
      }
    };

    // 2. Lấy settings bổ sung từ API (nếu có GA, Zalo...)
    let settings = {};
    try {
      const r = await api.get('/public/settings');
      settings = (r && (r.settings || r)) || {};
    } catch (e) { 
      // Lỗi API thì kệ, vẫn chạy FB Pixel cứng
      console.warn('[Pixels] API settings failed, using hardcoded defaults');
    }
    
    const { ga='', zl='' } = settings.ads || {};

    // 3. FACEBOOK PIXEL (Luôn chạy với ID cứng)
    if (FB_PIXEL_ID) {
      console.log('[Pixels] Init FB:', FB_PIXEL_ID);
      
      inject(`<script>
        !function(f,b,e,v,n,t,s)
        {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
        n.callMethod.apply(n,arguments):n.queue.push(arguments)};
        if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
        n.queue=[];t=b.createElement(e);t.async=!0;
        t.src=v;s=b.getElementsByTagName(e)[0];
        s.parentNode.insertBefore(t,s)}(window, document,'script',
        'https://connect.facebook.net/en_US/fbevents.js');
        fbq('init', '${FB_PIXEL_ID}');
        fbq('track', 'PageView');
      </script>
      <noscript><img height="1" width="1" style="display:none"
      src="https://www.facebook.com/tr?id=${FB_PIXEL_ID}&ev=PageView&noscript=1"
      /></noscript>
      `);

      // 4. Tự động bắn event theo URL
      const path = location.pathname;
      
      // Xem sản phẩm
      if (path.includes('/product')) { 
        // Delay xíu để đợi load thông tin SP nếu cần
        setTimeout(() => {
            if(window.fbq) window.fbq('track', 'ViewContent');
        }, 1000);
      }
      
      // Xem giỏ hàng
      if (path.includes('/cart')) { 
        if(window.fbq) window.fbq('track', 'AddToCart'); 
      }
      
      // Mua thành công (Trang cảm ơn)
      if (path.includes('/checkout-success') || path.includes('/order-received')) {
         // Lấy giá trị đơn hàng từ URL nếu có ?total=...
         const params = new URLSearchParams(location.search);
         const val = Number(params.get('total') || 0);
         const curr = 'VND';
         
         if(window.fbq) {
             if(val > 0) {
                 window.fbq('track', 'Purchase', { value: val, currency: curr });
             } else {
                 window.fbq('track', 'Purchase');
             }
         }
      }
    }

    // 5. Google Analytics (Nếu có trong settings)
    if (ga) {
      inject(`<script async src="https://www.googletagmanager.com/gtag/js?id=${ga}"></script>`);
      inject(`<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js', new Date());gtag('config','${ga}');</script>`);
    }

    // 6. Zalo Pixel (Nếu có)
    if (zl) {
      inject(`<script src="https://sp.zalo.me/plugins/sdk.js"></script>`);
    }

  } catch (e) { 
    console.error('[Pixels] Global Error:', e); 
  }
})();