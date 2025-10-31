const CACHE_NAME = 'emp-app-v1';
self.addEventListener('install', e => {
  console.log('SW installed');
});
self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request).then(r => r || fetch(e.request))
  );
});
