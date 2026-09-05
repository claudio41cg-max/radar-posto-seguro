/* Radar Seguro RJ PRO v162 — estilo aplicado às camadas NATIVAS do app. */
(()=>{
'use strict';
if(window.__radarSantaCruzNativeStyleV162)return;
window.__radarSantaCruzNativeStyleV162=true;

const colorExpr=['match',['get','name'],
'Cesarão (Santa Cruz)','#d92d20','Rodo (Santa Cruz)','#f28c18','Coqueiral (Santa Cruz)','#2563eb','Vila Paciência (Santa Cruz)','#16a34a',
'Comunidade de Antares (Santa Cruz)','#dc2626','Jardim Mangaratiba (Santa Cruz)','#2563eb','Urucânia (Santa Cruz)','#7c3aed','Areia Branca (Santa Cruz)','#eab308',
'Urucânia Velha (Santa Cruz)','#2563eb','Comunidade do Aço (Santa Cruz)','#0891b2','Rollas (Santa Cruz)','#16a34a','Três Pontes (Santa Cruz)','#7c3aed',
'João XXIII (Santa Cruz)','#eab308','Nova Cascadura (Santa Cruz)','#e11d48','Conjunto Habitacional da Aeronáutica (Santa Cruz)','#2563eb','Mangue Seco (Santa Cruz)','#2563eb',
'Nova Santa Cruz (Santa Cruz)','#2563eb',"Morro da Caixa D'Água (Santa Cruz)",'#2563eb','Loteamento São Jorge (Santa Cruz)','#64748b','Areia Branca Extensão (Santa Cruz)','#64748b','Vila Aliança (Santa Cruz)','#64748b',
'#1769d2'];
const pretty=['match',['get','name'],
'Cesarão (Santa Cruz)','CESARÃO','Rodo (Santa Cruz)','RODO','Coqueiral (Santa Cruz)','COQUEIRAL','Vila Paciência (Santa Cruz)','VILA PACIÊNCIA',
'Comunidade de Antares (Santa Cruz)','ANTARES','Jardim Mangaratiba (Santa Cruz)','JARDIM MANGARATIBA','Urucânia (Santa Cruz)','URUCÂNIA','Areia Branca (Santa Cruz)','AREIA BRANCA',
'Urucânia Velha (Santa Cruz)','URUCÂNIA VELHA','Comunidade do Aço (Santa Cruz)','AÇO','Rollas (Santa Cruz)','ROLLAS','Três Pontes (Santa Cruz)','TRÊS PONTES',
'João XXIII (Santa Cruz)','JOÃO XXIII','Nova Cascadura (Santa Cruz)','NOVA CASCADURA','Conjunto Habitacional da Aeronáutica (Santa Cruz)','CONJ. AERONÁUTICA','Mangue Seco (Santa Cruz)','MANGUE SECO',
'Nova Santa Cruz (Santa Cruz)','NOVA SANTA CRUZ',"Morro da Caixa D'Água (Santa Cruz)","MORRO DA CAIXA D'ÁGUA",'Loteamento São Jorge (Santa Cruz)','LOTEAMENTO SÃO JORGE','Areia Branca Extensão (Santa Cruz)','AREIA BRANCA EXT.','Vila Aliança (Santa Cruz)','VILA ALIANÇA',
['upcase',['get','name']]];
function app(){try{return window.RadarApp?.map?window.RadarApp:(typeof App!=='undefined'?App:null)}catch(_){return null}}
function apply(){const a=app(),m=a?.map;if(!m?.getLayer)return false;try{
  if(m.getLayer('community-fill')){m.setLayoutProperty('community-fill','visibility','visible');m.setPaintProperty('community-fill','fill-color',colorExpr);m.setPaintProperty('community-fill','fill-opacity',['interpolate',['linear'],['zoom'],8,.16,10,.22,12,.28,14,.32,17,.35]);}
  if(m.getLayer('community-outline')){m.setLayoutProperty('community-outline','visibility','visible');m.setPaintProperty('community-outline','line-color',colorExpr);m.setPaintProperty('community-outline','line-width',['interpolate',['linear'],['zoom'],8,1.4,10,1.8,12,2.4,14,3.0,17,3.6]);m.setPaintProperty('community-outline','line-opacity',1);}
  if(m.getLayer('community-label')){m.setLayoutProperty('community-label','visibility','visible');try{m.setLayerZoomRange('community-label',8.8,24)}catch(_){}m.setLayoutProperty('community-label','text-field',pretty);m.setLayoutProperty('community-label','text-size',['interpolate',['linear'],['zoom'],8.8,9.5,10.5,11,12.5,13.5,15,16,17,18]);m.setLayoutProperty('community-label','text-max-width',12);m.setPaintProperty('community-label','text-color','#fff');m.setPaintProperty('community-label','text-halo-color','#07131f');m.setPaintProperty('community-label','text-halo-width',2.2);m.setPaintProperty('community-label','text-opacity',1);}
  if(typeof a.setCommunityVisibility==='function')a.setCommunityVisibility(true);
  return !!m.getSource('communities');
}catch(e){console.warn('v162 estilo nativo Santa Cruz',e);return false}}
function install(){const a=app(),m=a?.map;if(!m?.on)return false;if(m.__scNative162)return true;m.__scNative162=true;let n=0;const t=setInterval(()=>{n++;if(apply()||n>100)clearInterval(t)},120);m.on('style.load',()=>setTimeout(apply,150));m.on('sourcedata',()=>setTimeout(apply,60));return true}
let n=0,t=setInterval(()=>{n++;if(install()||n>180)clearInterval(t)},100);window.addEventListener('load',()=>setTimeout(apply,400),{once:true});
})();