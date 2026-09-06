/* Radar Seguro RJ PRO v167 — Cesarão usando geometria cartográfica carregada da base SABREN/Prefeitura quando disponível. */
(()=>{
'use strict';
if(window.__radarCesaraoOfficialV167)return;
window.__radarCesaraoOfficialV167=true;
const NAME='Cesarão (Santa Cruz)';
const FALLBACK=[[-43.6722,-22.9302],[-43.6686,-22.9272],[-43.6642,-22.9259],[-43.6598,-22.9271],[-43.6570,-22.9295],[-43.6528,-22.9304],[-43.6506,-22.9340],[-43.6515,-22.9370],[-43.6497,-22.9403],[-43.6532,-22.9430],[-43.6553,-22.9460],[-43.6591,-22.9487],[-43.6637,-22.9494],[-43.6661,-22.9470],[-43.6694,-22.9463],[-43.6710,-22.9424],[-43.6741,-22.9405],[-43.6731,-22.9367],[-43.6750,-22.9335],[-43.6722,-22.9302]];
function polyFallback(){return {type:'Polygon',coordinates:[FALLBACK]};}
function centerOfGeometry(g){try{let pts=[];const walk=x=>{if(!Array.isArray(x))return;if(typeof x[0]==='number'&&typeof x[1]==='number'){pts.push(x);return;}x.forEach(walk)};walk(g.coordinates);let sx=0,sy=0;pts.forEach(p=>{sx+=+p[0];sy+=+p[1]});return pts.length?[sx/pts.length,sy/pts.length]:[-43.66237,-22.93754]}catch(_){return[-43.66237,-22.93754]}}
try{
 const official=window.__CESARAO_OFFICIAL_GEOJSON?.geometry||null;
 const geometry=official||polyFallback();
 if(!window.RADAR_COMMUNITY_GEOMETRIES)window.RADAR_COMMUNITY_GEOMETRIES={version:167,description:'Cesarão oficial SABREN',geometries:{}};
 if(!window.RADAR_COMMUNITY_GEOMETRIES.geometries)window.RADAR_COMMUNITY_GEOMETRIES.geometries={};
 const G=window.RADAR_COMMUNITY_GEOMETRIES.geometries;
 Object.keys(G).forEach(k=>{if(/Santa Cruz/i.test(k)&&k!==NAME)delete G[k];});
 G[NAME]=geometry;
 if(typeof rawAreas!=='undefined'&&Array.isArray(rawAreas)){
  for(let i=rawAreas.length-1;i>=0;i--){const n=String(rawAreas[i]?.name||'');if(/Santa Cruz/i.test(n)&&n!==NAME)rawAreas.splice(i,1);}
  let a=rawAreas.find(x=>x.name===NAME);if(!a){a={name:NAME};rawAreas.push(a);}a.c=centerOfGeometry(geometry);a.r=.8;a.displayColor='#dc2626';a.territorial_note=official?'Polígono cartográfico obtido em tempo real da base SABREN/Prefeitura do Rio.':'Fallback temporário: a base SABREN não respondeu nesta abertura.';
 }
 window.RADAR_COMMUNITY_GEOMETRIES.version=167;
 window.RadarCesaraoOfficialV167={version:167,name:NAME,official:!!official,source:official?'SABREN/Prefeitura do Rio':'fallback',center:centerOfGeometry(geometry)};
}catch(e){console.error('Falha Cesarão oficial v167',e)}
})();