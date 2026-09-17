/* Radar Seguro RJ PRO v220 — controlador unico de camera FOLLOW.
   Inspirado no comportamento FollowRouteDirection: carro em ancora inferior, rota para cima,
   camera continua. Nao altera matching GPS, recálculo, rota, hazards, Gemini ou alertas. */
(()=>{'use strict';
if(window.__radarNavigationCameraV220)return;window.__radarNavigationCameraV220=true;
const app=()=>{try{return window.RadarApp||window.App||null}catch(_){return null}};
const point=p=>Array.isArray(p)&&p.length>=2&&Number.isFinite(+p[0])&&Number.isFinite(+p[1]);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const rad=d=>d*Math.PI/180,deg=r=>r*180/Math.PI;
const bearing=(a,b)=>{if(!point(a)||!point(b))return null;const p1=rad(+a[1]),p2=rad(+b[1]),dl=rad(+b[0]-+a[0]),y=Math.sin(dl)*Math.cos(p2),x=Math.cos(p1)*Math.sin(p2)-Math.sin(p1)*Math.cos(p2)*Math.cos(dl);return(deg(Math.atan2(y,x))+360)%360};
const angle=(a,b,t)=>{const d=(((b-a)+540)%360)-180;return(a+d*t+360)%360};
function p(a){for(const x of[a?.matchedUserPos,a?.userPos,a?.filteredPos,a?.rawUserPos])if(point(x))return x;return null}
function routeBearing(a,pos){const c=a?.route?.coords;if(!Array.isArray(c)||c.length<2)return null;let i=clamp(+a.routeProgressIndex||0,0,c.length-2),j=Math.min(c.length-1,i+Math.max(2,Math.round((+a.currentSpeed||0)/12)));const q=c[j];return point(q)?bearing(pos,q):null}
function profile(s){if(s<15)return{z:17.35,pitch:66,bottom:.35};if(s<35)return{z:17.05,pitch:66,bottom:.34};if(s<55)return{z:16.70,pitch:65,bottom:.33};if(s<80)return{z:16.30,pitch:64,bottom:.32};if(s<105)return{z:15.85,pitch:63,bottom:.31};return{z:15.55,pitch:62,bottom:.30}}
let target=null,shown=null,targetBearing=null,shownBearing=null,lastGpsAt=0,lastFrame=0,raf=0,installed=false;
function capture(a){if(!a?.navActive)return;const q=p(a);if(!point(q))return;target=q.slice();lastGpsAt=performance.now();const rb=routeBearing(a,q),hb=Number.isFinite(+a.currentBearing)?(+a.currentBearing+360)%360:null;targetBearing=Number.isFinite(rb)&&Number.isFinite(hb)?angle(hb,rb,.38):(Number.isFinite(rb)?rb:(Number.isFinite(hb)?hb:targetBearing));if(!point(shown))shown=target.slice();if(!Number.isFinite(shownBearing))shownBearing=targetBearing;}
function frame(ts){raf=requestAnimationFrame(frame);const a=app();if(!a?.navActive||!a?.map||!point(target))return;if(ts-lastFrame<28)return;lastFrame=ts;
 /* Interpolacao continua independente da frequencia do GPS. Nao cria fila de easeTo. */
 const s=Math.max(0,+a.currentSpeed||0),k=s>=80?.24:s>=40?.20:.16;shown=[shown[0]+(target[0]-shown[0])*k,shown[1]+(target[1]-shown[1])*k];if(Number.isFinite(targetBearing))shownBearing=Number.isFinite(shownBearing)?angle(shownBearing,targetBearing,.16):targetBearing;const cfg=profile(s);
 try{const cv=a.map.getCanvas?.(),h=Math.max(400,cv?.clientHeight||innerHeight||700),w=Math.max(280,cv?.clientWidth||innerWidth||390),side=Math.round(clamp(w*.05,18,46)),top=Math.round(clamp(h*.065,42,72)),bottom=Math.round(clamp(h*cfg.bottom,150,h*.39));a.followMode=true;
 /* jumpTo por frame: um controlador, sem animacoes concorrentes. Padding coloca o carro abaixo do centro. */
 a.map.jumpTo({center:shown,zoom:cfg.z,pitch:cfg.pitch,bearing:Number.isFinite(shownBearing)?shownBearing:0,padding:{top,left:side,right:side,bottom}});}catch(_){}}
function install(){const a=app();if(!a?.map)return false;if(installed)return true;installed=true;
 const old=typeof a.handleGPS==='function'?a.handleGPS.bind(a):null;if(old)a.handleGPS=function(...args){const out=old(...args);capture(a);return out};
 const start=typeof a.startNavigation==='function'?a.startNavigation.bind(a):null;if(start)a.startNavigation=function(...args){target=shown=null;targetBearing=shownBearing=null;const out=start(...args);setTimeout(()=>capture(a),80);return out};
 capture(a);if(!raf)raf=requestAnimationFrame(frame);return true}
let tries=0,t=setInterval(()=>{if(install()||++tries>300)clearInterval(t)},100);
window.RadarNavigationCameraV220={version:'220',refresh:()=>capture(app())};
})();