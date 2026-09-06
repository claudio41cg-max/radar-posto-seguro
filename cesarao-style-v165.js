/* Radar Seguro RJ PRO v165 — visual do Cesarão: translúcido por dentro e linha branca por fora. */
(()=>{
'use strict';
if(window.__radarCesaraoStyleV165)return;
window.__radarCesaraoStyleV165=true;
const NAME='Cesarão (Santa Cruz)';
function app(){try{return window.RadarApp?.map?window.RadarApp:(typeof App!=='undefined'?App:null)}catch(_){return null}}
function apply(){const a=app(),m=a?.map;if(!m?.getLayer)return false;try{
  const ids=['communities-force-fill-v159','communities-force-line-v159','communities-force-label-v159'];
  if(!ids.every(id=>m.getLayer(id)))return false;
  const filter=['==',['get','name'],NAME];
  ids.forEach(id=>m.setFilter(id,filter));
  m.setLayoutProperty('communities-force-fill-v159','visibility','visible');
  m.setPaintProperty('communities-force-fill-v159','fill-color','#dc2626');
  m.setPaintProperty('communities-force-fill-v159','fill-opacity',['interpolate',['linear'],['zoom'],8,.18,10,.22,12,.27,14,.31,17,.34]);
  m.setLayoutProperty('communities-force-line-v159','visibility','visible');
  m.setPaintProperty('communities-force-line-v159','line-color','#ffffff');
  m.setPaintProperty('communities-force-line-v159','line-width',['interpolate',['linear'],['zoom'],8,1.8,11,2.2,14,2.8,17,3.4]);
  m.setPaintProperty('communities-force-line-v159','line-opacity',1);
  m.setLayoutProperty('communities-force-label-v159','visibility','visible');
  m.setLayoutProperty('communities-force-label-v159','text-field','CESARÃO');
  m.setLayoutProperty('communities-force-label-v159','text-size',['interpolate',['linear'],['zoom'],9,12,12,15,14,18,17,22]);
  m.setPaintProperty('communities-force-label-v159','text-color','#ffffff');
  m.setPaintProperty('communities-force-label-v159','text-halo-color','#111827');
  m.setPaintProperty('communities-force-label-v159','text-halo-width',2.5);
  if(!m.__radarCesaraoFocusedV165){m.__radarCesaraoFocusedV165=true;setTimeout(()=>{try{m.flyTo({center:[-43.66237,-22.93754],zoom:13.6,duration:900});}catch(_){}},250);}
  return true;
}catch(e){console.warn('Falha estilo Cesarão v165',e);return false}}
function install(){const a=app(),m=a?.map;if(!m?.on)return false;if(m.__cesaraoStyleV165Installed)return true;m.__cesaraoStyleV165Installed=true;let n=0,t=setInterval(()=>{n++;if(apply()||n>120)clearInterval(t)},120);m.on('style.load',()=>setTimeout(apply,180));m.on('sourcedata',()=>setTimeout(apply,80));return true;}
let n=0,t=setInterval(()=>{n++;if(install()||n>180)clearInterval(t)},100);window.addEventListener('load',()=>setTimeout(apply,500),{once:true});
})();