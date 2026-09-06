/* Radar Seguro RJ PRO v164 — mosaico territorial de referência de Santa Cruz.
   Polígonos amplos, irregulares e sem sobreposição entre si.
   São áreas territoriais de referência do Radar, não limites administrativos oficiais. */
(()=>{
'use strict';
if(window.__radarSantaCruzTerritoriesV164)return;
window.__radarSantaCruzTerritoriesV164=true;
const P={
"Morro da Caixa D'Água (Santa Cruz)":[[-43.675,-22.909],[-43.668,-22.908],[-43.661,-22.912],[-43.662,-22.918],[-43.668,-22.920],[-43.674,-22.917]],
"Cesarão (Santa Cruz)":[[-43.661,-22.912],[-43.654,-22.909],[-43.647,-22.911],[-43.644,-22.917],[-43.647,-22.922],[-43.655,-22.923],[-43.662,-22.918]],
"Coqueiral (Santa Cruz)":[[-43.644,-22.917],[-43.637,-22.914],[-43.630,-22.917],[-43.628,-22.924],[-43.633,-22.929],[-43.640,-22.928],[-43.647,-22.922]],
"Nova Santa Cruz (Santa Cruz)":[[-43.668,-22.920],[-43.662,-22.918],[-43.655,-22.923],[-43.657,-22.927],[-43.664,-22.928],[-43.670,-22.925]],
"Rodo (Santa Cruz)":[[-43.655,-22.923],[-43.647,-22.922],[-43.643,-22.927],[-43.645,-22.933],[-43.652,-22.936],[-43.657,-22.932],[-43.657,-22.927]],
"Vila Paciência (Santa Cruz)":[[-43.643,-22.927],[-43.640,-22.928],[-43.633,-22.929],[-43.635,-22.935],[-43.641,-22.938],[-43.645,-22.933]],
"Comunidade de Antares (Santa Cruz)":[[-43.674,-22.917],[-43.668,-22.920],[-43.670,-22.925],[-43.664,-22.928],[-43.657,-22.932],[-43.662,-22.936],[-43.671,-22.935],[-43.678,-22.930],[-43.678,-22.923]],
"Jardim Mangaratiba (Santa Cruz)":[[-43.684,-22.922],[-43.678,-22.923],[-43.678,-22.930],[-43.671,-22.935],[-43.678,-22.9375],[-43.684,-22.934]],
"Urucânia (Santa Cruz)":[[-43.681,-22.9385],[-43.674,-22.938],[-43.669,-22.941],[-43.670,-22.947],[-43.677,-22.949],[-43.683,-22.945]],
"Areia Branca (Santa Cruz)":[[-43.669,-22.941],[-43.662,-22.939],[-43.657,-22.943],[-43.658,-22.949],[-43.664,-22.952],[-43.670,-22.947]],
"Urucânia Velha (Santa Cruz)":[[-43.662,-22.936],[-43.657,-22.932],[-43.652,-22.936],[-43.650,-22.941],[-43.657,-22.943],[-43.662,-22.939]],
"Comunidade do Aço (Santa Cruz)":[[-43.657,-22.943],[-43.650,-22.941],[-43.644,-22.944],[-43.645,-22.950],[-43.652,-22.954],[-43.658,-22.949]],
"Rollas (Santa Cruz)":[[-43.645,-22.933],[-43.641,-22.938],[-43.636,-22.938],[-43.632,-22.942],[-43.635,-22.947],[-43.641,-22.947],[-43.644,-22.944],[-43.650,-22.941],[-43.652,-22.936]],
"Três Pontes (Santa Cruz)":[[-43.644,-22.944],[-43.641,-22.947],[-43.635,-22.947],[-43.632,-22.951],[-43.636,-22.956],[-43.643,-22.956],[-43.645,-22.950]],
"Conjunto Habitacional da Aeronáutica (Santa Cruz)":[[-43.636,-22.938],[-43.629,-22.937],[-43.624,-22.941],[-43.625,-22.947],[-43.632,-22.951],[-43.635,-22.947],[-43.632,-22.942]],
"João XXIII (Santa Cruz)":[[-43.632,-22.951],[-43.625,-22.947],[-43.620,-22.950],[-43.621,-22.956],[-43.628,-22.959],[-43.636,-22.956]],
"Areia Branca Extensão (Santa Cruz)":[[-43.652,-22.954],[-43.645,-22.950],[-43.643,-22.956],[-43.647,-22.960],[-43.653,-22.959]],
"Nova Cascadura (Santa Cruz)":[[-43.643,-22.956],[-43.636,-22.956],[-43.628,-22.959],[-43.630,-22.965],[-43.638,-22.967],[-43.647,-22.960]],
"Vila Aliança (Santa Cruz)":[[-43.653,-22.959],[-43.647,-22.960],[-43.643,-22.965],[-43.648,-22.969],[-43.654,-22.966]],
"Mangue Seco (Santa Cruz)":[[-43.654,-22.966],[-43.648,-22.969],[-43.650,-22.973],[-43.657,-22.974],[-43.660,-22.969]]
};
const COLORS={
"Morro da Caixa D'Água (Santa Cruz)":"#2563eb","Cesarão (Santa Cruz)":"#dc2626","Coqueiral (Santa Cruz)":"#2563eb","Nova Santa Cruz (Santa Cruz)":"#2563eb","Rodo (Santa Cruz)":"#f28c18","Vila Paciência (Santa Cruz)":"#16a34a","Comunidade de Antares (Santa Cruz)":"#dc2626","Jardim Mangaratiba (Santa Cruz)":"#2563eb","Urucânia (Santa Cruz)":"#7c3aed","Areia Branca (Santa Cruz)":"#eab308","Urucânia Velha (Santa Cruz)":"#2563eb","Comunidade do Aço (Santa Cruz)":"#0891b2","Rollas (Santa Cruz)":"#16a34a","Três Pontes (Santa Cruz)":"#7c3aed","Conjunto Habitacional da Aeronáutica (Santa Cruz)":"#2563eb","João XXIII (Santa Cruz)":"#eab308","Areia Branca Extensão (Santa Cruz)":"#64748b","Nova Cascadura (Santa Cruz)":"#e11d48","Vila Aliança (Santa Cruz)":"#64748b","Mangue Seco (Santa Cruz)":"#2563eb"};
const PRETTY={"Morro da Caixa D'Água (Santa Cruz)":"MORRO DA CAIXA D'ÁGUA","Cesarão (Santa Cruz)":"CESARÃO","Coqueiral (Santa Cruz)":"COQUEIRAL","Nova Santa Cruz (Santa Cruz)":"NOVA SANTA CRUZ","Rodo (Santa Cruz)":"RODO","Vila Paciência (Santa Cruz)":"VILA PACIÊNCIA","Comunidade de Antares (Santa Cruz)":"ANTARES","Jardim Mangaratiba (Santa Cruz)":"JARDIM MANGARATIBA","Urucânia (Santa Cruz)":"URUCÂNIA","Areia Branca (Santa Cruz)":"AREIA BRANCA","Urucânia Velha (Santa Cruz)":"URUCÂNIA VELHA","Comunidade do Aço (Santa Cruz)":"AÇO","Rollas (Santa Cruz)":"ROLLAS","Três Pontes (Santa Cruz)":"TRÊS PONTES","Conjunto Habitacional da Aeronáutica (Santa Cruz)":"CONJ. AERONÁUTICA","João XXIII (Santa Cruz)":"JOÃO XXIII","Areia Branca Extensão (Santa Cruz)":"AREIA BRANCA EXT.","Nova Cascadura (Santa Cruz)":"NOVA CASCADURA","Vila Aliança (Santa Cruz)":"VILA ALIANÇA","Mangue Seco (Santa Cruz)":"MANGUE SECO"};
function poly(pts){const q=pts.map(v=>[+v[0],+v[1]]);const a=q[0],b=q[q.length-1];if(a[0]!==b[0]||a[1]!==b[1])q.push([...a]);return {type:'Polygon',coordinates:[q]};}
function centroid(pts){let x=0,y=0;pts.forEach(p=>{x+=p[0];y+=p[1]});return [x/pts.length,y/pts.length];}
try{
 if(!window.RADAR_COMMUNITY_GEOMETRIES)window.RADAR_COMMUNITY_GEOMETRIES={version:164,description:'Territórios de referência do Radar',geometries:{}};
 if(!window.RADAR_COMMUNITY_GEOMETRIES.geometries)window.RADAR_COMMUNITY_GEOMETRIES.geometries={};
 const G=window.RADAR_COMMUNITY_GEOMETRIES.geometries;
 Object.entries(P).forEach(([name,pts])=>G[name]=poly(pts));
 if(typeof rawAreas!=='undefined'&&Array.isArray(rawAreas))Object.entries(P).forEach(([name,pts])=>{const c=centroid(pts);let a=rawAreas.find(x=>x.name===name);if(!a){a={name,c,r:.45};rawAreas.push(a)}a.c=c;a.r=.45;a.displayColor=COLORS[name];a.territorial_note='Área territorial de referência do Radar v164; não é limite administrativo oficial.';});
 window.RADAR_COMMUNITY_GEOMETRIES.version=164;
 window.RadarSantaCruzTerritoriesV164={version:164,count:Object.keys(P).length,colors:COLORS,pretty:PRETTY};
}catch(e){console.error('Falha territórios Santa Cruz v164',e)}
})();