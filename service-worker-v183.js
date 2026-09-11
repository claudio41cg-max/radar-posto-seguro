/* Radar Seguro RJ PRO v183 — Service Worker PWA. */
const CACHE_NAME='radar-seguro-pwa-v183';
const CORE=[
  './radar-v183.html','./index.html','./manifest-v183.json','./icon-192-1.png','./icon-512-1.png','./pwa-install-v183.js',
  './app-shell-v97.css','./voice-ui-v98.css','./legacy-inline-v99.css','./community-index-preload.js','./community-geometries-preload.js',
  './community-force-overlay-v159.js','./cesarao-antares-rollas-territory-v181.js','./cesarao-antares-rollas-style-v175.js',
  './main-map-manual-hold-v168.js','./navigation-live-fix-v177.js','./navigation-guards-v178.js','./map-navigation-search-v182.js','./navigation-camera-v183.js'
];
self.addEventListener('install',event=>{event.waitUntil((async()=>{const cache=await caches.open(CACHE_NAME);await Promise.allSettled(CORE.map(url=>cache.add(new Request(url,{cache:'reload'}))));})());self.skipWaiting();});
self.addEventListener('activate',event=>{event.waitUntil((async()=>{const keys=await caches.keys();await Promise.all(keys.filter(k=>(k.startsWith('radar-seguro-pwa-')||k.startsWith('radar-seguro-rj-'))&&k!==CACHE_NAME).map(k=>caches.delete(k)));await self.clients.claim();})());});
async function networkFirst(request){const cache=await caches.open(CACHE_NAME);try{const response=await fetch(request,{cache:'no-store'});if(response&&response.ok)cache.put(request,response.clone()).catch(()=>{});return response;}catch(_){return(await cache.match(request))||(request.mode==='navigate'?await cache.match('./radar-v183.html'):Response.error());}}
async function cacheFirst(request){const cache=await caches.open(CACHE_NAME);const cached=await cache.match(request);if(cached){fetch(request,{cache:'no-store'}).then(r=>{if(r&&r.ok)cache.put(request,r.clone()).catch(()=>{});}).catch(()=>{});return cached;}const response=await fetch(request);if(response&&response.ok)cache.put(request,response.clone()).catch(()=>{});return response;}
self.addEventListener('fetch',event=>{const request=event.request;if(request.method!=='GET')return;const url=new URL(request.url);if(url.origin!==self.location.origin)return;if(request.mode==='navigate'){event.respondWith(networkFirst(request));return;}if(/\.(?:js|css|json|png|jpg|jpeg|svg|webp)$/i.test(url.pathname)){event.respondWith(cacheFirst(request));return;}event.respondWith(networkFirst(request));});