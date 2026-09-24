/* Radar Seguro RJ PRO v223 — ajuste fino da camera V222.
   Mantem integralmente a logica FOLLOW aprovada da V222; altera somente o enquadramento
   vertical para deixar o veiculo um pouco mais baixo e aproveitar mais mapa a frente. */
(()=>{'use strict';
if(window.__radarNavigationCameraV223)return;window.__radarNavigationCameraV223=true;
const app=()=>{try{return window.RadarApp||window.App||null}catch(_){return null}};
const point=p=>Array.isArray(p)&&p.length>=2&&Number.isFinite(+p[0])&&Number.isFinite(+p[1]);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const rad=d=>d*Math.PI/180,deg=r=>r*180/Math.PI;
const bearing=(a,b)=>{if(!point(a)||!point(b))return null;const p1=rad(+a[1]),p2=rad(+b[1]),dl=rad(+b[0]-+a[0]),y=Math.sin(dl)*Math.cos(p2),x=Math.cos(p1)*Math.sin(p2)-Math.sin(p1)*Math.cos(p2)*Math.cos(dl);return(deg(Math.atan2(y,x))+360)%360};
const blend=(a,b,t)=>{const d=(((b-a)+540)%360)-180;return(a+d*t+360)%360};
function vehicle(a){for(const q of[a?.matchedUserPos,a?.userPos,a?.filteredPos,a?.rawUserPos])if(point(q))return q;return null}
function roadBearing(a,p){const c=a?.route?.coords;if(!Array.isArray(c)||c.length<2)return null;const i=clamp(+a.routeProgressIndex||0,0,c.length-2);let d=0,last=c[i];for(let j=i+1;j<c.length;j++){const q=c[j];if(!point(last)||!point(q))continue;const dx=(q[0]-last[0])*111320*Math.cos(rad(q[1])),dy=(q[1]-last[1])*110574;d+=Math.hypot(dx,dy);if(d>=22)return bearing(c[i],q);last=q;}return point(c[i])&&point(c[c.length-1])?bearing(c[i],c[c.length-1]):null}
function profile(s){if(s<15)return{z:17.20,p:58};if(s<35)return{z:16.95,p:58};if(s<55)return{z:16.55,p:58};if(s<80)return{z:16.10,p:57};if(s<105)return{z:15.60,p:56};return{z:15.25,p:55}}
let target=null,shown=null,targetBearing=null,shownBearing=null,last=0,raf=0,installed=false,manualUntil=0;
let freeHeading=null,previousFree=null,previousFreeAt=0;
function capture(a){const q=vehicle(a);if(!point(q))return;
 if(!a.navActive){
   const now=Date.now(),speed=Math.max(0,+a.currentSpeed||0),accuracy=+a.currentAccuracy;
   const gpsHeading=+a.currentBearing;
   if(speed>=6&&Number.isFinite(gpsHeading)&&gpsHeading>=0&&gpsHeading<360&&(!Number.isFinite(accuracy)||accuracy<=60))freeHeading=gpsHeading;
   else if(point(previousFree)&&now-previousFreeAt<8000&&(!Number.isFinite(accuracy)||accuracy<=35)){
     const dx=(q[0]-previousFree[0])*111320*Math.cos(rad(q[1])),dy=(q[1]-previousFree[1])*110574;
     if(Math.hypot(dx,dy)>=8&&now-previousFreeAt>=600)freeHeading=bearing(previousFree,q);
   }
   if(!point(previousFree)||Math.hypot((q[0]-previousFree[0])*111320*Math.cos(rad(q[1])),(q[1]-previousFree[1])*110574)>=8||now-previousFreeAt>8000){previousFree=q.slice();previousFreeAt=now;}
   target=q.slice();targetBearing=freeHeading;shown=q.slice();shownBearing=freeHeading;return;
 }
 target=q.slice();const rb=roadBearing(a,q),hb=Number.isFinite(+a.currentBearing)?(+a.currentBearing+360)%360:null;targetBearing=Number.isFinite(rb)?rb:(Number.isFinite(hb)?hb:targetBearing);if(!point(shown))shown=target.slice();if(!Number.isFinite(shownBearing))shownBearing=targetBearing;}
function frame(ts){raf=requestAnimationFrame(frame);const a=app();if(!a?.map)return;
 if(!a.navActive){if(point(target)&&a.followMode&&Date.now()>=manualUntil&&ts-last>100){last=ts;try{a.map.jumpTo({center:target,bearing:Number.isFinite(freeHeading)?freeHeading:0,pitch:0});}catch(_){}}return;}
 if(!point(target)||Date.now()<manualUntil)return;if(ts-last<32)return;last=ts;const s=Math.max(0,+a.currentSpeed||0),k=s>=80?.32:s>=45?.27:s>=15?.23:.20;shown=[shown[0]+(target[0]-shown[0])*k,shown[1]+(target[1]-shown[1])*k];if(Number.isFinite(targetBearing))shownBearing=Number.isFinite(shownBearing)?blend(shownBearing,targetBearing,.15):targetBearing;const cfg=profile(s);
 try{const cv=a.map.getCanvas?.(),h=Math.max(400,cv?.clientHeight||innerHeight||700),w=Math.max(280,cv?.clientWidth||innerWidth||390),side=Math.round(clamp(w*.05,18,42));
 /* Ajuste V264: baixa mais o ponto focal da navegacao, no estilo Maps/Waze.
    Apenas o enquadramento vertical muda; GPS, zoom, pitch e rotacao permanecem intactos. */
 const top=Math.round(clamp(h*.56,270,h*.60)),bottom=Math.round(clamp(h*.040,24,46));
 a.followMode=true;a.map.jumpTo({center:shown,zoom:cfg.z,pitch:cfg.p,bearing:Number.isFinite(shownBearing)?shownBearing:0,padding:{top,left:side,right:side,bottom}});
 }catch(_){}}
function install(){const a=app();if(!a?.map)return false;if(installed)return true;installed=true;window.__RADAR_SINGLE_CAMERA_OWNER='v223';
 const originalUpdate=typeof a.updateCamera==='function'?a.updateCamera.bind(a):null;
 if(originalUpdate)a.updateCamera=function(...args){if(!this.navActive&&this.followMode){capture(this);return;}return originalUpdate(...args)};
 const old=typeof a.handleGPS==='function'?a.handleGPS.bind(a):null;if(old)a.handleGPS=function(...args){const out=old(...args);capture(a);return out};
 const start=typeof a.startNavigation==='function'?a.startNavigation.bind(a):null;if(start)a.startNavigation=function(...args){target=shown=null;targetBearing=shownBearing=null;manualUntil=0;const out=start(...args);setTimeout(()=>capture(a),80);return out};
 ['dragstart','zoomstart','rotatestart','pitchstart'].forEach(ev=>a.map.on?.(ev,e=>{if(e?.originalEvent&&a.navActive)manualUntil=Date.now()+7000;}));
 ['navRecenterLeft','btnRecenter','locateBtn'].forEach(id=>document.getElementById(id)?.addEventListener('click',()=>{manualUntil=0;capture(a);},true));capture(a);if(!raf)raf=requestAnimationFrame(frame);return true}
let n=0,t=setInterval(()=>{if(install()||++n>300)clearInterval(t)},100);
window.RadarNavigationCameraV223={version:'223',heading:()=>app()?.navActive?shownBearing:freeHeading,refresh:()=>{manualUntil=0;capture(app())}};
})();
