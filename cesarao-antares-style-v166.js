/* Radar Seguro RJ PRO v166 — estilo Cesarão + Antares */
(()=>{
'use strict';
if(window.__radarCesaraoAntaresStyleV166)return;
window.__radarCesaraoAntaresStyleV166=true;
const C='Cesarão (Santa Cruz)',A='Comunidade de Antares (Santa Cruz)';
function app(){try{return window.RadarApp?.map?window.RadarApp:(typeof App!=='undefined'?App:null)}catch(_){return null}}
function apply(){const a=app(),m=a?.map;if(!m?.getLayer)return false;try{
 const color=['match',['get','name'],C,'#dc2626',A,'#f97316','#1769d2'];
 ['community-fill','communities-force-fill-v159'].forEach(id=>{if(m.getLayer(id)){m.setLayoutProperty(id,'visibility','visible');m.setPaintProperty(id,'fill-color',color);m.setPaintProperty(id,'fill-opacity',0.34);}});
 ['community-outline','communities-force-line-v159'].forEach(id=>{if(m.getLayer(id)){m.setLayoutProperty(id,'visibility','visible');m.setPaintProperty(id,'line-color','#ffffff');m.setPaintProperty(id,'line-width',['interpolate',['linear'],['zoom'],9,2,12,3,15,4]);m.setPaintProperty(id,'line-opacity',1);}});
 ['community-label','communities-force-label-v159'].forEach(id=>{if(m.getLayer(id)){m.setLayoutProperty(id,'visibility','visible');m.setLayoutProperty(id,'text-field',['match',['get','name'],C,'CESARÃO',A,'ANTARES',['upcase',['get','name']]]);m.setPaintProperty(id,'text-color','#fff');m.setPaintProperty(id,'text-halo-color','#07131f');m.setPaintProperty(id,'text-halo-width',2.2);}});
 if(!m.__v166Centered){m.__v166Centered=true;setTimeout(()=>{try{m.fitBounds([[-43.678,-22.951],[-43.648,-22.911]],{padding:{top:210,bottom:160,left:35,right:80},duration:900,maxZoom:13.8});}catch(_){}} ,350);}
 return true;
}catch(e){console.warn('v166 style',e);return false}}
function install(){const a=app(),m=a?.map;if(!m?.on)return false;if(m.__v166Installed)return true;m.__v166Installed=true;let n=0,t=setInterval(()=>{n++;if(apply()||n>120)clearInterval(t)},120);m.on('style.load',()=>setTimeout(apply,180));m.on('sourcedata',()=>setTimeout(apply,70));return true}
let n=0,t=setInterval(()=>{n++;if(install()||n>180)clearInterval(t)},100);window.addEventListener('load',()=>setTimeout(apply,500),{once:true});
})();