/* Radar Seguro RJ PRO v187 — rota principal TomTom direta, origem GPS real e proteção contra saída no sentido errado. */
(()=>{
'use strict';
if(window.__radarRoutingIntegrityV187)return;
window.__radarRoutingIntegrityV187=true;

const WORKER='https://radar-seguro-ia-rj.claudio41cg.workers.dev';
const app=()=>{try{return window.RadarApp||window.App||null;}catch(_){return null;}};
const point=p=>Array.isArray(p)&&p.length>=2&&Number.isFinite(+p[0])&&Number.isFinite(+p[1]);
const rad=d=>d*Math.PI/180,deg=r=>r*180/Math.PI;
function distM(a,b){if(!point(a)||!point(b))return Infinity;const R=6371000,p1=rad(+a[1]),p2=rad(+b[1]),d1=p2-p1,d2=rad(+b[0]-+a[0]);const q=Math.sin(d1/2)**2+Math.cos(p1)*Math.cos(p2)*Math.sin(d2/2)**2;return 2*R*Math.asin(Math.min(1,Math.sqrt(q)));}
function bearing(a,b){if(!point(a)||!point(b))return null;const p1=rad(+a[1]),p2=rad(+b[1]),dl=rad(+b[0]-+a[0]),y=Math.sin(dl)*Math.cos(p2),x=Math.cos(p1)*Math.sin(p2)-Math.sin(p1)*Math.cos(p2)*Math.cos(dl);return(deg(Math.atan2(y,x))+360)%360;}
function angleDiff(a,b){return Math.abs((((a-b)+540)%360)-180);}
function liveOrigin(a,fallback){
  const acc=Math.max(0,+a?.currentAccuracy||999);
  if(point(a?.rawUserPos)&&acc<=100)return[+a.rawUserPos[0],+a.rawUserPos[1]];
  if(point(a?.filteredPos))return[+a.filteredPos[0],+a.filteredPos[1]];
  if(point(a?.rawUserPos))return[+a.rawUserPos[0],+a.rawUserPos[1]];
  if(point(a?.userPos))return[+a.userPos[0],+a.userPos[1]];
  return point(fallback)?[+fallback[0],+fallback[1]]:null;
}
function vehicleHeading(a){
  const speed=Math.max(0,+a?.currentSpeed||0),trusted=Math.max(0,+a?.lastTrustedSpeed||0),h=+a?.currentBearing;
  return (speed>=6||trusted>=6)&&Number.isFinite(h)?Math.round((h+360)%360):null;
}
function firstTravelBearing(coords,origin){
  if(!Array.isArray(coords)||coords.length<2||!point(origin))return null;
  for(let i=1;i<Math.min(coords.length,120);i++)if(distM(origin,coords[i])>=35)return bearing(origin,coords[i]);
  return bearing(coords[0],coords[Math.min(coords.length-1,1)]);
}
function hasEarlyReturn(coords,origin){
  if(!Array.isArray(coords)||coords.length<4||!point(origin))return false;
  let travelled=0;
  for(let i=1;i<coords.length&&travelled<900;i++){
    travelled+=distM(coords[i-1],coords[i]);
    if(travelled>120&&distM(origin,coords[i])<32)return true;
  }
  return false;
}
function uturnCount(rt){return(rt?.guidance?.instructions||[]).filter(i=>/U.?TURN|TURN_AROUND|TURNAROUND|MAKE_UTURN/i.test(String(i?.maneuver||'')+' '+String(i?.message||''))).length;}
function quality(rt,origin,dest,heading,speed){
  const coords=[];
  for(const leg of rt?.legs||[])for(const p of leg?.points||[]){const c=[+p.longitude,+p.latitude],z=coords[coords.length-1];if(c.every(Number.isFinite)&&(!z||z[0]!==c[0]||z[1]!==c[1]))coords.push(c);}
  if(coords.length<2)return{valid:false,score:Infinity,coords,reason:'sem geometria'};
  const sd=distM(coords[0],origin),ed=distM(coords[coords.length-1],dest),fb=firstTravelBearing(coords,origin),hd=Number.isFinite(heading)&&Number.isFinite(fb)?angleDiff(heading,fb):0,loop=hasEarlyReturn(coords,origin),uturns=uturnCount(rt),sec=+rt.summary?.travelTimeInSeconds||999999;
  let valid=sd<=180&&ed<=260;
  if(speed>=8&&Number.isFinite(heading)&&Number.isFinite(fb)&&hd>128)valid=false;
  if(loop)valid=false;
  const score=sec+Math.min(sd,300)*1.4+Math.min(ed,300)*.6+(speed>=8?hd*4:0)+(loop?8000:0)+uturns*2400;
  return{valid,score,coords,sd,ed,headingDiff:hd,loop,uturns,reason:loop?'retorno precoce':hd>128?'sentido inicial incompatível':uturns?'retorno em U penalizado':''};
}
function modifier(a,type){try{return a.tomTomModifier?.(type)||'straight';}catch(_){const t=String(type||'').toUpperCase();if(t.includes('LEFT'))return'left';if(t.includes('RIGHT'))return'right';if(t.includes('ROUNDABOUT'))return'roundabout';if(t.includes('UTURN')||t.includes('TURN_AROUND'))return'uturn';return'straight';}}
function normalize(a,rt,coords){
  const steps=(rt.guidance?.instructions||[]).map(i=>({name:i.street||i.roadNumbers?.[0]||'Siga pela via',maneuver:{type:i.maneuver||'',modifier:modifier(a,i.maneuver),location:[+i.point?.longitude,+i.point?.latitude]},routeOffsetMeters:Number(i.routeOffsetInMeters)||0}));
  const route={coords,steps,distance:+rt.summary?.lengthInMeters||0,duration:+rt.summary?.travelTimeInSeconds||0,trafficDelaySeconds:+rt.summary?.trafficDelayInSeconds||0,liveTraffic:true,engine:'tomtom',provider:'TomTom',routingVersion:'187',tomtomRoute:rt};
  try{a.prepareRouteGeometry?.(route);}catch(_){}
  return route;
}
async function requestTomTom(a,origin,dest,attempt=0){
  const mode=a.transportMode==='motorcycle'?'motorcycle':'car',h=vehicleHeading(a),params=new URLSearchParams({traffic:'true',travelMode:mode,instructionsType:'text',language:'pt-BR',routeType:'fastest',avoid:'unpavedRoads',routeRepresentation:'polyline',computeTravelTimeFor:'all',maxAlternatives:'2'});
  if(h!=null)params.set('vehicleHeading',String(h));
  const path=`/routing/1/calculateRoute/${origin[1].toFixed(6)},${origin[0].toFixed(6)}:${dest[1].toFixed(6)},${dest[0].toFixed(6)}/json?${params.toString()}`;
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),9000);
  try{
    const r=await fetch(`${WORKER}/v1/tomtom?path=${encodeURIComponent(path)}`,{signal:controller.signal,cache:'no-store',headers:{Accept:'application/json'}});
    if(!r.ok)throw new Error('TomTom HTTP '+r.status);
    const j=await r.json();if(!Array.isArray(j.routes)||!j.routes.length)throw new Error('TomTom sem rota');
    const speed=Math.max(0,+a.currentSpeed||0),ranked=j.routes.map(rt=>({rt,q:quality(rt,origin,dest,h,speed)})).filter(x=>x.q.coords.length>=2).sort((x,y)=>(x.q.valid===y.q.valid?x.q.score-y.q.score:(x.q.valid?-1:1)));
    const chosen=ranked.find(x=>x.q.valid)||ranked[0];
    if(!chosen)throw new Error('TomTom sem geometria válida');
    if(!chosen.q.valid&&attempt<1){console.warn('Radar v187: rota TomTom suspeita, repetindo cálculo',chosen.q);return requestTomTom(a,origin,dest,attempt+1);}
    if(!chosen.q.valid)throw new Error('TomTom devolveu rota incompatível com a posição/sentido atual');
    const route=normalize(a,chosen.rt,chosen.q.coords);route.routeQuality=chosen.q;route.originUsed=origin;route.vehicleHeadingUsed=h;return route;
  }finally{clearTimeout(timer);}
}
function install(){
  const a=app();if(!a?.map)return false;if(a.__routingIntegrityV187)return true;a.__routingIntegrityV187=true;
  a.fetchTomTomRoute=async function(start,end){const origin=liveOrigin(this,start),dest=point(end)?[+end[0],+end[1]]:null;if(!origin||!dest)throw new Error('Origem ou destino inválido');return requestTomTom(this,origin,dest,0);};
  a.getRoute=async function(start,end){
    const origin=liveOrigin(this,start),dest=point(end)?[+end[0],+end[1]]:null;if(!origin||!dest)throw new Error('Aguardando GPS ou destino');
    try{return await requestTomTom(this,origin,dest,0);}catch(e){console.warn('Radar v187: TomTom não confirmou uma rota segura',e);this.toast?.('Não consegui confirmar a rota pela TomTom. Tente novamente em alguns segundos.',4200);throw e;}
  };
  const oldCalc=typeof a.calculateRoute==='function'?a.calculateRoute.bind(a):null;
  if(oldCalc)a.calculateRoute=async function(...args){
    try{window.RadarRouteAlternativesV116?.clear?.();}catch(_){}
    return oldCalc(...args);
  };
  console.info('Radar v187: roteamento principal fixado na TomTom, com GPS real e direção do veículo.');
  return true;
}
let tries=0,t=setInterval(()=>{tries++;if(install()||tries>300)clearInterval(t);},100);
window.RadarRoutingIntegrityV187={version:'187',liveOrigin:()=>{const a=app();return a?liveOrigin(a,a.userPos):null;}};
})();