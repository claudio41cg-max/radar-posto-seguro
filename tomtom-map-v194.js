/* Radar Seguro RJ PRO v194 — base cartografica TomTom Orbis no MapLibre.
   Usa tiles TomTom para claro/escuro/satelite; MapLibre continua apenas como renderer. */
(()=>{
'use strict';
if(window.__radarTomTomMapV194)return;
window.__radarTomTomMapV194=true;
const WORKER='https://radar-seguro-ia-rj.claudio41cg.workers.dev';
const app=()=>{try{return window.RadarApp||window.App||null}catch(_){return null}};
function proxyTilePath(path){return `${WORKER}/v1/tomtom?path=${path}`;}
function streetTile(style){const path='%2Fmaps%2Forbis%2Fmap-display%2Ftile%2F{z}%2F{x}%2F{y}.png%3FapiVersion%3D1%26style%3D'+encodeURIComponent(style)+'%26tileSize%3D512%26view%3DUnified%26language%3Dpt-BR';return proxyTilePath(path);}
function satelliteTile(){const path='%2Fmaps%2Forbis%2Fmap-display%2Ftile%2Fsatellite%2F{z}%2F{x}%2F{y}.jpg%3FapiVersion%3D1';return proxyTilePath(path);}
function style(mode){const sat=mode==='sat'||mode==='satellite',dark=mode==='dark';const tile=sat?satelliteTile():streetTile(dark?'street-dark':'street-light');return{version:8,sources:{'tomtom-v194':{type:'raster',tiles:[tile],tileSize:sat?256:512,minzoom:0,maxzoom:sat?19:22,attribution:'© TomTom'}},layers:[{id:'tomtom-v194-base',type:'raster',source:'tomtom-v194',minzoom:0,maxzoom:sat?19:22,paint:{'raster-opacity':1}}]};}
function badge(){let b=document.getElementById('mapProviderV194');if(!b){b=document.createElement('div');b.id='mapProviderV194';Object.assign(b.style,{position:'fixed',left:'10px',bottom:'150px',zIndex:'2147480000',padding:'5px 8px',borderRadius:'999px',font:'700 10px Arial,sans-serif',letterSpacing:'.3px',background:'rgba(0,100,180,.92)',color:'#fff',boxShadow:'0 3px 12px rgba(0,0,0,.35)',pointerEvents:'none'});document.body.appendChild(b);}b.textContent='MAPA • TOMTOM ORBIS';}
function install(){const a=app();if(!a?.map)return false;if(a.__tomTomMapV194Installed)return true;a.__tomTomMapV194Installed=true;const oldGet=typeof a.getThemeStyle==='function'?a.getThemeStyle.bind(a):null;a.__getThemeStyleBeforeTomTomV194=oldGet;a.getThemeStyle=function(mode){let resolved=mode;if(mode==='auto'){try{resolved=this.automaticThemeNow?.()||'light';}catch(_){resolved='light';}}return style(resolved);};try{const mode=a.themeMode==='auto'?(a.automaticThemeNow?.()||'light'):a.themeMode;a.map.setStyle(style(mode));}catch(e){console.warn('Radar v194 mapa TomTom:',e);}badge();return true;}
let tries=0,t=setInterval(()=>{tries++;if(install()||tries>240)clearInterval(t);},80);
window.RadarTomTomMapV194={version:'194',style};
})();
