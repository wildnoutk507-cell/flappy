const CACHE_NAME = 'flappy-pwa-v2';
const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './game.js',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.map((k) => (k === CACHE_NAME ? null : caches.delete(k))))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  // Offline-first for our assets; network for others
  if (ASSETS.includes(url.pathname.replace(/^[^/]*\/\//, './')) || url.origin === self.location.origin) {
    e.respondWith(
      caches.match(e.request).then((resp) => resp || fetch(e.request).then((r) => {
        const copy = r.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(e.request, copy));
        return r;
      }).catch(() => caches.match('./index.html')))
    );
  }
});