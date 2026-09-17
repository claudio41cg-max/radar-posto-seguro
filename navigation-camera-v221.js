/* Radar Seguro RJ PRO v221 — camera unica FOLLOW.
   Um unico controlador visual: sem fila de easeTo, pitch valido <=60, zoom mais aberto
   em alta velocidade e ancora inferior para mostrar a estrada a frente. */
(()=>{'use strict';
if(window.__radarNavigationCameraV221)return;window.__radarNavigationCameraV221=true;
const app=()=>{try{return window.RadarApp||window.App||null}catch(_){return null}};
const point=p=>Array.isArray(p)&&p.length>=2&&Number.isFinite(+p[0])&&Number.isFinite(+p[1]);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const rad=d=>d*Math.PI/180,deg=r=>r*180/Math.PI;
const bearing=(a,b)=>{if(!point(a)||!point(b))return null;const p1=rad(+a[1]),p2=rad(+b[1]),dl=rad(+b[0]-+a[0]),y=Math.sin(dl)*Math.cos(p2),x=Math.cos(p1)*Math.sin(p2)-Math.sin(p1)*Math.cos(p2)*Math.cos(dl);return(deg(Math.atan2(y,x))+360)%360};
const blendAngle=(a,b,t)=>{const d=(((b-a)+540)%360)-180;return(a+d*t+360)%360};
function display(a){for(const q of[a?.matchedUserPos,a?.userPos,a?.filteredPos,a?.rawUserPos])if(point(q))return q;return null}
function routeBearing(a,pos){const c=a?.route?.coords;if(!Array.isArray(c)||c.length<2)return null;const i=clamp(+a.routeProgressIndex||0,0,c.length-2);let meters=Math.max(45,Math.min(150,(+a.currentSpeed||0)*1.25));let d=0,last=c[i];for(let j=i+1;j<c.length;j++){const q=c[j];if(!point(last)||!point(q))continue;const dx=(q[0]-last[0])*111320*Math.cos(rad(q[1])),dy=(q[1]-last[1])*110574;d+=Math.hypot(dx,dy);if(d>=meters)return bearing(pos,q);last=q;}return bearing(pos,c[c.length-1]);}
function profile(s){if(s<15)return{z:17.25,p:60,b:.34};if(s<35)return{z:16.95,p:60,b:.33};if(s<55)return{z:16.55,p:59,b:.32};if(s<80)return{z:16.10,p:58,b:.31};if(s<105)return{z:15.60,p:57,b:.30};return{z:15.25,p:56,b:.29}}
let target=null,shown=null,targetBearing=null,shownBearing=null,lastFrame=0,raf=0,installed=false,manualUntil=0;
function capture(a){if(!a?.navActive)return;const q=display(a);if(!point(q))return;target=q.slice();const rb=routeBearing(a,q),hb=Number.isFinite(+a.currentBearing)?(+a.currentBearing+360)%360:null;targetBearing=Number.isFinite(rb)&&Number.isFinite(hb)?blendAngle(hb,rb,.55):(Number.isFinite(rb)?rb:(Number.isFinite(hb)?hb:targetBearing));if(!point(shown))shown=target.slice();if(!Number.isFinite(shownBearing))shownBearing=targetBearing;}
function frame(ts){raf=requestAnimationFrame(frame);const a=app();if(!a?.navActive||!a?.map||!point(target)||Date.now()<manualUntil)return;if(ts-lastFrame<32)return;lastFrame=ts;const s=Math.max(0,+a.currentSpeed||0);
 /* Resposta rapida o bastante para acompanhar o GPS, mas sem saltar entre amostras. */
 const k=s>=80?.32:s>=45?.27:s>=15?.23:.19;shown=[shown[0]+(target[0]-shown[0])*k,shown[1]+(target[1]-shown[1])*k];if(Number.isFinite(targetBearing))shownBearing=Number.isFinite(shownBearing)?blendAngle(shownBearing,targetBearing,s>=70?.13:.16):targetBearing;
 const cfg=profile(s);try{const cv=a.map.getCanvas?.(),h=Math.max(400,cv?.clientHeight||innerHeight||700),w=Math.max(280,cv?.clientWidth||innerWidth||390),side=Math.round(clamp(w*.05,18,42)),top=Math.round(clamp(h*.075,44,76)),bottom=Math.round(clamp(h*cfg.b,145,h*.38));a.followMode=true;a.map.jumpTo({center:shown,zoom:cfg.z,pitch:cfg.p,bearing:Number.isFinite(shownBearing)?shownBearing:0,padding:{top,left:side,right:side,bottom}});}catch(_){}}
function install(){const a=app();if(!a?.map)return false;if(installed)return true;installed=true;window.__RADAR_SINGLE_CAMERA_OWNER='v221';
 const old=typeof a.handleGPS==='function'?a.handleGPS.bind(a):null;if(old)a.handleGPS=function(...args){const out=old(...args);capture(a);return out};
 const start=typeof a.startNavigation==='function'?a.startNavigation.bind(a):null;if(start)a.startNavigation=function(...args){target=shown=null;targetBearing=shownBearing=null;manualUntil=0;const out=start(...args);setTimeout(()=>capture(a),80);return out};
 ['dragstart','zoomstart','rotatestart','pitchstart'].forEach(ev=>a.map.on?.(ev,e=>{if(e?.originalEvent&&a.navActive)manualUntil=Date.now()+7000;}));
 ['navRecenterLeft','btnRecenter','locateBtn'].forEach(id=>document.getElementById(id)?.addEventListener('click',()=>{manualUntil=0;capture(a);},true));
 capture(a);if(!raf)raf=requestAnimationFrame(frame);return true}
let tries=0,t=setInterval(()=>{if(install()||++tries>300)clearInterval(t)},100);
window.RadarNavigationCameraV221={version:'221',refresh:()=>{manualUntil=0;capture(app())}};
})();