// ================================================
// SERVICE WORKER - FIXED VERSION
// apps/mini/public/sw.js
// ================================================

const CACHE_VERSION = 'shv-v1.0.3'; // Tăng version
const STATIC_CACHE = `static-${CACHE_VERSION}`;
const DYNAMIC_CACHE = `dynamic-${CACHE_VERSION}`;
const IMAGE_CACHE = `images-${CACHE_VERSION}`;

const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/icon.png',
  '/manifest.json',
];

const IMAGE_DOMAINS = [
  'res.cloudinary.com',
  'dtemskptf.cloudinary.com',
];

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
// FETCH
// ================================================
self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);
    // Bỏ qua mọi request KHÔNG phải GET (POST/PUT/DELETE… không cache)
  if (request.method !== 'GET') return;

  // Bỏ qua API đồng bộ giỏ hàng và các API động khác cần realtime
  if (url.pathname.startsWith('/api/cart/sync')) return;

  // Skip non-http
  if (!url.protocol.startsWith('http')) {
    return;
  }

  // Skip chrome-extension and other protocols
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return;
  }

  // Images
  if (request.destination === 'image' || isImageDomain(url.hostname)) {
    event.respondWith(handleImageRequest(request));
    return;
  }

  // API
  if (isAPIRequest(url.pathname) || isAPIRequest(url.hostname)) {
    const strategy = getAPIStrategy(url.pathname);
    if (strategy === 'cache-first') {
      event.respondWith(handleCacheFirst(request, DYNAMIC_CACHE));
    } else {
      event.respondWith(handleNetworkFirst(request, DYNAMIC_CACHE));
    }
    return;
  }


  // Navigation
  if (request.mode === 'navigate') {
    event.respondWith(handleNavigationRequest(request));
    return;
  }

  // Default: Cache First
  event.respondWith(handleCacheFirst(request, STATIC_CACHE));
});

// ================================================
// CACHING STRATEGIES - FIXED
// ================================================

/**
 * Cache First - FIXED clone issue
 */
async function handleCacheFirst(request, cacheName) {
  try {
    // Check cache first
    const cached = await caches.match(request);
    if (cached) {
      return cached;
    }

    // Fetch from network
    const response = await fetch(request);
    
    // ✅ FIX: Clone BEFORE caching
    if (response && response.ok && response.status === 200) {
  const responseToCache = response.clone();
  if (request.method === 'GET') {
    caches.open(cacheName).then(cache => {
      cache.put(request, responseToCache);
    }).catch(err => console.warn('[SW] Cache put failed:', err));
  }
}
    
    // Return original response
    return response;
    
  } catch (error) {
    console.error('[SW] Cache first failed:', request.url, error);
    
    // Fallback for documents
    if (request.destination === 'document') {
      const offlineCache = await caches.match('/offline.html');
      if (offlineCache) return offlineCache;
    }
    
    // Return error response
    return new Response('Network error', {
      status: 408,
      statusText: 'Request Timeout'
    });
  }
}

/**
 * Network First - FIXED clone issue
 */
async function handleNetworkFirst(request, cacheName, timeout = 3000) {
  try {
    // Try network with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    const response = await fetch(request, { signal: controller.signal });
    clearTimeout(timeoutId);
    
    // ✅ FIX: Clone BEFORE caching
    if (response && response.ok && response.status === 200) {
  const responseToCache = response.clone();
  if (request.method === 'GET') {
    caches.open(cacheName).then(cache => {
      cache.put(request, responseToCache);
    }).catch(err => console.warn('[SW] Cache put failed:', err));
  }
}
return response;
    
  } catch (error) {
    console.warn('[SW] Network failed, trying cache:', request.url);
    
    // Fallback to cache
    const cached = await caches.match(request);
    if (cached) {
      return cached;
    }
    
    // No cache, return error
    return new Response(JSON.stringify({ error: 'Offline' }), {
      status: 503,
      statusText: 'Service Unavailable',
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Stale While Revalidate - FIXED clone issue
 */
async function handleImageRequest(request) {
  try {
    const cached = await caches.match(request);
    
    // Fetch new version in background
    const fetchPromise = fetch(request)
      .then((response) => {
        if (response && response.ok && response.status === 200) {
  const responseToCache = response.clone();
  if (request.method === 'GET') {
    caches.open(IMAGE_CACHE).then(cache => {
      cache.put(request, responseToCache);
    }).catch(err => console.warn('[SW] Image cache failed:', err));
  }
}
return response;
      })
      .catch(() => cached); // Fallback to cache on error

    // Return cache immediately if available
    return cached || fetchPromise;
    
  } catch (error) {
    console.error('[SW] Image request failed:', error);
    
    // Return placeholder or cached version
    const cached = await caches.match(request);
    if (cached) return cached;
    
    // Return 404
    return new Response('Image not found', {
      status: 404,
      statusText: 'Not Found'
    });
  }
}

/**
 * Navigation Request Handler - FIXED
 */
async function handleNavigationRequest(request) {
  try {
    const response = await fetch(request);
    
    // ✅ FIX: Clone BEFORE caching
    if (response && response.ok && response.status === 200) {
      const responseToCache = response.clone();
      
      caches.open(DYNAMIC_CACHE).then(cache => {
        cache.put(request, responseToCache);
      });
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

function isAPIRequest(pathOrHost) {
  return pathOrHost.startsWith('/v1/') || 
         pathOrHost.startsWith('/api/') ||
         pathOrHost.includes('shv-api.shophuyvan.workers.dev') ||
         pathOrHost.includes('workers.dev');
}

function getAPIStrategy(pathname) {
  for (const [pattern, strategy] of Object.entries(API_PATTERNS)) {
    if (pathname.includes(pattern)) {
      return strategy;
    }
  }
  return 'network-first';
}

// ================================================
// MESSAGE HANDLER
// ================================================
self.addEventListener('message', (event) => {
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
});

console.log('[SW] Service Worker loaded:', CACHE_VERSION);