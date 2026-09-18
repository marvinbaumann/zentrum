const CACHE = 'zentrum-v2';
const ASSETS = [
  './', './index.html', './styles.css', './manifest.json',
  './js/app.js', './js/store.js', './js/ui.js', './js/sheet.js', './js/habits.js',
  './js/views/heute.js', './js/views/training.js', './js/views/koerper.js', './js/views/listen.js', './js/views/welcome.js',
  './icons/icon-180.png', './icons/icon-512.png'
];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
// Network first, cache fallback: updates arrive immediately, offline still works.
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(
    fetch(e.request).then(res => {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(e.request, copy));
      return res;
    }).catch(() => caches.match(e.request).then(r => r || caches.match('./index.html')))
  );
});
