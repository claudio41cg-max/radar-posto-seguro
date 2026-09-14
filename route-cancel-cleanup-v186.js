/* Radar Seguro RJ PRO v186 — limpa completamente a rota visual ao cancelar/encerrar. Não altera câmera, busca, voz ou comunidades. */
(()=>{
'use strict';
if(window.__radarRouteCancelCleanupV186)return;
window.__radarRouteCancelCleanupV186=true;

const app=()=>{try{return window.RadarApp?.map?window.RadarApp:(typeof App!=='undefined'&&App?.map?App:null)}catch(_){return null}};
const EMPTY={type:'FeatureCollection',features:[]};

function clearVisuals(a){
  const m=a?.map;if(!m)return;
  try{window.RadarRouteStyleV127?.clear?.();}catch(_){}
  try{window.RadarRouteAlternativesV116?.clear?.();}catch(_){}
  const layers=['route-primary-v185-line','route-primary-v185-casing','route-main','route-outline','route-alt-v132-label','route-alt-v132-hit','route-alt-v132-line','route-alt-v132-casing','radar-flow-v131-line','route-main-traffic-v127-line'];
  for(const id of layers){
    try{if(m.getLayer(id)&&id.startsWith('route-primary-v185'))m.removeLayer(id);}catch(_){}
  }
  for(const id of['route','route-primary-v185','route-alt-v132','radar-flow-v131','route-main-traffic-v127']){
    try{const s=m.getSource(id);if(s?.setData)s.setData(EMPTY);}catch(_){}
  }
  for(const id of['route-main','route-outline']){
    try{if(m.getLayer(id))m.setPaintProperty(id,'line-opacity',0);}catch(_){}
  }
}

function clearState(a){
  if(!a)return;
  try{a.navActive=false;}catch(_){}
  try{a.route=null;}catch(_){}
  try{a.destination=null;}catch(_){}
  try{a.routeAlternatives=[];}catch(_){}
  try{a.routeProgressIndex=0;a.routeProgressMeters=0;a.lastTrustedProgressMeters=0;}catch(_){}
  try{a.destinationMarker?.remove?.();a.destinationMarker=null;}catch(_){}
  try{window.RadarRouteChoiceLock=null;}catch(_){}
  clearVisuals(a);
  setTimeout(()=>clearVisuals(a),60);
  setTimeout(()=>clearVisuals(a),300);
}

function install(){
  const a=app();if(!a?.map)return false;
  if(a.__routeCancelCleanupV186)return true;
  a.__routeCancelCleanupV186=true;

  const oldStop=typeof a.stopNavigation==='function'?a.stopNavigation.bind(a):null;
  if(oldStop)a.stopNavigation=function(...args){
    const out=oldStop(...args);
    setTimeout(()=>clearState(this),0);
    return out;
  };

  const oldClear=typeof a.clearRoute==='function'?a.clearRoute.bind(a):null;
  if(oldClear)a.clearRoute=function(...args){
    const out=oldClear(...args);
    setTimeout(()=>clearState(this),0);
    return out;
  };

  document.getElementById('stopNavBtn')?.addEventListener('click',()=>setTimeout(()=>clearState(a),20),true);
  return true;
}

let tries=0,t=setInterval(()=>{tries++;if(install()||tries>300)clearInterval(t);},100);
window.RadarRouteCancelCleanupV186={version:'186',clear:()=>{const a=app();if(a)clearState(a);}};
})();