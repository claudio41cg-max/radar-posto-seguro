const CACHE_NAME = 'radar-seguro-rj-v61';
const TOMTOM_WORKER = 'https://radar-seguro-ia-rj.claudio41cg.workers.dev';
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
    clients.forEach(c=>c.postMessage({type:'RADAR_BUILD',build:'61'}));
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

self.addEventListener('fetch',event=>{
  const url=new URL(event.request.url);
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
