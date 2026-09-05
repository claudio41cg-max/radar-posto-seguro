/* Radar Seguro RJ PRO v155 — restaura todas as comunidades e aplica visual cartográfico inspirado na referência */
(()=>{
'use strict';
if(window.__radarCommunityMapStyleV155)return;
window.__radarCommunityMapStyleV155=true;

const IDS={
 fill:'community-reference-fill-v155',
 glow:'community-reference-glow-v155',
 outline:'community-reference-outline-v155',
 label:'community-reference-label-v155'
};

const LEGACY=[
 'community-cartographic-outline-v95','community-cartographic-fill-v95',
 'santa-cruz-label-v149','santa-cruz-blue-fill-v149','santa-cruz-blue-glow-v149','santa-cruz-blue-outline-v149',
 'community-reference-fill-v155','community-reference-glow-v155','community-reference-outline-v155','community-reference-label-v155'
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
 'Barbante (Inhoaíba)','BARBANTE',
 'Carobinha (Campo Grande)','CAROBINHA',
 'Vila Aliança (Bangu)','VILA ALIANÇA',
 'Vila Vintém (Padre Miguel)','VILA VINTÉM',
 'Comunidade do Batam (Realengo)','BATAM',
 'Vila Kennedy','VILA KENNEDY',
 'Complexo do Chapadão','COMPLEXO DO CHAPADÃO',
 'Complexo da Pedreira','COMPLEXO DA PEDREIRA',
 'Complexo da Penha','COMPLEXO DA PENHA',
 'Complexo do Alemão','COMPLEXO DO ALEMÃO',
 ['upcase',['get','name']]
];

const statusColor=['match',['downcase',['to-string',['coalesce',['get','occurrenceStatus'],'normal']]],
 ['today','current','danger','red','critical','high'],'#d92d20',
 ['recent','orange','moderate'],'#f28c18',
 ['attention','yellow','watch'],'#f2c500',
 ['monitoring','green','safe-watch'],'#17a34a',
 '#1769d2'
];

const statusLine=['match',['downcase',['to-string',['coalesce',['get','occurrenceStatus'],'normal']]],
 ['today','current','danger','red','critical','high'],'#ff665a',
 ['recent','orange','moderate'],'#ffae42',
 ['attention','yellow','watch'],'#ffe15b',
 ['monitoring','green','safe-watch'],'#4ade80',
 '#4da3ff'
];

function addBefore(map,layer,before){
 try{
  map.addLayer(layer,before&&map.getLayer(before)?before:undefined);
 }catch(_){
  try{map.addLayer(layer);}catch(__){}
 }
}

function remove(map,id){
 try{if(map.getLayer(id))map.removeLayer(id);}catch(_){}
}

function setVisible(map,id,visible){
 try{if(map.getLayer(id))map.setLayoutProperty(id,'visibility',visible?'visible':'none');}catch(_){}
}

function apply(map){
 try{
  if(!map||!map.getSource('communities'))return false;

  LEGACY.forEach(id=>remove(map,id));

  /* Oculta apenas rótulos antigos para não duplicar nomes. Os dados e polígonos permanecem intactos. */
  [
   'community-label-v94','community-label-natural-v94','barbante-label-v94',
   'community-big-label','community-area-label','community-label'
  ].forEach(id=>setVisible(map,id,false));

  /* A camada antiga fica transparente, mas não é removida para preservar eventos e compatibilidade. */
  if(map.getLayer('community-fill')){
   try{map.setPaintProperty('community-fill','fill-opacity',0);}catch(_){}
  }
  if(map.getLayer('community-outline')){
   try{map.setPaintProperty('community-outline','line-opacity',0);}catch(_){}
  }

  /* Todas as comunidades recebem preenchimento visível. A cor muda somente quando há status de ocorrência. */
  addBefore(map,{
   id:IDS.fill,
   type:'fill',
   source:'communities',
   paint:{
    'fill-color':statusColor,
    'fill-opacity':['interpolate',['linear'],['zoom'],8,.18,10,.22,12,.27,14,.32,16,.34,18,.30]
   }
  },'community-outline');

  /* Brilho externo leve, inspirado no mapa de referência, sem esconder ruas e construções. */
  addBefore(map,{
   id:IDS.glow,
   type:'line',
   source:'communities',
   layout:{'line-join':'round','line-cap':'round'},
   paint:{
    'line-color':statusLine,
    'line-width':['interpolate',['linear'],['zoom'],8,2.2,10,3.2,12,4.4,15,5.8,18,7.0],
    'line-opacity':.26,
    'line-blur':2.1
   }
  },'community-outline');

  /* Contorno principal forte e fino para deixar cada limite claro no satélite e no mapa normal. */
  addBefore(map,{
   id:IDS.outline,
   type:'line',
   source:'communities',
   layout:{'line-join':'round','line-cap':'round'},
   paint:{
    'line-color':statusLine,
    'line-width':['interpolate',['linear'],['zoom'],8,1.2,10,1.55,12,1.9,15,2.4,18,2.9],
    'line-opacity':.98
   }
  });

  /* Nome dentro da área, com halo escuro para permanecer legível no satélite. */
  addBefore(map,{
   id:IDS.label,
   type:'symbol',
   source:'communities',
   minzoom:10.1,
   layout:{
    'text-field':pretty,
    'text-size':['interpolate',['linear'],['zoom'],10.1,10.5,11.5,12,13,13.5,15,15.5,17,17.5,18.5,19],
    'text-font':['Noto Sans Bold'],
    'text-anchor':'center',
    'text-allow-overlap':false,
    'text-ignore-placement':false,
    'text-letter-spacing':.025,
    'text-max-width':10,
    'symbol-placement':'point'
   },
   paint:{
    'text-color':'#ffffff',
    'text-halo-color':'rgba(4,14,28,.94)',
    'text-halo-width':2.15,
    'text-halo-blur':.45
   }
  });

  return true;
 }catch(e){
  console.warn('Estilo de comunidades v155 indisponível',e);
  return false;
 }
}

function install(){
 const map=window.RadarApp?.map;
 if(!map?.on)return false;
 if(map.__communityStyleV155)return true;
 map.__communityStyleV155=true;
 apply(map);
 map.on('style.load',()=>setTimeout(()=>apply(map),40));
 return true;
}

let tries=0;
const timer=setInterval(()=>{
 if(install()||++tries>140)clearInterval(timer);
},150);
window.addEventListener('load',install,{once:true});

window.RadarCommunityMapStyleV95={
 version:'155-all-communities-reference-style',
 apply:()=>apply(window.RadarApp?.map)
};
})();