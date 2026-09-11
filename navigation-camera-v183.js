/* Radar Seguro RJ PRO v183 — câmera de navegação: mais próxima, inclinada e com a seta mais baixa. Não altera comunidades. */
(()=>{
'use strict';
if(window.__radarNavigationCameraV183)return;
window.__radarNavigationCameraV183=true;

const S={manualUntil:0,lastAt:0,lastGps:null,lastGpsAt:0,movementBearing:null,nativeEase:null};
const app=()=>{try{return window.RadarApp?.map?window.RadarApp:(typeof App!=='undefined'&&App?.map?App:null)}catch(_){return null}};
const point=p=>Array.isArray(p)&&p.length>=2&&Number.isFinite(+p[0])&&Number.isFinite(+p[1]);
const rad=d=>d*Math.PI/180,deg=r=>r*180/Math.PI;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
function distM(a,b){if(!point(a)||!point(b))return Infinity;const R=6371000,p1=rad(+a[1]),p2=rad(+b[1]),d1=p2-p1,d2=rad(+b[0]-+a[0]);const q=Math.sin(d1/2)**2+Math.cos(p1)*Math.cos(p2)*Math.sin(d2/2)**2;return 2*R*Math.asin(Math.min(1,Math.sqrt(q)));}
function bearing(a,b){if(!point(a)||!point(b))return null;const p1=rad(+a[1]),p2=rad(+b[1]),dl=rad(+b[0]-+a[0]),y=Math.sin(dl)*Math.cos(p2),x=Math.cos(p1)*Math.sin(p2)-Math.sin(p1)*Math.cos(p2)*Math.cos(dl);return(deg(Math.atan2(y,x))+360)%360;}
function mix(a,b,t){return[+a[0]+(+b[0]-+a[0])*t,+a[1]+(+b[1]-+a[1])*t];}
function currentPoint(a){return point(a?.rawUserPos)?a.rawUserPos:(point(a?.filteredPos)?a.filteredPos:a?.userPos);}
function routeBearing(a){const c=a?.route?.coords,idx=clamp(+a?.routeProgressIndex||0,0,Math.max(0,(c?.length||2)-2));return c?.[idx]&&c?.[idx+1]?bearing(c[idx],c[idx+1]):null;}
function heading(a){const speed=Math.max(0,+a?.currentSpeed||0);if(speed>4&&Number.isFinite(S.movementBearing))return S.movementBearing;if(Number.isFinite(+a?.currentBearing)&&+a.currentBearing>=0)return+a.currentBearing;const rb=routeBearing(a);if(Number.isFinite(rb))return rb;try{return a.map.getBearing();}catch(_){return 0}}
function noteGPS(position){const c=position?.coords;if(!c||!Number.isFinite(+c.longitude)||!Number.isFinite(+c.latitude))return;const p=[+c.longitude,+c.latitude],ts=Number.isFinite(+position.timestamp)?+position.timestamp:Date.now();if(point(S.lastGps)&&S.lastGpsAt){const d=distM(S.lastGps,p),dt=Math.max(.25,(ts-S.lastGpsAt)/1000),kmh=d/dt*3.6;if(d>=3&&d<120&&kmh<170)S.movementBearing=bearing(S.lastGps,p);}S.lastGps=p;S.lastGpsAt=ts;}
function profile(speed){if(speed<15)return{zoom:17.95,pitch:68,ahead:105};if(speed<35)return{zoom:17.82,pitch:68,ahead:120};if(speed<55)return{zoom:17.55,pitch:67,ahead:140};if(speed<80)return{zoom:17.25,pitch:66,ahead:165};return{zoom:16.90,pitch:64,ahead:200};}
function routeAhead(a,meters){try{const p=a.pointAhead?.(meters);if(point(p))return p;}catch(_){}
 const c=a?.route?.coords;if(!Array.isArray(c)||c.length<2)return null;let i=clamp(+a.routeProgressIndex||0,0,c.length-2),left=meters;let start=currentPoint(a);if(!point(start))start=c[i];for(;i<c.length-1;i++){const a0=i===clamp(+a.routeProgressIndex||0,0,c.length-2)&&point(start)?start:c[i],b0=c[i+1];const seg=distM(a0,b0);if(!Number.isFinite(seg)||seg<=0)continue;if(left<=seg)return mix(a0,b0,left/seg);left-=seg;}return c[c.length-1];}
function camera(a,force=false){if(!a?.map||!a.navActive||!a.route)return;if(Date.now()<S.manualUntil&&!force)return;const p=currentPoint(a);if(!point(p))return;const now=Date.now();if(!force&&now-S.lastAt<320)return;S.lastAt=now;const speed=Math.max(0,+a.currentSpeed||0),cfg=profile(speed),br=heading(a),ahead=routeAhead(a,cfg.ahead);let center=point(ahead)?mix(p,ahead,.82):p;const ease=S.nativeEase||a.map.easeTo?.bind(a.map);if(!ease)return;try{a.followMode=true;ease({center,zoom:cfg.zoom,pitch:cfg.pitch,bearing:Number.isFinite(br)?br:a.map.getBearing(),duration:340,essential:true});}catch(_){}}
function install(){const a=app(),m=a?.map;if(!a||!m)return false;if(!a.__navigationLiveFixV177||!a.__navigationGuardsV178||!a.__mapNavigationSearchV182)return false;if(a.__navigationCameraV183)return true;a.__navigationCameraV183=true;
 S.nativeEase=m.easeTo?.bind(m)||null;
 if(S.nativeEase&&!m.__radarCameraV183EaseGuard){m.__radarCameraV183EaseGuard=true;const native=S.nativeEase;m.easeTo=function(options,...args){try{if(a.navActive&&options&&options.essential===true){const p=+options.pitch,d=+options.duration,z=+options.zoom;const legacy=(p===62||p===64)&&(d===300||d===430||d===720||[15.95,16.25,16.75,17.15,17.2,17.65].some(v=>Math.abs(z-v)<.03));if(legacy)return this;}}catch(_){}return native(options,...args);};}
 ['dragstart','zoomstart','rotatestart','pitchstart'].forEach(ev=>m.on?.(ev,e=>{if(e?.originalEvent&&a.navActive)S.manualUntil=Date.now()+7000;}));
 ['locateBtn','navRecenterLeft','btnRecenter'].forEach(id=>document.getElementById(id)?.addEventListener('click',()=>{S.manualUntil=0;setTimeout(()=>camera(a,true),40);},true));
 const oldHandle=typeof a.handleGPS==='function'?a.handleGPS.bind(a):null;if(oldHandle)a.handleGPS=function(position,...args){noteGPS(position);const out=oldHandle(position,...args);if(this.navActive)setTimeout(()=>camera(this,false),0);return out;};
 const oldCamera=typeof a.updateCamera==='function'?a.updateCamera.bind(a):null;a.updateCamera=function(...args){if(this.navActive){camera(this,false);return;}return oldCamera?.(...args);};
 const oldStart=typeof a.startNavigation==='function'?a.startNavigation.bind(a):null;if(oldStart)a.startNavigation=function(...args){S.manualUntil=0;const out=oldStart(...args);setTimeout(()=>camera(this,true),260);return out;};
 const oldRecenter=typeof a.recenter==='function'?a.recenter.bind(a):null;if(oldRecenter)a.recenter=function(...args){S.manualUntil=0;const out=oldRecenter(...args);if(this.navActive)setTimeout(()=>camera(this,true),90);return out;};
 setInterval(()=>{const x=app();if(x?.navActive&&Date.now()>=S.manualUntil)camera(x,false);},280);
 if(a.navActive)setTimeout(()=>camera(a,true),250);
 return true;}
let tries=0,t=setInterval(()=>{tries++;if(install()||tries>300)clearInterval(t);},100);
window.RadarNavigationCameraV183={version:'183',refresh:()=>{const a=app();if(a){S.manualUntil=0;camera(a,true);}}};
})();