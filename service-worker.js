const CACHE_NAME = 'radar-seguro-rj-v27';
const TOMTOM_WORKER = 'https://radar-seguro-ia-rj.claudio41cg.workers.dev';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icon-192-1.png',
  './icon-512-1.png',
  './tomtom-proxy-client.js',
  './nav-enhancements.js',
  './runtime-stability.js'
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

async function injectAppModules(response) {
  if (!response || !response.ok) return response;
  const type = response.headers.get('content-type') || '';
  if (!type.includes('text/html')) return response;

  let html = await response.text();
  const scripts = [];
  if (!html.includes('tomtom-proxy-client.js')) {
    scripts.push('<script src="./tomtom-proxy-client.js?v=27"></script>');
  }
  if (!html.includes('nav-enhancements.js')) {
    scripts.push('<script src="./nav-enhancements.js?v=27"></script>');
  }
  if (!html.includes('runtime-stability.js')) {
    scripts.push('<script src="./runtime-stability.js?v=27"></script>');
  }
  if (scripts.length) {
    html = html.replace('</body>', `${scripts.join('\n')}\n</body>`);
  }

  const headers = new Headers(response.headers);
  headers.delete('content-length');
  headers.set('x-radar-build', '27');
  return new Response(html, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}

function tomTomProxyRequest(request) {
  const source = new URL(request.url);
  source.searchParams.delete('key');
  const path = source.pathname + (source.search || '');
  const proxyUrl = `${TOMTOM_WORKER}/v1/tomtom?path=${encodeURIComponent(path)}`;
  return fetch(proxyUrl, {
    method: 'GET',
    headers: {
      'Accept': request.headers.get('Accept') || '*/*'
    },
    cache: 'no-store'
  });
}

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  if (url.hostname === 'api.tomtom.com') {
    event.respondWith(tomTomProxyRequest(event.request));
    return;
  }

  const isAppShell = url.origin === self.location.origin;
  if (!isAppShell) return;

  if (url.pathname.includes('/data/')) {
    event.respondWith(
      fetch(event.request, { cache: 'no-store' })
        .then((resp) => {
          const respClone = resp.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, respClone));
          return resp;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  const isNavigationHtml =
    event.request.mode === 'navigate' ||
    url.pathname.endsWith('/') ||
    url.pathname.endsWith('/index.html');

  if (isNavigationHtml) {
    event.respondWith((async () => {
      try {
        const network = await fetch(event.request, { cache: 'no-store' });
        const cacheCopy = network.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put('./index.html', cacheCopy));
        return injectAppModules(network);
      } catch (e) {
        const cached = await caches.match('./index.html');
        return injectAppModules(cached);
      }
    })());
    return;
  }

  if (url.pathname.endsWith('.js') || url.pathname.endsWith('.json')) {
    event.respondWith(
      fetch(event.request, { cache: 'no-store' })
        .then((resp) => {
          const respClone = resp.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, respClone));
          return resp;
        })
        .catch(() => caches.match(event.request))
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
