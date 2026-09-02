const CACHE_NAME = 'radar-seguro-rj-v72';
const TOMTOM_WORKER = 'https://radar-seguro-ia-rj.claudio41cg.workers.dev';
const OPENFREEMAP_HOST = 'tiles.openfreemap.org';
const APP_SHELL = [
  './manifest.json','./icon-192-1.png','./icon-512-1.png'
];

self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE_NAME).then(cache=>cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate',event=>{
  event.waitUntil((async()=>{
    const keys=await caches.keys();
    await Promise.all(keys.filter(k=>k!==CACHE_NAME).map(k=>caches.delete(k)));
    await self.clients.claim();
    const clients=await self.clients.matchAll({type:'window',includeUncontrolled:true});
    clients.forEach(c=>c.postMessage({type:'RADAR_BUILD',build:'72'}));
  })());
});

function tomTomProxyRequest(request){
  const source=new URL(request.url);
  source.searchParams.delete('key');
  const path=source.pathname+(source.search||'');
  return fetch(`${TOMTOM_WORKER}/v1/tomtom?path=${encodeURIComponent(path)}`,{
    method:request.method==='POST'?'POST':'GET',
    headers:{'Accept':request.headers.get('Accept')||'*/*','Content-Type':request.headers.get('Content-Type')||'application/json'},
    body:request.method==='POST'?request.clone().body:undefined,
    cache:'no-store'
  });
}

async function aiChatProxyRequest(request){
  const rawBody=await request.clone().text();let body=rawBody;
  try{
    const payload=JSON.parse(rawBody||'{}');
    if(!payload.message&&typeof payload.pergunta==='string'){payload.message=payload.pergunta;delete payload.pergunta;}
    if(!Array.isArray(payload.history))payload.history=[];
    body=JSON.stringify(payload);
  }catch(_){}
  return fetch(`${TOMTOM_WORKER}/v1/chat`,{method:'POST',headers:{'Content-Type':'application/json'},body,cache:'no-store'});
}

function isTrafficMapTile(url){
  if(url.origin!==TOMTOM_WORKER || url.pathname!=='/v1/tomtom') return false;
  const encoded=url.searchParams.get('path')||'';
  let path=encoded;
  try{ path=decodeURIComponent(encoded); }catch(_){}
  return /\/traffic\/map\/.*\/tile\/flow\//i.test(path);
}

async function cleanOpenFreeMapStyle(request){
  try{
    const response=await fetch(request,{cache:'no-store'});
    if(!response.ok)return response;
    const style=await response.json();
    if(Array.isArray(style.layers)){
      for(const layer of style.layers){
        if(layer?.type!=='line')continue;
        const id=String(layer.id||'').toLowerCase();
        const sourceLayer=String(layer['source-layer']||'').toLowerCase();
        const roadLayer=sourceLayer.includes('transportation') || /road|street|highway|motorway|trunk|primary|secondary|tertiary/.test(id);
        if(!roadLayer)continue;
        layer.paint=layer.paint||{};
        const isCasing=/case|casing|outline/.test(id);
        layer.paint['line-color']=isCasing?'#cbd5e1':'#94a3b8';
        if(layer.paint['line-opacity']==null)layer.paint['line-opacity']=0.72;
      }
    }
    return new Response(JSON.stringify(style),{
      status:200,
      headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}
    });
  }catch(_){
    return fetch(request,{cache:'no-store'});
  }
}

self.addEventListener('fetch',event=>{
  const url=new URL(event.request.url);

  // v72: deixa o mapa-base sem as vias verdes. A rota do Radar é desenhada depois e não é alterada.
  if(event.request.method==='GET' && url.hostname===OPENFREEMAP_HOST && /\/styles\/(?:liberty|dark)\/?$/i.test(url.pathname)){
    event.respondWith(cleanOpenFreeMapStyle(event.request));
    return;
  }

  // Remove somente os tiles visuais de fluxo TomTom (verde/amarelo/vermelho).
  if(event.request.method==='GET' && isTrafficMapTile(url)){
    event.respondWith(new Response(null,{status:204,headers:{'Cache-Control':'no-store'}}));
    return;
  }

  if(url.origin===TOMTOM_WORKER&&(url.pathname==='/'||url.pathname==='/v1/chat')&&event.request.method==='POST'){
    event.respondWith(aiChatProxyRequest(event.request));return;
  }
  if(url.hostname==='api.tomtom.com'){
    event.respondWith(tomTomProxyRequest(event.request));return;
  }
  if(url.origin!==self.location.origin)return;

  const isNav=event.request.mode==='navigate'||url.pathname.endsWith('/')||url.pathname.endsWith('/index.html');
  const liveFile=/\.(?:js|json|html)$/.test(url.pathname)||url.pathname.includes('/data/');
  if(isNav||liveFile){
    event.respondWith(fetch(event.request,{cache:'no-store'}).catch(()=>caches.match(event.request)));
    return;
  }
  event.respondWith(caches.match(event.request).then(cached=>cached||fetch(event.request)));
});
