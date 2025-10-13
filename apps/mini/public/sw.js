// ================================================
// SERVICE WORKER - Shop Huy Vân Mini App
// Đặt file này vào: apps/mini/public/sw.js
// ================================================

const CACHE_VERSION = 'shv-v1.0.0';
const STATIC_CACHE = `static-${CACHE_VERSION}`;
const DYNAMIC_CACHE = `dynamic-${CACHE_VERSION}`;
const IMAGE_CACHE = `images-${CACHE_VERSION}`;

// Files cần cache ngay (critical)
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/icon.png',
  '/manifest.json',
];

// Cloudinary domain
const IMAGE_DOMAINS = [
  'res.cloudinary.com',
  'dtemskptf.cloudinary.com',
];

// API endpoints cần cache
const API_PATTERNS = {
  '/v1/products': 'network-first',
  '/v1/platform/areas': 'cache-first',
};

// ================================================
// INSTALL
// ================================================
self.addEventListener('install', (event) => {
  console.log('[SW] Installing...', CACHE_VERSION);
  
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => {
        console.log('[SW] Precaching assets');
        return cache.addAll(PRECACHE_URLS);
      })
      .then(() => self.skipWaiting())
      .catch(err => console.error('[SW] Install failed:', err))
  );
});

// ================================================
// ACTIVATE
// ================================================
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating...', CACHE_VERSION);
  
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName.startsWith('static-') && cacheName !== STATIC_CACHE) {
              console.log('[SW] Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
            if (cacheName.startsWith('dynamic-') && cacheName !== DYNAMIC_CACHE) {
              return caches.delete(cacheName);
            }
            if (cacheName.startsWith('images-') && cacheName !== IMAGE_CACHE) {
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => self.clients.claim())
      .catch(err => console.error('[SW] Activate failed:', err))
  );
});

// ================================================
// FETCH - Request Interceptor
// ================================================
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Bỏ qua non-http requests
  if (!url.protocol.startsWith('http')) {
    return;
  }

  // Strategy 1: Images - Cache First
  if (request.destination === 'image' || isImageDomain(url.hostname)) {
    event.respondWith(handleImageRequest(request));
    return;
  }

  // Strategy 2: API - Network First hoặc Cache First
  if (isAPIRequest(url.pathname)) {
    const strategy = getAPIStrategy(url.pathname);
    
    if (strategy === 'cache-first') {
      event.respondWith(handleCacheFirst(request, DYNAMIC_CACHE));
    } else {
      event.respondWith(handleNetworkFirst(request, DYNAMIC_CACHE));
    }
    return;
  }

  // Strategy 3: Navigation - Network First
  if (request.mode === 'navigate') {
    event.respondWith(handleNavigationRequest(request));
    return;
  }

  // Strategy 4: Static assets - Cache First
  event.respondWith(handleCacheFirst(request, STATIC_CACHE));
});

// ================================================
// CACHING STRATEGIES
// ================================================

/**
 * Cache First - Ưu tiên cache
 */
async function handleCacheFirst(request, cacheName) {
  try {
    const cached = await caches.match(request);
    
    if (cached) {
      // Tìm thấy trong cache
      return cached;
    }

    // Không có cache, fetch từ network
    const response = await fetch(request);
    
    if (response && response.status === 200) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    
    return response;
  } catch (error) {
    console.error('[SW] Cache first failed:', request.url, error);
    
    // Fallback: offline page
    if (request.destination === 'document') {
      const offlineCache = await caches.match('/offline.html');
      if (offlineCache) return offlineCache;
    }
    
    throw error;
  }
}

/**
 * Network First - Ưu tiên network
 */
async function handleNetworkFirst(request, cacheName, timeout = 3000) {
  try {
    // Thử fetch từ network với timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    const response = await fetch(request, { signal: controller.signal });
    clearTimeout(timeoutId);
    
    // Cache response thành công
    if (response && response.status === 200) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    
    return response;
  } catch (error) {
    console.warn('[SW] Network failed, using cache:', request.url);
    
    // Fallback to cache
    const cached = await caches.match(request);
    if (cached) {
      return cached;
    }
    
    throw error;
  }
}

