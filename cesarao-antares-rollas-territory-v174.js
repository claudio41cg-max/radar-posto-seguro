/* Radar Seguro RJ PRO v174 — Cesarão + Antares + Rollas. Prioriza geometrias oficiais SABREN/Prefeitura. */
(()=>{'use strict';if(window.__radarTerritoryV174)return;window.__radarTerritoryV174=true;
const C='Cesarão (Santa Cruz)',A='Comunidade de Antares (Santa Cruz)',R='Rollas (Santa Cruz)';
/* Fallback do Rollas somente se nenhuma geometria oficial for localizada. Forma territorial de referência baseada na posição histórica já cadastrada no Radar e na referência visual compartilhada pelo usuário. */
const ROLLAS_FALLBACK=[
[-43.6584,-22.9239],[-43.6567,-22.9235],[-43.6548,-22.9238],[-43.6531,-22.9247],[-43.6522,-22.9260],[-43.6523,-22.9275],[-43.6533,-22.9287],[-43.6550,-22.9292],[-43.6568,-22.9288],[-43.6580,-22.9278],[-43.6587,-22.9264],[-43.6588,-22.9250],[-43.6584,-22.9239]
];
const poly=p=>({type:'Polygon',coordinates:[p]});
function center(g,fb){try{const p=[];const w=x=>{if(!Array.isArray(x))return;if(typeof x[0]==='number'&&typeof x[1]==='number'){p.push(x);return}x.forEach(w)};w(g.coordinates);return p.length?[p.reduce((s,x)=>s+x[0],0)/p.length,p.reduce((s,x)=>s+x[1],0)/p.length]:fb}catch(_){return fb}}
try{
 const gc=window.__CESARAO_OFFICIAL_GEOJSON?.geometry||null;
 const ga=window.__ANTARES_OFFICIAL_GEOJSON?.geometry||null;
 const gr=window.__ROLLAS_OFFICIAL_GEOJSON?.geometry||null;
 if(!window.RADAR_COMMUNITY_GEOMETRIES)window.RADAR_COMMUNITY_GEOMETRIES={version:174,geometries:{}};
 const G=window.RADAR_COMMUNITY_GEOMETRIES.geometries||(window.RADAR_COMMUNITY_GEOMETRIES.geometries={});
 Object.keys(G).forEach(k=>{if(/Santa Cruz/i.test(k)&&k!==C&&k!==A&&k!==R)delete G[k]});
 if(gc)G[C]=gc;
 if(ga)G[A]=ga;
 G[R]=gr||poly(ROLLAS_FALLBACK);
 if(typeof rawAreas!=='undefined'&&Array.isArray(rawAreas)){
  for(let i=rawAreas.length-1;i>=0;i--){const n=String(rawAreas[i]?.name||'');if(/Santa Cruz/i.test(n)&&n!==C&&n!==A&&n!==R)rawAreas.splice(i,1)}
  const rows=[
   [C,G[C],'#dc2626',[-43.66237,-22.93754],'Polígono SABREN/Prefeitura quando disponível.'],
   [A,G[A],'#f97316',[-43.6602,-22.9190],'Polígono de Conjunto Habitacional obtido do SABREN/Prefeitura do Rio.'],
   [R,G[R],'#f59e0b',[-43.654277,-22.926186],gr?'Polígono localizado em camada oficial SABREN/Prefeitura do Rio.':'Área territorial de referência do Radar baseada na imagem cartográfica compartilhada pelo usuário; não é limite administrativo oficial.']
  ];
  rows.forEach(([n,g,color,fb,note])=>{if(!g)return;let a=rawAreas.find(x=>x.name===n);if(!a){a={name:n};rawAreas.push(a)}a.c=center(g,fb);a.r=.42;a.displayColor=color;a.territorial_note=note});
 }
 window.RADAR_COMMUNITY_GEOMETRIES.version=174;
 window.RadarTerritoryV174={rollasSource:gr?'SABREN':'reference',centers:{[C]:center(G[C]||G[A]||G[R],[-43.66237,-22.93754]),[A]:center(G[A]||G[R],[-43.6602,-22.9190]),[R]:center(G[R],[-43.654277,-22.926186])}};
}catch(e){console.error('territory v174',e)}})();