/* Radar Seguro RJ PRO v168 — Cesarão + Antares com geometria cartográfica oficial quando disponível. */
(()=>{
'use strict';
if(window.__radarCesaraoAntaresOfficialV168)return;
window.__radarCesaraoAntaresOfficialV168=true;
const C='Cesarão (Santa Cruz)';
const A='Comunidade de Antares (Santa Cruz)';
const FALLBACK_C=[[-43.6722,-22.9302],[-43.6686,-22.9272],[-43.6642,-22.9259],[-43.6598,-22.9271],[-43.6570,-22.9295],[-43.6528,-22.9304],[-43.6506,-22.9340],[-43.6515,-22.9370],[-43.6497,-22.9403],[-43.6532,-22.9430],[-43.6553,-22.9460],[-43.6591,-22.9487],[-43.6637,-22.9494],[-43.6661,-22.9470],[-43.6694,-22.9463],[-43.6710,-22.9424],[-43.6741,-22.9405],[-43.6731,-22.9367],[-43.6750,-22.9335],[-43.6722,-22.9302]];
const FALLBACK_A=[[-43.6668,-22.9145],[-43.6625,-22.9136],[-43.6582,-22.9140],[-43.6545,-22.9158],[-43.6522,-22.9184],[-43.6528,-22.9213],[-43.6512,-22.9233],[-43.6537,-22.9253],[-43.6572,-22.9261],[-43.6605,-22.9250],[-43.6638,-22.9256],[-43.6663,-22.9237],[-43.6684,-22.9214],[-43.6680,-22.9182],[-43.6690,-22.9164],[-43.6668,-22.9145]];
function polygon(p){return {type:'Polygon',coordinates:[p]};}
function center(g,fallback){try{const pts=[];const walk=x=>{if(!Array.isArray(x))return;if(typeof x[0]==='number'&&typeof x[1]==='number'){pts.push(x);return;}x.forEach(walk)};walk(g.coordinates);let sx=0,sy=0;pts.forEach(p=>{sx+=+p[0];sy+=+p[1]});return pts.length?[sx/pts.length,sy/pts.length]:fallback}catch(_){return fallback}}
try{
 const gc=window.__CESARAO_OFFICIAL_GEOJSON?.geometry||polygon(FALLBACK_C);
 const ga=window.__ANTARES_OFFICIAL_GEOJSON?.geometry||polygon(FALLBACK_A);
 if(!window.RADAR_COMMUNITY_GEOMETRIES)window.RADAR_COMMUNITY_GEOMETRIES={version:168,description:'Cesarão e Antares cartográficos',geometries:{}};
 if(!window.RADAR_COMMUNITY_GEOMETRIES.geometries)window.RADAR_COMMUNITY_GEOMETRIES.geometries={};
 const G=window.RADAR_COMMUNITY_GEOMETRIES.geometries;
 Object.keys(G).forEach(k=>{if(/Santa Cruz/i.test(k)&&k!==C&&k!==A)delete G[k];});
 G[C]=gc;G[A]=ga;
 if(typeof rawAreas!=='undefined'&&Array.isArray(rawAreas)){
  for(let i=rawAreas.length-1;i>=0;i--){const n=String(rawAreas[i]?.name||'');if(/Santa Cruz/i.test(n)&&n!==C&&n!==A)rawAreas.splice(i,1);}
  [[C,gc,'#dc2626',[-43.66237,-22.93754],!!window.__CESARAO_OFFICIAL_GEOJSON],[A,ga,'#f97316',[-43.6596,-22.9205],!!window.__ANTARES_OFFICIAL_GEOJSON]].forEach(([name,g,color,fb,official])=>{
   let a=rawAreas.find(x=>x.name===name);if(!a){a={name};rawAreas.push(a);}a.c=center(g,fb);a.r=.8;a.displayColor=color;a.territorial_note=official?'Polígono cartográfico obtido da base SABREN/Prefeitura do Rio.':'Fallback temporário porque a base oficial não respondeu nesta abertura.';
  });
 }
 window.RADAR_COMMUNITY_GEOMETRIES.version=168;
 window.RadarCesaraoAntaresOfficialV168={version:168,centers:{[C]:center(gc,[-43.66237,-22.93754]),[A]:center(ga,[-43.6596,-22.9205])},official:{cesarao:!!window.__CESARAO_OFFICIAL_GEOJSON,antares:!!window.__ANTARES_OFFICIAL_GEOJSON}};
}catch(e){console.error('Falha Cesarão + Antares v168',e)}
})();