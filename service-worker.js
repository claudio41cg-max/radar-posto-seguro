const CACHE_NAME = 'radar-seguro-rj-v7';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icon-192-1.png',
  './icon-512-1.png'
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

// Estratégia: para o "app shell" (arquivos locais), tenta cache primeiro,
// depois rede. Para tudo externo (mapa, rotas, busca de endereço), sempre
// usa a rede — esses precisam de internet mesmo, não dá pra funcionar
// offline (senão o mapa e as rotas ficariam desatualizados ou quebrados).
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  const isAppShell = url.origin === self.location.origin;

  if (!isAppShell) return; // deixa passar direto pra rede

  // Dados oficiais mudam sem que o código do app precise mudar.
  // Busca primeiro na internet e usa o cache somente se estiver offline.
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
