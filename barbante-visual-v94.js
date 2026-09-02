/* v94: prototipo visual somente Barbante; geometria oficial continua intacta */
(()=>{
  'use strict';
  if(window.__radarBarbanteV94)return; window.__radarBarbanteV94=true;
  const NAME='Barbante (Inhoaíba)', SRC='barbante-visual-v94', FILL='barbante-fill-v94', LINE='barbante-line-v94', LABEL='barbante-label-v94';
  function smoothRing(r){
    if(!Array.isArray(r)||r.length<5)return r;
    let pts=r.slice(0,-1), out=[];
    // Chaikin leve: arredonda quinas visuais sem substituir a geometria oficial usada pelo toque/dados.
    for(let i=0;i<pts.length;i++){
      const a=pts[i],b=pts[(i+1)%pts.length];
      out.push([a[0]*.78+b[0]*.22,a[1]*.78+b[1]*.22]);
      out.push([a[0]*.22+b[0]*.78,a[1]*.22+b[1]*.78]);
    }
    out.push(out[0]); return out;
  }
  function smoothGeom(g){
    if(!g)return null;
    if(g.type==='Polygon')return {type:'Polygon',coordinates:g.coordinates.map(smoothRing)};
    if(g.type==='MultiPolygon')return {type:'MultiPolygon',coordinates:g.coordinates.map(p=>p.map(smoothRing))};
    return g;
  }
  function install(){
    const map=window.RadarApp?.map,g=window.RADAR_COMMUNITY_GEOMETRIES?.[NAME];
    if(!map?.addSource||!g)return false;
    try{
      const geo={type:'FeatureCollection',features:[{type:'Feature',properties:{name:NAME},geometry:smoothGeom(g)}]};
      if(map.getSource(SRC))map.getSource(SRC).setData(geo);else map.addSource(SRC,{type:'geojson',data:geo});
      // Esconde só Barbante das camadas gerais para não desenhar duas bordas.
      for(const id of ['community-fill','community-outline'])if(map.getLayer(id))try{map.setFilter(id,['!=',['get','name'],NAME])}catch(e){}
      const before=map.getLayer('community-label')?'community-label':undefined;
      if(!map.getLayer(FILL))map.addLayer({id:FILL,type:'fill',source:SRC,paint:{'fill-color':'#6f8796','fill-opacity':.24}},before);
      if(!map.getLayer(LINE))map.addLayer({id:LINE,type:'line',source:SRC,paint:{'line-color':'#f2f7fa','line-width':1.8,'line-opacity':.96,'line-blur':.15}},before);
      if(!map.getLayer(LABEL))map.addLayer({id:LABEL,type:'symbol',source:SRC,layout:{'text-field':'BARBANTE','text-size':14,'text-font':['Noto Sans Bold'],'text-allow-overlap':true},paint:{'text-color':'#ffffff','text-halo-color':'#07131f','text-halo-width':2}},before);
      return true;
    }catch(e){console.warn('Barbante v94',e);return false}
  }
  let n=0,t=setInterval(()=>{if(install()||++n>100)clearInterval(t)},180);
  window.addEventListener('load',install,{once:true});
})();
