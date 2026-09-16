/* Radar Seguro RJ PRO v214 — encerra rota de verdade ao sair/cancelar navegacao.
   Corrige linha fantasma observando a transicao real navActive true -> false.
   Nao confunde app em background com cancelamento: visibility/pagehide nao alteram navActive. */
(()=>{'use strict';
if(window.__radarRouteLifecycleV214)return;window.__radarRouteLifecycleV214=true;
const EMPTY={type:'FeatureCollection',features:[]};
const app=()=>{try{return window.RadarApp||window.App||null}catch(_){return null}};
function routeId(id){id=String(id||'').toLowerCase();return id==='route-main'||id==='route-outline'||id.includes('route-primary')||id.includes('route-main-traffic')||id.includes('route-alt')||id.includes('radar-flow')||id.includes('navigation-route')||id.includes('tomtom-route');}
function persistClear(){for(const k of['radar-nav-v134','activeRoute','destination','navigationState'])try{localStorage.removeItem(k)}catch(_){}}
function visualClear(a){const m=a?.map;try{window.RadarRouteStyleV127?.clear?.()}catch(_){}try{window.RadarRouteAlternativesV116?.clear?.()}catch(_){}try{window.RadarRouteTrafficV74?.clear?.()}catch(_){}if(!m)return;
 try{for(const l of[...(m.getStyle()?.layers||[])])if(routeId(l?.id)&&m.getLayer(l.id))try{m.removeLayer(l.id)}catch(_){}}catch(_){}
 try{for(const id of Object.keys(m.getStyle()?.sources||{}))if(routeId(id)){try{m.getSource(id)?.setData?.(EMPTY)}catch(_){}try{if(m.getSource(id))m.removeSource(id)}catch(_){}}}catch(_){}
}
function finish(reason){const a=app();if(!a)return;
 try{a.navActive=false;a.navigating=false;a.navigationActive=false;a.routeActive=false;a.rerouting=false;a.route=null;a.routeAlternatives=[];a.routeProgressIndex=0;a.routeProgressMeters=0;a.routeStepIndex=0;a.activeGuidanceStep=-1;a.lastGuidanceStep=-1;a.announced={};a.offRouteHits=0;}catch(_){}
 try{a.destinationMarker?.remove?.();a.destinationMarker=null;a.destination=null}catch(_){}
 persistClear();try{window.Voice?.clear?.();speechSynthesis?.cancel?.()}catch(_){}
 visualClear(a);[60,180,500,1000,1800].forEach(ms=>setTimeout(()=>visualClear(a),ms));
 try{window.dispatchEvent(new CustomEvent('radar-route-ended',{detail:{reason}}))}catch(_){}
}
function install(){const a=app();if(!a?.map)return false;if(a.__routeLifecycleV214)return true;a.__routeLifecycleV214=true;
 let was=!!a.navActive;
 setInterval(()=>{const x=app();if(!x)return;const now=!!x.navActive;if(was&&!now){finish('navigation-ended');}was=now;},120);
 const x=document.getElementById('clearBtn');if(x&&!x.__v214){x.__v214=true;x.addEventListener('click',()=>{const z=app();if(z?.route||z?.destination||z?.navActive)setTimeout(()=>finish('clear-search'),0)},true);}
 // Ao voltar do background, se a navegacao ainda esta ativa, nao toca na rota.
 // Se ja terminou e sobrou somente desenho antigo, remove o desenho.
 const scrub=()=>{const z=app();if(z&&!z.navActive&&!z.route)visualClear(z)};
 window.addEventListener('pageshow',()=>setTimeout(scrub,500));document.addEventListener('visibilitychange',()=>{if(!document.hidden)setTimeout(scrub,400)});
 return true;}
let n=0,t=setInterval(()=>{n++;if(install()||n>300)clearInterval(t)},100);
window.RadarRouteLifecycleV214={version:'214',finish};
})();
