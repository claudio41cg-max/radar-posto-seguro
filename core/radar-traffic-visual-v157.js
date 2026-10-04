/* Radar Seguro RJ PRO — limpeza visual de trânsito v157
   Responsabilidade:
   - ocultar sobreposições antigas de trânsito;
   - neutralizar cores indevidas das vias base.
   Não altera ETA, roteamento ou dados de trânsito.
*/
(()=>{'use strict';

if(window.RadarTrafficVisualV157)return;

const getMap=()=>{
  try{
    const app=window.RadarApp;
    return app?.map?.getStyle?app.map:null;
  }catch(_){
    return null;
  }
};

function hideTrafficVisual(){
  const m=getMap();if(!m)return;
  try{
   const st=m.getStyle?.();if(!st?.layers)return;
   for(const l of st.layers){
    const id=String(l.id||'').toLowerCase();
    if(/route-main|route-outline|community|comunidade|fogo|radar(?!-overlay)|hazard|semaforo|traffic[-_ ]?light/.test(id))continue;
    let src='';try{src=JSON.stringify(st.sources?.[l.source]||{}).toLowerCase()}catch(e){}
    const trafficByName=/traffic|trafficflow|flowsegment|tomtom.*flow|tomtom.*traffic/.test(id+' '+src);
    let trafficByColor=false;
    if(l.type==='line'){
      let c='',w='',paint='';
      try{c=JSON.stringify(m.getPaintProperty(l.id,'line-color')||'').toLowerCase()}catch(e){}
      try{w=JSON.stringify(m.getPaintProperty(l.id,'line-width')||'').toLowerCase()}catch(e){}
      try{paint=JSON.stringify(l.paint||{}).toLowerCase()}catch(e){}
      const visual=(c+' '+paint);
      const bright=/green|yellow|#22c55e|#16a34a|#84cc16|#a3e635|#65a30d|#4ade80|#86efac|#eab308|#facc15|#fde047|#f59e0b|rgb\s*\(\s*(?:34\s*,\s*197\s*,\s*94|22\s*,\s*163\s*,\s*74|132\s*,\s*204\s*,\s*22|234\s*,\s*179\s*,\s*8|250\s*,\s*204\s*,\s*21)/.test(visual);
      const widthWide=/interpolate|step|zoom/.test(w) || Number(m.getPaintProperty(l.id,'line-width')||0)>=2;
      trafficByColor=bright && widthWide;
    }
    const trafficRaster=l.type==='raster' && /traffic|flow|tomtom/.test(id+' '+src);
    if(!(trafficByName||trafficByColor||trafficRaster))continue;
    try{m.setLayoutProperty(l.id,'visibility','none')}catch(e){}
    try{if(l.type==='line')m.setPaintProperty(l.id,'line-opacity',0)}catch(e){}
    try{if(l.type==='raster')m.setPaintProperty(l.id,'raster-opacity',0)}catch(e){}
   }
  }catch(e){console.warn('v58 limpeza visual',e)}
 }

function neutralizeBaseRoadPalette(){
  const m=getMap();if(!m)return;
  try{
    const st=m.getStyle?.();if(!st?.layers)return;
    const changed=[];
    for(const l of st.layers){
      if(l.type!=='line')continue;
      const id=String(l.id||'').toLowerCase();
      const sourceLayer=String(l['source-layer']||'').toLowerCase();
      const sourceId=String(l.source||'').toLowerCase();
      if(/radar|route|community|comunidade|fogo|hazard|semaforo|traffic/.test(id))continue;
      const baseRoad = sourceLayer==='transportation' || sourceLayer.includes('transportation') ||
        (/road|street|highway|motorway|trunk|primary|secondary|tertiary/.test(id) && /open|map|liberty|tiles/.test(sourceId+' '+JSON.stringify(st.sources?.[l.source]||{}).toLowerCase()));
      if(!baseRoad)continue;
      let color='';
      try{color=JSON.stringify(m.getPaintProperty(l.id,'line-color')||'').toLowerCase()}catch(e){}
      if(!/green|yellow|orange|#22c55e|#16a34a|#84cc16|#a3e635|#eab308|#facc15|#fde047|#f59e0b|#f97316|rgb/.test(color))continue;
      try{
        const isCasing=/case|casing|outline/.test(id);
        m.setPaintProperty(l.id,'line-color',isCasing?'#374151':'#6b7280');
        changed.push(l.id);
      }catch(e){}
    }
    window.RadarBaseRoadLayersV67=changed;
    if(changed.length)console.info('Radar v67 vias base neutralizadas:',changed);
  }catch(e){console.warn('v67 paleta de vias',e)}
 }

let initialized=false;

function clean(){
  hideTrafficVisual();
  neutralizeBaseRoadPalette();
}

function init(){
  if(initialized)return true;
  const map=getMap();
  if(!map)return false;

  initialized=true;

  try{
    map.on?.('styledata',()=>setTimeout(clean,80));
  }catch(_){}

  try{
    map.on?.('idle',clean);
  }catch(_){}

  [100,400,900,1800,3500].forEach(ms=>setTimeout(clean,ms));
  return true;
}

window.RadarTrafficVisualV157=Object.freeze({
  init,
  clean,
  hideTrafficVisual,
  neutralizeBaseRoadPalette,
  version:'157'
});

})();