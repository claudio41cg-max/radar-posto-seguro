/* Radar Seguro RJ PRO v176 — Cesarão + Antares preservados; Rollas como território de referência contínuo e suavizado. */
(()=>{'use strict';if(window.__radarTerritoryV176)return;window.__radarTerritoryV176=true;
const C='Cesarão (Santa Cruz)',A='Comunidade de Antares (Santa Cruz)',R='Rollas (Santa Cruz)';
/* Rollas: base territorial contínua. Não copia recortes rua-a-rua do cadastro. Usa a posição pública/cadastral e a referência visual do WikiFavelas para representar a área reconhecida de forma útil no Radar. Não é limite administrativo oficial. */
const ROLLAS_REFERENCE=[
[-43.6611,-22.9231],[-43.6596,-22.9225],[-43.6577,-22.9224],[-43.6559,-22.9229],
[-43.6545,-22.9239],[-43.6535,-22.9252],[-43.6532,-22.9267],[-43.6537,-22.9281],
[-43.6548,-22.9292],[-43.6564,-22.9298],[-43.6581,-22.9297],[-43.6596,-22.9290],
[-43.6607,-22.9279],[-43.6614,-22.9264],[-43.6615,-22.9248],[-43.6611,-22.9231]
];
const poly=p=>({type:'Polygon',coordinates:[p]});
function center(g,fb){try{const p=[];const w=x=>{if(!Array.isArray(x))return;if(typeof x[0]==='number'&&typeof x[1]==='number'){p.push(x);return}x.forEach(w)};w(g.coordinates);return p.length?[p.reduce((s,x)=>s+x[0],0)/p.length,p.reduce((s,x)=>s+x[1],0)/p.length]:fb}catch(_){return fb}}
try{
 const gc=window.__CESARAO_OFFICIAL_GEOJSON?.geometry||null;
 const ga=window.__ANTARES_OFFICIAL_GEOJSON?.geometry||null;
 const gr=poly(ROLLAS_REFERENCE);
 if(!window.RADAR_COMMUNITY_GEOMETRIES)window.RADAR_COMMUNITY_GEOMETRIES={version:176,geometries:{}};
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
   [R,G[R],'#f59e0b',[-43.6573,-22.9261],'Território de referência contínuo e suavizado, baseado em fontes públicas e referência visual; não é limite administrativo oficial.']
  ];
  rows.forEach(([n,g,color,fb,note])=>{if(!g)return;let a=rawAreas.find(x=>x.name===n);if(!a){a={name:n};rawAreas.push(a)}a.c=center(g,fb);a.r=.48;a.displayColor=color;a.territorial_note=note});
 }
 window.RADAR_COMMUNITY_GEOMETRIES.version=176;
 window.RadarTerritoryV176={rollasSource:'territorio-referencia',centers:{[C]:center(G[C]||G[A]||G[R],[-43.66237,-22.93754]),[A]:center(G[A]||G[R],[-43.6602,-22.9190]),[R]:center(G[R],[-43.6573,-22.9261])}};
}catch(e){console.error('territory v176',e)}})();