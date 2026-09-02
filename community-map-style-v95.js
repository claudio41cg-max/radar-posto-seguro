/* Radar Seguro RJ PRO v95 — estilo cartográfico uniforme para todas as comunidades */
(()=>{
'use strict';
if(window.__radarCommunityMapStyleV95)return;window.__radarCommunityMapStyleV95=true;
const OUT='community-cartographic-outline-v95',FILL='community-cartographic-fill-v95';
function apply(map){
 try{
  if(!map||!map.getSource('communities'))return false;
  /* Esconde os dois rótulos grandes/duplicados; preserva o rótulo principal do app. */
  ['community-label-v94','community-label-natural-v94','barbante-label-v94','community-big-label','community-area-label'].forEach(id=>{try{if(map.getLayer(id))map.setLayoutProperty(id,'visibility','none')}catch(e){}});
  if(map.getLayer('community-fill')){map.setPaintProperty('community-fill','fill-color','#60798a');map.setPaintProperty('community-fill','fill-opacity',.12)}
  if(!map.getLayer(FILL))map.addLayer({id:FILL,type:'fill',source:'communities',paint:{'fill-color':'#58788d','fill-opacity':.18}},map.getLayer('community-outline')?'community-outline':undefined);
  if(map.getLayer('community-outline')){map.setPaintProperty('community-outline','line-color','#f2f8fb');map.setPaintProperty('community-outline','line-width',1.55);map.setPaintProperty('community-outline','line-opacity',.94)}
  if(!map.getLayer(OUT))map.addLayer({id:OUT,type:'line',source:'communities',layout:{'line-join':'round','line-cap':'round'},paint:{'line-color':'#f7fbfd','line-width':['interpolate',['linear'],['zoom'],9,1.05,12,1.45,15,1.8,18,2.1],'line-opacity':.96,'line-blur':.12}});
  /* Nome principal: branco, discreto, desaparece ao afastar para não poluir. */
  if(map.getLayer('community-label')){
   map.setLayoutProperty('community-label','text-size',['interpolate',['linear'],['zoom'],10,0,11,10,13,12,16,14]);
   map.setPaintProperty('community-label','text-color','#ffffff');
   map.setPaintProperty('community-label','text-halo-color','#07131f');
   map.setPaintProperty('community-label','text-halo-width',1.4);
   map.setPaintProperty('community-label','text-opacity',['interpolate',['linear'],['zoom'],10,0,10.8,0,11.4,1]);
  }
  return true;
 }catch(e){console.warn('Estilo cartográfico v95 indisponível',e);return false}
}
function install(){const map=window.RadarApp?.map;if(!map?.on)return false;if(map.__communityStyleV95)return true;map.__communityStyleV95=true;apply(map);map.on('style.load',()=>setTimeout(()=>apply(map),20));return true}
let tries=0,t=setInterval(()=>{if(install()||++tries>120)clearInterval(t)},150);window.addEventListener('load',install,{once:true});
window.RadarCommunityMapStyleV95={version:'95-all-communities-cartographic',apply:()=>apply(window.RadarApp?.map)};
})();