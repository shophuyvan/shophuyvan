
import api from './lib/api.js';

(async () => {
  try {
    const r = await api.get('/public/settings');
    const s = (r && (r.settings||r)) || {}; if(!s.ads) return;
    const { fb='', ga='', zl='' } = s.ads;
    const url = location.pathname;
    // helper to inject a script
    const inject = (html) => {
      const el = document.createElement('div'); el.innerHTML = html.trim();
      const node = el.firstChild;
      document.head.appendChild(node);
    };
    // Facebook Pixel
    if (fb) {
      inject(`<!-- Facebook Pixel Code -->
      <script>
        !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
        n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
        n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
        t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window, document,'script',
        'https://connect.facebook.net/en_US/fbevents.js');
        fbq('init','${fb}'); fbq('track','PageView');
      </script>`);
      if (url.includes('/product')) { inject(`<script>fbq('track','ViewContent');</script>`); }
      if (url.includes('/cart')) { inject(`<script>fbq('track','AddToCart');</script>`); }
      if (url.includes('/checkout-success')) { inject(`<script>fbq('track','Purchase');</script>`); }
      inject(`<noscript><img height="1" width="1" style="display:none" src="https://www.facebook.com/tr?id=${fb}&ev=PageView&noscript=1"/></noscript>`);
    }
    // Google Analytics (gtag)
    if (ga) {
      inject(`<script async src="https://www.googletagmanager.com/gtag/js?id=${ga}"></script>`);
      inject(`<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js', new Date());gtag('config','${ga}');</script>`);
    }
    // Zalo pixel (basic)
    if (zl) {
      inject(`<script src="https://sp.zalo.me/plugins/sdk.js"></script>`);
    }
  } catch (e) { console.warn('pixels err', e); }
})();
