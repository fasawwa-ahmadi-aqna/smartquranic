const CACHE_NAME = 'fazzquran-offline-v1';
const API_CACHE = 'fazzquran-api-v1';
const RUNTIME_CACHE = 'fazzquran-runtime-v1';

const APP_SHELL = [
  '/',
  '/index.html',
  '/manifest.json',
  '/sw.js',
  '/img/fazz.png',
  '/img/IMG_20260828_203323.jpg',
  '/img/IMG_20260828_112810.jpg'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL).catch(() => undefined))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => ![CACHE_NAME, API_CACHE, RUNTIME_CACHE].includes(k))
        .map(k => caches.delete(k))
    )).then(() => self.clients.claim())
  );
});

function isQuranApi(url) {
  return url.hostname === 'equran.id' || url.hostname === 'ournoor.com';
}

function isStaticExternal(url) {
  return [
    'cdn.tailwindcss.com',
    'cdn.jsdelivr.net',
    'cdnjs.cloudflare.com',
    'fonts.googleapis.com',
    'fonts.gstatic.com',
    'cdn-icons-png.flaticon.com'
  ].includes(url.hostname);
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response && (response.ok || response.type === 'opaque')) {
      cache.put(request, response.clone()).catch(() => {});
    }
    return response;
  } catch (err) {
    throw err;
  }
}

async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const response = await fetch(request);
    if (response && (response.ok || response.type === 'opaque')) {
      cache.put(request, response.clone()).catch(() => {});
    }
    return response;
  } catch (err) {
    const cached = await cache.match(request);
    if (cached) return cached;
    throw err;
  }
}

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Quran + word-by-word API: cache-first after the first successful online use.
  if (isQuranApi(url)) {
    event.respondWith(cacheFirst(request, API_CACHE));
    return;
  }

  // App shell/local files: network-first so deployed updates arrive, offline falls back.
  if (url.origin === self.location.origin) {
    event.respondWith(networkFirst(request, RUNTIME_CACHE));
    return;
  }

  // CDN fonts/libs: cache successful resources for offline use after first online load.
  if (isStaticExternal(url)) {
    event.respondWith(cacheFirst(request, RUNTIME_CACHE));
  }
});
