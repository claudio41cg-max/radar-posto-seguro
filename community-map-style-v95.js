/* Radar Seguro RJ PRO v157 — correção robusta das comunidades usando as camadas nativas do app */
(()=>{
'use strict';
if(window.__radarCommunityMapStyleV157)return;
window.__radarCommunityMapStyleV157=true;

function currentMap(){
  try{ if(typeof App!=='undefined' && App?.map) return App.map; }catch(_){}
  try{ if(window.RadarApp?.map) return window.RadarApp.map; }catch(_){}
  return null;
}

const EXTRA_LAYERS=[
  'community-reference-fill-v155','community-reference-glow-v155','community-reference-outline-v155','community-reference-label-v155',
  'community-reference-fill-v156','community-reference-glow-v156','community-reference-outline-v156','community-reference-label-v156',
  'community-cartographic-outline-v95','community-cartographic-fill-v95',
  'santa-cruz-label-v149','santa-cruz-blue-fill-v149','santa-cruz-blue-glow-v149','santa-cruz-blue-outline-v149'
];

function removeExtraLayers(map){
  EXTRA_LAYERS.forEach(id=>{
    try{ if(map.getLayer(id)) map.removeLayer(id); }catch(_){}
  });
}

function apply(map=currentMap()){
  try{
    if(!map || !map.getSource('communities')) return false;
    if(!map.getLayer('community-fill') || !map.getLayer('community-outline')) return false;

    removeExtraLayers(map);

    map.setLayoutProperty('community-fill','visibility','visible');
    map.setLayoutProperty('community-outline','visibility','visible');

    map.setPaintProperty('community-fill','fill-color',[
      'match',['get','occurrenceStatus'],
      'today','#dc2626',
      'recent','#f97316',
      '#1769d2'
    ]);
    map.setPaintProperty('community-fill','fill-opacity',[
      'match',['get','occurrenceStatus'],
      'today',0.38,
      'recent',0.30,
      0.22
    ]);

    map.setPaintProperty('community-outline','line-color',[
      'match',['get','occurrenceStatus'],
      'today','#ff6b63',
      'recent','#ffad4d',
      '#4da3ff'
    ]);
    map.setPaintProperty('community-outline','line-width',[
      'interpolate',['linear'],['zoom'],
      8.8,1.4,
      11,2.0,
      14,2.7,
      17,3.4
    ]);
    map.setPaintProperty('community-outline','line-opacity',0.98);

    if(map.getLayer('community-dot')){
      map.setLayoutProperty('community-dot','visibility','visible');
      map.setPaintProperty('community-dot','circle-opacity',0.95);
      map.setPaintProperty('community-dot','circle-stroke-opacity',1);
    }

    if(map.getLayer('community-label')){
      map.setLayoutProperty('community-label','visibility','visible');
      try{ map.setLayerZoomRange('community-label',10.2,24); }catch(_){}
      map.setPaintProperty('community-label','text-color','#ffffff');
      map.setPaintProperty('community-label','text-halo-color','#07131f');
      map.setPaintProperty('community-label','text-halo-width',2);
      map.setPaintProperty('community-label','text-opacity',1);
      map.setLayoutProperty('community-label','text-size',[
        'interpolate',['linear'],['zoom'],
        10.2,10,
        12,12,
        14,14,
        17,17
      ]);
      map.setLayoutProperty('community-label','text-max-width',14);
    }

    return true;
  }catch(e){
    console.warn('Radar comunidades v157:',e);
    return false;
  }
}

function retryApply(delay=120){
  let attempts=0;
  const timer=setInterval(()=>{
    attempts++;
    if(apply() || attempts>=120) clearInterval(timer);
  },delay);
}

function install(){
  const map=currentMap();
  if(!map?.on) return false;
  if(map.__communityStyleV157Installed) return true;
  map.__communityStyleV157Installed=true;

  retryApply(120);

  map.on('style.load',()=>{
    setTimeout(()=>retryApply(100),40);
  });

  map.on('sourcedata',e=>{
    if(e?.sourceId==='communities') apply(map);
  });

  return true;
}

let bootAttempts=0;
const bootTimer=setInterval(()=>{
  bootAttempts++;
  if(install() || bootAttempts>=160) clearInterval(bootTimer);
},120);

window.addEventListener('load',()=>{
  install();
  retryApply(120);
},{once:true});

window.RadarCommunityMapStyleV95={
  version:'157-native-community-layer-fix',
  apply:()=>apply(currentMap())
};
})();