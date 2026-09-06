/* Radar Seguro RJ PRO v165 — Cesarão isolado em Santa Cruz.
   Mantém apenas o Cesarão entre as áreas de Santa Cruz e usa um contorno territorial amplo de referência.
   O centro foi conferido na localidade Conjunto Habitacional Cesarão / Conjunto Otacílio Câmara.
   Este contorno é uma referência territorial do Radar, não um limite administrativo oficial. */
(()=>{
'use strict';
if(window.__radarCesaraoOnlyV165)return;
window.__radarCesaraoOnlyV165=true;
const NAME='Cesarão (Santa Cruz)';
const P=[
[-43.6722,-22.9302],[-43.6686,-22.9272],[-43.6642,-22.9259],[-43.6598,-22.9271],
[-43.6570,-22.9295],[-43.6528,-22.9304],[-43.6506,-22.9340],[-43.6515,-22.9370],
[-43.6497,-22.9403],[-43.6532,-22.9430],[-43.6553,-22.9460],[-43.6591,-22.9487],
[-43.6637,-22.9494],[-43.6661,-22.9470],[-43.6694,-22.9463],[-43.6710,-22.9424],
[-43.6741,-22.9405],[-43.6731,-22.9367],[-43.6750,-22.9335],[-43.6722,-22.9302]
];
function poly(){return {type:'Polygon',coordinates:[P.map(p=>[+p[0],+p[1]])]};}
function centroid(){let x=0,y=0;P.slice(0,-1).forEach(p=>{x+=p[0];y+=p[1]});const n=P.length-1;return [x/n,y/n];}
try{
  if(!window.RADAR_COMMUNITY_GEOMETRIES)window.RADAR_COMMUNITY_GEOMETRIES={version:165,description:'Cesarão isolado',geometries:{}};
  if(!window.RADAR_COMMUNITY_GEOMETRIES.geometries)window.RADAR_COMMUNITY_GEOMETRIES.geometries={};
  const G=window.RADAR_COMMUNITY_GEOMETRIES.geometries;
  Object.keys(G).forEach(k=>{if(/Santa Cruz/i.test(k)&&k!==NAME)delete G[k];});
  G[NAME]=poly();
  if(typeof rawAreas!=='undefined'&&Array.isArray(rawAreas)){
    for(let i=rawAreas.length-1;i>=0;i--){const n=String(rawAreas[i]?.name||'');if(/Santa Cruz/i.test(n)&&n!==NAME)rawAreas.splice(i,1);}
    let a=rawAreas.find(x=>x.name===NAME);
    if(!a){a={name:NAME};rawAreas.push(a);}
    a.c=centroid();a.r=1.35;a.displayColor='#dc2626';a.territorial_note='Área territorial ampla de referência do Radar v165; não é limite administrativo oficial.';
  }
  window.RADAR_COMMUNITY_GEOMETRIES.version=165;
  window.RadarCesaraoOnlyV165={version:165,name:NAME,center:centroid(),geometry:poly()};
}catch(e){console.error('Falha ao preparar Cesarão v165',e);}
})();