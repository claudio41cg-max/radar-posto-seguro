/* Radar Seguro RJ PRO v168 — estilo cartográfico + visual satélite mais cinematográfico. */
(()=>{
'use strict';
if(window.__radarCesaraoAntaresStyleV168)return;window.__radarCesaraoAntaresStyleV168=true;
const C='Cesarão (Santa Cruz)',A='Comunidade de Antares (Santa Cruz)';
function app(){try{return window.RadarApp?.map?window.RadarApp:(typeof App!=='undefined'?App:null)}catch(_){return null}}
function enhanceCanvas(){try{document.querySelectorAll('#map canvas').forEach(c=>{c.style.filter='saturate(1.18) contrast(1.10) brightness(0.96)';c.style.imageRendering='auto';});}catch(_){}}
function apply(){const a=app(),m=a?.map;if(!m?.getLayer)return false;try{
 ['community-fill','communities-force-fill-v159'].forEach(id=>{if(m.getLayer(id)){m.setLayoutProperty(id,'visibility','visible');m.setPaintProperty(id,'fill-color',['match',['get','name'],C,'#dc2626',A,'#f97316','#1769d2']);m.setPaintProperty(id,'fill-opacity',['match',['get','name'],C,0.27,A,0.27,0]);}});
 ['community-outline','communities-force-line-v159'].forEach(id=>{if(m.getLayer(id)){m.setLayoutProperty(id,'visibility','visible');m.setPaintProperty(id,'line-color',['match',['get','name'],C,'#ffffff',A,'#ffffff','rgba(0,0,0,0)']);m.setPaintProperty(id,'line-width',['interpolate',['linear'],['zoom'],9,2.2,12,3.2,15,4.2]);m.setPaintProperty(id,'line-opacity',1);}});
 ['community-label','communities-force-label-v159'].forEach(id=>{if(m.getLayer(id)){m.setLayoutProperty(id,'visibility','visible');m.setLayoutProperty(id,'text-field',['match',['get','name'],C,'CESARÃO',A,'ANTARES','']);m.setPaintProperty(id,'text-color','#fff');m.setPaintProperty(id,'text-halo-color','#07131f');m.setPaintProperty(id,'text-halo-width',2.5);}});
 if(a.setTheme && !m.__v168Satellite){m.__v168Satellite=true;try{a.setTheme('sat')}catch(_){}}
 enhanceCanvas();
 if(!m.__v168Centered){m.__v168Centered=true;setTimeout(()=>{try{const cs=window.RadarCesaraoAntaresOfficialV168?.centers||{};const c1=cs[C]||[-43.66237,-22.93754],c2=cs[A]||[-43.6596,-22.9205];m.fitBounds([[Math.min(c1[0],c2[0])-.008,Math.min(c1[1],c2[1])-.006],[Math.max(c1[0],c2[0])+.008,Math.max(c1[1],c2[1])+.006]],{padding:{top:210,bottom:150,left:35,right:75},duration:900,maxZoom:14.5});}catch(_){}} ,500);}
 return true;
}catch(e){console.warn('v168 style',e);return false}}
function install(){const a=app(),m=a?.map;if(!m?.on)return false;if(m.__v168Installed)return true;m.__v168Installed=true;let n=0,t=setInterval(()=>{n++;if(apply()||n>120)clearInterval(t)},120);m.on('style.load',()=>setTimeout(apply,220));m.on('sourcedata',()=>setTimeout(apply,90));m.on('idle',enhanceCanvas);return true}
let n=0,t=setInterval(()=>{n++;if(install()||n>180)clearInterval(t)},100);window.addEventListener('load',()=>setTimeout(apply,600),{once:true});
})();