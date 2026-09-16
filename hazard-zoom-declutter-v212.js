/* Radar Seguro RJ PRO v212 — declutter visual de hazards por zoom.
   Nao remove dados da rota. Apenas reduz marcadores desenhados quando o mapa esta afastado.
   Preserva v211, navegacao, TomTom, IA e alertas. */
(()=>{
'use strict';
if(window.__radarHazardZoomDeclutterV212)return;
window.__radarHazardZoomDeclutterV212=true;

const app=()=>{try{return window.RadarApp||window.App||null}catch(_){return null}};
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

function priority(type){
  if(type==='radar')return 3;
  if(type==='semaforo')return 2;
  if(type==='lombada')return 1;
  return 0;
}

function markerBudget(zoom,total){
  if(total<=0)return 0;
  if(zoom>=15.3)return total;
  if(zoom>=14.4)return Math.min(total,18);
  if(zoom>=13.5)return Math.min(total,12);
  if(zoom>=12.6)return Math.min(total,8);
  return Math.min(total,6);
}

function chooseHazards(hazards,zoom){
  const list=Array.isArray(hazards)?hazards:[];
  const budget=markerBudget(zoom,list.length);
  if(budget>=list.length)return list.slice();
  if(budget<=0)return [];

  // Mantem cobertura do inicio ao fim da rota e evita aglomeracao.
  const sorted=list.slice().sort((a,b)=>(+a.routeIndex||0)-(+b.routeIndex||0));
  const min=+sorted[0]?.routeIndex||0;
  const max=+sorted[sorted.length-1]?.routeIndex||min;
  const span=Math.max(1,max-min);
  const buckets=Array.from({length:budget},()=>[]);

  for(const h of sorted){
    const pos=clamp(((+h.routeIndex||min)-min)/span,0,0.999999);
    buckets[Math.floor(pos*budget)].push(h);
  }

  const picked=[];
  for(const bucket of buckets){
    if(!bucket.length)continue;
    bucket.sort((a,b)=>priority(b.type)-priority(a.type));
    picked.push(bucket[0]);
  }

  // Se algum trecho nao tinha hazard, completa o limite com os mais bem distribuidos.
  if(picked.length<budget){
    const used=new Set(picked);
    const candidates=sorted.filter(x=>!used.has(x));
    while(picked.length<budget&&candidates.length){
      let bestI=0,bestScore=-1;
      for(let i=0;i<candidates.length;i++){
        const c=candidates[i],ri=+c.routeIndex||0;
        let nearest=Infinity;
        for(const p of picked)nearest=Math.min(nearest,Math.abs(ri-(+p.routeIndex||0)));
        const score=nearest*10+priority(c.type);
        if(score>bestScore){bestScore=score;bestI=i;}
      }
      picked.push(candidates.splice(bestI,1)[0]);
    }
  }
  return picked.sort((a,b)=>(+a.routeIndex||0)-(+b.routeIndex||0));
}

function clearMarkers(a){
  (a.hazardMarkers||[]).forEach(m=>{try{m.remove()}catch(_){}});
  a.hazardMarkers=[];
}

function render(a){
  if(!a?.map)return;
  clearMarkers(a);
  const all=Array.isArray(a.routeHazards)?a.routeHazards:[];
  if(!all.length)return;
  const lib=window.maplibregl;if(!lib?.Marker)return;
  const zoom=Number(a.map.getZoom?.())||16;
  const visible=chooseHazards(all,zoom);

  for(const h of visible){
    if(a.navActive&&Number.isFinite(+a.routeProgressIndex)&&(+h.routeIndex||0)<+a.routeProgressIndex-5)continue;
    const el=document.createElement('div');el.className='hazard-marker';
    try{el.innerHTML=a.hazardSVG?.(h.type)||'';}catch(_){el.textContent=h.type==='radar'?'📷':h.type==='lombada'?'⚠':'🚦';}
    try{a.hazardMarkers.push(new lib.Marker({element:el,anchor:'center'}).setLngLat(h.coords).addTo(a.map));}catch(_){}
  }
}

function install(){
  const a=app(),m=a?.map;
  if(!a||!m||typeof m.on!=='function')return false;
  if(a.__hazardZoomDeclutterV212)return true;
  a.__hazardZoomDeclutterV212=true;

  // Substitui apenas a renderizacao. Os dados completos permanecem em routeHazards.
  a.renderHazards=function(){render(this);};

  let timer=null,lastBucket=null;
  const refresh=()=>{
    clearTimeout(timer);
    timer=setTimeout(()=>{
      const z=Number(m.getZoom?.())||16;
      const b=z>=15.3?5:z>=14.4?4:z>=13.5?3:z>=12.6?2:1;
      if(b!==lastBucket){lastBucket=b;render(a);}
    },90);
  };
  m.on('zoom',refresh);
  m.on('zoomend',()=>{lastBucket=null;refresh();});

  // A v211 pode terminar a busca depois deste arquivo instalar.
  const wait=setInterval(()=>{
    if(Array.isArray(a.routeHazards)&&a.routeHazards.length){clearInterval(wait);render(a);}
  },350);
  setTimeout(()=>clearInterval(wait),30000);
  return true;
}

let tries=0;
const boot=setInterval(()=>{
  tries++;
  if(install()||tries>400)clearInterval(boot);
},80);

window.RadarHazardZoomDeclutterV212={version:'212',chooseHazards};
})();
