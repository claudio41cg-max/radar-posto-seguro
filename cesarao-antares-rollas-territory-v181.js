/* Radar Seguro RJ PRO v181 — Cesarão + Antares preservados; Rollas alongado para sul com contorno cartográfico. */
(()=>{'use strict';if(window.__radarTerritoryV181)return;window.__radarTerritoryV181=true;
const C='Cesarão (Santa Cruz)',A='Comunidade de Antares (Santa Cruz)',R='Rollas (Santa Cruz)';
/* Rollas: território de referência do Radar. Usa o Data.Rio apenas como referência de localização, sem copiar o recorte cadastral estreito. O desenho foi alongado um pouco para sul e modelado como um pequeno bairro, com quinas suaves e continuidade territorial. Não é limite administrativo oficial. */
const ROLLAS_REFERENCE=[
[-43.6595,-22.9227],
[-43.6583,-22.9224],
[-43.6572,-22.9227],
[-43.6569,-22.9234],
[-43.6562,-22.9234],
[-43.6561,-22.9240],
[-43.6555,-22.9240],
[-43.6554,-22.9249],
[-43.6548,-22.9250],
[-43.6547,-22.9258],
[-43.6542,-22.9259],
[-43.6543,-22.9267],
[-43.6548,-22.9269],
[-43.6547,-22.9277],
[-43.6551,-22.9279],
[-43.6552,-22.9287],
[-43.6555,-22.9294],
[-43.6558,-22.9300],
[-43.6563,-22.9306],
[-43.6570,-22.9310],
[-43.6577,-22.9312],
[-43.6583,-22.9308],
[-43.6589,-22.9303],
[-43.6597,-22.9299],
[-43.6604,-22.9295],
[-43.6611,-22.9290],
[-43.6616,-22.9284],
[-43.6618,-22.9277],
[-43.6616,-22.9270],
[-43.6618,-22.9263],
[-43.6614,-22.9255],
[-43.6610,-22.9249],
[-43.6606,-22.9243],
[-43.6607,-22.9236],
[-43.6595,-22.9227]
];
const poly=p=>({type:'Polygon',coordinates:[p]});
function center(g,fb){try{const p=[];const w=x=>{if(!Array.isArray(x))return;if(typeof x[0]==='number'&&typeof x[1]==='number'){p.push(x);return}x.forEach(w)};w(g.coordinates);return p.length?[p.reduce((s,x)=>s+x[0],0)/p.length,p.reduce((s,x)=>s+x[1],0)/p.length]:fb}catch(_){return fb}}
try{
 const gc=window.__CESARAO_OFFICIAL_GEOJSON?.geometry||null;
 const ga=window.__ANTARES_OFFICIAL_GEOJSON?.geometry||null;
 const gr=poly(ROLLAS_REFERENCE);
 if(!window.RADAR_COMMUNITY_GEOMETRIES)window.RADAR_COMMUNITY_GEOMETRIES={version:181,geometries:{}};
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
   [R,G[R],'#f59e0b',[-43.6579,-22.9270],'Território de referência do Radar: contorno cartográfico contínuo e alongado para sul; Data.Rio usado apenas como referência de localização, não como limite copiado.']
  ];
  rows.forEach(([n,g,color,fb,note])=>{if(!g)return;let a=rawAreas.find(x=>x.name===n);if(!a){a={name:n};rawAreas.push(a)}a.c=center(g,fb);a.r=.52;a.displayColor=color;a.territorial_note=note});
 }
 window.RADAR_COMMUNITY_GEOMETRIES.version=181;
 window.RadarTerritoryV181={rollasSource:'territorio-referencia-geografico-ajustado',centers:{[C]:center(G[C]||G[A]||G[R],[-43.66237,-22.93754]),[A]:center(G[A]||G[R],[-43.6602,-22.9190]),[R]:center(G[R],[-43.6579,-22.9270])}};
}catch(e){console.error('territory v181',e)}})();