// Laya Mobile Service Worker
const CACHE_NAME = 'laya-mobile-v1.5.0';
const ASSETS_TO_CACHE = [
  './mobile.html',
  './css/mobile.css',
  './assets/icon.png',
  './js/lib/crypto-js.min.js',
  './js/player/queue.js',
  './js/player/audio-controller.js',
  './js/providers/lyrics-service.js',
  './js/providers/innertube.js',
  './js/providers/playlist-importer.js',
  './js/ui/library.js',
  './js/ui/palette-extractor.js',
  './js/mobile/mobile-app.js'
];

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE).catch(() => {});
    })
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) return caches.delete(key);
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  // Allow streaming audio and dynamic API calls to bypass cache
  if (e.request.url.includes('api.php') || e.request.url.includes('saavncdn') || e.request.url.includes('googlevideo') || e.request.url.includes('lrclib')) {
    return;
  }
  e.respondWith(
    caches.match(e.request).then((res) => {
      return res || fetch(e.request).catch(() => caches.match('./mobile.html'));
    })
  );
});
