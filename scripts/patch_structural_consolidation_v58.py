from pathlib import Path
import re

p=Path('index.html')
s=p.read_text(encoding='utf-8')
marker='RADAR_STRUCTURAL_CONSOLIDATION_V58'
if marker in s:
    print('v58 ja aplicado')
    raise SystemExit(0)

# Build
s=re.sub(r'<meta name="radar-build" content="[^"]+">','<meta name="radar-build" content="58-structural-consolidation">',s,count=1)

# Remove os quatro patches concorrentes inteiros.
for sid in [
    'radar-orbis-v54',
    'radar-location-map-clean-v55',
    'radar-clean-traffic-poi-location-v56',
    'radar-location-poi-traffic-v57'
]:
    pat=rf'\n?<script id="{re.escape(sid)}">.*?</script>\n?'
    s,n=re.subn(pat,'\n',s,flags=re.S)
    print(sid,'removido',n)

# Renomeia a camada de trânsito da rota para não colidir com prefixo de rota.
s=s.replace("trafficSourceId:'radar-route-traffic-v42'","trafficSourceId:'radar-overlay-traffic-v58'",1)
s=s.replace("trafficLayerOrange:'radar-route-traffic-orange-v42'","trafficLayerOrange:'radar-overlay-traffic-orange-v58'",1)
s=s.replace("trafficLayerRed:'radar-route-traffic-red-v42'","trafficLayerRed:'radar-overlay-traffic-red-v58'",1)

# O usuário não quer overlays coloridos de trânsito no mapa. Mantém cálculo/voz, mas não desenha.
old_draw="""  drawTrafficOverlay(route){
    try{
      if(!this.ensureTrafficLayers()) return;
      const src=App.map?.getSource(this.trafficSourceId);
      if(src?.setData) src.setData(this.trafficFeatureCollection(route));
    }catch(e){ console.warn('Radar desenho de trânsito:',e); }
  },
"""
new_draw="""  drawTrafficOverlay(route){
    // v58: trânsito continua sendo consultado para ETA/rota/voz,
    // porém o mapa não recebe malha colorida de trânsito.
    try{
      const src=App.map?.getSource(this.trafficSourceId);
      if(src?.setData) src.setData({type:'FeatureCollection',features:[]});
    }catch(e){}
  },
"""
if old_draw in s:
    s=s.replace(old_draw,new_draw,1)
else:
    print('aviso: drawTrafficOverlay original nao localizado')

