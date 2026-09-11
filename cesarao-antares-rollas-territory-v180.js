/* Radar Seguro RJ PRO v180 — Cesarão + Antares preservados; Rollas com contorno territorial mais geográfico. */
(()=>{'use strict';if(window.__radarTerritoryV180)return;window.__radarTerritoryV180=true;
const C='Cesarão (Santa Cruz)',A='Comunidade de Antares (Santa Cruz)',R='Rollas (Santa Cruz)';
/* Rollas: território de referência com aparência de bairro/comunidade. Mantém a base aprovada da v176, mas troca o contorno arredondado por limites mais cartográficos, com lados e quinas suaves, sem copiar recortes estreitos rua-a-rua. Não é limite administrativo oficial. */
const ROLLAS_REFERENCE=[
[-43.6594,-22.9227],
[-43.6578,-22.9224],
[-43.6567,-22.9228],
[-43.6565,-22.9236],
[-43.6557,-22.9236],
[-43.6556,-22.9245],
[-43.6549,-22.9245],
[-43.6548,-22.9256],
[-43.6542,-22.9257],
[-43.6543,-22.9265],
[-43.6548,-22.9267],
[-43.6547,-22.9275],
[-43.6552,-22.9277],
[-43.6550,-22.9286],
[-43.6557,-22.9290],
[-43.6564,-22.9295],
[-43.6574,-22.9298],
[-43.6582,-22.9293],
[-43.6591,-22.9289],
[-43.6601,-22.9286],
[-43.6611,-22.9281],
[-43.6614,-22.9273],
[-43.6612,-22.9265],
[-43.6616,-22.9258],
[-43.6612,-22.9250],
[-43.6605,-22.9244],
[-43.6606,-22.9236],
[-43.6594,-22.9227]
];
const poly=p=>({type:'Polygon',coordinates:[p]});
function center(g,fb){try{const p=[];const w=x=>{if(!Array.isArray(x))return;if(typeof x[0]==='number'&&typeof x[1]==='number'){p.push(x);return}x.forEach(w)};w(g.coordinates);return p.length?[p.reduce((s,x)=>s+x[0],0)/p.length,p.reduce((s,x)=>s+x[1],0)/p.length]:fb}catch(_){return fb}}
try{
 const gc=window.__CESARAO_OFFICIAL_GEOJSON?.geometry||null;
 const ga=window.__ANTARES_OFFICIAL_GEOJSON?.geometry||null;
 const gr=poly(ROLLAS_REFERENCE);
 if(!window.RADAR_COMMUNITY_GEOMETRIES)window.RADAR_COMMUNITY_GEOMETRIES={version:180,geometries:{}};
 const G=window.RADAR_COMMUNITY_GEOMETRIES.geometries||(window.RADAR_COMMUNITY_GEOMETRIES.geometries={});
 Object.keys(G).forEach(k=>{if(/Santa Cruz/i.test(k)&&k!==C&&k!==A&&k!==R)delete G[k]});
 if(gc)G[C]=gc;
 if(ga)G[A]=ga;
 G[R]=gr;
 if(typeof rawAreas!=='undefined'&&Array.isArray(rawAreas)){
  for(let i=rawAreas.length-1;i>=0;i--){const n=String(rawAreas[i]?.name||'');if(/Santa Cruz/i.test(n)&&n!==C&&n!==A&&n!==R)rawAreas.splice(i,1)}
  const rows=[
   [C,G[C],'#dc2626',[-43.66237,-22.93754],'Polígono SABREN/Prefeitura quando disponível.'],
   [A,G[A],'#f97316',[-43.6602,-22.9190],'Polígono de Conjunto Habitacional SABREN/Prefeitura, preservado da versão aprovada.'],
   [R,G[R],'#f59e0b',[-43.6577,-22.9262],'Território de referência do Radar com contorno cartográfico mais natural; não é limite administrativo oficial.']
  ];
  rows.forEach(([n,g,color,fb,note])=>{if(!g)return;let a=rawAreas.find(x=>x.name===n);if(!a){a={name:n};rawAreas.push(a)}a.c=center(g,fb);a.r=.48;a.displayColor=color;a.territorial_note=note});
 }
 window.RADAR_COMMUNITY_GEOMETRIES.version=180;
 window.RadarTerritoryV180={rollasSource:'territorio-referencia-geografico',centers:{[C]:center(G[C]||G[A]||G[R],[-43.66237,-22.93754]),[A]:center(G[A]||G[R],[-43.6602,-22.9190]),[R]:center(G[R],[-43.6577,-22.9262])}};
}catch(e){console.error('territory v180',e)}})();