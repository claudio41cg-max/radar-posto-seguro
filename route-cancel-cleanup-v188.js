/* Radar Seguro RJ PRO v188 — cancelamento definitivo da navegação e remoção de todas as linhas de rota. */
(()=>{
'use strict';
if(window.__radarRouteCancelCleanupV188)return;
window.__radarRouteCancelCleanupV188=true;
const app=()=>{try{return window.RadarApp?.map?window.RadarApp:(typeof App!=='undefined'&&App?.map?App:null)}catch(_){return null}};
const EMPTY={type:'FeatureCollection',features:[]};
const routeLike=id=>/^(route|rota)(-|$)|^radar-flow(-|$)/i.test(String(id||''));
function stopVoice(){try{window.Voice?.clear?.();}catch(_){}try{window.speechSynthesis?.cancel?.();}catch(_){}try{speechSynthesis?.cancel?.();}catch(_){} }
function clearVisuals(a){const m=a?.map;if(!m)return;
 try{window.RadarRouteStyleV127?.clear?.();}catch(_){}
 try{window.RadarRouteAlternativesV116?.clear?.();}catch(_){}
 try{window.RadarRouteTrafficV74?.clear?.();}catch(_){}
 const layers=[];try{for(const l of m.getStyle()?.layers||[])if(routeLike(l?.id))layers.push(l.id);}catch(_){}
 for(const id of layers)try{if(m.getLayer(id))m.removeLayer(id);}catch(_){}
 const sources=[];try{for(const id of Object.keys(m.getStyle()?.sources||{}))if(routeLike(id))sources.push(id);}catch(_){}
 for(const id of sources){try{const s=m.getSource(id);if(s?.setData)s.setData(EMPTY);}catch(_){}try{if(m.getSource(id))m.removeSource(id);}catch(_){} }
}
function clearUi(a){try{document.body.classList.remove('nav-mode');}catch(_){}try{document.getElementById('wazeHud')?.classList.remove('show');document.getElementById('wazeSheet')?.classList.remove('show');}catch(_){}
 try{document.getElementById('mainTopbar')?.classList.remove('hide-nav');document.getElementById('mainBottomActions')?.classList.remove('hide-nav');}catch(_){}
 try{const input=document.getElementById('destInput');if(input)input.value='';}catch(_){}
 try{document.getElementById('hudDist').textContent='-- m';document.getElementById('hudStreet').textContent='Siga pela via';document.getElementById('hudNextStreet').textContent='próximo acesso';document.getElementById('sheetTime').textContent='-- min';document.getElementById('sheetDist').textContent='-- km • chegada prevista';}catch(_){}
 try{a?.hideTrafficLightHud?.();}catch(_){}
}
function clearState(a){if(!a)return;
 try{a.navActive=false;a.route=null;a.destination=null;a.routeAlternatives=[];a.routeProgressIndex=0;a.routeProgressMeters=0;a.lastTrustedProgressMeters=0;a.lastTrustedSpeed=0;a.routeStepIndex=0;a.activeGuidanceStep=-1;a.lastGuidanceStep=-1;a.announced={};a.rerouting=false;a.offRouteHits=0;a.lastArrivalAnnounced=false;a.followMode=true;}catch(_){}
 try{a.destinationMarker?.remove?.();a.destinationMarker=null;}catch(_){}
 try{window.RadarRouteChoiceLock=null;window.__radarRouteCancelledAt=Date.now();}catch(_){}
 stopVoice();clearUi(a);clearVisuals(a);
 [40,180,500,1100,1800].forEach(ms=>setTimeout(()=>{stopVoice();clearVisuals(a);},ms));
}
function install(){const a=app();if(!a?.map)return false;if(a.__routeCancelCleanupV188)return true;a.__routeCancelCleanupV188=true;
 const oldStop=typeof a.stopNavigation==='function'?a.stopNavigation.bind(a):null;if(oldStop)a.stopNavigation=function(...args){let out;try{out=oldStop(...args);}finally{clearState(this);}return out;};
 const oldClear=typeof a.clearRoute==='function'?a.clearRoute.bind(a):null;if(oldClear)a.clearRoute=function(...args){let out;try{out=oldClear(...args);}finally{clearState(this);}return out;};
 document.getElementById('stopNavBtn')?.addEventListener('click',()=>clearState(a),true);
 return true;}
let n=0,t=setInterval(()=>{n++;if(install()||n>300)clearInterval(t);},100);
const api={version:'188',clear:()=>{const a=app();if(a)clearState(a);}};
window.RadarRouteCancelCleanupV188=api;
window.RadarRouteCancelCleanupV186=api;
})();