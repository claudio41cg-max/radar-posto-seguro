/* Radar Seguro RJ PRO v127 — cores claras para rota principal e secundarias */
(()=>{'use strict';if(window.__radarRouteStyleV127)return;window.__radarRouteStyleV127=true;
const MAIN='#123B8F',ALT='#69B7FF';
function app(){return window.RadarApp||window.App||null;}
function paint(){const map=app()?.map;if(!map?.getStyle)return;let layers=[];try{layers=map.getStyle()?.layers||[];}catch(_){return;}
for(const l of layers){if(l?.type!=='line')continue;const id=String(l.id||'').toLowerCase();try{
if(id.includes('route-alt-v125-line')||id.includes('route-alt-v127-line')){map.setPaintProperty(l.id,'line-color',ALT);map.setPaintProperty(l.id,'line-opacity',.96);continue;}
if(id.includes('route-main-traffic'))continue;
const routeLike=(id.includes('route')||id.includes('rota'))&&!id.includes('alt')&&!id.includes('alternative')&&!id.includes('casing')&&!id.includes('hit')&&!id.includes('traffic');
if(routeLike){map.setPaintProperty(l.id,'line-color',MAIN);map.setPaintProperty(l.id,'line-opacity',1);}
}catch(_){}}
}
function install(){const a=app();if(!a?.map)return false;if(!a.__routeStyleV127Installed){a.__routeStyleV127Installed=true;const old=typeof a.drawRoute==='function'?a.drawRoute.bind(a):null;if(old)a.drawRoute=function(r,f){const out=old(r,f);setTimeout(paint,80);setTimeout(paint,700);return out;};try{a.map.on?.('styledata',()=>setTimeout(paint,50));}catch(_){}}paint();return true;}
let n=0,t=setInterval(()=>{n++;if(install()||n>200)clearInterval(t);},200);window.RadarRouteStyleV127={paint,main:MAIN,alternative:ALT};})();