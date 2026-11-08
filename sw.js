/* sw.js — offline cache for the Cabinet Cut List PWA.
 * Bump CACHE when any cached asset changes so clients pick up new files. */
var CACHE = 'cutlist-v3';
var ASSETS = [
  './',
  './index.html',
  './css/styles.css',
  './js/packer.js',
  './js/cabinet.js',
  './js/ada.js',
  './js/iso.js',
  './js/estimator.js',
  './js/app.js',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-512-maskable.png',
  './icons/apple-touch-icon.png'
];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) {
    return c.addAll(ASSETS);
  }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.map(function (k) {
      if (k !== CACHE) return caches.delete(k);
    }));
  }).then(function () { return self.clients.claim(); }));
});

// Cache-first for app assets; network-first fallthrough for anything else.
self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request).then(function (cached) {
      return cached || fetch(e.request).then(function (resp) {
        return resp;
      }).catch(function () {
        return caches.match('./index.html');
      });
    })
  );
});
