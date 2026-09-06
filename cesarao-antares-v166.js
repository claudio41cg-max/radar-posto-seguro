/* Radar Seguro RJ PRO v166 — Cesarão + Antares em suas posições de referência.
   Mostra apenas estas duas áreas de Santa Cruz neste teste.
   Os contornos são áreas territoriais de referência do Radar, não limites administrativos oficiais. */
(()=>{
'use strict';
if(window.__radarCesaraoAntaresV166)return;
window.__radarCesaraoAntaresV166=true;
const C='Cesarão (Santa Cruz)';
const A='Comunidade de Antares (Santa Cruz)';
const P={
 [C]:[
  [-43.6722,-22.9302],[-43.6686,-22.9272],[-43.6642,-22.9259],[-43.6598,-22.9271],
  [-43.6570,-22.9295],[-43.6528,-22.9304],[-43.6506,-22.9340],[-43.6515,-22.9370],
  [-43.6497,-22.9403],[-43.6532,-22.9430],[-43.6553,-22.9460],[-43.6591,-22.9487],
  [-43.6637,-22.9494],[-43.6661,-22.9470],[-43.6694,-22.9463],[-43.6710,-22.9424],
  [-43.6741,-22.9405],[-43.6731,-22.9367],[-43.6750,-22.9335],[-43.6722,-22.9302]
 ],
 [A]:[
  [-43.6668,-22.9145],[-43.6625,-22.9136],[-43.6582,-22.9140],[-43.6545,-22.9158],
  [-43.6522,-22.9184],[-43.6528,-22.9213],[-43.6512,-22.9233],[-43.6537,-22.9253],
  [-43.6572,-22.9261],[-43.6605,-22.9250],[-43.6638,-22.9256],[-43.6663,-22.9237],
  [-43.6684,-22.9214],[-43.6680,-22.9182],[-43.6690,-22.9164],[-43.6668,-22.9145]
 ]
};
function poly(pts){return {type:'Polygon',coordinates:[pts.map(p=>[+p[0],+p[1]])]};}
function centroid(pts){let x=0,y=0;const q=pts.slice(0,-1);q.forEach(p=>{x+=p[0];y+=p[1]});return [x/q.length,y/q.length];}
try{
 if(!window.RADAR_COMMUNITY_GEOMETRIES)window.RADAR_COMMUNITY_GEOMETRIES={version:166,description:'Cesarão e Antares isolados',geometries:{}};
 if(!window.RADAR_COMMUNITY_GEOMETRIES.geometries)window.RADAR_COMMUNITY_GEOMETRIES.geometries={};
 const G=window.RADAR_COMMUNITY_GEOMETRIES.geometries;
 Object.keys(G).forEach(k=>{if(/Santa Cruz/i.test(k)&&k!==C&&k!==A)delete G[k];});
 G[C]=poly(P[C]); G[A]=poly(P[A]);
 if(typeof rawAreas!=='undefined'&&Array.isArray(rawAreas)){
   for(let i=rawAreas.length-1;i>=0;i--){const n=String(rawAreas[i]?.name||'');if(/Santa Cruz/i.test(n)&&n!==C&&n!==A)rawAreas.splice(i,1);}
   [[C,'#dc2626'],[A,'#f97316']].forEach(([name,color])=>{
     let a=rawAreas.find(x=>x.name===name);if(!a){a={name};rawAreas.push(a);}a.c=centroid(P[name]);a.r=.75;a.displayColor=color;a.territorial_note='Área territorial de referência do Radar v166; não é limite administrativo oficial.';
   });
 }
 window.RADAR_COMMUNITY_GEOMETRIES.version=166;
 window.RadarCesaraoAntaresV166={version:166,names:[C,A],centers:{[C]:centroid(P[C]),[A]:centroid(P[A])}};
}catch(e){console.error('Falha Cesarão + Antares v166',e)}
})();