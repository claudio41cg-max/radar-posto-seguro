/* Radar Seguro RJ PRO v190 — seta 3D menor, com escala dinâmica conforme zoom e modo. */
(()=>{
'use strict';
if(window.__radarNavigationVisualV190)return;window.__radarNavigationVisualV190=true;
const app=()=>{try{return window.RadarApp||window.App||null;}catch(_){return null;}};
function injectCss(){if(document.getElementById('radar-v190-visual-css'))return;const s=document.createElement('style');s.id='radar-v190-visual-css';s.textContent=`
.user-marker-waze.radar-arrow3d-v190{width:var(--radar-arrow-w,56px)!important;height:var(--radar-arrow-h,66px)!important;background:url('./navigation-arrow-3d.png?v=4') no-repeat center 60%/contain,radial-gradient(circle at 50% 76%,rgba(165,235,255,.78) 0 22%,rgba(100,195,255,.42) 38%,rgba(100,195,255,.22) 56%,transparent 76%) no-repeat center 76%/92% 70%!important;filter:drop-shadow(0 5px 8px rgba(0,0,0,.68)) drop-shadow(0 0 9px rgba(0,210,255,.40))!important;transform-origin:50% 61%!important;transition:width .16s linear,height .16s linear!important}
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
window.RadarNavigationVisualV190={version:'190',refresh:()=>{injectCss();applyArrow();}};
})();