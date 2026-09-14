/* Radar Seguro RJ PRO v188 — seta 3D mais robusta e hazards menores. */
(()=>{
'use strict';
if(window.__radarNavigationVisualV188)return;window.__radarNavigationVisualV188=true;
const app=()=>{try{return window.RadarApp||window.App||null;}catch(_){return null;}};
const SVG=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 72 82">
<defs>
 <linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e8fdff"/><stop offset="0.24" stop-color="#35ecff"/><stop offset="0.62" stop-color="#00a9d6"/><stop offset="1" stop-color="#006b94"/></linearGradient>
 <linearGradient id="s" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#003f5e"/><stop offset="1" stop-color="#007fa8"/></linearGradient>
 <filter id="sh" x="-40%" y="-40%" width="180%" height="180%"><feDropShadow dx="0" dy="5" stdDeviation="4" flood-color="#00131f" flood-opacity="0.75"/></filter>
</defs>
<ellipse cx="36" cy="65" rx="25" ry="10" fill="#16cfff" opacity="0.20"/>
<g filter="url(#sh)">
 <path d="M36 4 L64 68 L36 57 L8 68 Z" fill="#ffffff" stroke="#ffffff" stroke-width="5" stroke-linejoin="round"/>
 <path d="M36 7 L60 63 L36 53 L12 63 Z" fill="url(#g)" stroke="#053e58" stroke-width="2.2" stroke-linejoin="round"/>
 <path d="M36 7 L36 53 L12 63 Z" fill="#70f4ff" opacity="0.42"/>
 <path d="M36 7 L60 63 L36 53 Z" fill="url(#s)" opacity="0.52"/>
 <path d="M36 14 L45 49 L36 45 L27 49 Z" fill="#ffffff" opacity="0.82"/>
 <circle cx="36" cy="48" r="4.5" fill="#ffffff" stroke="#006e96" stroke-width="1.5"/>
</g></svg>`;
const ARROW=`url("data:image/svg+xml;charset=UTF-8,${encodeURIComponent(SVG)}")`;
function injectCss(){if(document.getElementById('radar-v188-visual-css'))return;const s=document.createElement('style');s.id='radar-v188-visual-css';s.textContent=`
.user-marker-waze.radar-arrow3d-v188{width:64px!important;height:72px!important;background-image:${ARROW}!important;background-repeat:no-repeat!important;background-position:center!important;background-size:contain!important;filter:drop-shadow(0 5px 10px rgba(0,0,0,.72)) drop-shadow(0 0 7px rgba(0,210,255,.28))!important;transform-origin:50% 58%!important}
.hazard-marker{width:28px!important;height:28px!important;filter:drop-shadow(0 2px 4px rgba(0,0,0,.75))!important}
.hazard-marker svg{width:28px!important;height:28px!important}
`;document.head.appendChild(s);}
function applyArrow(){const a=app();let el=null;try{el=a?.userMarker?.getElement?.()||null;}catch(_){}if(!el)return false;el.classList.add('radar-arrow3d-v188');return true;}
function install(){injectCss();applyArrow();const a=app();if(!a)return false;if(a.__navigationVisualV188Installed)return true;a.__navigationVisualV188Installed=true;const oldHandle=typeof a.handleGPS==='function'?a.handleGPS.bind(a):null;if(oldHandle)a.handleGPS=function(...args){const out=oldHandle(...args);setTimeout(applyArrow,0);return out;};return true;}
let n=0,t=setInterval(()=>{n++;install();if(n>300||applyArrow())clearInterval(t);},120);setInterval(applyArrow,1200);
window.RadarNavigationVisualV188={version:'188',refresh:()=>{injectCss();applyArrow();}};
})();