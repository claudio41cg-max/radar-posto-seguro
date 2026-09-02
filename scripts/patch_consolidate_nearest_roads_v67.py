from pathlib import Path
import re

p=Path('index.html')
s=p.read_text(encoding='utf-8')
s=re.sub(r'<meta name="radar-build" content="[^"]+">','<meta name="radar-build" content="67-nearest-road-consolidation">',s,count=1)

# 1) Proximidade: se nearestPlaceQuery reconheceu a intenção, nunca devolva para geocodificação textual.
old="return originalHandle(cleaned,...rest);"
if old not in s:
    raise SystemExit('retorno cleaned nao localizado')
s=s.replace(old,"return answerNearestPlace(pq);",1)

# 2) Busca POI já usa GPS + radius. Torna o limite explícito e um pouco mais local para evitar resultados distantes.
s=s.replace("&radius=30000&limit=12&countrySet=BR&language=pt-BR","&radius=20000&limit=20&countrySet=BR&language=pt-BR",1)

# 3) Vias verdes/amarelas: neutraliza somente camadas viárias do estilo base OpenFreeMap/Liberty.
anchor=""" function armTrafficCleaner(){
  const m=getMap();if(!m){setTimeout(armTrafficCleaner,400);return;}
"""
insert=""" function neutralizeBaseRoadPalette(){
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

 function armTrafficCleaner(){
  const m=getMap();if(!m){setTimeout(armTrafficCleaner,400);return;}
"""
if anchor not in s:
    raise SystemExit('armTrafficCleaner nao localizado')
s=s.replace(anchor,insert,1)

# Chama neutralização junto das mudanças de estilo e nos primeiros segundos.
s=s.replace("try{m.on?.('styledata',()=>setTimeout(hideTrafficVisual,80));}catch(e){}",
            "try{m.on?.('styledata',()=>setTimeout(()=>{hideTrafficVisual();neutralizeBaseRoadPalette();},80));}catch(e){}",1)
s=s.replace("try{m.on?.('idle',hideTrafficVisual);}catch(e){}",
            "try{m.on?.('idle',()=>{hideTrafficVisual();neutralizeBaseRoadPalette();});}catch(e){}",1)
s=s.replace("[100,400,900,1800,3500].forEach(ms=>setTimeout(hideTrafficVisual,ms));",
            "[100,400,900,1800,3500].forEach(ms=>setTimeout(()=>{hideTrafficVisual();neutralizeBaseRoadPalette();},ms));",1)

p.write_text(s,encoding='utf-8')
print('v67 aplicado')