/**
 * Stale While Revalidate - Cho images
 */
async function handleImageRequest(request) {
  const cached = await caches.match(request);
  
  // Fetch mới trong background
  const fetchPromise = fetch(request)
    .then((response) => {
      if (response && response.status === 200) {
        caches.open(IMAGE_CACHE).then(cache => {
          cache.put(request, response.clone());
        });
      }
      return response;
    })
    .catch(() => cached); // Fallback to cache on error

  // Return cache ngay nếu có, không thì đợi fetch
  return cached || fetchPromise;
}

/**
 * Navigation Request Handler
 */
async function handleNavigationRequest(request) {
  try {
    const response = await fetch(request);
    
    if (response && response.status === 200) {
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, response.clone());
    }
    
    return response;
  } catch (error) {
    console.error('[SW] Navigation failed:', request.url);
    
    // Try cache
    const cached = await caches.match(request);
    if (cached) return cached;
    
    // Fallback to offline page
    const offlinePage = await caches.match('/offline.html');
    if (offlinePage) return offlinePage;
    
    // Last resort
    return caches.match('/index.html');
  }
}

// ================================================
// HELPERS
// ================================================

function isImageDomain(hostname) {
  return IMAGE_DOMAINS.some(domain => hostname.includes(domain));
}

function isAPIRequest(pathname) {
  return pathname.startsWith('/v1/') || 
         pathname.startsWith('/api/') ||
         pathname.includes('shv-api.shophuyvan.workers.dev');
}

function getAPIStrategy(pathname) {
  for (const [pattern, strategy] of Object.entries(API_PATTERNS)) {
    if (pathname.includes(pattern)) {
      return strategy;
    }
  }
  return 'network-first'; // Default
}

// ================================================
// BACKGROUND SYNC (Optional)
// ================================================
self.addEventListener('sync', (event) => {
  console.log('[SW] Background sync:', event.tag);
  
  if (event.tag === 'sync-orders') {
    event.waitUntil(syncOrders());
  }
});

async function syncOrders() {
  try {
    // Lấy orders từ localStorage (vì IndexedDB phức tạp hơn)
    const pendingOrders = JSON.parse(localStorage.getItem('pending_orders') || '[]');
    
    for (const order of pendingOrders) {
      try {
        const response = await fetch('https://shv-api.shophuyvan.workers.dev/v1/platform/orders/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(order)
        });
        
        if (response.ok) {
          // Xóa order đã sync thành công
          const remaining = pendingOrders.filter(o => o.id !== order.id);
          localStorage.setItem('pending_orders', JSON.stringify(remaining));
        }
      } catch (err) {
        console.error('[SW] Failed to sync order:', order.id, err);
      }
    }
  } catch (error) {
    console.error('[SW] Background sync failed:', error);
  }
}

// ================================================
// MESSAGE HANDLER
// ================================================
self.addEventListener('message', (event) => {
  console.log('[SW] Message received:', event.data);
  
  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data.type === 'CLEAR_CACHE') {
    event.waitUntil(
      caches.keys().then(keys => {
        return Promise.all(keys.map(key => caches.delete(key)));
      })
    );
  }
  
  if (event.data.type === 'CACHE_URLS') {
    event.waitUntil(
      caches.open(DYNAMIC_CACHE).then(cache => {
        return cache.addAll(event.data.urls);
      })
    );
  }
});

// ================================================
// PUSH NOTIFICATIONS (Optional - cho Zalo Mini App)
// ================================================
self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {};
  
  const options = {
    body: data.body || 'Bạn có thông báo mới từ Shop Huy Vân',
    icon: '/icon.png',
    badge: '/icon.png',
    data: data.url || '/',
  };

  event.waitUntil(
    self.registration.showNotification(
      data.title || 'Shop Huy Vân', 
      options
    )
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  event.waitUntil(
    clients.openWindow(event.notification.data)
  );
});

console.log('[SW] Service Worker loaded:', CACHE_VERSION);