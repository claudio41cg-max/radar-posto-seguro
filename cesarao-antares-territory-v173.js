/* Radar Seguro RJ PRO v173 — Antares: prioridade para polígono oficial SABREN; fallback territorial estreito. */
(()=>{'use strict';if(window.__radarTerritoryV173)return;window.__radarTerritoryV173=true;
const C='Cesarão (Santa Cruz)',A='Comunidade de Antares (Santa Cruz)';
/* Fallback somente se o SABREN não devolver Antares. Formato estreito inspirado na referência visual do WikiFavelas e nas barreiras locais, sem tratar esta aproximação como limite oficial. */
const ANTARES_FALLBACK=[[-43.6650,-22.9170],[-43.6635,-22.9165],[-43.6617,-22.9162],[-43.6599,-22.9164],[-43.6582,-22.9170],[-43.6570,-22.9180],[-43.6564,-22.9192],[-43.6568,-22.9201],[-43.6581,-22.9207],[-43.6598,-22.9210],[-43.6615,-22.9209],[-43.6630,-22.9205],[-43.6642,-22.9197],[-43.6650,-22.9186],[-43.6650,-22.9170]];
const poly=p=>({type:'Polygon',coordinates:[p]});
function center(g,fb){try{const p=[];const w=x=>{if(!Array.isArray(x))return;if(typeof x[0]==='number'&&typeof x[1]==='number'){p.push(x);return}x.forEach(w)};w(g.coordinates);return p.length?[p.reduce((s,x)=>s+x[0],0)/p.length,p.reduce((s,x)=>s+x[1],0)/p.length]:fb}catch(_){return fb}}
try{
 const gc=window.__CESARAO_OFFICIAL_GEOJSON?.geometry||null;
 const ga=window.__ANTARES_OFFICIAL_GEOJSON?.geometry||null;
 if(!window.RADAR_COMMUNITY_GEOMETRIES)window.RADAR_COMMUNITY_GEOMETRIES={version:173,geometries:{}};
 const G=window.RADAR_COMMUNITY_GEOMETRIES.geometries||(window.RADAR_COMMUNITY_GEOMETRIES.geometries={});
 Object.keys(G).forEach(k=>{if(/Santa Cruz/i.test(k)&&k!==C&&k!==A)delete G[k]});
 if(gc)G[C]=gc; G[A]=ga||poly(ANTARES_FALLBACK);
 if(typeof rawAreas!=='undefined'&&Array.isArray(rawAreas)){
  for(let i=rawAreas.length-1;i>=0;i--){const n=String(rawAreas[i]?.name||'');if(/Santa Cruz/i.test(n)&&n!==C&&n!==A)rawAreas.splice(i,1)}
  [[C,G[C],'#dc2626',[-43.66237,-22.93754],'Polígono SABREN/Prefeitura quando disponível.'],[A,G[A],'#f97316',[-43.6602,-22.9190],ga?'Polígono de Conjunto Habitacional obtido diretamente do SABREN/Prefeitura do Rio.':'Área territorial de referência do Radar: formato estreito baseado na referência visual WikiFavelas e conferência IBGE; não é limite administrativo oficial.']].forEach(([n,g,color,fb,note])=>{if(!g)return;let a=rawAreas.find(x=>x.name===n);if(!a){a={name:n};rawAreas.push(a)}a.c=center(g,fb);a.r=.45;a.displayColor=color;a.territorial_note=note});
 }
 window.RADAR_COMMUNITY_GEOMETRIES.version=173;
 window.RadarTerritoryV173={antaresSource:ga?'SABREN':'reference',centers:{[C]:center(G[C]||G[A],[-43.66237,-22.93754]),[A]:center(G[A],[-43.6602,-22.9190])}};
}catch(e){console.error('territory v173',e)}})();