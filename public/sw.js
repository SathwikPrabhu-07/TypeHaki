// Service Worker for offline caching and performance
const CACHE_NAME = 'typehaki-v3';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/typehaki-icon.ico',
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('Caching static assets');
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.log('Cache addAll error:', err);
      });
    })
  );
  self.skipWaiting();
});

// Activate event - clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch event - use network-first for JS/CSS to avoid serving stale vendor bundles,
// cache-first for images/fonts, and network-first with cache fallback for other requests.
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle same-origin GET requests
  if (request.method !== 'GET' || url.origin !== location.origin) {
    return;
  }

  // Network-first for JS/CSS to avoid stale mismatches
  if (request.destination === 'script' || request.destination === 'style' || request.url.endsWith('.js') || request.url.endsWith('.css')) {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const copy = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return networkResponse;
        })
        .catch(() => caches.match(request).then((cached) => cached || caches.match('/index.html'))
    );
    return;
  }

  // Cache-first for images/fonts/icons (fast repeat visits)
  if (request.destination === 'image' || request.destination === 'font' || request.url.match(/\.(png|jpg|jpeg|gif|svg|webp|ico|woff2?|ttf)$/)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request)
          .then((resp) => {
            if (!resp || resp.status !== 200) return resp;
            const copy = resp.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
            return resp;
          })
          .catch(() => caches.match('/typehaki-icon.ico'));
      })
    );
    return;
  }

  // Default: network-first then fallback to cache then index.html
  event.respondWith(
    fetch(request)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const copy = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        }
        return networkResponse;
      })
      .catch(() => caches.match(request).then((cached) => cached || caches.match('/index.html')))
  );
});
