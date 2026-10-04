/* Radar Seguro RJ PRO — geometria de comunidades v156
   Extraído do index.html sem alterar a lógica de cálculo. */
(()=>{'use strict';

if(window.RadarCommunityGeometryV156)return;

const Utils=window.RADAR_MAP_UTILS_V101?.Utils;
const areas=(typeof rawAreas!=='undefined'&&Array.isArray(rawAreas))?rawAreas:[];

if(!Utils){
  throw new Error('RadarCommunityGeometryV156: Utils indisponível');
}

const officialCommunityGeometries=window.RADAR_COMMUNITY_GEOMETRIES?.geometries||{};



/*
  Primeira ampliação a partir das localidades citadas nas ocorrências do Fogo Cruzado.
  Limites oficiais SABREN 2022, Instituto Pereira Passos / Prefeitura do Rio.
*/
/* Geometrias consolidadas em community-geometries-preload.js. */


/*
  Segunda ampliação a partir das localidades citadas nas ocorrências do Fogo Cruzado.
  Limites oficiais SABREN 2022, Instituto Pereira Passos / Prefeitura do Rio.
*/
/* Geometrias consolidadas em community-geometries-preload.js. */

/*
  Correção de Aço, Nova Sepetiba e Vila Kennedy.
  Base oficial: SABREN - Conjuntos Habitacionais, Prefeitura do Rio.
  Comunidade do Aço corresponde ao Conjunto Vila Paciência, Rua São Gomário.
*/
/* Geometrias consolidadas em community-geometries-preload.js. */

const officialHousingCommunityNames=new Set([
  'Comunidade do Aço (Santa Cruz)',
  'Nova Sepetiba',
  'Vila Kennedy'
]);


/*
  Correção de Vila Aliança, Vila do Vintém e Batam.
  Partes relacionadas foram agrupadas em um único MultiPolygon.
  Base oficial SABREN 2022, Instituto Pereira Passos / Prefeitura do Rio.
*/
/* Geometrias consolidadas em community-geometries-preload.js. */

/*
  Vila Aliança: envoltória contínua criada a partir dos núcleos
  oficiais SABREN já cadastrados, evitando representá-la como
  apenas uma rua estreita.
*/
/*
  LIMITES OFICIAIS SABREN 2022 — Complexos do Chapadão e da Pedreira,
  Comunidade da Serrinha e Morro do Fubá. As partes oficiais de cada
  complexo são exibidas juntas, sem criar um círculo artificial.
*/

/* Limites oficiais SABREN 2022: Canal das Tachas (nome local Terreirão) e Vila Taboinha. */
/* Limites oficiais SABREN 2022 — Barra/Jacarepaguá:
   Complexo do Rio das Pedras (2 núcleos), Muzema e Gardênia Azul (3 núcleos). */
/*
  Limites oficiais SABREN 2022 — Complexo da Maré, Rocinha e Vidigal.
  Instituto Pereira Passos / Prefeitura do Rio. Geometrias generalizadas em cerca de 1,3 m.
*/
/* Zona Sul: limites derivados dos polígonos oficiais de FCU do Censo 2022/IBGE. */
/* Zona Sul: mais três limites derivados dos polígonos oficiais de FCU do Censo 2022/IBGE. */
/* Zona Sul: complexos preservados como polígonos reais, sem preencher os espaços entre as partes. */
const official2022CommunityNames=new Set([
  'Vidigal',
  'Complexo da Maré',
  'Rocinha',
  "Santa Marta",
  "Complexo Cantagalo–Pavão–Pavãozinho",
  "Complexo Babilônia–Chapéu Mangueira",
  "Tavares Bastos",
  "Morro Azul",
  "Pereira da Silva",
  "Complexo Cabritos–Tabajaras",
  "Complexo Guararapes–Cerro-Corá–Vila Cândido",
  "Vila Santo Amaro",
  'Complexo do Rio das Pedras',
  'Muzema',
  'Gardênia Azul',
  'Comunidade do Terreirão',
  'Comunidade Vila Taboinha',
'Complexo do Alemão','Complexo da Penha',
  'Cesarão (Santa Cruz)',
  'Comunidade do Rola (Santa Cruz)',
  'Comunidade de Antares (Santa Cruz)',
  'Pantanal (Santa Cruz)',
  'Comunidade Terra Nostra (Barros Filho)',
  'Comunidade Vila Catiri (Bangu)',
  'Comunidade Baixa do Sapateiro (Maré)',
  'Comunidade Vila Campinho (Cascadura)',
  'Comunidade da Covanca (Tanque)',
  'Comunidade do Tirol (Jacarepaguá)',
  'Vila Aliança (Bangu)',
  'Vila Vintém (Padre Miguel)',
  'Comunidade do Batam (Realengo)',
  'Complexo do Chapadão',
  'Complexo da Pedreira',
  'Comunidade da Serrinha (Madureira)',
  'Morro do Fubá (Cascadura)'
]);


/*
  DIMINUI 50 METROS DO RAIO.
*/
function riskRadius(area){

  return Math.max(
    .18,
    area.r-.05
  );

}

function pointInRing(point,ring){

  let inside=false;

  for(let i=0,j=ring.length-1;i<ring.length;j=i++){
    const xi=ring[i][0],yi=ring[i][1];
    const xj=ring[j][0],yj=ring[j][1];
    const crosses=
      ((yi>point[1])!==(yj>point[1])) &&
      (point[0]<(xj-xi)*(point[1]-yi)/((yj-yi)||1e-12)+xi);
    if(crosses) inside=!inside;
  }

  return inside;

}

function distanceToSegmentKm(point,a,b){

  const latScale=111.32;
  const lonScale=111.32*Math.cos(point[1]*Math.PI/180);
  const ax=(a[0]-point[0])*lonScale;
  const ay=(a[1]-point[1])*latScale;
  const bx=(b[0]-point[0])*lonScale;
  const by=(b[1]-point[1])*latScale;
  const dx=bx-ax;
  const dy=by-ay;
  const length2=dx*dx+dy*dy;
  const t=length2
    ? Math.max(0,Math.min(1,-(ax*dx+ay*dy)/length2))
    : 0;

  return Math.hypot(ax+t*dx,ay+t*dy);

}

function distanceToCommunityKm(point,area){

  const geometry=officialCommunityGeometries[area.name];

  if(!geometry)
    return Math.max(0,Utils.distanceKm(point,area.c)-riskRadius(area));

  const polygons=
    geometry.type==='MultiPolygon'
    ? geometry.coordinates
    : [geometry.coordinates];

  let minimum=Infinity;

  for(const polygon of polygons){
    const outer=polygon[0]||[];
    if(pointInRing(point,outer)) return 0;
    for(const ring of polygon){
      for(let i=1;i<ring.length;i++){
        minimum=Math.min(
          minimum,
          distanceToSegmentKm(point,ring[i-1],ring[i])
        );
      }
    }
  }

  return minimum;

}


function communitiesPolygonGeoJSON(occurrenceStatusByName={}){

  return {

    type:'FeatureCollection',

    features:
      areas.map(
        (a,index)=>{

          const officialGeometry=
            officialCommunityGeometries[
              a.name
            ];


          return {

            type:'Feature',

            properties:{
              index,
              name:a.name,
              officialBoundary:
                Boolean(officialGeometry),
              occurrenceStatus:
                occurrenceStatusByName[a.name] || 'normal',
              boundarySource:
                officialGeometry
                ?
                (
                  a.name==='Vila Aliança (Bangu)'
                  ? 'Área contínua de referência baseada nos núcleos SABREN 2022'
                  : officialHousingCommunityNames.has(a.name)
                  ? 'SABREN - Conjuntos Habitacionais, Prefeitura do Rio'
                  : official2022CommunityNames.has(a.name)
                    ? 'SABREN/SMH - Prefeitura do Rio (2022)'
                    : 'IPP/SMH - Prefeitura do Rio (2019)'
                )
                :
                'área aproximada'
            },

            geometry:
              officialGeometry ||
              {
                type:'Polygon',
                coordinates:[
                  Utils.makeCircle(
                    a.c[0],
                    a.c[1],
                    riskRadius(a)
                  )
                ]
              }

          };

        }
      )

  };

}


function communitiesPointGeoJSON(){

  return {

    type:'FeatureCollection',

    features:
      areas.map(
        (a,index)=>{

          const featured=
            a.name==='Carobinha (Campo Grande)' ||
            a.name==='Barbante (Inhoaíba)' ||
            a.name==='Comunidade Terra Nostra (Barros Filho)' ||
            a.name==='Comunidade Vila Catiri (Bangu)' ||
            a.name==='Comunidade Baixa do Sapateiro (Maré)' ||
            a.name==='Comunidade Vila Campinho (Cascadura)' ||
            a.name==='Comunidade da Covanca (Tanque)' ||
            a.name==='Comunidade do Tirol (Jacarepaguá)' ||
            a.name==='Cesarão (Santa Cruz)' ||
            a.name==='Comunidade do Rola (Santa Cruz)' ||
            a.name==='Comunidade de Antares (Santa Cruz)' ||
            a.name==='Pantanal (Santa Cruz)' ||
            a.name==='Comunidade do Aço (Santa Cruz)' ||
            a.name==='Nova Sepetiba' ||
            a.name==='Vila Kennedy' ||
            a.name==='Vila Aliança (Bangu)' ||
            a.name==='Vila Vintém (Padre Miguel)' ||
            a.name==='Comunidade do Batam (Realengo)' ||
            a.name==='Complexo do Chapadão' ||
            a.name==='Complexo da Pedreira' ||
            a.name==='Comunidade da Serrinha (Madureira)' ||
            a.name==='Morro do Fubá (Cascadura)';

          const labelCoordinates=
            a.name==='Carobinha (Campo Grande)'
            ? [-43.5351,-22.8592]
            : a.name==='Barbante (Inhoaíba)'
              ? [-43.5860,-22.9030]
              : a.c;

          const upperName=a.name.toUpperCase();

          return {

          type:'Feature',

          properties:{
            index,
            name:a.name,
            officialBoundary:
              Boolean(
                officialCommunityGeometries[
                  a.name
                ]
              ),
            featured,
            displayName:
              featured
              ? (
                  upperName.startsWith('COMUNIDADE ')
                  ? upperName
                  : 'COMUNIDADE '+upperName
                )
              : a.name
          },

          geometry:{
            type:'Point',
            coordinates:labelCoordinates
          }

        };

        }
      )

  };

}

function communityBridgesGeoJSON(){

  const geometry=
    officialCommunityGeometries['Carobinha (Campo Grande)'];

  const centers=(geometry.coordinates||[]).map(polygon=>{
    const ring=polygon[0]||[];
    const sum=ring.reduce((acc,p)=>[acc[0]+p[0],acc[1]+p[1]],[0,0]);
    return ring.length
      ? [sum[0]/ring.length,sum[1]/ring.length]
      : null;
  }).filter(Boolean);

  const features=[];

  centers.forEach((a,i)=>{
    centers.slice(i+1).forEach(b=>{
      if(Utils.distanceKm(a,b)<=.32){
        features.push({
          type:'Feature',
          properties:{name:'Carobinha (Campo Grande)'},
          geometry:{type:'LineString',coordinates:[a,b]}
        });
      }
    });
  });

  return {type:'FeatureCollection',features};

}

window.RadarCommunityGeometryV156=Object.freeze({
  officialCommunityGeometries,
  officialHousingCommunityNames,
  official2022CommunityNames,
  riskRadius,
  pointInRing,
  distanceToSegmentKm,
  distanceToCommunityKm,
  communitiesPolygonGeoJSON,
  communitiesPointGeoJSON,
  communityBridgesGeoJSON,
  version:'156'
});

})();