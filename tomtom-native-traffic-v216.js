/* Radar Seguro RJ PRO v216 — trânsito exibido diretamente pelos tiles oficiais TomTom.
   Não classifica velocidade, não inventa trechos e não decide cores localmente. */
(()=>{'use strict';
if(window.__radarTomTomNativeTrafficV216)return;window.__radarTomTomNativeTrafficV216=true;
const WORKER='https://radar-seguro-ia-rj.claudio41cg.workers.dev';
const SOURCE='tomtom-native-traffic-v216',LAYER='tomtom-native-traffic-v216';
const app=()=>{try{return window.RadarApp||window.App||null}catch(_){return null}};
function tile(){const path='%2Ftraffic%2Fmap%2F4%2Ftile%2Fflow%2Frelative-delay%2F{z}%2F{x}%2F{y}.png%3FtileSize%3D512';return `${WORKER}/v1/tomtom?path=${path}`;}
function removeOld(m){
  for(const id of['radar-flow-v131-line','tomtom-traffic-flow'])try{if(m.getLayer(id))m.removeLayer(id)}catch(_){}
  for(const id of['radar-flow-v131','tomtom-traffic'])try{if(m.getSource(id))m.removeSource(id)}catch(_){}
}
function installLayer(){const a=app(),m=a?.map;if(!m)return false;try{
  removeOld(m);
  if(!m.getSource(SOURCE))m.addSource(SOURCE,{type:'raster',tiles:[tile()],tileSize:512,minzoom:5,maxzoom:22,attribution:'© TomTom Traffic'});
  if(!m.getLayer(LAYER))m.addLayer({id:LAYER,type:'raster',source:SOURCE,minzoom:5,maxzoom:22,paint:{'raster-opacity':.92,'raster-fade-duration':0}});
  try{const routeLayer=['route-primary-v188-line','route-main','route-outline'].find(id=>m.getLayer(id));if(routeLayer)m.moveLayer(LAYER,routeLayer);}catch(_){}
  return true;
}catch(e){console.warn('Radar v216 TomTom traffic',e);return false;}}
function install(){const a=app(),m=a?.map;if(!m)return false;if(a.__tomTomNativeTrafficV216Installed)return true;a.__tomTomNativeTrafficV216Installed=true;
  try{m.on?.('styledata',()=>setTimeout(installLayer,80));}catch(_){}
  [0,500,1400,3000].forEach(ms=>setTimeout(installLayer,ms));return true;}
let n=0,t=setInterval(()=>{n++;if(install()||n>300)clearInterval(t)},100);
window.RadarTomTomNativeTrafficV216={version:'216',refresh:installLayer};
})();