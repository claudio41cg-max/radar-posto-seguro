/* Radar Seguro RJ PRO v209 — camera de navegacao TomTom mais estavel em curvas + aviso de recálculo.
   Nao altera IA. Mantem as manobras/announcement points da TomTom v196. */
(()=>{
'use strict';
if(window.__radarTomTomNavigationPolishV209)return;
window.__radarTomTomNavigationPolishV209=true;

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
  const p1=routePointAt(a,28);
  const p2=routePointAt(a,72);
  const p3=routePointAt(a,130);
  if(!point(p0)||!point(p1)||!point(p2)||!point(p3))return{strength:0,angle:0,bNow:null,bFuture:null};
  const bNow=bearing(p0,p1),bMid=bearing(p1,p2),bFuture=bearing(p2,p3);
  if(!Number.isFinite(bNow)||!Number.isFinite(bMid)||!Number.isFinite(bFuture))return{strength:0,angle:0,bNow,bFuture};
  const angle=Math.max(angleDiff(bNow,bMid),angleDiff(bMid,bFuture),angleDiff(bNow,bFuture));
  const strength=clamp((angle-12)/72,0,1);
  return{strength,angle,bNow,bFuture};
}

function cameraAdjustment(a,opts){
  if(!a?.navActive||!a?.route||!a?.map)return opts;
  const p=displayPoint(a);
  if(!point(p))return opts;

  const speed=Math.max(0,+a.currentSpeed||0);
  const cv=curveInfo(a);
  const s=cv.strength;

  let baseAhead;
  if(speed<15)baseAhead=82;
  else if(speed<35)baseAhead=102;
  else if(speed<55)baseAhead=125;
  else if(speed<80)baseAhead=150;
  else baseAhead=180;

  const aheadDist=baseAhead*(1-.45*s);
  const target=routePointAt(a,aheadDist);
  const centerMix=.80-.30*s;
  const center=point(target)?mix(p,target,centerMix):p;

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

  return{
    ...opts,
    center,
    zoom,
    pitch,
    bearing:Number.isFinite(b)?b:opts.bearing,
    duration:Math.max(360,Number(opts.duration)||0),
    essential:true
  };
}

function installCamera(){
  const a=app(),m=a?.map;
  if(!m||typeof m.easeTo!=='function')return false;
  if(m.__tomTomCameraV209Installed)return true;
  m.__tomTomCameraV209Installed=true;
  const raw=m.easeTo.bind(m);
  m.__easeToBeforeTomTomCameraV209=raw;
  m.easeTo=function(opts){
    try{
      if(a.navActive&&a.route&&opts&&typeof opts==='object'){
        return raw(cameraAdjustment(a,{...opts}));
      }
    }catch(e){console.warn('Radar v209 camera',e);}
    return raw(opts);
  };
  return true;
}

function speakRecalculating(){
  try{
    const v=window.Voice;
    if(v&&typeof v.speak==='function')v.speak('Recalculando rota.',true);
  }catch(_){}
}

function installRerouteVoice(){
  const a=app();
  if(!a||typeof a.getRoute!=='function')return false;
  if(a.__tomTomRerouteVoiceV209Installed)return true;
  a.__tomTomRerouteVoiceV209Installed=true;
  const old=a.getRoute.bind(a);
  let last=0;
  a.getRoute=async function(...args){
    const rerouting=!!this.navActive&&!!this.route;
    if(rerouting&&Date.now()-last>7000){
      last=Date.now();
      speakRecalculating();
    }
    return old(...args);
  };
  return true;
}

let tries=0;
const timer=setInterval(()=>{
  tries++;
  const c=installCamera();
  const r=installRerouteVoice();
  if((c&&r)||tries>320)clearInterval(timer);
},80);

window.RadarTomTomNavigationPolishV209={
  version:'209',
  curve:()=>{const a=app();return a?curveInfo(a):null;}
};
})();
