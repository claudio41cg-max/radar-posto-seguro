const CACHE_NAME = 'radar-seguro-rj-v101';
const TOMTOM_WORKER = 'https://radar-seguro-ia-rj.claudio41cg.workers.dev';
const OPENFREEMAP_HOST = 'tiles.openfreemap.org';

/* Shell atual. Sem injetar scripts antigos no HTML: o index.html é a fonte de verdade. */
const APP_SHELL = [
  './manifest.json',
  './app-shell-v97.css',
  './voice-ui-v98.css',
  './legacy-inline-v99.css',
  './icon-192-1.png',
  './icon-512-1.png',
  './app-shell-v97.css?v=97',
  './tomtom-proxy-client.js',
  './route-traffic-v74.js',
  './traffic-clean-v75.js',
  './community-index-preload.js',
  './community-geometries-preload.js',
  './community-data-loader.js',
  './community-runtime-v83.js',
  './community-panel-v93.js',
  './community-map-style-v95.js',
  './data/community-datasets.json',
  './data/community-index.json',
  './data/community-geometries.json'
];

self.addEventListener('install',event=>{
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache=>Promise.allSettled(APP_SHELL.map(file=>cache.add(file))))
  );
  self.skipWaiting();
});

self.addEventListener('activate',event=>{
  event.waitUntil((async()=>{
    const keys=await caches.keys();
    await Promise.all(keys.filter(k=>k!==CACHE_NAME).map(k=>caches.delete(k)));
    await self.clients.claim();
    const clients=await self.clients.matchAll({type:'window',includeUncontrolled:true});
    clients.forEach(c=>c.postMessage({type:'RADAR_BUILD',build:'101'}));
  })());
});

function tomTomProxyRequest(request){
  const source=new URL(request.url);
  source.searchParams.delete('key');
  const path=source.pathname+(source.search||'');
  return fetch(`${TOMTOM_WORKER}/v1/tomtom?path=${encodeURIComponent(path)}`,{
    method:request.method==='POST'?'POST':'GET',
    headers:{
      'Accept':request.headers.get('Accept')||'*/*',
      'Content-Type':request.headers.get('Content-Type')||'application/json'
    },
    body:request.method==='POST'?request.clone().body:undefined,
    cache:'no-store'
  });
}

async function aiChatProxyRequest(request){
  const rawBody=await request.clone().text();
  let body=rawBody;
  try{
    const payload=JSON.parse(rawBody||'{}');
    if(!payload.message&&typeof payload.pergunta==='string'){
      payload.message=payload.pergunta;
      delete payload.pergunta;
    }
    if(!Array.isArray(payload.history))payload.history=[];
    body=JSON.stringify(payload);
  }catch(_){}
  return fetch(`${TOMTOM_WORKER}/v1/chat`,{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body,
    cache:'no-store'
  });
}

/* Proteção mantida: nunca desenhar o trânsito global sobre todas as ruas. */
function isTrafficMapTile(url){
  const raw=String(url.href||'').toLowerCase();
  if(url.origin!==TOMTOM_WORKER||url.pathname!=='/v1/tomtom')return false;
  let path=url.searchParams.get('path')||'';
  try{path=decodeURIComponent(path);}catch(_){}
  const text=(raw+' '+String(path)).toLowerCase();
  return text.includes('/traffic/map/')||
    text.includes('%2ftraffic%2fmap%2f')||
    text.includes('/tile/flow/')||
    text.includes('%2ftile%2fflow%2f');
}

function isStaticCommunityData(url){
  if(url.origin!==self.location.origin)return false;
  return /\/data\/(?:sabren-|ibge-).+\.geojson$/i.test(url.pathname)||
    /\/data\/community-(?:datasets|index|geometries)\.json$/i.test(url.pathname);
}

async function cacheFirstStatic(request){
  const cache=await caches.open(CACHE_NAME);
  const cached=await cache.match(request);
  if(cached)return cached;
  const response=await fetch(request,{cache:'no-store'});
  if(response.ok)await cache.put(request,response.clone());
  return response;
}

async function buildCleanOpenFreeMapStyle(request){
  const response=await fetch(request,{cache:'no-store'});
  if(!response.ok)return response;
  const style=await response.json();
  if(Array.isArray(style.layers)){
    for(const layer of style.layers){
      if(layer?.type!=='line')continue;
      const id=String(layer.id||'').toLowerCase();
      const sourceLayer=String(layer['source-layer']||'').toLowerCase();
      const roadLayer=sourceLayer.includes('transportation')||/road|street|highway|motorway|trunk|primary|secondary|tertiary/.test(id);
      if(!roadLayer)continue;
      layer.paint=layer.paint||{};
      const isCasing=/case|casing|outline/.test(id);
      layer.paint['line-color']=isCasing?'#cbd5e1':'#94a3b8';
      layer.paint['line-opacity']=0.56;
    }
  }
  return new Response(JSON.stringify(style),{
    status:200,
    headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'public, max-age=86400'}
  });
}

async function cleanOpenFreeMapStyle(request){
  const cache=await caches.open(CACHE_NAME);
  const cached=await cache.match(request);
  if(cached)return cached;
  try{
    const cleaned=await buildCleanOpenFreeMapStyle(request);
    if(cleaned.ok)await cache.put(request,cleaned.clone());
    return cleaned;
  }catch(_){
    return fetch(request,{cache:'no-store'});
  }
}

/* Navegação sempre busca o index atual. Offline usa o último index que tiver sido salvo pelo navegador. */
async function navigationNetworkFirst(request){
  try{
    return await fetch(request,{cache:'no-store'});
  }catch(_){
    return (await caches.match(request)) || (await caches.match('./index.html')) || Response.error();
  }
}

self.addEventListener('fetch',event=>{
  const url=new URL(event.request.url);

  if(event.request.method==='GET'&&url.hostname===OPENFREEMAP_HOST&&/\/styles\/(?:liberty|dark)\/?$/i.test(url.pathname)){
    event.respondWith(cleanOpenFreeMapStyle(event.request));
    return;
  }

  if(event.request.method==='GET'&&isTrafficMapTile(url)){
    event.respondWith(new Response(null,{status:204,headers:{'Cache-Control':'no-store'}}));
    return;
  }

  if(url.origin===TOMTOM_WORKER&&(url.pathname==='/'||url.pathname==='/v1/chat')&&event.request.method==='POST'){
    event.respondWith(aiChatProxyRequest(event.request));
    return;
  }

  if(url.hostname==='api.tomtom.com'){
    event.respondWith(tomTomProxyRequest(event.request));
    return;
  }

  if(url.origin!==self.location.origin)return;

  if(event.request.method==='GET'&&isStaticCommunityData(url)){
    event.respondWith(cacheFirstStatic(event.request));
    return;
  }

  const isNav=event.request.mode==='navigate'||url.pathname.endsWith('/')||url.pathname.endsWith('/index.html');
  if(isNav){
    event.respondWith(navigationNetworkFirst(event.request));
    return;
  }

  const liveFile=/\.(?:js|json|html|css)$/.test(url.pathname)||url.pathname.includes('/data/');
  if(liveFile){
    event.respondWith(fetch(event.request,{cache:'no-store'}).catch(()=>caches.match(event.request)));
    return;
  }

  event.respondWith(caches.match(event.request).then(cached=>cached||fetch(event.request)));
});
