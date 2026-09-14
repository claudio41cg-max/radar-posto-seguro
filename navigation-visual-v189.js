/* Radar Seguro RJ PRO v189 — seta 3D dedicada em SVG externo. Mantém hazards reduzidos. */
(()=>{
'use strict';
if(window.__radarNavigationVisualV189)return;window.__radarNavigationVisualV189=true;
const app=()=>{try{return window.RadarApp||window.App||null;}catch(_){return null;}};
function injectCss(){if(document.getElementById('radar-v189-visual-css'))return;const s=document.createElement('style');s.id='radar-v189-visual-css';s.textContent=`
.user-marker-waze.radar-arrow3d-v189{width:66px!important;height:78px!important;background:url('./navigation-arrow-v189.svg?v=189') no-repeat center/contain!important;filter:drop-shadow(0 6px 11px rgba(0,0,0,.74)) drop-shadow(0 0 8px rgba(0,210,255,.24))!important;transform-origin:50% 60%!important}
.hazard-marker{width:28px!important;height:28px!important;filter:drop-shadow(0 2px 4px rgba(0,0,0,.75))!important}
.hazard-marker svg{width:28px!important;height:28px!important}
`;document.head.appendChild(s);}
function applyArrow(){const a=app();let el=null;try{el=a?.userMarker?.getElement?.()||null;}catch(_){}if(!el)return false;el.classList.remove('radar-arrow3d-v188');el.classList.add('radar-arrow3d-v189');return true;}
function install(){injectCss();applyArrow();const a=app();if(!a)return false;if(a.__navigationVisualV189Installed)return true;a.__navigationVisualV189Installed=true;const oldHandle=typeof a.handleGPS==='function'?a.handleGPS.bind(a):null;if(oldHandle)a.handleGPS=function(...args){const out=oldHandle(...args);setTimeout(applyArrow,0);return out;};return true;}
let n=0,t=setInterval(()=>{n++;install();if(n>300||applyArrow())clearInterval(t);},120);setInterval(applyArrow,1200);
window.RadarNavigationVisualV189={version:'189',refresh:()=>{injectCss();applyArrow();}};
})();