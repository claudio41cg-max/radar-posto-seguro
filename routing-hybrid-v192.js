/* Radar Seguro RJ PRO v192 — integra Radar Router próprio com TomTom.
   Padrão: TomTom principal + Radar Router como fallback. ?router=radar testa o roteador próprio como principal. */
(()=>{
'use strict';
if(window.__radarRoutingHybridV192)return;window.__radarRoutingHybridV192=true;
const app=()=>{try{return window.RadarApp||window.App||null}catch(_){return null}};
const point=p=>Array.isArray(p)&&p.length>=2&&Number.isFinite(+p[0])&&Number.isFinite(+p[1]);
function urlMode(){try{return new URLSearchParams(location.search).get('router')||'';}catch(_){return'';}}
function loadMode(){const q=urlMode().toLowerCase();if(q==='radar'||q==='tomtom'||q==='hybrid')return q;try{const s=localStorage.getItem('radar.router.mode');if(['radar','tomtom','hybrid'].includes(s))return s;}catch(_){}return'hybrid';}
let mode=loadMode();
function setMode(v,persist=true){v=String(v||'').toLowerCase();if(!['radar','tomtom','hybrid'].includes(v))return false;mode=v;if(persist)try{localStorage.setItem('radar.router.mode',v);}catch(_){}const a=app();a?.toast?.(v==='radar'?'Radar Router ativado para teste.':v==='tomtom'?'TomTom ativada como roteador.':'Modo híbrido ativado.',2600);return true;}
async function ownRoute(a,start,end){if(!window.RadarOwnRouterV192?.route)throw new Error('Radar Router não carregado');a.toast?.('Radar Router calculando pela malha OpenStreetMap...',2400);const r=await window.RadarOwnRouterV192.route(start,end,{transportMode:a.transportMode||'car'});try{a.prepareRouteGeometry?.(r);}catch(_){}return r;}
function install(){const a=app();if(!a?.map||!window.RadarOwnRouterV192?.route)return false;if(a.__routingHybridV192Installed)return true;const tomtomGet=typeof a.getRoute==='function'?a.getRoute.bind(a):null;if(!tomtomGet)return false;a.__routingHybridV192Installed=true;a.__tomTomGetRouteV192=tomtomGet;
 a.getRoute=async function(start,end){if(!point(start)||!point(end))throw new Error('Origem/destino inválidos');const current=mode;
   if(current==='radar'){
     try{const r=await ownRoute(this,start,end);this.toast?.('Rota calculada pelo Radar Router.',1800);return r;}catch(e){console.warn('Radar Router v192 falhou; usando TomTom',e);this.toast?.('Radar Router não conseguiu essa rota. Usando TomTom.',2600);return tomtomGet(start,end);}
   }
   if(current==='tomtom')return tomtomGet(start,end);
   try{return await tomtomGet(start,end);}catch(e){console.warn('TomTom falhou; tentando Radar Router',e);this.toast?.('TomTom indisponível. Tentando Radar Router...',2600);return ownRoute(this,start,end);}
 };
 const badge=()=>{try{const el=document.getElementById('gpsBadge');if(!el)return;el.title='Roteador: '+mode.toUpperCase();}catch(_){}};badge();setInterval(badge,4000);
 console.info('Radar v192 roteamento:',mode);
 return true;}
let n=0,t=setInterval(()=>{n++;if(install()||n>300)clearInterval(t);},100);
window.RadarRoutingHybridV192={version:'192',get mode(){return mode;},setMode,getMode:()=>mode};
})();