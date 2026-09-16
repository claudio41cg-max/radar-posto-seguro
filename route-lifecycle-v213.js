/* Radar Seguro RJ PRO v213 — ciclo de vida da rota.
   Corrige rota fantasma sem alterar TomTom, camera, hazards ou IA.
   Regra: sair/ocultar/recarregar NAO cancela navegacao ativa; cancelar/X encerra e limpa tudo. */
(()=>{
'use strict';
if(window.__radarRouteLifecycleV213)return;
window.__radarRouteLifecycleV213=true;

const EMPTY={type:'FeatureCollection',features:[]};
const app=()=>{try{return window.RadarApp||window.App||null}catch(_){return null}};
const routeLike=id=>/^(route|rota)(-|$)|^radar-flow(-|$)/i.test(String(id||''));

function clearPersisted(){
  try{localStorage.removeItem('radar-nav-v134')}catch(_){}
  try{localStorage.removeItem('activeRoute')}catch(_){}
  try{localStorage.removeItem('destination')}catch(_){}
  try{localStorage.removeItem('navigationState')}catch(_){}
}
function clearVoice(){
  try{window.Voice?.clear?.()}catch(_){}
  try{window.speechSynthesis?.cancel?.()}catch(_){}
}
function clearRouteVisuals(a){
  const m=a?.map;
  try{window.RadarRouteStyleV127?.clear?.()}catch(_){}
  try{window.RadarRouteAlternativesV116?.clear?.()}catch(_){}
  try{window.RadarRouteTrafficV74?.clear?.()}catch(_){}
  if(!m)return;
  try{
    for(const l of [...(m.getStyle()?.layers||[])]){
      if(routeLike(l?.id)&&m.getLayer(l.id))try{m.removeLayer(l.id)}catch(_){}
    }
  }catch(_){}
  try{
    for(const id of Object.keys(m.getStyle()?.sources||{})){
      if(!routeLike(id))continue;
      try{m.getSource(id)?.setData?.(EMPTY)}catch(_){}
      try{if(m.getSource(id))m.removeSource(id)}catch(_){}
    }
  }catch(_){}
}
function clearDestination(a){
  try{a.destinationMarker?.remove?.();a.destinationMarker=null}catch(_){}
  try{a.destination=null}catch(_){}
  try{const i=document.getElementById('destInput');if(i)i.value=''}catch(_){}
  try{const s=document.getElementById('suggest');if(s){s.innerHTML='';s.classList.remove('show')}}catch(_){}
}
function resetNavigationState(a){
  if(!a)return;
  try{
    a.navActive=false;a.navigating=false;a.navigationActive=false;a.routeActive=false;
    a.route=null;a.routeAlternatives=[];a.routeProgressIndex=0;a.routeProgressMeters=0;
    a.lastTrustedProgressMeters=0;a.routeStepIndex=0;a.activeGuidanceStep=-1;
    a.lastGuidanceStep=-1;a.announced={};a.rerouting=false;a.offRouteHits=0;
    a.lastArrivalAnnounced=false;a.followMode=true;
  }catch(_){}
  try{window.RadarRouteChoiceLock=null;window.__radarRouteCancelledAt=Date.now()}catch(_){}
}
function clearUi(a){
  try{document.body.classList.remove('nav-mode')}catch(_){}
  try{document.getElementById('wazeHud')?.classList.remove('show')}catch(_){}
  try{document.getElementById('wazeSheet')?.classList.remove('show')}catch(_){}
  try{document.getElementById('mainTopbar')?.classList.remove('hide-nav')}catch(_){}
  try{document.getElementById('mainBottomActions')?.classList.remove('hide-nav')}catch(_){}
  try{a?.hideTrafficLightHud?.()}catch(_){}
}
function hardCancel(reason='cancel'){
  const a=app();if(!a)return;
  clearPersisted();
  resetNavigationState(a);
  clearDestination(a);
  clearUi(a);
  clearVoice();
  clearRouteVisuals(a);
  [80,260,700,1500].forEach(ms=>setTimeout(()=>clearRouteVisuals(a),ms));
  try{window.dispatchEvent(new CustomEvent('radar-route-ended',{detail:{reason}}))}catch(_){}
}
function routeIsActive(a){return !!(a&&(a.navActive||a.navigating||a.navigationActive||a.routeActive));}

function install(){
  const a=app();
  if(!a?.map)return false;
  if(a.__routeLifecycleV213)return true;
  a.__routeLifecycleV213=true;

  // Cancelar explicitamente encerra de verdade. Sair da pagina/app nao passa por aqui.
  for(const name of ['stopNavigation','cancelNavigation','endNavigation']){
    const old=typeof a[name]==='function'?a[name].bind(a):null;
    if(!old)continue;
    a[name]=function(...args){
      let out;
      try{out=old(...args)}finally{setTimeout(()=>hardCancel(name),0)}
      return out;
    };
  }

  // O X da busca e um cancelamento explicito somente quando existe rota/destino.
  const clearBtn=document.getElementById('clearBtn');
  if(clearBtn&&!clearBtn.__routeLifecycleV213){
    clearBtn.__routeLifecycleV213=true;
    clearBtn.addEventListener('click',()=>{
      const x=app();
      if(x?.route||x?.destination||routeIsActive(x))setTimeout(()=>hardCancel('clear-search'),0);
    },true);
  }

  // Botao vermelho de cancelar.
  const stop=document.getElementById('stopNavBtn');
  if(stop&&!stop.__routeLifecycleV213){
    stop.__routeLifecycleV213=true;
    stop.addEventListener('click',()=>setTimeout(()=>hardCancel('stop-button'),0),true);
  }

  // Se nao existe rota ativa, nunca permita uma linha antiga sobreviver/reaparecer.
  const scrub=()=>{
    const x=app();if(!x)return;
    if(!routeIsActive(x)&&!x.route){clearPersisted();clearRouteVisuals(x);}
  };
  window.addEventListener('pageshow',()=>setTimeout(scrub,650));
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)setTimeout(scrub,500)});
  setTimeout(scrub,900);
  return true;
}
let n=0,t=setInterval(()=>{n++;if(install()||n>300)clearInterval(t)},100);
window.RadarRouteLifecycleV213={version:'213',cancel:hardCancel};
})();
