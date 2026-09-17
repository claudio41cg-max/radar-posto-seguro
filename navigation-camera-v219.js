/* Radar Seguro RJ PRO v219 — camera suave e afastada em alta velocidade.
   Substitui apenas o override v217; nao altera GPS matching, rota, hazards, Gemini ou alertas. */
(()=>{'use strict';
if(window.__radarNavigationCameraV219)return;window.__radarNavigationCameraV219=true;
const app=()=>{try{return window.RadarApp||window.App||null}catch(_){return null}};
const point=p=>Array.isArray(p)&&p.length>=2&&Number.isFinite(+p[0])&&Number.isFinite(+p[1]);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const rad=d=>d*Math.PI/180,deg=r=>r*180/Math.PI;
const bearing=(a,b)=>{if(!point(a)||!point(b))return null;const p1=rad(+a[1]),p2=rad(+b[1]),dl=rad(+b[0]-+a[0]),y=Math.sin(dl)*Math.cos(p2),x=Math.cos(p1)*Math.sin(p2)-Math.sin(p1)*Math.cos(p2)*Math.cos(dl);return(deg(Math.atan2(y,x))+360)%360};
const blendAngle=(a,b,t)=>{const d=(((b-a)+540)%360)-180;return(a+d*t+360)%360};
function pos(a){for(const p of[a?.matchedUserPos,a?.userPos,a?.filteredPos,a?.rawUserPos])if(point(p))return p;return null}
function profile(s){if(s<15)return{z:17.35,p:55};if(s<35)return{z:17.05,p:54};if(s<55)return{z:16.7,p:52};if(s<80)return{z:16.25,p:49};if(s<105)return{z:15.75,p:46};return{z:15.4,p:44}}
let lastCenter=null,lastBearing=null,lastAt=0;
function camera(a){if(!a?.navActive||!a?.map)return;const raw=pos(a);if(!point(raw))return;const now=Date.now();if(now-lastAt<180)return;lastAt=now;const speed=Math.max(0,+a.currentSpeed||0),cfg=profile(speed);
 /* Centro segue a propria posicao do carro. Pequena interpolacao visual evita saltos entre fixes GPS. */
 const alpha=speed>=80?.72:speed>=40?.62:.52;const c=point(lastCenter)?[lastCenter[0]+(raw[0]-lastCenter[0])*alpha,lastCenter[1]+(raw[1]-lastCenter[1])*alpha]:raw;lastCenter=c;
 let br=Number.isFinite(+a.currentBearing)?(+a.currentBearing+360)%360:null;try{if(!Number.isFinite(br))br=a.map.getBearing()}catch(_){}if(!Number.isFinite(br))br=0;if(Number.isFinite(lastBearing))br=blendAngle(lastBearing,br,speed>50?.55:.42);lastBearing=br;
 try{const cv=a.map.getCanvas?.(),h=Math.max(400,cv?.clientHeight||innerHeight||700),w=Math.max(280,cv?.clientWidth||innerWidth||390),side=Math.round(clamp(w*.05,18,46)),top=Math.round(clamp(h*.075,48,82)),bottom=Math.round(clamp(h*(speed>=80?.25:.29),135,h*.34));a.followMode=true;
 /* duration menor que intervalo normal de GPS: evita acumular animacoes easeTo, causa principal do efeito de pulo. */
 a.map.easeTo({center:c,zoom:cfg.z,pitch:cfg.p,bearing:br,padding:{top,left:side,right:side,bottom},duration:180,essential:true});}catch(e){console.warn('Radar v219 camera',e)}}
function install(){const a=app();if(!a?.map)return false;if(a.__cameraV219Installed)return true;a.__cameraV219Installed=true;
 /* v218 carrega v219 no lugar de v217. GPS/matching continuam pertencendo ao engine v191. */
 const old=typeof a.handleGPS==='function'?a.handleGPS.bind(a):null;if(old)a.handleGPS=function(...args){const out=old(...args);requestAnimationFrame(()=>camera(a));return out};
 const start=typeof a.startNavigation==='function'?a.startNavigation.bind(a):null;if(start)a.startNavigation=function(...args){lastCenter=null;lastBearing=null;lastAt=0;const out=start(...args);setTimeout(()=>camera(a),120);return out};return true}
let n=0,t=setInterval(()=>{if(install()||++n>300)clearInterval(t)},100);
window.RadarNavigationCameraV219={version:'219',refresh:()=>camera(app())};
})();