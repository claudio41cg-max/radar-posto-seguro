from pathlib import Path
import re
p=Path('index.html')
s=p.read_text(encoding='utf-8')
marker='RADAR_LOCATION_POI_TRAFFIC_V57'
if marker in s:
 print('v57 ja aplicado'); raise SystemExit(0)
s=re.sub(r'<meta name="radar-build" content="[^"]+">','<meta name="radar-build" content="57-location-poi-traffic">',s,count=1)
patch=r'''
<script id="radar-location-poi-traffic-v57">
/* RADAR_LOCATION_POI_TRAFFIC_V57
   Corrige: bairro/endereco atual, POI mais proximo com coordenadas unicas,
   confirmacao 'sim' para rota e remocao visual da malha geral de transito.
*/
(()=>{
 const WORKER='https://radar-seguro-ia-rj.claudio41cg.workers.dev';
 const norm=t=>String(t||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ').trim();
 const hav=(a,b)=>{const R=6371000,rad=x=>x*Math.PI/180,dlat=rad(b[1]-a[1]),dlon=rad(b[0]-a[0]);const q=Math.sin(dlat/2)**2+Math.cos(rad(a[1]))*Math.cos(rad(b[1]))*Math.sin(dlon/2)**2;return 2*R*Math.asin(Math.sqrt(q));};
 const getMap=()=>{try{if(typeof map!=='undefined'&&map?.getStyle)return map;}catch(e){};try{if(App?.map?.getStyle)return App.map;}catch(e){};return window.map?.getStyle?window.map:null;};

 // 1) Remove apenas a CAMADA VISUAL geral de transito. Os dados TomTom continuam ativos.
 function hideTrafficVisual(){
  const m=getMap(); if(!m)return;
  try{
   const st=m.getStyle?.(); if(!st)return;
   const trafficSources=new Set();
   for(const [id,src] of Object.entries(st.sources||{})){
    let sig=''; try{sig=(id+' '+JSON.stringify(src||{})).toLowerCase();}catch(e){sig=String(id).toLowerCase();}
    if(/traffic|trafficflow|flowsegment|flow[_-]|tomtom.*flow|tomtom.*traffic|\/traffic\//.test(sig)) trafficSources.add(id);
   }
   for(const l of (st.layers||[])){
    const id=String(l.id||'').toLowerCase(),src=String(l.source||'');
    const isChosenRoute=/radar-route|route-line|route-main|route-outline|route-traffic/.test(id);
    const isLight=/traffic[-_ ]?light|semaforo/.test(id);
    const isGeneralTraffic=!isChosenRoute&&!isLight&&(trafficSources.has(src)||/traffic(?!.*light)|trafficflow|flow[-_ ]?(?:line|tile|layer|road)|tomtom[-_ ]?(?:traffic|flow)/.test(id));
    if(!isGeneralTraffic)continue;
    try{m.setLayoutProperty(l.id,'visibility','none')}catch(e){}
    try{if(l.type==='raster')m.setPaintProperty(l.id,'raster-opacity',0)}catch(e){}
    try{if(l.type==='line')m.setPaintProperty(l.id,'line-opacity',0)}catch(e){}
    try{if(l.type==='fill')m.setPaintProperty(l.id,'fill-opacity',0)}catch(e){}
   }
  }catch(e){console.warn('v57 traffic visual',e)}
 }
 function armTrafficCleaner(){
  const m=getMap(); if(!m){setTimeout(armTrafficCleaner,400);return;}
  try{m.on?.('styledata',()=>setTimeout(hideTrafficVisual,40));}catch(e){}
  try{m.on?.('idle',hideTrafficVisual);}catch(e){}
  [50,250,700,1500,3000].forEach(ms=>setTimeout(hideTrafficVisual,ms));
 }
 armTrafficCleaner();

 // 2) GPS realmente fresco e endereco montado com rua TomTom + bairro do melhor reverse geocoder.
 function freshGps(){return new Promise(resolve=>{
  if(!navigator.geolocation){resolve(null);return;}
  navigator.geolocation.getCurrentPosition(
   p=>resolve({lat:Number(p.coords.latitude),lon:Number(p.coords.longitude),accuracy:Number(p.coords.accuracy||0)}),
   ()=>{try{const p=App?.userPos;resolve(Array.isArray(p)?{lon:Number(p[0]),lat:Number(p[1]),accuracy:0}:null)}catch(e){resolve(null)}},
   {enableHighAccuracy:true,maximumAge:0,timeout:8000}
  );
 });}
 async function reverseTomTom(gps){
  try{
   const path='/search/2/reverseGeocode/'+gps.lat+','+gps.lon+'.json?language=pt-BR&radius=50';
   const r=await fetch(WORKER+'/v1/tomtom?path='+encodeURIComponent(path),{cache:'no-store'}),d=r.ok?await r.json():null,a=d?.addresses?.[0]?.address||{};
   return {street:String(a.streetName||'').trim(),number:String(a.streetNumber||'').trim(),district:String(a.municipalitySubdivision||a.localName||'').trim(),city:String(a.municipality||'').trim(),state:String(a.countrySubdivision||'').trim(),postalCode:String(a.postalCode||'').trim()};
  }catch(e){return {};}
 }
 async function reverseOSM(gps){
  try{
   const u='https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat='+encodeURIComponent(gps.lat)+'&lon='+encodeURIComponent(gps.lon)+'&zoom=18&addressdetails=1&accept-language=pt-BR';
   const r=await fetch(u,{headers:{'Accept-Language':'pt-BR,pt;q=.9'},cache:'no-store'}),d=r.ok?await r.json():null,a=d?.address||{};
   return {street:String(a.road||a.pedestrian||a.residential||a.highway||'').trim(),number:String(a.house_number||'').trim(),district:String(a.suburb||a.neighbourhood||a.city_district||a.quarter||'').trim(),city:String(a.city||a.town||a.municipality||'').trim(),state:String(a.state||'').trim(),postalCode:String(a.postcode||'').trim()};
  }catch(e){return {};}
 }
 async function currentPlace(){
  const gps=await freshGps(); if(!gps||!Number.isFinite(gps.lat)||!Number.isFinite(gps.lon))return null;
  const [tt,osm]=await Promise.all([reverseTomTom(gps),reverseOSM(gps)]);
  const street=tt.street||osm.street,number=tt.number||osm.number,district=osm.district||tt.district,city=tt.city||osm.city,state=tt.state||osm.state,postalCode=tt.postalCode||osm.postalCode;
  return {gps,street,number,district,city,state,postalCode};
 }
 function isLocationQuestion(q){const n=norm(q).replace(/^radar[, ]*/,'');return /\b(onde estou|onde eu estou|qual e minha localizacao|minha localizacao|qual meu bairro|qual e meu bairro|que bairro estou|qual minha rua|qual e minha rua|que rua estou)\b/.test(n);}
 function formatCurrentPlace(p,q){
  if(!p)return 'Não consegui confirmar sua posição agora. Aguarde alguns segundos e tente novamente.';
  const n=norm(q);
  if(n.includes('bairro')) return p.district?'Seu bairro é '+p.district+'.':'Consegui confirmar sua rua, mas o serviço de endereço não informou o bairro com segurança agora.';
  if(n.includes('rua')) return p.street?'Você está na '+p.street+(p.number?', número '+p.number:'')+'.':'Não consegui confirmar o nome da rua agora.';
  const parts=[];
  if(p.street)parts.push(p.street+(p.number?', '+p.number:''));
  if(p.district)parts.push('bairro '+p.district);
  if(p.city)parts.push(p.city);
  if(p.postalCode)parts.push('CEP '+p.postalCode);
  return parts.length?'Você está em '+parts.join(', ')+'.':'Não consegui transformar sua posição em um endereço agora.';
 }

 // 3) POI mais proximo: um unico resultado TomTom, uma unica coordenada, sem a IA inventar endereco.
 let pendingPlace=null;
 function nearestPlaceQuery(q){
  const n=norm(q).replace(/^radar[, ]*/,'');
  const nearest=/(mais proximo|mais proxima|perto de mim|perto daqui|proximo de mim|proxima de mim|onde fica o|onde tem)/.test(n);
  if(!nearest)return '';
  const known=[['mcdonald','McDonald’s'],['mc donald','McDonald’s'],['farmacia','farmácia'],['hospital','hospital'],['supermercado','supermercado'],['mercado','supermercado'],['posto de gasolina','posto de gasolina'],['restaurante','restaurante'],['lanchonete','lanchonete']];
  for(const [k,v] of known)if(n.includes(k))return v;
  return '';
 }
 async function tomtomNearest(query,gps){
  const path='/search/2/search/'+encodeURIComponent(query)+'.json?lat='+gps.lat+'&lon='+gps.lon+'&radius=30000&limit=12&countrySet=BR&language=pt-BR';
  const r=await fetch(WORKER+'/v1/tomtom?path='+encodeURIComponent(path),{cache:'no-store'}); if(!r.ok)throw new Error('search '+r.status);
  const d=await r.json(),items=(d?.results||[]).filter(x=>Number.isFinite(Number(x?.position?.lat))&&Number.isFinite(Number(x?.position?.lon)));
  items.forEach(x=>x.__dist=hav([gps.lon,gps.lat],[Number(x.position.lon),Number(x.position.lat)]));
  items.sort((a,b)=>a.__dist-b.__dist); return items[0]||null;
 }
 async function routeToPlace(gps,place){
  try{
   if(window.RadarTomTomV54?.orbisRoute){
    const d=await window.RadarTomTomV54.orbisRoute([gps.lon,gps.lat],[Number(place.position.lon),Number(place.position.lat)],0),r=d?.routes?.[0],s=r?.summary||{};
    return {meters:Number(s.lengthInMeters||0),seconds:Number(s.travelDurationInSeconds||s.travelTimeInSeconds||0)};
   }
  }catch(e){}
  return {meters:Number(place.__dist||0),seconds:0};
 }
 function placeAddress(x){
  const a=x?.address||{},parts=[];
  const street=String(a.streetName||'').trim(),num=String(a.streetNumber||'').trim(),district=String(a.municipalitySubdivision||a.localName||'').trim(),city=String(a.municipality||'').trim();
  if(street)parts.push(street+(num?', '+num:''));
  if(district)parts.push(district);
  if(city)parts.push(city);
  return parts.join(', ')||String(a.freeformAddress||'').trim();
 }
 async function answerNearestPlace(query){
  const cp=await currentPlace(); if(!cp){VoiceAssistant.reply('Não consegui confirmar sua posição para procurar '+query+' agora.');return true;}
  try{
   App.toast('Procurando '+query+' perto de você...',3500);
   const x=await tomtomNearest(query,cp.gps); if(!x){VoiceAssistant.reply('Não encontrei '+query+' próximo de você nos dados da TomTom agora.');return true;}
   const rr=await routeToPlace(cp.gps,x),name=String(x?.poi?.name||query).trim(),address=placeAddress(x);
   const km=rr.meters>0?(rr.meters/1000).toFixed(1).replace('.',','):'';
   const min=rr.seconds>0?Math.max(1,Math.round(rr.seconds/60)):0;
   pendingPlace={name,address,lon:Number(x.position.lon),lat:Number(x.position.lat),createdAt:Date.now()};
   let text='O '+name+' mais próximo';
   if(address)text+=' fica em '+address;
   if(km)text+=', a cerca de '+km+' km';
   if(min)text+=' e '+min+' minutos';
   text+='. Quer iniciar a rota?';
   VoiceAssistant.reply(text); return true;
  }catch(e){console.warn('v57 POI',e);VoiceAssistant.reply('Não consegui consultar esse lugar na TomTom agora.');return true;}
 }
 async function acceptPendingPlace(){
  if(!pendingPlace||Date.now()-pendingPlace.createdAt>90000){pendingPlace=null;return false;}
  const p=pendingPlace; pendingPlace=null;
  try{
   App.destination=[p.lon,p.lat];
   App.destinationLabel=p.name; App.destinationName=p.name; App.routeDestinationName=p.name;
   const input=document.getElementById('destInput'); if(input)input.value=p.name+(p.address?' - '+p.address:'');
   VoiceAssistant.reply('Certo. Calculando a rota para '+p.name+'.');
   if(typeof App.calculateRoute==='function') await App.calculateRoute();
   else if(typeof App.recalculateRoute==='function') await App.recalculateRoute();
   else throw new Error('sem calculador');
   return true;
  }catch(e){console.warn('v57 iniciar POI',e);VoiceAssistant.reply('Encontrei o local, mas não consegui abrir a rota agora.');return true;}
 }

 function installAssistant(){
  if(typeof VoiceAssistant==='undefined'||VoiceAssistant.__v57)return false;
  VoiceAssistant.__v57=true;
  const originalHandle=typeof VoiceAssistant.handle==='function'?VoiceAssistant.handle.bind(VoiceAssistant):null;
  if(originalHandle){
   VoiceAssistant.handle=async function(command,...rest){
    const n=norm(command);
    if(pendingPlace&&Date.now()-pendingPlace.createdAt<=90000){
     if(/^(sim|pode|pode sim|quero|vai|vamos|inicia|iniciar|comece|comeca|começar|beleza)$/.test(n))return acceptPendingPlace();
     if(/^(nao|não|cancela|cancelar|deixa|deixa pra la|deixa pra lá)$/.test(n)){pendingPlace=null;this.reply('Tudo bem. Não vou mudar sua rota.');return;}
    }
    if(isLocationQuestion(command)){const p=await currentPlace();this.reply(formatCurrentPlace(p,command));return;}
    const pq=nearestPlaceQuery(command); if(pq){await answerNearestPlace(pq);return;}
    return originalHandle(command,...rest);
   };
  }
  // Garante interceptacao mesmo se alguma versao encaminhar direto para a IA.
  const originalAsk=typeof VoiceAssistant.askAI==='function'?VoiceAssistant.askAI.bind(VoiceAssistant):null;
  if(originalAsk){
   VoiceAssistant.askAI=async function(question,...rest){
    if(isLocationQuestion(question)){const p=await currentPlace();this.reply(formatCurrentPlace(p,question));return true;}
    const pq=nearestPlaceQuery(question); if(pq)return answerNearestPlace(pq);
    return originalAsk(question,...rest);
   };
  }
  return true;
 }
 if(!installAssistant()){let t=0,id=setInterval(()=>{if(installAssistant()||++t>80)clearInterval(id)},250)}
 window.RadarV57={hideTrafficVisual,currentPlace,answerNearestPlace};
 console.info('Radar v57 ativo');
})();
</script>
'''
pos=s.lower().rfind('</body>')
if pos<0: raise SystemExit('body final nao encontrado')
s=s[:pos]+patch+s[pos:]
p.write_text(s,encoding='utf-8')
print('patch v57 aplicado')
