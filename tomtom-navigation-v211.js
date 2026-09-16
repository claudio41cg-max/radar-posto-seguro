/* Radar Seguro RJ PRO v211
   Ajuste consolidado do teste TomTom.
   - preserva a camera aprovada da v209
   - respeita gesto manual por 10s durante a navegacao
   - na tela normal, main-map-manual-hold-v168 continua sem retorno automatico
   - fala "Recalculando rota" no evento real do motor v191
   - restaura radares, lombadas e semaforos somente ao longo da rota
   - nao altera Gemini/IA
*/
(()=>{
'use strict';
if(window.__radarTomTomNavigationV211)return;
window.__radarTomTomNavigationV211=true;

const app=()=>{try{return window.RadarApp||window.App||null}catch(_){return null}};
const point=p=>Array.isArray(p)&&p.length>=2&&Number.isFinite(+p[0])&&Number.isFinite(+p[1]);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const rad=d=>d*Math.PI/180;
const deg=r=>r*180/Math.PI;
const mix=(a,b,t)=>[+a[0]+(+b[0]-+a[0])*t,+a[1]+(+b[1]-+a[1])*t];
const distM=(a,b)=>{
  if(!point(a)||!point(b))return Infinity;
  const R=6371000,p1=rad(+a[1]),p2=rad(+b[1]),d1=p2-p1,d2=rad(+b[0]-+a[0]);
  const q=Math.sin(d1/2)**2+Math.cos(p1)*Math.cos(p2)*Math.sin(d2/2)**2;
  return 2*R*Math.asin(Math.min(1,Math.sqrt(q)));
};
const bearing=(a,b)=>{
  if(!point(a)||!point(b))return null;
  const p1=rad(+a[1]),p2=rad(+b[1]),dl=rad(+b[0]-+a[0]);
  const y=Math.sin(dl)*Math.cos(p2),x=Math.cos(p1)*Math.sin(p2)-Math.sin(p1)*Math.cos(p2)*Math.cos(dl);
  return(deg(Math.atan2(y,x))+360)%360;
};
const signedAngle=(a,b)=>(((b-a)+540)%360)-180;
const angleDiff=(a,b)=>Math.abs(signedAngle(a,b));
const blendAngle=(a,b,t)=>(a+signedAngle(a,b)*t+360)%360;

/* =========================================================
   CAMERA v209 + GESTO MANUAL 10s
========================================================= */
let manualNavUntil=0;
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
    const d=distM(c[i-1],c[i]);total+=Number.isFinite(d)?d:0;out[i]=total;
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
    if(target<=y){const t=y>x?clamp((target-x)/(y-x),0,1):0;return mix(c[i],c[i+1],t);}
  }
  return c[c.length-1];
}
function curveInfo(a){
  const p0=displayPoint(a)||routePointAt(a,0),p1=routePointAt(a,28),p2=routePointAt(a,72),p3=routePointAt(a,130);
  if(!point(p0)||!point(p1)||!point(p2)||!point(p3))return{strength:0,bNow:null,bFuture:null};
  const bNow=bearing(p0,p1),bMid=bearing(p1,p2),bFuture=bearing(p2,p3);
  if(!Number.isFinite(bNow)||!Number.isFinite(bMid)||!Number.isFinite(bFuture))return{strength:0,bNow,bFuture};
  const angle=Math.max(angleDiff(bNow,bMid),angleDiff(bMid,bFuture),angleDiff(bNow,bFuture));
  return{strength:clamp((angle-12)/72,0,1),bNow,bFuture};
}
function cameraAdjustment(a,opts){
  if(!a?.navActive||!a?.route||!a?.map)return opts;
  const p=displayPoint(a);if(!point(p))return opts;
  const speed=Math.max(0,+a.currentSpeed||0),cv=curveInfo(a),s=cv.strength;
  let baseAhead=speed<15?82:speed<35?102:speed<55?125:speed<80?150:180;
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
function installCameraAndManualHold(){
  const a=app(),m=a?.map;
  if(!m||typeof m.easeTo!=='function'||typeof m.on!=='function')return false;
  if(m.__radarV211Camera)return true;
  m.__radarV211Camera=true;
  const raw=m.easeTo.bind(m);
  m.__easeToBeforeV211=raw;
  m.easeTo=function(opts){
    try{
      if(a.navActive){
        if(Date.now()<manualNavUntil)return;
        if(opts&&typeof opts==='object')return raw(cameraAdjustment(a,{...opts}));
      }
    }catch(e){console.warn('Radar v211 camera',e);}
    return raw(opts);
  };
  const hold=()=>{if(a.navActive){manualNavUntil=Date.now()+10000;a.followMode=false;}};
  ['dragstart','zoomstart','rotatestart','pitchstart'].forEach(ev=>m.on(ev,e=>{if(e?.originalEvent)setTimeout(hold,0);}));
  ['navRecenterLeft','btnRecenter','locateBtn'].forEach(id=>document.getElementById(id)?.addEventListener('click',()=>{if(a.navActive){manualNavUntil=0;a.followMode=true;}},true));
  if(typeof a.startNavigation==='function'&&!a.startNavigation.__v211ClearManual){
    const old=a.startNavigation;
    const wrap=function(...args){manualNavUntil=0;return old.apply(this,args);};
    wrap.__v211ClearManual=true;a.startNavigation=wrap;
  }
  return true;
}

/* =========================================================
   VOZ DE RECALCULO NO EVENTO REAL DO MOTOR v191
========================================================= */
let lastRecalc=0,lastUpdated=0,lastRecalcSeen=0;
function navSpeak(text,force=true){try{window.Voice?.speak?.(text,force);}catch(_){}}
function installRerouteVoice(){
  const a=app();if(!a||typeof a.toast!=='function')return false;
  if(a.toast.__radarV211Reroute)return true;
  const raw=a.toast.bind(a);
  const wrap=function(message,...rest){
    const text=String(message||''),now=Date.now();
    if(/^Recalculando rota/i.test(text)){
      lastRecalcSeen=now;
      if(now-lastRecalc>5000){lastRecalc=now;navSpeak('Recalculando rota.',true);}
    }else if(/^Rota atualizada/i.test(text)&&now-lastRecalcSeen<30000){
      if(now-lastUpdated>5000){lastUpdated=now;setTimeout(()=>navSpeak('Rota atualizada.',false),350);}
      setTimeout(()=>{try{a.fetchHazardsAlongRoute?.()}catch(_){}},500);
    }
    return raw(message,...rest);
  };
  wrap.__radarV211Reroute=true;
  a.toast=wrap;
  return true;
}

/* =========================================================
   HAZARDS SOMENTE NO CORREDOR DA ROTA
========================================================= */
const OVERPASS=[
  'https://overpass-api.de/api/interpreter?data=',
  'https://overpass.kumi.systems/api/interpreter?data='
];
function sampleRoute(coords,spacing=280){
  if(!Array.isArray(coords)||coords.length<2)return[];
  const out=[coords[0]],last=()=>out[out.length-1];
  let acc=0;
  for(let i=1;i<coords.length;i++){
    const d=distM(coords[i-1],coords[i]);if(Number.isFinite(d))acc+=d;
    if(acc>=spacing){out.push(coords[i]);acc=0;}
  }
  if(distM(last(),coords[coords.length-1])>20)out.push(coords[coords.length-1]);
  return out.filter(point);
}
function groups(arr,size=32){const out=[];for(let i=0;i<arr.length;i+=size-1)out.push(arr.slice(Math.max(0,i?i-1:0),i+size));return out;}
function lineArgs(points){return points.map(p=>`${(+p[1]).toFixed(6)},${(+p[0]).toFixed(6)}`).join(',');}
function hazardType(el){
  const t=el?.tags||{};
  if(t.traffic_calming)return'lombada';
  if(t.highway==='speed_camera')return'radar';
  if(t.highway==='traffic_signals')return'semaforo';
  return null;
}
function elementPoint(el){
  const lat=Number(el?.lat??el?.center?.lat),lon=Number(el?.lon??el?.center?.lon);
  return Number.isFinite(lat)&&Number.isFinite(lon)?[lon,lat]:null;
}
async function queryCorridor(points){
  const args=lineArgs(points);
  const q=`[out:json][timeout:18];(
node["traffic_calming"](around:85,${args});
way["traffic_calming"](around:85,${args});
node["highway"="speed_camera"](around:85,${args});
node["highway"="traffic_signals"](around:85,${args});
);out center tags qt;`;
  let lastErr=null;
  for(const base of OVERPASS){
    const ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),14000);
    try{
      const r=await fetch(base+encodeURIComponent(q),{cache:'no-store',signal:ctl.signal});
      if(!r.ok)throw new Error('Overpass '+r.status);
      return await r.json();
    }catch(e){lastErr=e;}finally{clearTimeout(timer);}
  }
  throw lastErr||new Error('Overpass indisponivel');
}
function segmentProjection(p,a,b){
  const lat0=rad(+p[1]),sx=111320*Math.max(.2,Math.cos(lat0)),sy=110574;
  const ax=(+a[0]-+p[0])*sx,ay=(+a[1]-+p[1])*sy,bx=(+b[0]-+p[0])*sx,by=(+b[1]-+p[1])*sy;
  const dx=bx-ax,dy=by-ay,den=dx*dx+dy*dy,t=den>0?clamp((-(ax*dx+ay*dy))/den,0,1):0;
  const x=ax+dx*t,y=ay+dy*t;
  return{distance:Math.hypot(x,y),bearing:bearing(a,b)};
}
function nearestRoute(coords,p){
  let best=Infinity,index=0,b=0;
  for(let i=0;i<coords.length-1;i++){
    const pr=segmentProjection(p,coords[i],coords[i+1]);
    if(pr.distance<best){best=pr.distance;index=i;b=Number(pr.bearing)||0;}
  }
  return{distance:best,index,bearing:b};
}
function tolerance(type){return type==='semaforo'?48:type==='lombada'?42:40;}
function clearMarkers(a){
  (a.hazardMarkers||[]).forEach(m=>{try{m.remove()}catch(_){}});
  a.hazardMarkers=[];
}
function renderHazardsV211(a){
  clearMarkers(a);
  if(!a?.route?.coords?.length)return;
  const lib=window.maplibregl;if(!lib?.Marker)return;
  for(const h of a.routeHazards||[]){
    if(a.navActive&&Number.isFinite(+a.routeProgressIndex)&&h.routeIndex<+a.routeProgressIndex-5)continue;
    const el=document.createElement('div');el.className='hazard-marker';
    try{el.innerHTML=a.hazardSVG?.(h.type)||'';}catch(_){el.textContent=h.type==='radar'?'📷':h.type==='lombada'?'⚠':'🚦';}
    try{a.hazardMarkers.push(new lib.Marker({element:el,anchor:'center'}).setLngLat(h.coords).addTo(a.map));}catch(_){}
  }
}
function installHazards(){
  const a=app();
  if(!a||typeof a.hazardSVG!=='function'||!a.map)return false;
  if(a.__radarV211Hazards)return true;
  a.__radarV211Hazards=true;

  const fetchHazards=async function(){
    if(this.__v211HazardsBusy)return;
    const coords=this.route?.coords;
    if(!Array.isArray(coords)||coords.length<2){this.routeHazards=[];clearMarkers(this);return;}
    this.__v211HazardsBusy=true;
    try{
      const sampled=sampleRoute(coords,280),parts=groups(sampled,32),all=[];
      const results=await Promise.allSettled(parts.map(p=>queryCorridor(p)));
      for(const r of results)if(r.status==='fulfilled')all.push(...(r.value?.elements||[]));
      const seen=new Set(),found=[];
      for(const el of all){
        const type=hazardType(el),p=elementPoint(el);if(!type||!p)continue;
        const id=`${el.type||'node'}:${el.id||p.join(',')}:${type}`;if(seen.has(id))continue;seen.add(id);
        const near=nearestRoute(coords,p);
        if(near.distance<=tolerance(type))found.push({type,coords:p,routeIndex:near.index,bearing:near.bearing,source:'osm-route-v211'});
      }
      found.sort((x,y)=>x.routeIndex-y.routeIndex);
      if(this.route?.coords!==coords)return;
      this.routeHazards=found;
      renderHazardsV211(this);
      try{this.updateTrafficLightHUD?.();}catch(_){}
      console.info('Radar v211 hazards:',found.length);
    }catch(e){console.warn('Radar v211 hazards',e);}finally{this.__v211HazardsBusy=false;}
  };
  fetchHazards.__radarV211=true;
  a.fetchHazardsAlongRoute=fetchHazards;
  a.renderHazards=function(){renderHazardsV211(this);};

  if(typeof a.calculateRoute==='function'&&!a.calculateRoute.__v211Hazards){
    const old=a.calculateRoute;
    const wrap=async function(...args){
      const out=await old.apply(this,args);
      setTimeout(()=>{try{this.fetchHazardsAlongRoute?.()}catch(_){}},250);
      return out;
    };
    wrap.__v211Hazards=true;a.calculateRoute=wrap;
  }
  if(typeof a.startNavigation==='function'&&!a.startNavigation.__v211Hazards){
    const old=a.startNavigation;
    const wrap=function(...args){const out=old.apply(this,args);setTimeout(()=>{try{this.fetchHazardsAlongRoute?.()}catch(_){}},300);return out;};
    wrap.__v211Hazards=true;a.startNavigation=wrap;
  }
  if(a.route?.coords?.length)setTimeout(()=>a.fetchHazardsAlongRoute(),400);
  return true;
}

let tries=0;
const timer=setInterval(()=>{
  tries++;
  const c=installCameraAndManualHold();
  const r=installRerouteVoice();
  const h=installHazards();
  if((c&&r&&h)||tries>420)clearInterval(timer);
},80);

window.RadarTomTomNavigationV211={
  version:'211',
  reloadHazards:()=>app()?.fetchHazardsAlongRoute?.(),
  manualHoldMs:10000
};
})();
