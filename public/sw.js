const CACHE = 'pantry-shell-v1';
const ASSETS = ['/', '/manifest.webmanifest', '/icon-192.png', '/icon-512.png', '/apple-touch-icon.png'];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
// Network-first for navigations/data (so family sync stays fresh); cache fallback offline.
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return; // let Supabase/Google calls pass through
  e.respondWith(
    fetch(e.request).then((resp) => { const cp = resp.clone(); caches.open(CACHE).then((c) => c.put(e.request, cp)); return resp; })
      .catch(() => caches.match(e.request).then((r) => r || caches.match('/')))
  );
});
