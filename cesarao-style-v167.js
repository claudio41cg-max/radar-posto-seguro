/* Radar Seguro RJ PRO v167 — estilo cartográfico do Cesarão */
(()=>{
'use strict';
if(window.__radarCesaraoStyleV167)return;window.__radarCesaraoStyleV167=true;
const C='Cesarão (Santa Cruz)';
function app(){try{return window.RadarApp?.map?window.RadarApp:(typeof App!=='undefined'?App:null)}catch(_){return null}}
function apply(){const a=app(),m=a?.map;if(!m?.getLayer)return false;try{
 ['community-fill','communities-force-fill-v159'].forEach(id=>{if(m.getLayer(id)){m.setLayoutProperty(id,'visibility','visible');m.setPaintProperty(id,'fill-color',['match',['get','name'],C,'#dc2626','#1769d2']);m.setPaintProperty(id,'fill-opacity',['match',['get','name'],C,0.28,0]);}});
 ['community-outline','communities-force-line-v159'].forEach(id=>{if(m.getLayer(id)){m.setLayoutProperty(id,'visibility','visible');m.setPaintProperty(id,'line-color',['match',['get','name'],C,'#ffffff','rgba(0,0,0,0)']);m.setPaintProperty(id,'line-width',['interpolate',['linear'],['zoom'],9,2.2,12,3.2,15,4.2]);m.setPaintProperty(id,'line-opacity',1);}});
 ['community-label','communities-force-label-v159'].forEach(id=>{if(m.getLayer(id)){m.setLayoutProperty(id,'visibility','visible');m.setLayoutProperty(id,'text-field',['match',['get','name'],C,'CESARÃO','']);m.setPaintProperty(id,'text-color','#fff');m.setPaintProperty(id,'text-halo-color','#07131f');m.setPaintProperty(id,'text-halo-width',2.4);}});
 if(!m.__v167Centered){m.__v167Centered=true;setTimeout(()=>{try{const c=window.RadarCesaraoOfficialV167?.center||[-43.66237,-22.93754];m.easeTo({center:c,zoom:14.1,duration:900});}catch(_){}} ,350);}
 return true;
}catch(e){console.warn('v167 style',e);return false}}
function install(){const a=app(),m=a?.map;if(!m?.on)return false;if(m.__v167Installed)return true;m.__v167Installed=true;let n=0,t=setInterval(()=>{n++;if(apply()||n>120)clearInterval(t)},120);m.on('style.load',()=>setTimeout(apply,180));m.on('sourcedata',()=>setTimeout(apply,70));return true}
let n=0,t=setInterval(()=>{n++;if(install()||n>180)clearInterval(t)},100);window.addEventListener('load',()=>setTimeout(apply,500),{once:true});
})();