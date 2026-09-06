/* Radar Seguro RJ PRO v172 — Antares restrito ao trecho Rua Cybber Porto de Mendonça / Rua G, sem atravessar ferrovia nem Av. Antares. */
(()=>{'use strict';if(window.__radarTerritoryV172)return;window.__radarTerritoryV172=true;
const C='Cesarão (Santa Cruz)',A='Comunidade de Antares (Santa Cruz)';
/* Antares v172: referência territorial deliberadamente mais conservadora. Base principal: setor IBGE 0603, que identifica Conjunto Antares (Rua Cybber Porto de Mendonça) e descreve o perímetro seguindo a Rua Cybber Porto de Mendonça até a Rua G e retornando pelos fundos das unidades. O desenho abaixo é uma aproximação cartográfica estreita desse trecho, mantida do lado interno das barreiras locais informadas pelo usuário (linha férrea e Avenida Antares). Não é limite administrativo oficial. */
const ANTARES_REF=[
[-43.65875,-22.91855],
[-43.65955,-22.91875],
[-43.66045,-22.91905],
[-43.66135,-22.91945],
[-43.66225,-22.91990],
[-43.66315,-22.92035],
[-43.66385,-22.92080],
[-43.66405,-22.92115],
[-43.66365,-22.92155],
[-43.66285,-22.92130],
[-43.66195,-22.92090],
[-43.66105,-22.92050],
[-43.66015,-22.92010],
[-43.65930,-22.91970],
[-43.65855,-22.91930],
[-43.65820,-22.91895],
[-43.65875,-22.91855]
];
const poly=p=>({type:'Polygon',coordinates:[p]});
function center(g,fb){try{const p=[];const w=x=>{if(!Array.isArray(x))return;if(typeof x[0]==='number'&&typeof x[1]==='number'){p.push(x);return}x.forEach(w)};w(g.coordinates);return p.length?[p.reduce((s,x)=>s+x[0],0)/p.length,p.reduce((s,x)=>s+x[1],0)/p.length]:fb}catch(_){return fb}}
try{
 const gc=window.__CESARAO_OFFICIAL_GEOJSON?.geometry||null;
 if(!window.RADAR_COMMUNITY_GEOMETRIES)window.RADAR_COMMUNITY_GEOMETRIES={version:172,geometries:{}};
 const G=window.RADAR_COMMUNITY_GEOMETRIES.geometries||(window.RADAR_COMMUNITY_GEOMETRIES.geometries={});
 Object.keys(G).forEach(k=>{if(/Santa Cruz/i.test(k)&&k!==C&&k!==A)delete G[k]});
 if(gc)G[C]=gc;G[A]=poly(ANTARES_REF);
 if(typeof rawAreas!=='undefined'&&Array.isArray(rawAreas)){
  for(let i=rawAreas.length-1;i>=0;i--){const n=String(rawAreas[i]?.name||'');if(/Santa Cruz/i.test(n)&&n!==C&&n!==A)rawAreas.splice(i,1)};
  [[C,G[C],'#dc2626',[-43.66237,-22.93754],'Polígono cartográfico SABREN/Prefeitura quando disponível.'],[A,G[A],'#f97316',[-43.6610,-22.9200],'Área territorial de referência conservadora do Radar, baseada no setor IBGE do Conjunto Antares na Rua Cybber Porto de Mendonça até a Rua G. Mantida sem atravessar a linha férrea e sem avançar além da Avenida Antares no sentido do morro.']].forEach(([n,g,color,fb,note])=>{if(!g)return;let a=rawAreas.find(x=>x.name===n);if(!a){a={name:n};rawAreas.push(a)}a.c=center(g,fb);a.r=.45;a.displayColor=color;a.territorial_note=note});
 }
 window.RADAR_COMMUNITY_GEOMETRIES.version=172;
 window.RadarTerritoryV172={centers:{[C]:center(G[C]||G[A],[-43.66237,-22.93754]),[A]:center(G[A],[-43.6610,-22.9200])}};
}catch(e){console.error('territory v172',e)}})();