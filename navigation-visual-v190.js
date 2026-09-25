/* Radar Seguro RJ PRO v190 — seta 3D menor, com escala dinâmica conforme zoom e modo. */
(()=>{
'use strict';
if(window.__radarNavigationVisualV190)return;window.__radarNavigationVisualV190=true;
const app=()=>{try{return window.RadarApp||window.App||null;}catch(_){return null;}};
const point=p=>Array.isArray(p)&&p.length>=2&&Number.isFinite(+p[0])&&Number.isFinite(+p[1]);
const rad=d=>d*Math.PI/180,deg=r=>r*180/Math.PI;
const bearing=(a,b)=>{if(!point(a)||!point(b))return null;const p1=rad(+a[1]),p2=rad(+b[1]),dl=rad(+b[0]-+a[0]),y=Math.sin(dl)*Math.cos(p2),x=Math.cos(p1)*Math.sin(p2)-Math.sin(p1)*Math.cos(p2)*Math.cos(dl);return(deg(Math.atan2(y,x))+360)%360};
function routeBearing(a){
 const c=a?.route?.coords;if(!Array.isArray(c)||c.length<2)return null;
 const i=Math.max(0,Math.min(c.length-2,+a.routeProgressIndex||0));
 const p=point(a?.userPos)?a.userPos:c[i],q=c[Math.min(c.length-1,i+2)];
 return point(p)&&point(q)?bearing(p,q):null;
}
function injectCss(){if(document.getElementById('radar-v190-visual-css'))return;const s=document.createElement('style');s.id='radar-v190-visual-css';s.textContent=`
.user-marker-waze.radar-arrow3d-v190{position:relative!important;isolation:isolate!important;width:var(--radar-arrow-w,56px)!important;height:var(--radar-arrow-h,66px)!important;background:none!important;filter:drop-shadow(0 5px 8px rgba(0,0,0,.68))!important;transform-origin:50% 61%!important;transition:width .16s linear,height .16s linear!important;overflow:visible!important}
.user-marker-waze.radar-arrow3d-v190::before{content:'';position:absolute;left:50%;top:60%;width:36px;height:36px;border-radius:50%;background:radial-gradient(circle,rgba(145,230,255,.22) 0 28%,rgba(120,210,255,.12) 46%,rgba(120,210,255,.05) 62%,rgba(120,210,255,0) 78%);filter:blur(2px);transform:translate(-50%,-50%);z-index:0;pointer-events:none}
.user-marker-waze.radar-arrow3d-v190::after{content:'';position:absolute;inset:0;background:url('./navigation-arrow-3d.png?v=7') no-repeat center/contain;transform:none;filter:invert(30%) sepia(90%) saturate(2500%) hue-rotate(191deg) brightness(1.35) contrast(1.15) drop-shadow(0 2px 3px rgba(0,18,72,.82));z-index:1;pointer-events:none}
.hazard-marker{width:28px!important;height:28px!important;filter:drop-shadow(0 2px 4px rgba(0,0,0,.75))!important}
.hazard-marker svg{width:28px!important;height:28px!important}
`;document.head.appendChild(s);}
function sizeFor(a){let z=17;try{z=+a?.map?.getZoom?.()||17;}catch(_){}const nav=!!a?.navActive;let w;
 if(nav){if(z>=18.5)w=61;else if(z>=17.5)w=58;else if(z>=16.5)w=55;else if(z>=15.5)w=52;else if(z>=14)w=48;else w=44;}
 else {if(z>=18.5)w=56;else if(z>=17.5)w=53;else if(z>=16.5)w=50;else if(z>=15.5)w=47;else if(z>=14)w=43;else w=40;}
 return[w,Math.round(w*1.17)];}
function applyArrow(){const a=app();let el=null;try{el=a?.userMarker?.getElement?.()||null;}catch(_){}if(!el)return false;el.classList.remove('radar-arrow3d-v188','radar-arrow3d-v189');el.classList.add('radar-arrow3d-v190');const [w,h]=sizeFor(a);el.style.setProperty('--radar-arrow-w',w+'px');el.style.setProperty('--radar-arrow-h',h+'px');return true;}
function install(){injectCss();const a=app();if(!a)return false;if(a.__navigationVisualV190Installed){applyArrow();return true;}a.__navigationVisualV190Installed=true;applyArrow();
 const oldHandle=typeof a.handleGPS==='function'?a.handleGPS.bind(a):null;if(oldHandle)a.handleGPS=function(...args){const out=oldHandle(...args);setTimeout(applyArrow,0);return out;};
 try{a.map?.on?.('zoom',applyArrow);a.map?.on?.('zoomend',applyArrow);}catch(_){}
 const oldStart=typeof a.startNavigation==='function'?a.startNavigation.bind(a):null;if(oldStart)a.startNavigation=function(...args){const out=oldStart(...args);setTimeout(applyArrow,80);return out;};
 const oldStop=typeof a.stopNavigation==='function'?a.stopNavigation.bind(a):null;if(oldStop)a.stopNavigation=function(...args){const out=oldStop(...args);setTimeout(applyArrow,80);return out;};
 return true;}
let n=0,t=setInterval(()=>{n++;if(install()||n>300)clearInterval(t);},120);setInterval(applyArrow,1000);
window.RadarNavigationVisualV190={version:'190',refresh:()=>{injectCss();applyArrow();},align:applyArrow};
})();
