/* Radar Seguro RJ PRO v150 — visual de Santa Cruz inspirado na referência aprovada */
(()=>{
'use strict';
if(window.__radarCommunityMapStyleV154)return;window.__radarCommunityMapStyleV154=true;
const OUT='community-cartographic-outline-v95',FILL='community-cartographic-fill-v95';
const SCF='santa-cruz-blue-fill-v149',SCG='santa-cruz-blue-glow-v149',SCO='santa-cruz-blue-outline-v149',SCL='santa-cruz-label-v149';
const SCN=[
 'Cesarão (Santa Cruz)',
 'Comunidade de Antares (Santa Cruz)',
 'Pantanal (Santa Cruz)',
 'Três Pontes (Santa Cruz)',
 'Rollas / Rodo (Santa Cruz)',
 'Coqueiral (Santa Cruz)',
 'Urucânia (Santa Cruz)',
 'Comunidade do Aço (Santa Cruz)',
 'João XXIII (Santa Cruz)'
];
const pretty=['match',['get','name'],
 'Cesarão (Santa Cruz)','CESARÃO',
 'Comunidade de Antares (Santa Cruz)','ANTARES',
 'Pantanal (Santa Cruz)','PANTANAL',
 'Três Pontes (Santa Cruz)','TRÊS PONTES',
 'Rollas / Rodo (Santa Cruz)','ROLLAS / RODO',
 'Coqueiral (Santa Cruz)','COQUEIRAL',
 'Urucânia (Santa Cruz)','URUCÂNIA',
 'Comunidade do Aço (Santa Cruz)','AÇO',
 'João XXIII (Santa Cruz)','JOÃO XXIII',
 ['get','name']
];
function addBefore(map,layer,before){try{map.addLayer(layer,before&&map.getLayer(before)?before:undefined)}catch(_){try{map.addLayer(layer)}catch(__){}}}
function apply(map){
 try{
  if(!map||!map.getSource('communities'))return false;
  ['santa-cruz-label-v149','santa-cruz-blue-fill-v149','santa-cruz-blue-glow-v149','santa-cruz-blue-outline-v149'].forEach(id=>{try{if(map.getLayer(id))map.removeLayer(id)}catch(_){}});
  ['community-label-v94','community-label-natural-v94','barbante-label-v94','community-big-label','community-area-label'].forEach(id=>{try{if(map.getLayer(id))map.setLayoutProperty(id,'visibility','none')}catch(_){}});
  if(map.getLayer('community-fill')){
   map.setPaintProperty('community-fill','fill-color','#60798a');
   map.setPaintProperty('community-fill','fill-opacity',.11);
  }
  if(!map.getLayer(FILL))addBefore(map,{id:FILL,type:'fill',source:'communities',paint:{'fill-color':'#58788d','fill-opacity':.16}},'community-outline');
  if(map.getLayer('community-outline')){
   map.setPaintProperty('community-outline','line-color','#f2f8fb');
   map.setPaintProperty('community-outline','line-width',1.45);
   map.setPaintProperty('community-outline','line-opacity',.88);
  }
  if(!map.getLayer(OUT))addBefore(map,{id:OUT,type:'line',source:'communities',layout:{'line-join':'round','line-cap':'round'},paint:{'line-color':'#f7fbfd','line-width':['interpolate',['linear'],['zoom'],9,1.0,12,1.35,15,1.65,18,2.0],'line-opacity':.9,'line-blur':.08}});

  /* Santa Cruz: preenchimento azul translúcido, contorno vivo e leve brilho como na referência. */
  if(!map.getLayer(SCF))addBefore(map,{id:SCF,type:'fill',source:'communities',filter:['match',['get','name'],SCN,true,false],paint:{'fill-color':'#0f66d8','fill-opacity':['interpolate',['linear'],['zoom'],9,.18,12,.27,15,.33,18,.29]}},'community-outline');
  if(!map.getLayer(SCG))addBefore(map,{id:SCG,type:'line',source:'communities',filter:['match',['get','name'],SCN,true,false],layout:{'line-join':'round','line-cap':'round'},paint:{'line-color':'#178cff','line-width':['interpolate',['linear'],['zoom'],9,4.0,12,5.0,15,6.0,18,7.0],'line-opacity':.34,'line-blur':2.2}},'community-outline');
  if(!map.getLayer(SCO))addBefore(map,{id:SCO,type:'line',source:'communities',filter:['match',['get','name'],SCN,true,false],layout:{'line-join':'round','line-cap':'round'},paint:{'line-color':'#ffffff','line-width':['interpolate',['linear'],['zoom'],9,1.7,12,2.2,15,2.8,18,3.2],'line-opacity':1,'line-blur':.02}});

  /* Evita rótulo duplicado nas áreas de Santa Cruz. */
  if(map.getLayer('community-label')){
   map.setLayoutProperty('community-label','text-size',['interpolate',['linear'],['zoom'],10,0,11,10,13,12,16,14]);
   map.setPaintProperty('community-label','text-color','#ffffff');
   map.setPaintProperty('community-label','text-halo-color','#07131f');
   map.setPaintProperty('community-label','text-halo-width',1.4);
   map.setPaintProperty('community-label','text-opacity',['case',['match',['get','name'],SCN,true,false],0,['interpolate',['linear'],['zoom'],10,0,10.8,0,11.4,1]]);
  }
  if(!map.getLayer(SCL))addBefore(map,{id:SCL,type:'symbol',source:'communities',filter:['match',['get','name'],SCN,true,false],minzoom:10.2,layout:{'text-field':pretty,'text-size':['interpolate',['linear'],['zoom'],10.2,11,12,13.5,14,16,16,18.5,18,20],'text-font':['Noto Sans Bold'],'text-anchor':'center','text-allow-overlap':false,'text-ignore-placement':false,'text-letter-spacing':.03,'symbol-placement':'point'},paint:{'text-color':'#ffffff','text-halo-color':'rgba(4,14,28,.92)','text-halo-width':2.35,'text-halo-blur':.55}});
  return true;
 }catch(e){console.warn('Estilo Santa Cruz v149 indisponível',e);return false}
}
function install(){const map=window.RadarApp?.map;if(!map?.on)return false;if(map.__communityStyleV154)return true;map.__communityStyleV154=true;apply(map);map.on('style.load',()=>setTimeout(()=>apply(map),30));return true}
let tries=0,t=setInterval(()=>{if(install()||++tries>120)clearInterval(t)},150);window.addEventListener('load',install,{once:true});
window.RadarCommunityMapStyleV95={version:'154-cesarao-clean-rebuild',apply:()=>apply(window.RadarApp?.map)};
})();