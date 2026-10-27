const CACHE = 'daily-english-pages-v5';
const BASE = new URL('./', self.registration.scope);
const page = name => new URL(name, BASE).toString();
const CORE = ['', 'index.html', 'oneui.css', 'empower-b1-wordlist.js', 'github-config.js', 'storage-service.js', 'account-ui.js', 'manifest.webmanifest', 'icon.svg', 'offline.html'].map(page);
self.addEventListener('install', event => event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(CORE)).then(() => self.skipWaiting())));
self.addEventListener('activate', event => event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('daily-english-') && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim())));
self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || !url.pathname.startsWith(new URL('./', BASE).pathname)) return;
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).then(response => { if (response.ok) caches.open(CACHE).then(cache => cache.put(page('index.html'), response.clone())); return response; }).catch(async () => (await caches.match(page('index.html'))) || (await caches.match(page('offline.html')))));
    return;
  }
  event.respondWith(caches.match(request).then(cached => cached || fetch(request).then(response => { if (response.ok) caches.open(CACHE).then(cache => cache.put(request, response.clone())); return response; })));
});
