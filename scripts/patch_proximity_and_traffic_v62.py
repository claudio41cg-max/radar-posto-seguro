from pathlib import Path
import re

p=Path('index.html')
s=p.read_text(encoding='utf-8')

s=re.sub(r'<meta name="radar-build" content="[^"]+">','<meta name="radar-build" content="62-proximity-traffic-fix">',s,count=1)

old_nearest=""" function nearestPlaceQuery(q){
  const n=norm(q).replace(/^radar[, ]*/,'');
  if(!/(mais proximo|mais proxima|perto de mim|perto daqui|proximo de mim|proxima de mim|onde fica o|onde tem|me leve ate o|me leva ate o|leve me ate o)/.test(n))return '';
  const known=[['mcdonald','McDonald’s'],['mc donald','McDonald’s'],['farmacia','farmácia'],['hospital','hospital'],['supermercado','supermercado'],['mercado','supermercado'],['posto de gasolina','posto de gasolina'],['restaurante','restaurante'],['lanchonete','lanchonete']];
  for(const [k,v] of known)if(n.includes(k))return v;
  return '';
 }"""
new_nearest=""" function nearestPlaceQuery(q){
  let n=norm(q).replace(/^radar[, ]*/,'').trim();
  const hasProximity=/(mais proximo|mais proxima|mais perto|mais perto de casa|mais perto da minha casa|mais proximo da minha casa|mais proxima da minha casa|perto da minha casa|perto de casa|perto de mim|perto daqui|proximo de mim|proxima de mim)/.test(n);
  if(!hasProximity)return '';
  n=n
   .replace(/^(me leve|me leva|leve me|leva me|quero ir|va|vá|ir)\s+(para|pra|pro|para o|para a|ate|até|ao|a)\s+/,'')
   .replace(/\b(o|a)\s+(mais proximo|mais proxima|mais perto)\b/g,' ')
   .replace(/\b(mais proximo|mais proxima|mais perto|perto da minha casa|mais perto da minha casa|mais proximo da minha casa|mais proxima da minha casa|perto de casa|perto de mim|perto daqui|proximo de mim|proxima de mim|da minha casa)\b/g,' ')
   .replace(/\s+/g,' ').trim();
  if(!n)return '';
  if(/mcdonald|mc donald/.test(n))return 'McDonald’s';
  return n;
 }"""
if old_nearest not in s:
    raise SystemExit('nearestPlaceQuery nao localizado')
s=s.replace(old_nearest,new_nearest,1)

old_color="""    let trafficByColor=false;
    if(l.type==='line'){
      let c='';let w=0;
      try{c=String(m.getPaintProperty(l.id,'line-color')||'').toLowerCase()}catch(e){}
      try{w=String(m.getPaintProperty(l.id,'line-width')||'')}catch(e){}
      trafficByColor=/#22c55e|#16a34a|#84cc16|#a3e635|#eab308|#facc15|#f59e0b|#ef4444/.test(c) && (/interpolate|step|zoom/.test(w) || Number(w)>=3);
    }
    if(!(trafficByName||trafficByColor))continue;"""
new_color="""    let trafficByColor=false;
    if(l.type==='line'){
      let c='',w='',paint='';
      try{c=JSON.stringify(m.getPaintProperty(l.id,'line-color')||'').toLowerCase()}catch(e){}
      try{w=JSON.stringify(m.getPaintProperty(l.id,'line-width')||'').toLowerCase()}catch(e){}
      try{paint=JSON.stringify(l.paint||{}).toLowerCase()}catch(e){}
      const visual=(c+' '+paint);
      const bright=/green|yellow|#22c55e|#16a34a|#84cc16|#a3e635|#65a30d|#4ade80|#86efac|#eab308|#facc15|#fde047|#f59e0b|rgb\\s*\\(\\s*(?:34\\s*,\\s*197\\s*,\\s*94|22\\s*,\\s*163\\s*,\\s*74|132\\s*,\\s*204\\s*,\\s*22|234\\s*,\\s*179\\s*,\\s*8|250\\s*,\\s*204\\s*,\\s*21)/.test(visual);
      const widthWide=/interpolate|step|zoom/.test(w) || Number(m.getPaintProperty(l.id,'line-width')||0)>=2;
      trafficByColor=bright && widthWide;
    }
    const trafficRaster=l.type==='raster' && /traffic|flow|tomtom/.test(id+' '+src);
    if(!(trafficByName||trafficByColor||trafficRaster))continue;"""
if old_color not in s:
    raise SystemExit('bloco visual nao localizado')
s=s.replace(old_color,new_color,1)

# Remove de vez as camadas visuais de trânsito criadas pelo módulo interno.
s=s.replace("  trafficLayerOrange:'radar-overlay-traffic-orange-v58',\n  trafficLayerRed:'radar-overlay-traffic-red-v58',","  trafficLayerOrange:'radar-overlay-traffic-orange-v58',\n  trafficLayerRed:'radar-overlay-traffic-red-v58',")

# Garante que, ao confirmar POI, a rota use as coordenadas já escolhidas e não volte a geocodificar o texto.
old_accept="""   App.destination=[p.lon,p.lat];
   const input=document.getElementById('destInput');if(input)input.value=p.name;
   VoiceAssistant.reply('Certo. Calculando a rota para '+p.name+'.');
   if(typeof App.recalculateRoute==='function')await App.recalculateRoute();
   else if(typeof App.calculateRoute==='function')await App.calculateRoute();"""
new_accept="""   App.destination=[p.lon,p.lat];
   App.destinationName=p.name;
   App.destinationLabel=p.name;
   const input=document.getElementById('destInput');if(input)input.value=p.name;
   VoiceAssistant.reply('Certo. Calculando a rota para '+p.name+'.');
   if(typeof App.recalculateRoute==='function')await App.recalculateRoute();
   else if(typeof App.calculateRoute==='function')await App.calculateRoute();"""
if old_accept in s:
    s=s.replace(old_accept,new_accept,1)

p.write_text(s,encoding='utf-8')
print('v62 aplicado')
