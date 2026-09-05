/* Radar Seguro RJ PRO v159 — camada independente de comunidades usando os dados já salvos */
(()=>{
'use strict';
if(window.__radarCommunityForceOverlayV159) return;
window.__radarCommunityForceOverlayV159=true;

const SRC='communities-force-v159';
const PTS='communities-force-points-v159';
const FILL='communities-force-fill-v159';
const LINE='communities-force-line-v159';
const LABEL='communities-force-label-v159';

function app(){
  try{ if(window.RadarApp?.map) return window.RadarApp; }catch(_){}
  try{ if(typeof App!=='undefined' && App?.map) return App; }catch(_){}
  return null;
}

function circle(lon,lat,rKm,steps=48){
  const pts=[];
  const latRad=lat*Math.PI/180;
  const dLat=rKm/110.574;
  const dLon=rKm/(111.320*Math.max(.2,Math.cos(latRad)));
  for(let i=0;i<=steps;i++){
    const a=2*Math.PI*i/steps;
    pts.push([lon+dLon*Math.cos(a),lat+dLat*Math.sin(a)]);
  }
  return pts;
}

function areaData(){
  let areas=[];
  try{ if(typeof rawAreas!=='undefined' && Array.isArray(rawAreas)) areas=rawAreas; }catch(_){}
  const geoms=window.RADAR_COMMUNITY_GEOMETRIES?.geometries||{};
  const features=areas.map((a,index)=>({
    type:'Feature',
    properties:{name:a.name,index,official:Boolean(geoms[a.name]),occurrenceStatus:'normal'},
    geometry:geoms[a.name]||{type:'Polygon',coordinates:[circle(Number(a.c[0]),Number(a.c[1]),Number(a.r||.35))]}
  }));
  return {type:'FeatureCollection',features};
}

function pointData(){
  let areas=[];
  try{ if(typeof rawAreas!=='undefined' && Array.isArray(rawAreas)) areas=rawAreas; }catch(_){}
  return {type:'FeatureCollection',features:areas.map((a,index)=>({
    type:'Feature',properties:{name:a.name,index},geometry:{type:'Point',coordinates:[Number(a.c[0]),Number(a.c[1])]}
  }))};
}

function remove(map,id){ try{ if(map.getLayer(id)) map.removeLayer(id); }catch(_){} }
function removeSource(map,id){ try{ if(map.getSource(id)) map.removeSource(id); }catch(_){} }

function build(){
  const a=app(), map=a?.map;
  if(!map?.getStyle) return false;
  let areas=[];
  try{ if(typeof rawAreas!=='undefined' && Array.isArray(rawAreas)) areas=rawAreas; }catch(_){}
  if(!areas.length) return false;

  try{
    [LABEL,LINE,FILL].forEach(id=>remove(map,id));
    [PTS,SRC].forEach(id=>removeSource(map,id));

    map.addSource(SRC,{type:'geojson',data:areaData()});
    map.addSource(PTS,{type:'geojson',data:pointData()});

    map.addLayer({
      id:FILL,type:'fill',source:SRC,minzoom:8,
      paint:{'fill-color':'#1769d2','fill-opacity':['interpolate',['linear'],['zoom'],8,.18,10,.24,12,.30,14,.34,17,.38]}
    });
    map.addLayer({
      id:LINE,type:'line',source:SRC,minzoom:8,
      layout:{'line-cap':'round','line-join':'round'},
      paint:{'line-color':'#2f8cff','line-width':['interpolate',['linear'],['zoom'],8,1.3,10,1.8,12,2.4,14,3,17,3.6],'line-opacity':1}
    });
    map.addLayer({
      id:LABEL,type:'symbol',source:PTS,minzoom:9.2,
      layout:{
        'text-field':['upcase',['get','name']],
        'text-size':['interpolate',['linear'],['zoom'],9.2,10,11,11.5,13,13.5,15,16,17,18],
        'text-anchor':'center','text-max-width':13,'text-allow-overlap':false,'text-ignore-placement':false
      },
      paint:{'text-color':'#ffffff','text-halo-color':'#07131f','text-halo-width':2.2,'text-halo-blur':.3}
    });

    const visible=a.communityVisible!==false?'visible':'none';
    [FILL,LINE,LABEL].forEach(id=>{try{map.setLayoutProperty(id,'visibility',visible);}catch(_){}});
    return true;
  }catch(e){
    console.warn('Radar v159 comunidades:',e);
    return false;
  }
}

function syncVisibility(){
  const a=app(),map=a?.map;
  if(!map) return;
  const visible=a.communityVisible!==false?'visible':'none';
  [FILL,LINE,LABEL].forEach(id=>{try{if(map.getLayer(id))map.setLayoutProperty(id,'visibility',visible);}catch(_){}});
}

function install(){
  const a=app(),map=a?.map;
  if(!map?.on) return false;
  if(map.__communityForceV159Installed) return true;
  map.__communityForceV159Installed=true;

  let tries=0;
  const t=setInterval(()=>{ tries++; if(build()||tries>=120) clearInterval(t); },120);
  map.on('style.load',()=>setTimeout(build,120));

  ['communityChip','navCommunityChip'].forEach(id=>{
    document.getElementById(id)?.addEventListener('click',()=>setTimeout(syncVisibility,80));
  });
  return true;
}

let boot=0;
const timer=setInterval(()=>{boot++;if(install()||boot>=180)clearInterval(timer);},100);
window.addEventListener('load',()=>{install();setTimeout(build,300);},{once:true});
})();