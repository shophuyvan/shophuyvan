import React from 'react';
import { createRoot } from 'react-dom/client';
import 'zmp-ui/zaui.css';
import './styles/tailwind.css';
import App from './app';

const root = createRoot(document.getElementById('root')!);
root.render(<App />);

// ================================================
// SERVICE WORKER REGISTRATION
// ================================================
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => {
        console.log('✅ Service Worker registered successfully:', registration.scope);

        // Kiểm tra updates mỗi 1 giờ
        setInterval(() => {
          registration.update();
        }, 60 * 60 * 1000);

        // Lắng nghe khi có version mới
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                // Có phiên bản mới sẵn sàng
                console.log('🔄 New version available!');
                
                // Hiển thị thông báo cho user
                const shouldUpdate = confirm(
                  'Có phiên bản mới của ứng dụng! Bạn có muốn cập nhật không?'
                );
                
                if (shouldUpdate) {
                  // Yêu cầu SW mới activate ngay
                  newWorker.postMessage({ type: 'SKIP_WAITING' });
                  
                  // Reload trang sau khi SW mới activated
                  window.location.reload();
                }
              }
            });
          }
        });
      })
      .catch((error) => {
        console.error('❌ Service Worker registration failed:', error);
      });

    // Lắng nghe khi SW được activated
    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    });
  });
}

// ================================================
// ONLINE/OFFLINE DETECTION
// ================================================
window.addEventListener('online', () => {
  console.log('🟢 Back online');
  
  // Hiển thị toast (nếu có UI library hỗ trợ)
  // Hoặc có thể dùng native notification
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification('Đã kết nối internet', {
      body: 'Bạn đã online trở lại',
      icon: '/icon.png',
    });
  }
  
  // Trigger background sync nếu có pending orders
  if ('serviceWorker' in navigator && 'sync' in ServiceWorkerRegistration.prototype) {
    navigator.serviceWorker.ready.then((registration) => {
      return registration.sync.register('sync-orders');
    }).catch((err) => {
      console.error('Background sync registration failed:', err);
    });
  }
});

window.addEventListener('offline', () => {
  console.log('🔴 Offline mode');
  
  // Hiển thị banner hoặc toast
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification('Mất kết nối internet', {
      body: 'Bạn đang ở chế độ offline',
      icon: '/icon.png',
    });
  }
});

// ================================================
// REQUEST NOTIFICATION PERMISSION (Optional)
// ================================================
if ('Notification' in window && Notification.permission === 'default') {
  // Hỏi quyền notification sau 5 giây (không làm phiền ngay lập tức)
  setTimeout(() => {
    Notification.requestPermission().then((permission) => {
      if (permission === 'granted') {
        console.log('✅ Notification permission granted');
      }
    });
  }, 5000);
}

// ================================================
// PERFORMANCE MONITORING (Optional)
// ================================================
if (import.meta.env.PROD) {
  // Log performance metrics
  window.addEventListener('load', () => {
    setTimeout(() => {
      const perfData = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      
      if (perfData) {
        console.log('📊 Performance Metrics:', {
          'DNS Lookup': `${Math.round(perfData.domainLookupEnd - perfData.domainLookupStart)}ms`,
          'TCP Connection': `${Math.round(perfData.connectEnd - perfData.connectStart)}ms`,
          'Request Time': `${Math.round(perfData.responseStart - perfData.requestStart)}ms`,
          'Response Time': `${Math.round(perfData.responseEnd - perfData.responseStart)}ms`,
          'DOM Processing': `${Math.round(perfData.domComplete - perfData.domInteractive)}ms`,
          'Load Complete': `${Math.round(perfData.loadEventEnd - perfData.fetchStart)}ms`,
        });
        
        // Gửi metrics lên analytics (nếu cần)
        // sendAnalytics('performance', metrics);
      }
    }, 0);
  });
}

// ================================================
// ERROR TRACKING (Optional)
// ================================================
if (import.meta.env.PROD) {
  window.addEventListener('error', (event) => {
    console.error('🔴 Global Error:', {
      message: event.message,
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
      error: event.error,
    });
    
    // Gửi lên error tracking service (Sentry, LogRocket, etc.)
    // trackError(event);
  });

  window.addEventListener('unhandledrejection', (event) => {
    console.error('🔴 Unhandled Promise Rejection:', event.reason);
    
    // Track promise rejections
    // trackError(event.reason);
  });
}