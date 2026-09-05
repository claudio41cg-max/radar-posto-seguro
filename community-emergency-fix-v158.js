/* Radar Seguro RJ PRO v158 — restauração robusta das comunidades */
(()=>{
'use strict';
if(window.__radarCommunityEmergencyFixV158) return;
window.__radarCommunityEmergencyFixV158=true;

const EXTRA=[
  'community-reference-fill-v155','community-reference-glow-v155','community-reference-outline-v155','community-reference-label-v155',
  'community-reference-fill-v156','community-reference-glow-v156','community-reference-outline-v156','community-reference-label-v156',
  'community-cartographic-outline-v95','community-cartographic-fill-v95',
  'santa-cruz-label-v149','santa-cruz-blue-fill-v149','santa-cruz-blue-glow-v149','santa-cruz-blue-outline-v149'
];

function getApp(){
  try{ if(typeof App!=='undefined' && App) return App; }catch(_){}
  try{ if(window.RadarApp?.map) return window.RadarApp; }catch(_){}
  return null;
}

function cleanExtras(map){
  EXTRA.forEach(id=>{
    try{ if(map.getLayer(id)) map.removeLayer(id); }catch(_){}
  });
}

function styleBase(app){
  const map=app?.map;
  if(!map) return false;
  if(!map.getSource('communities')) return false;
  if(!map.getLayer('community-fill') || !map.getLayer('community-outline')) return false;

  try{
    app.communityVisible=true;
    map.setLayoutProperty('community-fill','visibility','visible');
    map.setLayoutProperty('community-outline','visibility','visible');

    map.setPaintProperty('community-fill','fill-color',[
      'match',['get','occurrenceStatus'],
      'today','#dc2626',
      'recent','#f97316',
      '#1769d2'
    ]);
    map.setPaintProperty('community-fill','fill-opacity',[
      'interpolate',['linear'],['zoom'],
      8.8,.18,10,.24,12,.30,14,.34,17,.38
    ]);

    map.setPaintProperty('community-outline','line-color',[
      'match',['get','occurrenceStatus'],
      'today','#ff5c52',
      'recent','#ff9f2f',
      '#2f8cff'
    ]);
    map.setPaintProperty('community-outline','line-width',[
      'interpolate',['linear'],['zoom'],
      8.8,1.5,10,1.9,12,2.4,14,2.9,17,3.5
    ]);
    map.setPaintProperty('community-outline','line-opacity',1);

    if(map.getLayer('community-dot')){
      map.setLayoutProperty('community-dot','visibility','visible');
      try{ map.setLayerZoomRange('community-dot',0,24); }catch(_){}
      map.setPaintProperty('community-dot','circle-opacity',.95);
      map.setPaintProperty('community-dot','circle-stroke-opacity',1);
    }

    if(map.getLayer('community-label')){
      map.setLayoutProperty('community-label','visibility','visible');
      try{ map.setLayerZoomRange('community-label',9.7,24); }catch(_){}
      map.setLayoutProperty('community-label','text-size',[
        'interpolate',['linear'],['zoom'],
        9.7,10,11,11.5,13,13.5,15,16,17,18
      ]);
      map.setLayoutProperty('community-label','text-max-width',14);
      map.setPaintProperty('community-label','text-color','#ffffff');
      map.setPaintProperty('community-label','text-halo-color','#07131f');
      map.setPaintProperty('community-label','text-halo-width',2.2);
      map.setPaintProperty('community-label','text-opacity',1);
    }

    if(typeof app.setCommunityVisibility==='function') app.setCommunityVisibility(true);
    return true;
  }catch(e){
    console.warn('v158 estilo comunidades:',e);
    return false;
  }
}

function rebuild(){
  const app=getApp();
  const map=app?.map;
  if(!map?.getStyle) return false;

  try{
    cleanExtras(map);
    if(typeof app.addCommunityLayers==='function'){
      app.addCommunityLayers();
    }
    cleanExtras(map);
    return styleBase(app);
  }catch(e){
    console.warn('v158 reconstrução comunidades:',e);
    return false;
  }
}

function install(){
  const app=getApp();
  const map=app?.map;
  if(!map?.on) return false;
  if(map.__communityEmergencyV158Installed) return true;
  map.__communityEmergencyV158Installed=true;

  const run=()=>{
    let attempts=0;
    const t=setInterval(()=>{
      attempts++;
      if(rebuild() || attempts>=80) clearInterval(t);
    },120);
  };

  run();
  map.on('style.load',()=>setTimeout(run,60));
  return true;
}

let boot=0;
const timer=setInterval(()=>{
  boot++;
  if(install() || boot>=160) clearInterval(timer);
},100);

window.addEventListener('load',()=>{
  install();
  setTimeout(rebuild,250);
},{once:true});
})();