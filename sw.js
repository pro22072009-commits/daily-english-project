const CACHE = 'daily-english-biome-personal-import-2';
const BASE = new URL('./', self.registration.scope);
const page = name => new URL(name, BASE).toString();
const CORE = ['', 'index.html', 'oneui.css', 'redesign.css', 'redesign.js', 'empower-b1-wordlist.js', 'sourced-vocabulary.js', 'github-config.js', 'storage-service.js', 'account-ui.js', 'manifest.webmanifest', 'icon.svg', 'offline.html', 'vendor/pdfjs/pdf.min.mjs', 'vendor/pdfjs/pdf.worker.min.mjs', 'vendor/pdfjs/LICENSE'].map(page);
CORE.push(page('personal-vocabulary-import.js?build=2026-11-22.1'));
// The network-first HTML can arrive before the old worker is replaced. These
// URLs avoid mixing new inline code with a previous storage-service API.
CORE.push(...['storage-service.js', 'account-ui.js', 'redesign.js', 'redesign.css', 'learning-hub.js', 'learning-hub.css'].map(name => page(`${name}?build=2026-11-20.copy1`)));
CORE.push(...['design-enhancements.js', 'design-enhancements.css'].map(name => page(name + '?build=2026-11-20.copy1')));
CORE.push(page('biome.css?build=2026-11-20.copy1'), page('biome.js?build=2026-11-20.copy1'), page('assets/study.jpg'), page('assets/landscape.jpg'));
CORE.push(page('biome-polish.css?build=2026-11-20.copy1'), page('biome-background.js?build=2026-11-20.copy1'));
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


