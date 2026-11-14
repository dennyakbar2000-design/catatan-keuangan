// Bump VERSION whenever any file changes so phones pick up the new copy.
const VERSION = 'catatan-keuangan-v8';
const FILES = [
  './',
  'index.html',
  'style.css',
  'glass.css',
  'fonts/inter-latin-wght.woff2',
  'app.js',
  'ui-sheet.js',
  'logic.js',
  'manifest.webmanifest',
  'icon.svg',
  'apple-touch-icon.png',
  'bg.jpg',
  'bg-sheet.jpg',
];

self.addEventListener('install', (e) => {
  // cache: 'reload' skips the browser HTTP cache, so a new version never precaches stale files.
  const fresh = FILES.map((f) => new Request(f, { cache: 'reload' }));
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(fresh)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then((hit) => hit || fetch(e.request)),
  );
});
