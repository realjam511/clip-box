// クリップ置き場 Service Worker (Cache-First Offline Support)
const CACHE_NAME = 'clip-box-cache-v4';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-180.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/favicon.ico'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  // GETリクエストのみキャッシュから返却
  if (event.request.method !== 'GET') return;
  
  // URLクエリパラメータがある場合（例: ?text=...）もベースURLのキャッシュをフォールバックとして返却
  const requestUrl = new URL(event.request.url);
  const isSameOrigin = requestUrl.origin === location.origin;

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        // バックグラウンドで最新を取得してキャッシュを更新
        fetch(event.request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, networkResponse));
          }
        }).catch(() => {});
        return cachedResponse;
      }

      // クエリ付き（?text=...）の場合は index.html キャッシュを返却
      if (isSameOrigin && requestUrl.searchParams.has('text')) {
        return caches.match('./index.html').then((fallback) => {
          if (fallback) return fallback;
          return fetch(event.request);
        });
      }

      return fetch(event.request).then((networkResponse) => {
        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
          return networkResponse;
        }
        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseToCache));
        return networkResponse;
      });
    }).catch(() => caches.match('./index.html'))
  );
});
