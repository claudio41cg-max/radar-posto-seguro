const CACHE_NAME = 'radar-seguro-rj-v21';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icon-192-1.png',
  './icon-512-1.png',
  './nav-enhancements.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

async function injectNavigationEnhancements(response) {
  if (!response || !response.ok) return response;

  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('text/html')) return response;

  let html = await response.text();
  const scriptTag = '<script src="./nav-enhancements.js?v=21"></script>';

  if (!html.includes('nav-enhancements.js')) {
    html = html.includes('</body>')
      ? html.replace('</body>', `${scriptTag}\n</body>`)
      : `${html}\n${scriptTag}`;
  }

  const headers = new Headers(response.headers);
  headers.delete('content-length');

  return new Response(html, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  const isAppShell = url.origin === self.location.origin;

  if (!isAppShell) return;

  if (url.pathname.includes('/data/')) {
    event.respondWith(
      fetch(event.request, { cache: 'no-store' })
        .then((resp) => {
          const respClone = resp.clone();
          caches.open(CACHE_NAME).then((cache) =>
            cache.put(event.request, respClone)
          );
          return resp;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  const isNavigation =
    event.request.mode === 'navigate' ||
    url.pathname.endsWith('/') ||
    url.pathname.endsWith('/index.html');

  if (isNavigation) {
    event.respondWith(
      fetch(event.request, { cache: 'no-store' })
        .then(async (resp) => {
          const cacheCopy = resp.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, cacheCopy));
          return injectNavigationEnhancements(resp);
        })
        .catch(async () => {
          const cached = await caches.match(event.request) || await caches.match('./index.html');
          return injectNavigationEnhancements(cached);
        })
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      return cached || fetch(event.request).then((resp) => {
        const respClone = resp.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, respClone));
        return resp;
      }).catch(() => cached);
    })
  );
});
