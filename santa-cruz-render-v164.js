/* Radar Seguro RJ PRO v164 — estilo cartográfico do mosaico de Santa Cruz */
(()=>{
'use strict';
if(window.__radarSantaCruzRenderV164)return;window.__radarSantaCruzRenderV164=true;
function app(){try{return window.RadarApp?.map?window.RadarApp:(typeof App!=='undefined'?App:null)}catch(_){return null}}
function colorExpr(){const C=window.RadarSantaCruzTerritoriesV164?.colors||{};const out=['match',['get','name']];Object.entries(C).forEach(([n,c])=>out.push(n,c));out.push('#1769d2');return out}
function prettyExpr(){const P=window.RadarSantaCruzTerritoriesV164?.pretty||{};const out=['match',['get','name']];Object.entries(P).forEach(([n,v])=>out.push(n,v));out.push(['upcase',['get','name']]);return out}
function apply(){const a=app(),m=a?.map;if(!m?.getLayer)return false;try{
 const fill='communities-force-fill-v159',line='communities-force-line-v159',label='communities-force-label-v159';
 if(!m.getLayer(fill)||!m.getLayer(line))return false;
 m.setPaintProperty(fill,'fill-color',colorExpr());
 m.setPaintProperty(fill,'fill-opacity',['interpolate',['linear'],['zoom'],8,.20,10,.24,12,.28,14,.31,17,.34]);
 m.setPaintProperty(line,'line-color','#ffffff');
 m.setPaintProperty(line,'line-width',['interpolate',['linear'],['zoom'],8,1.1,10,1.5,12,2,14,2.5,17,3]);
 m.setPaintProperty(line,'line-opacity',.96);
 if(m.getLayer(label)){
   m.setLayoutProperty(label,'text-field',prettyExpr());
   m.setLayoutProperty(label,'text-size',['interpolate',['linear'],['zoom'],9.2,10,11,11.5,13,13.5,15,16,17,18]);
   m.setPaintProperty(label,'text-color','#fff');
   m.setPaintProperty(label,'text-halo-color','#07131f');
   m.setPaintProperty(label,'text-halo-width',2.2);
 }
 return true;
}catch(e){console.warn('v164 render Santa Cruz',e);return false}}
function install(){const a=app(),m=a?.map;if(!m?.on)return false;if(m.__scRender164)return true;m.__scRender164=true;let n=0,t=setInterval(()=>{n++;if(apply()||n>120)clearInterval(t)},120);m.on('style.load',()=>setTimeout(apply,180));m.on('sourcedata',()=>setTimeout(apply,100));return true}
let n=0,t=setInterval(()=>{n++;if(install()||n>180)clearInterval(t)},100);window.addEventListener('load',()=>setTimeout(apply,500),{once:true});
})();