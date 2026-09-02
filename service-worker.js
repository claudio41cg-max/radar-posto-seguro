const CACHE_NAME = 'radar-seguro-rj-v73';
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
    clients.forEach(c=>c.postMessage({type:'RADAR_BUILD',build:'73'}));
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
  const raw=String(url.href||'').toLowerCase();
  if(url.origin!==TOMTOM_WORKER || url.pathname!=='/v1/tomtom') return false;
  let path=url.searchParams.get('path')||'';
  try{ path=decodeURIComponent(path); }catch(_){}
  const text=(raw+' '+String(path)).toLowerCase();
  return text.includes('/traffic/map/') || text.includes('%2ftraffic%2fmap%2f') || text.includes('/tile/flow/') || text.includes('%2ftile%2fflow%2f');
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
        if(layer.paint['line-opacity']==null)layer.paint['line-opacity']=0.62;
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

const TRAFFIC_SOFTENER = `<script id="radar-traffic-softener-v73">\n(()=>{\n  const apply=()=>{\n    let m=null;\n    try{m=(typeof App!=='undefined'&&App&&App.map)?App.map:(window.App&&window.App.map); }catch(_){}\n    if(!m||!m.getStyle)return false;\n    try{\n      const st=m.getStyle();\n      for(const l of (st.layers||[])){\n        const id=String(l.id||'').toLowerCase();\n        const src=String(l.source||'').toLowerCase();\n        if(l.type!=='raster'||!/traffic|flow|tomtom/.test(id+' '+src))continue;\n        try{m.setPaintProperty(l.id,'raster-opacity',0.16)}catch(_){}\n        try{m.setPaintProperty(l.id,'raster-saturation',-0.65)}catch(_){}\n        try{m.setPaintProperty(l.id,'raster-contrast',-0.20)}catch(_){}\n        try{m.setPaintProperty(l.id,'raster-brightness-max',0.72)}catch(_){}\n      }\n    }catch(_){}\n    return true;\n  };\n  let n=0;const t=setInterval(()=>{n++;if(apply()&&n>8)clearInterval(t);if(n>80)clearInterval(t)},250);\n  const arm=()=>{let m=null;try{m=(typeof App!=='undefined'&&App&&App.map)?App.map:(window.App&&window.App.map)}catch(_){};if(!m)return;try{m.on('styledata',()=>setTimeout(apply,50));m.on('idle',apply)}catch(_){}};\n  setTimeout(arm,1200);setTimeout(apply,2000);setTimeout(apply,4000);\n})();\n<\/script>`;

async function navigationWithTrafficSoftener(request){
  try{
    const response=await fetch(request,{cache:'no-store'});
    if(!response.ok)return response;
    const type=response.headers.get('content-type')||'';
    if(!type.includes('text/html'))return response;
    let html=await response.text();
    if(!html.includes('radar-traffic-softener-v73')){
      html=html.includes('</body>')?html.replace('</body>',TRAFFIC_SOFTENER+'\n</body>'):html+TRAFFIC_SOFTENER;
    }
    return new Response(html,{status:response.status,statusText:response.statusText,headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'}});
  }catch(_){
    return fetch(request,{cache:'no-store'});
  }
}

self.addEventListener('fetch',event=>{
  const url=new URL(event.request.url);

  if(event.request.method==='GET' && url.hostname===OPENFREEMAP_HOST && /\/styles\/(?:liberty|dark)\/?$/i.test(url.pathname)){
    event.respondWith(cleanOpenFreeMapStyle(event.request));
    return;
  }

  // Segurança extra: se o navegador ainda tentar carregar o overlay cheio, bloqueia somente o tile visual.
  // Os dados de trânsito usados no cálculo de rota continuam ativos.
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
  if(isNav){
    event.respondWith(navigationWithTrafficSoftener(event.request));
    return;
  }
  if(liveFile){
    event.respondWith(fetch(event.request,{cache:'no-store'}).catch(()=>caches.match(event.request)));
    return;
  }
  event.respondWith(caches.match(event.request).then(cached=>cached||fetch(event.request)));
});
