/* Radar Seguro RJ PRO v175 — estilo Cesarão + Antares + Rollas visíveis. */
(()=>{'use strict';if(window.__radarStyleV175)return;window.__radarStyleV175=true;
const C='Cesarão (Santa Cruz)',A='Comunidade de Antares (Santa Cruz)',R='Rollas (Santa Cruz)';
function app(){try{return window.RadarApp?.map?window.RadarApp:(typeof App!=='undefined'?App:null)}catch(_){return null}}
function enhance(){document.querySelectorAll('#map canvas').forEach(c=>c.style.filter='saturate(1.16) contrast(1.08) brightness(.97)')}
function apply(){const a=app(),m=a?.map;if(!m?.getLayer)return false;try{
 ['community-fill','communities-force-fill-v159'].forEach(id=>{if(m.getLayer(id)){m.setLayoutProperty(id,'visibility','visible');m.setPaintProperty(id,'fill-color',['match',['get','name'],C,'#dc2626',A,'#f97316',R,'#f59e0b','#1769d2']);m.setPaintProperty(id,'fill-opacity',['match',['get','name'],C,.27,A,.27,R,.27,0])}});
 ['community-outline','communities-force-line-v159'].forEach(id=>{if(m.getLayer(id)){m.setLayoutProperty(id,'visibility','visible');m.setPaintProperty(id,'line-color',['match',['get','name'],C,'#fff',A,'#fff',R,'#fff','rgba(0,0,0,0)']);m.setPaintProperty(id,'line-width',['interpolate',['linear'],['zoom'],9,.8,12,1.1,15,1.45]);m.setPaintProperty(id,'line-opacity',.94)}});
 ['community-label','communities-force-label-v159'].forEach(id=>{if(m.getLayer(id)){m.setLayoutProperty(id,'visibility','visible');m.setLayoutProperty(id,'text-field',['match',['get','name'],C,'CESARÃO',A,'ANTARES',R,'ROLLAS','']);m.setPaintProperty(id,'text-color','#fff');m.setPaintProperty(id,'text-halo-color','#07131f');m.setPaintProperty(id,'text-halo-width',1.8)}});
 enhance();return true
 }catch(e){console.warn('style v175',e);return false}}
function install(){const a=app(),m=a?.map;if(!m?.on)return false;if(m.__v175Installed)return true;m.__v175Installed=true;let n=0,t=setInterval(()=>{n++;if(apply()||n>120)clearInterval(t)},120);m.on('style.load',()=>setTimeout(apply,220));m.on('sourcedata',()=>setTimeout(apply,90));m.on('idle',enhance);return true}
let n=0,t=setInterval(()=>{n++;if(install()||n>180)clearInterval(t)},100);window.addEventListener('load',()=>setTimeout(apply,600),{once:true})})();