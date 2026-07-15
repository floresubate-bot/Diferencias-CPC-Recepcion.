const CACHE_NAME = 'cpc-vs-rec-v1';
const ASSETS = [
  '/',
  '/static/style.css',
  '/static/main.js',
  '/static/flower_banner.jpg',
  '/static/chart.js',
  '/static/chartjs-plugin-datalabels.js',
  '/static/html2canvas.min.js',
  '/static/css/all.min.css',
  '/static/webfonts/fa-solid-900.woff2',
  '/static/webfonts/fa-regular-400.woff2',
  '/static/webfonts/fa-brands-400.woff2',
  '/static/webfonts/fa-solid-900.ttf',
  '/static/webfonts/fa-regular-400.ttf',
  '/static/webfonts/fa-brands-400.ttf'
];

// Install Event
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] Caching all static assets');
      return cache.addAll(ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// Activate Event
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('[Service Worker] Removing old cache', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Event
self.addEventListener('fetch', (e) => {
  // Only handle GET requests and skip API calls
  if (e.request.method !== 'GET' || e.request.url.includes('/api/')) {
    return;
  }
  
  e.respondWith(
    caches.match(e.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(e.request).catch(() => {
        // Offline fallback if needed
        if (e.request.mode === 'navigate') {
          return caches.match('/');
        }
      });
    })
  );
});
