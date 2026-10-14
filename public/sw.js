// FixMyDistrict service worker.
//
// What it caches (and what it must never cache):
// - /_next/static/* (content-hashed, immutable): cache-first
// - public pages (/, /public, /r/*, /install, /login, /signup) and icons:
//   network-first, cached copy used only when offline
// - everything under /dashboard, /api, RSC payloads, redirects and partial
//   responses: never cached, so one person's signed-in pages can't be
//   shown to the next person on a shared device
// The cache name carries the build version (?v= on registration) so each
// deploy starts clean and old caches are deleted on activate.

const VERSION = new URL(self.location.href).searchParams.get('v') || 'dev';
const CACHE_NAME = `fmd-${VERSION}`;
const OFFLINE_URL = '/offline';
const PRECACHE = [OFFLINE_URL, '/manifest.json', '/logo.svg', '/icons/icon-192.png', '/icons/icon-512.png'];
const PUBLIC_PAGES = [/^\/$/, /^\/public\/?$/, /^\/r\/[^/]+\/?$/, /^\/install\/?$/, /^\/login\/?$/, /^\/signup\/?$/, /^\/offline\/?$/];

/** How to handle a request: 'static' | 'page' | 'asset' | 'navigate-uncached' | 'bypass'. */
function classify(url, request) {
  if (request.method !== 'GET') return 'bypass';
  if (url.origin !== self.location.origin) return 'bypass';
  if (url.pathname.startsWith('/api/')) return 'bypass';
  if (url.searchParams.has('_rsc') || request.headers.get('RSC') === '1' || request.headers.get('Next-Router-Prefetch')) return 'bypass';
  if (request.headers.has('range')) return 'bypass';
  if (url.pathname.startsWith('/_next/static/')) return 'static';
  // Pages: public ones may be cached; anything else (incl. /dashboard) only gets the offline fallback.
  if (request.mode === 'navigate') return PUBLIC_PAGES.some((re) => re.test(url.pathname)) ? 'page' : 'navigate-uncached';
  if (url.pathname.startsWith('/dashboard')) return 'bypass';
  if (/\.(png|svg|ico|webp|jpg|jpeg)$/.test(url.pathname) || url.pathname === '/manifest.json') return 'asset';
  return 'bypass';
}
self.__fmdClassify = classify; // exposed for tests

/** Only complete, non-redirected, same-origin 200s are safe to keep. */
function cacheable(response) {
  return response && response.status === 200 && !response.redirected && response.type === 'basic';
}

async function putInCache(request, response) {
  if (!cacheable(response)) return;
  const cache = await caches.open(CACHE_NAME);
  await cache.put(request, response);
}

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE)));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) => Promise.all(names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  const type = event.data && event.data.type;
  if (type === 'SKIP_WAITING') self.skipWaiting();
  if (type === 'CLEAR_CACHES') {
    event.waitUntil(caches.keys().then((names) => Promise.all(names.map((n) => caches.delete(n)))));
  }
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  const kind = classify(url, request);
  if (kind === 'bypass') return;

  if (kind === 'static') {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((response) => {
            event.waitUntil(putInCache(request, response.clone()));
            return response;
          })
      )
    );
    return;
  }

  if (kind === 'page' || kind === 'asset') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          event.waitUntil(putInCache(request, response.clone()));
          return response;
        })
        .catch(async () => (await caches.match(request)) || (kind === 'page' ? caches.match(OFFLINE_URL) : Response.error()))
    );
    return;
  }

  // Signed-in or unknown pages: always from the network, offline page if that fails.
  if (kind === 'navigate-uncached') {
    event.respondWith(fetch(request).catch(() => caches.match(OFFLINE_URL)));
  }
});
