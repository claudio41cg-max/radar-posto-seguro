/* Radar Seguro RJ PRO v162 — territórios de referência de Santa Cruz.
   Estes contornos representam áreas territoriais amplas de referência do Radar,
   não limites administrativos oficiais. A ideia é evitar círculos pequenos e
   representar o território conhecido localmente como um todo. */
(()=>{
'use strict';
if(window.__radarSantaCruzTerritoriesV162)return;
window.__radarSantaCruzTerritoriesV162=true;

const T={
  'Cesarão (Santa Cruz)': [[-43.6692,-22.9308],[-43.6650,-22.9268],[-43.6590,-22.9254],[-43.6529,-22.9270],[-43.6483,-22.9307],[-43.6469,-22.9351],[-43.6485,-22.9400],[-43.6530,-22.9437],[-43.6591,-22.9453],[-43.6644,-22.9432],[-43.6681,-22.9393],[-43.6695,-22.9349]],
  'Rodo (Santa Cruz)': [[-43.6638,-22.9253],[-43.6591,-22.9227],[-43.6535,-22.9229],[-43.6487,-22.9258],[-43.6489,-22.9305],[-43.6528,-22.9337],[-43.6580,-22.9341],[-43.6628,-22.9310]],
  'Coqueiral (Santa Cruz)': [[-43.6491,-22.9100],[-43.6428,-22.9088],[-43.6371,-22.9112],[-43.6356,-22.9164],[-43.6384,-22.9210],[-43.6445,-22.9223],[-43.6500,-22.9190]],
  'Vila Paciência (Santa Cruz)': [[-43.6505,-22.9208],[-43.6450,-22.9196],[-43.6406,-22.9221],[-43.6391,-22.9260],[-43.6422,-22.9296],[-43.6474,-22.9304],[-43.6513,-22.9270]],
  'Comunidade de Antares (Santa Cruz)': [[-43.6699,-22.9194],[-43.6643,-22.9165],[-43.6574,-22.9168],[-43.6517,-22.9198],[-43.6512,-22.9246],[-43.6555,-22.9280],[-43.6624,-22.9287],[-43.6680,-22.9253]],
  'Jardim Mangaratiba (Santa Cruz)': [[-43.6816,-22.9197],[-43.6760,-22.9164],[-43.6708,-22.9172],[-43.6677,-22.9210],[-43.6696,-22.9251],[-43.6748,-22.9271],[-43.6804,-22.9248]],
  'Urucânia (Santa Cruz)': [[-43.6777,-22.9306],[-43.6726,-22.9280],[-43.6672,-22.9290],[-43.6644,-22.9332],[-43.6666,-22.9374],[-43.6717,-22.9392],[-43.6768,-22.9366]],
  'Areia Branca (Santa Cruz)': [[-43.6668,-22.9349],[-43.6618,-22.9327],[-43.6568,-22.9341],[-43.6549,-22.9385],[-43.6575,-22.9425],[-43.6625,-22.9435],[-43.6666,-22.9404]],
  'Urucânia Velha (Santa Cruz)': [[-43.6576,-22.9326],[-43.6525,-22.9310],[-43.6482,-22.9334],[-43.6480,-22.9375],[-43.6522,-22.9397],[-43.6568,-22.9375]],
  'Comunidade do Aço (Santa Cruz)': [[-43.6540,-22.9372],[-43.6487,-22.9355],[-43.6438,-22.9379],[-43.6421,-22.9427],[-43.6454,-22.9461],[-43.6507,-22.9463],[-43.6545,-22.9427]],
  'Rollas (Santa Cruz)': [[-43.6467,-22.9334],[-43.6415,-22.9320],[-43.6372,-22.9344],[-43.6361,-22.9388],[-43.6390,-22.9421],[-43.6437,-22.9427],[-43.6470,-22.9393]],
  'Três Pontes (Santa Cruz)': [[-43.6438,-22.9389],[-43.6388,-22.9375],[-43.6342,-22.9399],[-43.6332,-22.9443],[-43.6364,-22.9476],[-43.6412,-22.9477],[-43.6444,-22.9442]],
  'João XXIII (Santa Cruz)': [[-43.6353,-22.9405],[-43.6301,-22.9393],[-43.6257,-22.9417],[-43.6250,-22.9459],[-43.6284,-22.9488],[-43.6331,-22.9485],[-43.6360,-22.9452]],
  'Nova Cascadura (Santa Cruz)': [[-43.6423,-22.9466],[-43.6373,-22.9449],[-43.6320,-22.9464],[-43.6298,-22.9507],[-43.6326,-22.9547],[-43.6378,-22.9558],[-43.6424,-22.9524]],
  'Conjunto Habitacional da Aeronáutica (Santa Cruz)': [[-43.6541,-22.9462],[-43.6495,-22.9448],[-43.6455,-22.9470],[-43.6449,-22.9510],[-43.6481,-22.9536],[-43.6527,-22.9528],[-43.6552,-22.9492]],
  'Mangue Seco (Santa Cruz)': [[-43.6505,-22.9531],[-43.6465,-22.9518],[-43.6427,-22.9538],[-43.6423,-22.9573],[-43.6450,-22.9598],[-43.6490,-22.9590],[-43.6514,-22.9562]],
  'Nova Santa Cruz (Santa Cruz)': [[-43.6636,-22.9240],[-43.6594,-22.9226],[-43.6554,-22.9247],[-43.6553,-22.9281],[-43.6587,-22.9302],[-43.6627,-22.9282]],
  "Morro da Caixa D'Água (Santa Cruz)": [[-43.6684,-22.9112],[-43.6635,-22.9095],[-43.6590,-22.9119],[-43.6586,-22.9160],[-43.6618,-22.9185],[-43.6666,-22.9175],[-43.6692,-22.9142]],
  'Loteamento São Jorge (Santa Cruz)': [[-43.6610,-22.9285],[-43.6573,-22.9275],[-43.6544,-22.9293],[-43.6546,-22.9321],[-43.6576,-22.9337],[-43.6607,-22.9319]],
  'Areia Branca Extensão (Santa Cruz)': [[-43.6474,-22.9420],[-43.6439,-22.9409],[-43.6410,-22.9426],[-43.6411,-22.9455],[-43.6441,-22.9472],[-43.6470,-22.9453]],
  'Vila Aliança (Santa Cruz)': [[-43.6458,-22.9495],[-43.6424,-22.9484],[-43.6394,-22.9502],[-43.6396,-22.9531],[-43.6427,-22.9545],[-43.6455,-22.9526]]
};

const COLORS={
  'Cesarão (Santa Cruz)':'#d92d20','Rodo (Santa Cruz)':'#f28c18','Coqueiral (Santa Cruz)':'#2563eb','Vila Paciência (Santa Cruz)':'#16a34a',
  'Comunidade de Antares (Santa Cruz)':'#dc2626','Jardim Mangaratiba (Santa Cruz)':'#2563eb','Urucânia (Santa Cruz)':'#7c3aed','Areia Branca (Santa Cruz)':'#eab308',
  'Urucânia Velha (Santa Cruz)':'#2563eb','Comunidade do Aço (Santa Cruz)':'#0891b2','Rollas (Santa Cruz)':'#16a34a','Três Pontes (Santa Cruz)':'#7c3aed',
  'João XXIII (Santa Cruz)':'#eab308','Nova Cascadura (Santa Cruz)':'#e11d48','Conjunto Habitacional da Aeronáutica (Santa Cruz)':'#2563eb','Mangue Seco (Santa Cruz)':'#2563eb',
  'Nova Santa Cruz (Santa Cruz)':'#2563eb',"Morro da Caixa D'Água (Santa Cruz)":'#2563eb','Loteamento São Jorge (Santa Cruz)':'#64748b','Areia Branca Extensão (Santa Cruz)':'#64748b','Vila Aliança (Santa Cruz)':'#64748b'
};

function closePoly(points){const p=points.map(x=>[Number(x[0]),Number(x[1])]);const a=p[0],b=p[p.length-1];if(!b||a[0]!==b[0]||a[1]!==b[1])p.push([...a]);return {type:'Polygon',coordinates:[p]};}
function centroid(points){let x=0,y=0;points.forEach(p=>{x+=p[0];y+=p[1]});return [x/points.length,y/points.length];}

try{
  if(!window.RADAR_COMMUNITY_GEOMETRIES)window.RADAR_COMMUNITY_GEOMETRIES={version:162,description:'Territórios de referência do Radar',geometries:{}};
  if(!window.RADAR_COMMUNITY_GEOMETRIES.geometries)window.RADAR_COMMUNITY_GEOMETRIES.geometries={};
  const G=window.RADAR_COMMUNITY_GEOMETRIES.geometries;
  Object.entries(T).forEach(([name,pts])=>{G[name]=closePoly(pts);});
  window.RADAR_COMMUNITY_GEOMETRIES.version=162;
  window.RADAR_COMMUNITY_GEOMETRIES.description='v162: Santa Cruz por áreas territoriais amplas de referência do Radar; não são limites administrativos oficiais.';

  if(typeof rawAreas!=='undefined'&&Array.isArray(rawAreas)){
    Object.entries(T).forEach(([name,pts])=>{
      const c=centroid(pts);
      const found=rawAreas.find(a=>a.name===name);
      if(found){found.c=c;found.r=.6;found.territorial_note='Área territorial de referência do Radar v162; não é limite administrativo oficial.';found.displayColor=COLORS[name]||'#2563eb';}
      else rawAreas.push({name,c,r:.6,territorial_note:'Área territorial de referência do Radar v162; não é limite administrativo oficial.',displayColor:COLORS[name]||'#2563eb'});
    });
  }
  window.RadarSantaCruzTerritoriesV162={version:162,count:Object.keys(T).length,colors:COLORS,note:'territorial-reference'};
}catch(e){console.error('Falha ao preparar territórios Santa Cruz v162',e);}
})();