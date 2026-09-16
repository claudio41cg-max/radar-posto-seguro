/* Radar Seguro RJ PRO v210 — preserva a camera TomTom v209 e melhora recálculo + hazards.
   Nao altera IA. Mantem as manobras/announcement points da TomTom v196.
   Mudancas: fala ligada ao recálculo real, busca de semáforos/lombadas/radares em trechos,
   varredura de todos os segmentos da rota e tolerancia cartografica moderada. */
(()=>{
'use strict';
if(window.__radarTomTomNavigationPolishV210)return;
window.__radarTomTomNavigationPolishV210=true;

const app=()=>{try{return window.RadarApp||window.App||null}catch(_){return null}};
const point=p=>Array.isArray(p)&&p.length>=2&&Number.isFinite(+p[0])&&Number.isFinite(+p[1]);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const rad=d=>d*Math.PI/180;
const deg=r=>r*180/Math.PI;
const mix=(a,b,t)=>[+a[0]+(+b[0]-+a[0])*t,+a[1]+(+b[1]-+a[1])*t];

function distM(a,b){
  if(!point(a)||!point(b))return Infinity;
  const R=6371000,p1=rad(+a[1]),p2=rad(+b[1]),d1=p2-p1,d2=rad(+b[0]-+a[0]);
  const q=Math.sin(d1/2)**2+Math.cos(p1)*Math.cos(p2)*Math.sin(d2/2)**2;
  return 2*R*Math.asin(Math.min(1,Math.sqrt(q)));
}
function bearing(a,b){
  if(!point(a)||!point(b))return null;
  const p1=rad(+a[1]),p2=rad(+b[1]),dl=rad(+b[0]-+a[0]);
  const y=Math.sin(dl)*Math.cos(p2),x=Math.cos(p1)*Math.sin(p2)-Math.sin(p1)*Math.cos(p2)*Math.cos(dl);
  return(deg(Math.atan2(y,x))+360)%360;
}
function signedAngle(a,b){return(((b-a)+540)%360)-180;}
function angleDiff(a,b){return Math.abs(signedAngle(a,b));}
function blendAngle(a,b,t){return(a+signedAngle(a,b)*t+360)%360;}

/* =========================================================
   CAMERA: MESMA LOGICA TESTADA NA v209
========================================================= */
function displayPoint(a){
  if(point(a?.matchedUserPos))return a.matchedUserPos;
  if(point(a?.userPos))return a.userPos;
  if(point(a?.filteredPos))return a.filteredPos;
  if(point(a?.rawUserPos))return a.rawUserPos;
  return null;
}
function cumulative(route){
  const c=route?.coords;
  if(!Array.isArray(c)||c.length<2)return[];
  if(Array.isArray(route.cumulative)&&route.cumulative.length===c.length)return route.cumulative;
  const out=[0];let total=0;
  for(let i=1;i<c.length;i++){
    const d=distM(c[i-1],c[i]);
    total+=Number.isFinite(d)?d:0;
    out[i]=total;
  }
  route.cumulative=out;
  return out;
}
function routePointAt(a,extra){
  const c=a?.route?.coords,cu=cumulative(a?.route);
  if(!Array.isArray(c)||c.length<2||cu.length!==c.length)return null;
  const target=Math.max(0,(+a.routeProgressMeters||0)+Math.max(0,+extra||0));
  let i=clamp(+a.routeProgressIndex||0,0,c.length-2);
  for(;i<c.length-1;i++){
    const x=cu[i]||0,y=cu[i+1]||x;
    if(target<=y){
      const t=y>x?clamp((target-x)/(y-x),0,1):0;
      return mix(c[i],c[i+1],t);
    }
  }
  return c[c.length-1];
}
function curveInfo(a){
  const p0=displayPoint(a)||routePointAt(a,0);
  const p1=routePointAt(a,28),p2=routePointAt(a,72),p3=routePointAt(a,130);
  if(!point(p0)||!point(p1)||!point(p2)||!point(p3))return{strength:0,angle:0,bNow:null,bFuture:null};
  const bNow=bearing(p0,p1),bMid=bearing(p1,p2),bFuture=bearing(p2,p3);
  if(!Number.isFinite(bNow)||!Number.isFinite(bMid)||!Number.isFinite(bFuture))return{strength:0,angle:0,bNow,bFuture};
  const angle=Math.max(angleDiff(bNow,bMid),angleDiff(bMid,bFuture),angleDiff(bNow,bFuture));
  return{strength:clamp((angle-12)/72,0,1),angle,bNow,bFuture};
}
function cameraAdjustment(a,opts){
  if(!a?.navActive||!a?.route||!a?.map)return opts;
  const p=displayPoint(a);
  if(!point(p))return opts;
  const speed=Math.max(0,+a.currentSpeed||0),cv=curveInfo(a),s=cv.strength;
  let baseAhead;
  if(speed<15)baseAhead=82;
  else if(speed<35)baseAhead=102;
  else if(speed<55)baseAhead=125;
  else if(speed<80)baseAhead=150;
  else baseAhead=180;
  const target=routePointAt(a,baseAhead*(1-.45*s));
  const center=point(target)?mix(p,target,.80-.30*s):p;
  let zoom=Number.isFinite(+opts.zoom)?+opts.zoom:17.6;
  let pitch=Number.isFinite(+opts.pitch)?+opts.pitch:66;
  zoom=Math.max(15.9,zoom-(.10+.62*s));
  pitch=Math.max(54,pitch-(2+10*s));
  let b=Number.isFinite(+opts.bearing)?(+opts.bearing+360)%360:null;
  if(Number.isFinite(cv.bNow)){
    if(!Number.isFinite(b))b=cv.bNow;
    b=blendAngle(b,cv.bNow,.38);
    if(Number.isFinite(cv.bFuture)&&s>.08)b=blendAngle(b,cv.bFuture,.22*s);
  }
  return{...opts,center,zoom,pitch,bearing:Number.isFinite(b)?b:opts.bearing,duration:Math.max(360,Number(opts.duration)||0),essential:true};
}
function installCamera(){
  const a=app(),m=a?.map;
  if(!m||typeof m.easeTo!=='function')return false;
  if(m.__tomTomCameraV210Installed)return true;
  m.__tomTomCameraV210Installed=true;
  const raw=m.easeTo.bind(m);
  m.__easeToBeforeTomTomCameraV210=raw;
  m.easeTo=function(opts){
    try{
      if(a.navActive&&a.route&&opts&&typeof opts==='object')return raw(cameraAdjustment(a,{...opts}));
    }catch(e){console.warn('Radar v210 camera',e);}
    return raw(opts);
  };
  return true;
}

/* =========================================================
   RECALCULO: FALA NO EVENTO REAL DO MOTOR v191
========================================================= */
let lastRecalcVoiceAt=0,lastUpdatedVoiceAt=0,lastRecalcSeenAt=0;
function normalNavSpeak(text,force=true){
  try{
    const v=window.Voice;
    if(v&&typeof v.speak==='function')return v.speak(text,force);
  }catch(_){}
}
function installRerouteEventVoice(){
  const a=app();
  if(!a||typeof a.toast!=='function')return false;
  if(a.toast.__radarV210RerouteVoice)return true;
  const raw=a.toast.bind(a);
  const wrapped=function(message,...rest){
    const text=String(message||'');
    const now=Date.now();
    if(/^Recalculando rota/i.test(text)){
      lastRecalcSeenAt=now;
      if(now-lastRecalcVoiceAt>5500){
        lastRecalcVoiceAt=now;
        normalNavSpeak('Recalculando rota.',true);
      }
    }else if(/^Rota atualizada/i.test(text)&&now-lastRecalcSeenAt<30000){
      if(now-lastUpdatedVoiceAt>5500){
        lastUpdatedVoiceAt=now;
        setTimeout(()=>normalNavSpeak('Rota atualizada.',false),350);
      }
      setTimeout(()=>{try{a.fetchHazardsAlongRoute?.()}catch(_){}},600);
    }
    return raw(message,...rest);
  };
  wrapped.__radarV210RerouteVoice=true;
  wrapped.__raw=raw;
  a.toast=wrapped;
  return true;
}

/* =========================================================
   HAZARDS ROBUSTOS AO LONGO DA ROTA TOMTOM
========================================================= */
const OVERPASS=[
  'https://overpass-api.de/api/interpreter?data=',
  'https://overpass.kumi.systems/api/interpreter?data='
];
function buildChunks(coords,maxMeters=4500){
  if(!Array.isArray(coords)||coords.length<2)return[];
  const chunks=[];let start=0,meters=0;
  for(let i=1;i<coords.length;i++){
    const d=distM(coords[i-1],coords[i]);
    if(Number.isFinite(d))meters+=d;
    if(meters>=maxMeters&&i-start>=2){
      chunks.push({start,end:i});
      start=Math.max(0,i-1);meters=0;
    }
  }
  if(start<coords.length-1)chunks.push({start,end:coords.length-1});
  return chunks;
}
function chunkBBox(coords,ch){
  let minLon=Infinity,maxLon=-Infinity,minLat=Infinity,maxLat=-Infinity;
  for(let i=ch.start;i<=ch.end;i++){
    const p=coords[i];if(!point(p))continue;
    minLon=Math.min(minLon,+p[0]);maxLon=Math.max(maxLon,+p[0]);
    minLat=Math.min(minLat,+p[1]);maxLat=Math.max(maxLat,+p[1]);
  }
  if(!Number.isFinite(minLon))return null;
  const margin=.0022;
  return `${minLat-margin},${minLon-margin},${maxLat+margin},${maxLon+margin}`;
}
function hazardType(el){
  const tags=el?.tags||{};
  if(tags.traffic_calming)return'lombada';
  if(tags.highway==='speed_camera')return'radar';
  if(tags.highway==='traffic_signals')return'semaforo';
  return null;
}
function elementPoint(el){
  const lat=Number(el?.lat??el?.center?.lat),lon=Number(el?.lon??el?.center?.lon);
  return Number.isFinite(lat)&&Number.isFinite(lon)?[lon,lat]:null;
}
async function overpassChunk(bbox){
  const query=`[out:json][timeout:12];(
node["traffic_calming"](${bbox});
way["traffic_calming"](${bbox});
node["highway"="speed_camera"](${bbox});
node["highway"="traffic_signals"](${bbox});
);out center tags;`;
  let lastError=null;
  for(const base of OVERPASS){
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),9500);
    try{
      const r=await fetch(base+encodeURIComponent(query),{cache:'no-store',signal:controller.signal});
      if(!r.ok)throw new Error('Overpass '+r.status);
      return await r.json();
    }catch(e){lastError=e;}
    finally{clearTimeout(timer);}
  }
  throw lastError||new Error('Overpass indisponível');
}
function toleranceFor(type){
  if(type==='radar')return 40;
  if(type==='lombada')return 45;
  return 45;
}
function nearestOnRoute(a,coords,ch,p){
  let nearestDist=Infinity,routeIndex=ch.start,routeBearing=0;
  const from=Math.max(0,ch.start-2),to=Math.min(coords.length-2,ch.end+2);
  for(let i=from;i<=to;i++){
    let res=null;
    try{res=a.Utils?.pointToSegment?.(p,coords[i],coords[i+1]);}catch(_){}
    if(!res){
      try{res=window.Utils?.pointToSegment?.(p,coords[i],coords[i+1]);}catch(_){}
    }
    if(!res||!Number.isFinite(res.distanceMeters))continue;
    if(res.distanceMeters<nearestDist){
      nearestDist=res.distanceMeters;routeIndex=i;routeBearing=Number(res.bearing)||0;
    }
  }
  return{nearestDist,routeIndex,routeBearing};
}
function installHazards(){
  const a=app();
  if(!a||typeof a.fetchHazardsAlongRoute!=='function'||typeof a.renderHazards!=='function')return false;
  if(a.fetchHazardsAlongRoute.__radarV210Hazards)return true;
  const robust=async function(){
    if(this.__v210HazardsBusy)return;
    this.__v210HazardsBusy=true;
    try{
      this.clearHazards?.();
      if(!this.navActive||!this.route?.coords?.length)return;
      const coords=this.route.coords,chunks=buildChunks(coords,4500),seen=new Set(),found=[];
      for(const ch of chunks){
        if(!this.navActive||this.route?.coords!==coords)break;
        const bbox=chunkBBox(coords,ch);if(!bbox)continue;
        let data;
        try{data=await overpassChunk(bbox);}catch(e){console.warn('Radar v210 hazards trecho',e);continue;}
        for(const el of data?.elements||[]){
          const type=hazardType(el),p=elementPoint(el);if(!type||!p)continue;
          const id=`${el.type||'node'}:${el.id||p.join(',')}:${type}`;
          if(seen.has(id))continue;
          const near=nearestOnRoute(this,coords,ch,p);
          if(near.nearestDist<=toleranceFor(type)){
            seen.add(id);
            found.push({type,coords:p,routeIndex:near.routeIndex,bearing:near.routeBearing,source:'osm-v210'});
          }
        }
      }
      if(!this.navActive||this.route?.coords!==coords)return;
      found.sort((x,y)=>(x.routeIndex||0)-(y.routeIndex||0));
      this.routeHazards=found;
      this.renderHazards();
      console.info('Radar v210 hazards carregados:',found.length);
    }finally{
      this.__v210HazardsBusy=false;
    }
  };
  robust.__radarV210Hazards=true;
  robust.__old=a.fetchHazardsAlongRoute;
  a.fetchHazardsAlongRoute=robust;

  if(typeof a.startNavigation==='function'&&!a.startNavigation.__radarV210HazardsStart){
    const rawStart=a.startNavigation;
    const startWrapped=function(...args){
      const out=rawStart.apply(this,args);
      setTimeout(()=>{try{this.fetchHazardsAlongRoute?.()}catch(_){}},900);
      return out;
    };
    startWrapped.__radarV210HazardsStart=true;
    a.startNavigation=startWrapped;
  }
  return true;
}

let tries=0;
const timer=setInterval(()=>{
  tries++;
  const c=installCamera();
  const r=installRerouteEventVoice();
  const h=installHazards();
  if((c&&r&&h)||tries>420)clearInterval(timer);
},80);

window.RadarTomTomNavigationPolishV210={
  version:'210',
  curve:()=>{const a=app();return a?curveInfo(a):null;},
  reloadHazards:()=>app()?.fetchHazardsAlongRoute?.()
};
})();