patch=r'''
<script id="radar-structural-consolidation-v58">
/* RADAR_STRUCTURAL_CONSOLIDATION_V58
   Uma única implementação para localização e POI.
   Também remove visualmente malhas verdes/amarelas de trânsito sem desligar
   os dados usados para ETA, recálculo e perguntas de trânsito.
*/
(()=>{
 const WORKER='https://radar-seguro-ia-rj.claudio41cg.workers.dev';
 const norm=t=>String(t||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ').trim();
 const hav=(a,b)=>{const R=6371000,rad=x=>x*Math.PI/180,dlat=rad(b[1]-a[1]),dlon=rad(b[0]-a[0]);const q=Math.sin(dlat/2)**2+Math.cos(rad(a[1]))*Math.cos(rad(b[1]))*Math.sin(dlon/2)**2;return 2*R*Math.asin(Math.sqrt(q));};
 const getMap=()=>{try{return App?.map?.getStyle?App.map:null}catch(e){return null}};

 async function reverseTomTom(lat,lon){
  try{
   const path='/search/2/reverseGeocode/'+lat+','+lon+'.json?language=pt-BR&radius=50';
   const r=await fetch(WORKER+'/v1/tomtom?path='+encodeURIComponent(path),{cache:'no-store'});
   const d=r.ok?await r.json():null,a=d?.addresses?.[0]?.address||{};
   return {street:String(a.streetName||'').trim(),number:String(a.streetNumber||'').trim(),district:String(a.municipalitySubdivision||a.localName||'').trim(),city:String(a.municipality||'').trim(),state:String(a.countrySubdivision||'').trim(),postalCode:String(a.postalCode||'').trim()};
  }catch(e){return {};}
 }
 async function reverseOSM(lat,lon){
  try{
   const u='https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat='+encodeURIComponent(lat)+'&lon='+encodeURIComponent(lon)+'&zoom=18&addressdetails=1&accept-language=pt-BR';
   const r=await fetch(u,{headers:{'Accept-Language':'pt-BR,pt;q=.9'},cache:'no-store'});
   const d=r.ok?await r.json():null,a=d?.address||{};
   return {street:String(a.road||a.pedestrian||a.residential||a.highway||'').trim(),number:String(a.house_number||'').trim(),district:String(a.suburb||a.neighbourhood||a.city_district||a.quarter||'').trim(),city:String(a.city||a.town||a.municipality||'').trim(),state:String(a.state||'').trim(),postalCode:String(a.postcode||'').trim()};
  }catch(e){return {};}
 }
 async function resolvePlace(lon,lat){
  const [tt,osm]=await Promise.all([reverseTomTom(lat,lon),reverseOSM(lat,lon)]);
  const street=tt.street||osm.street;
  const number=tt.number||osm.number;
  const postalCode=tt.postalCode||osm.postalCode;
  const district=osm.district||tt.district;
  const city=osm.city||tt.city;
  const state=osm.state||tt.state;
  const parts=[];
  if(street)parts.push(street+(number?', '+number:''));
  if(district)parts.push(district);
  if(city)parts.push(city);
  return {street,number,postalCode,district,city,state,label:parts.join(', '),lon,lat};
 }

 function freshGps(){
  return new Promise(resolve=>{
   if(!navigator.geolocation){resolve(null);return;}
   navigator.geolocation.getCurrentPosition(
    p=>resolve({lat:Number(p.coords.latitude),lon:Number(p.coords.longitude),accuracy:Number(p.coords.accuracy||0)}),
    ()=>{try{const p=App?.userPos;resolve(Array.isArray(p)?{lon:Number(p[0]),lat:Number(p[1]),accuracy:0}:null)}catch(e){resolve(null)}},
    {enableHighAccuracy:true,maximumAge:0,timeout:8000}
   );
  });
 }

 function isLocationQuestion(q){
  const n=norm(q).replace(/^radar[, ]*/,'');
  return /\b(onde estou|onde eu estou|qual e minha localizacao atual|qual e minha localizacao|minha localizacao atual|minha localizacao|qual meu bairro|qual e meu bairro|que bairro estou|qual minha rua|qual e minha rua|que rua estou|em que rua estou)\b/.test(n);
 }
 function formatCurrentPlace(p,q){
  if(!p||!p.label)return 'Não consegui confirmar sua posição agora. Aguarde alguns segundos e tente novamente.';
  const n=norm(q);
  if(n.includes('bairro'))return p.district?('Seu bairro é '+p.district+'.'):'Consegui confirmar sua rua, mas não o bairro com segurança agora.';
  if(n.includes('rua'))return p.street?('Você está na '+p.street+(p.number?', número '+p.number:'')+'.'):'Não consegui confirmar o nome da rua agora.';
  return 'Você está em '+p.label+(p.postalCode?', CEP '+p.postalCode:'')+'.';
 }

 let pendingPlace=null;
 function nearestPlaceQuery(q){
  const n=norm(q).replace(/^radar[, ]*/,'');
  if(!/(mais proximo|mais proxima|perto de mim|perto daqui|proximo de mim|proxima de mim|onde fica o|onde tem|me leve ate o|me leva ate o|leve me ate o)/.test(n))return '';
  const known=[['mcdonald','McDonald’s'],['mc donald','McDonald’s'],['farmacia','farmácia'],['hospital','hospital'],['supermercado','supermercado'],['mercado','supermercado'],['posto de gasolina','posto de gasolina'],['restaurante','restaurante'],['lanchonete','lanchonete']];
  for(const [k,v] of known)if(n.includes(k))return v;
  return '';
 }
 async function tomtomNearest(query,gps){
  const path='/search/2/search/'+encodeURIComponent(query)+'.json?lat='+gps.lat+'&lon='+gps.lon+'&radius=30000&limit=12&countrySet=BR&language=pt-BR';
  const r=await fetch(WORKER+'/v1/tomtom?path='+encodeURIComponent(path),{cache:'no-store'});
  if(!r.ok)throw new Error('search '+r.status);
  const d=await r.json();
  const items=(d?.results||[]).filter(x=>Number.isFinite(Number(x?.position?.lat))&&Number.isFinite(Number(x?.position?.lon)));
  items.forEach(x=>x.__dist=hav([gps.lon,gps.lat],[Number(x.position.lon),Number(x.position.lat)]));
  items.sort((a,b)=>a.__dist-b.__dist);
  return items[0]||null;
 }
 async function routeSummaryTo(gps,dest){
  try{
   const path='/maps/orbis/routing/routes/calculate?apiVersion=3';
   const body={routePlanningLocations:{origin:{type:'Point',coordinates:[gps.lon,gps.lat]},destination:{type:'Point',coordinates:[dest.lon,dest.lat]}},travelMode:'car',routeType:'fast',traffic:'live',departureDateTime:'now',maxPathAlternativeRoutes:0};
   const r=await fetch(WORKER+'/v1/tomtom?path='+encodeURIComponent(path),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),cache:'no-store'});
   if(!r.ok)throw new Error('route '+r.status);
   const d=await r.json(),s=d?.routes?.[0]?.summary||{};
   return {meters:Number(s.lengthInMeters||0),seconds:Number(s.travelDurationInSeconds||s.travelTimeInSeconds||0)};
  }catch(e){return {meters:0,seconds:0};}
 }
 async function answerNearestPlace(query){
  const gps=await freshGps();
  if(!gps){VoiceAssistant.reply('Não consegui confirmar sua posição para procurar '+query+' agora.');return true;}
  try{
   App.toast('Procurando '+query+' perto de você...',3500);
   const x=await tomtomNearest(query,gps);
   if(!x){VoiceAssistant.reply('Não encontrei '+query+' próximo de você nos dados da TomTom agora.');return true;}
   const lon=Number(x.position.lon),lat=Number(x.position.lat);
   const place=await resolvePlace(lon,lat);
   const rr=await routeSummaryTo(gps,{lon,lat});
   const name=String(x?.poi?.name||query).trim();
   pendingPlace={name,lon,lat,createdAt:Date.now()};
   let text='O '+name+' mais próximo';
   if(place.label)text+=' fica em '+place.label;
   if(rr.meters>0)text+=', a cerca de '+(rr.meters/1000).toFixed(1).replace('.',',')+' km';
   if(rr.seconds>0)text+=' e '+Math.max(1,Math.round(rr.seconds/60))+' minutos';
   text+='. Quer iniciar a rota?';
   VoiceAssistant.reply(text);
  }catch(e){console.warn('v58 poi',e);VoiceAssistant.reply('Não consegui consultar esse lugar na TomTom agora.');}
  return true;
 }
 async function acceptPendingPlace(){
  if(!pendingPlace||Date.now()-pendingPlace.createdAt>90000){pendingPlace=null;return false;}
  const p=pendingPlace;pendingPlace=null;
  try{
   App.destination=[p.lon,p.lat];
   const input=document.getElementById('destInput');if(input)input.value=p.name;
   VoiceAssistant.reply('Certo. Calculando a rota para '+p.name+'.');
   if(typeof App.calculateRoute==='function')await App.calculateRoute();
   else if(typeof App.recalculateRoute==='function')await App.recalculateRoute();
   else throw new Error('sem calculador de rota');
  }catch(e){console.warn('v58 rota poi',e);VoiceAssistant.reply('Encontrei o local, mas não consegui abrir a rota agora.');}
  return true;
 }

 // Remove a malha verde/amarela visual. Mantém rota roxa, comunidades, radares e semáforos.
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
      let c='';let w=0;
      try{c=String(m.getPaintProperty(l.id,'line-color')||'').toLowerCase()}catch(e){}
      try{w=Number(m.getPaintProperty(l.id,'line-width')||0)}catch(e){}
      trafficByColor=w>=3 && /#22c55e|#16a34a|#84cc16|#a3e635|#eab308|#facc15|#f59e0b|#ef4444/.test(c);
    }
    if(!(trafficByName||trafficByColor))continue;
    try{m.setLayoutProperty(l.id,'visibility','none')}catch(e){}
    try{if(l.type==='line')m.setPaintProperty(l.id,'line-opacity',0)}catch(e){}
    try{if(l.type==='raster')m.setPaintProperty(l.id,'raster-opacity',0)}catch(e){}
   }
  }catch(e){console.warn('v58 limpeza visual',e)}
 }
 function armTrafficCleaner(){
  const m=getMap();if(!m){setTimeout(armTrafficCleaner,400);return;}
  try{m.on?.('styledata',()=>setTimeout(hideTrafficVisual,80));}catch(e){}
  try{m.on?.('idle',hideTrafficVisual);}catch(e){}
  [100,400,900,1800,3500].forEach(ms=>setTimeout(hideTrafficVisual,ms));
 }
 armTrafficCleaner();

 function install(){
  if(typeof VoiceAssistant==='undefined'||VoiceAssistant.__structuralV58)return false;
  VoiceAssistant.__structuralV58=true;
  VoiceAssistant.getCurrentAddress=async function(force=false){
   let gps=null;
   if(force)gps=await freshGps();
   if(!gps&&Array.isArray(App?.userPos)&&App.userPos.length>=2)gps={lon:Number(App.userPos[0]),lat:Number(App.userPos[1])};
   if(!gps)return null;
   const place=await resolvePlace(gps.lon,gps.lat);
   if(place.label){this.lastKnownAddress=place.label;this.lastKnownAddressAt=Date.now();}
   return place;
  };
  const originalHandle=typeof VoiceAssistant.handle==='function'?VoiceAssistant.handle.bind(VoiceAssistant):null;
  if(originalHandle){
   VoiceAssistant.handle=async function(command,...rest){
    const n=norm(command);
    if(pendingPlace&&Date.now()-pendingPlace.createdAt<=90000){
      if(/^(sim|pode|pode sim|quero|vai|vamos|inicia|iniciar|comece|comeca|começar|beleza)$/.test(n))return acceptPendingPlace();
      if(/^(nao|não|cancela|cancelar|deixa|deixa pra la|deixa pra lá)$/.test(n)){pendingPlace=null;this.reply('Tudo bem. Não vou mudar sua rota.');return;}
    }
    if(isLocationQuestion(command)){const p=await this.getCurrentAddress(true);this.reply(formatCurrentPlace(p,command));return;}
    const pq=nearestPlaceQuery(command);if(pq)return answerNearestPlace(pq);
    return originalHandle(command,...rest);
   };
  }
  return true;
 }
 if(!install()){let n=0,id=setInterval(()=>{if(install()||++n>80)clearInterval(id)},250)}
 window.RadarV58={resolvePlace,hideTrafficVisual,answerNearestPlace};
 console.info('Radar v58 consolidação estrutural ativa');
})();
</script>
'''

pos=s.lower().rfind('</body>')
if pos<0:
    raise SystemExit('body final nao encontrado')
s=s[:pos]+patch+s[pos:]

required=[
    '58-structural-consolidation',
    'RADAR_STRUCTURAL_CONSOLIDATION_V58',
    "trafficSourceId:'radar-overlay-traffic-v58'"
]
missing=[x for x in required if x not in s]
if missing:
    raise SystemExit('marcadores ausentes: '+', '.join(missing))
for sid in ['radar-orbis-v54','radar-location-map-clean-v55','radar-clean-traffic-poi-location-v56','radar-location-poi-traffic-v57']:
    if f'<script id="{sid}">' in s:
        raise SystemExit('script antigo ainda presente: '+sid)

p.write_text(s,encoding='utf-8')
print('consolidacao estrutural v58 aplicada')
