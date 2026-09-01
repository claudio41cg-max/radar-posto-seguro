from pathlib import Path
import re
p=Path('index.html')
s=p.read_text(encoding='utf-8')
marker='RADAR_CLEAN_TRAFFIC_POI_LOCATION_V56'
if marker in s:
 print('v56 ja aplicado'); raise SystemExit(0)
s=re.sub(r'<meta name="radar-build" content="[^"]+">','<meta name="radar-build" content="56-clean-traffic-poi-location">',s,count=1)
patch=r'''
<script id="radar-clean-traffic-poi-location-v56">
/* RADAR_CLEAN_TRAFFIC_POI_LOCATION_V56
   - esconde visualmente a malha geral de trânsito sem desligar os dados TomTom
   - usa GPS fresco nas perguntas de localização
   - busca lugares/estabelecimentos ao longo da rota
*/
(()=>{
 const WORKER='https://radar-seguro-ia-rj.claudio41cg.workers.dev';
 const norm=t=>String(t||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ').trim();
 const hav=(a,b)=>{const R=6371000,rad=x=>x*Math.PI/180,dlat=rad(b[1]-a[1]),dlon=rad(b[0]-a[0]);const q=Math.sin(dlat/2)**2+Math.cos(rad(a[1]))*Math.cos(rad(b[1]))*Math.sin(dlon/2)**2;return 2*R*Math.asin(Math.sqrt(q));};

 // 1) Mapa limpo: identifica a fonte TomTom de tráfego, inclusive raster, e oculta só a malha geral.
 function hideGeneralTraffic(){
  try{
   if(!window.map?.getStyle)return;
   const st=map.getStyle(); if(!st)return;
   const trafficSources=new Set();
   Object.entries(st.sources||{}).forEach(([id,src])=>{
    const sig=[id,src?.url,...(Array.isArray(src?.tiles)?src.tiles:[])].filter(Boolean).join(' ').toLowerCase();
    if((sig.includes('tomtom')&&(sig.includes('traffic')||sig.includes('flow'))) || /(^|[-_])(traffic|flow)([-_]|$)/.test(String(id).toLowerCase())) trafficSources.add(id);
   });
   (st.layers||[]).forEach(l=>{
    const id=String(l.id||'').toLowerCase(),src=String(l.source||'');
    const routeLayer=id.includes('route')||id.includes('radar-route');
    const trafficLayer=!routeLayer && (trafficSources.has(src) || ((id.includes('traffic')||id.includes('flow'))&&!id.includes('light')));
    if(trafficLayer){
     try{map.setLayoutProperty(l.id,'visibility','none')}catch(e){}
     try{if(l.type==='raster')map.setPaintProperty(l.id,'raster-opacity',0)}catch(e){}
     try{if(l.type==='line')map.setPaintProperty(l.id,'line-opacity',0)}catch(e){}
    }
   });
  }catch(e){console.warn('v56 hide traffic',e)}
 }
 const refreshTrafficVisibility=()=>{setTimeout(hideGeneralTraffic,100);setTimeout(hideGeneralTraffic,700);setTimeout(hideGeneralTraffic,1800)};
 if(window.map){map.on?.('styledata',refreshTrafficVisibility);map.on?.('idle',hideGeneralTraffic)}
 new MutationObserver(refreshTrafficVisibility).observe(document.documentElement,{subtree:true,attributes:true,attributeFilter:['class']});
 refreshTrafficVisibility();

 // 2) GPS fresco e endereço consistente.
 function freshGps(){
  return new Promise(resolve=>{
   if(!navigator.geolocation){resolve(null);return;}
   navigator.geolocation.getCurrentPosition(
    p=>resolve({lat:Number(p.coords.latitude),lon:Number(p.coords.longitude),accuracy:Number(p.coords.accuracy||0)}),
    ()=>resolve(null),
    {enableHighAccuracy:true,maximumAge:0,timeout:8000}
   );
  });
 }
 async function reverseFresh(gps){
  if(!gps)return null;
  let street='',number='',district='',city='',label='';
  try{
   const path='/search/2/reverseGeocode/'+gps.lat+','+gps.lon+'.json?language=pt-BR&radius=60';
   const r=await fetch(WORKER+'/v1/tomtom?path='+encodeURIComponent(path),{cache:'no-store'}),d=r.ok?await r.json():null,a=d?.addresses?.[0]?.address||{};
   street=String(a.streetName||'').trim(); number=String(a.streetNumber||'').trim(); district=String(a.municipalitySubdivision||a.localName||'').trim(); city=String(a.municipality||'').trim();
   label=[street+(number?' '+number:''),district,city].filter((x,i,a)=>x&&a.indexOf(x)===i).join(', ')||String(a.freeformAddress||'').trim();
  }catch(e){}
  if(!label){
   try{
    const u='https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat='+gps.lat+'&lon='+gps.lon+'&zoom=18&addressdetails=1&accept-language=pt-BR';
    const r=await fetch(u,{headers:{'Accept-Language':'pt-BR,pt;q=.9'},cache:'no-store'}),d=r.ok?await r.json():null,a=d?.address||{};
    street=a.road||a.pedestrian||a.residential||''; number=a.house_number||''; district=a.suburb||a.neighbourhood||a.quarter||a.city_district||''; city=a.city||a.town||a.municipality||'';
    label=[street+(number?' '+number:''),district,city].filter((x,i,a)=>x&&a.indexOf(x)===i).join(', ')||String(d?.display_name||'').trim();
   }catch(e){}
  }
  return {label,street,number,district,city,lat:gps.lat,lon:gps.lon,accuracy:gps.accuracy};
 }
 function locationIntent(q){const n=norm(q).replace(/^radar[, ]*/, '');return /\b(onde estou|onde eu estou|minha localizacao|qual e minha localizacao|qual meu bairro|qual e meu bairro|que bairro estou|qual minha rua|qual e minha rua|que rua estou|qual cidade estou|qual e a cidade que estou)\b/.test(n);}
 function locationAnswer(pos,q){
  const n=norm(q); if(!pos?.label)return 'Estou com o GPS, mas não consegui converter a posição atual para rua e bairro agora.';
  if(n.includes('bairro')) return pos.district?('Você está no bairro '+pos.district+'.'):('O endereço atual é '+pos.label+'.');
  if(n.includes('rua')) return pos.street?('Você está na '+pos.street+(pos.number?', número '+pos.number:'')+'.'):('O endereço atual é '+pos.label+'.');
  if(n.includes('cidade')) return pos.city?('Você está em '+pos.city+'.'):('O endereço atual é '+pos.label+'.');
  return 'Você está em '+pos.label+'.';
 }
 const installLocation=()=>{
  if(typeof VoiceAssistant==='undefined'||VoiceAssistant.__locationV56)return false;
  VoiceAssistant.__locationV56=true;
  VoiceAssistant.getCurrentAddress=async function(force=false){
   let gps=null;
   if(force)gps=await freshGps();
   if(!gps&&Array.isArray(App?.userPos)&&App.userPos.length>=2)gps={lon:Number(App.userPos[0]),lat:Number(App.userPos[1]),accuracy:0};
   if(!gps)return null;
   const pos=await reverseFresh(gps);
   if(pos?.label){this.lastKnownAddress=pos.label;this.lastKnownAddressAt=Date.now();}
   return pos;
  };
  const originalAsk=typeof VoiceAssistant.askAI==='function'?VoiceAssistant.askAI.bind(VoiceAssistant):null;
  if(originalAsk){
   VoiceAssistant.askAI=async function(question,...rest){
    if(locationIntent(question)){
     const pos=await this.getCurrentAddress(true); this.reply(locationAnswer(pos,question)); return true;
    }
    return originalAsk(question,...rest);
   };
  }
  return true;
 };
 if(!installLocation()){let n=0,id=setInterval(()=>{if(installLocation()||++n>60)clearInterval(id)},250)}

 // 3) Lugares no caminho: TomTom Search em amostras da rota e filtro por proximidade do trajeto.
 function routePoints(){
  const pts=App?.route?.geometry?.coordinates||App?.route?.coords||App?.route?.coordinates||App?.route?.points||[];
  return Array.isArray(pts)?pts.filter(p=>Array.isArray(p)&&p.length>=2&&Number.isFinite(Number(p[0]))&&Number.isFinite(Number(p[1]))):[];
 }
 function sampleAhead(pts){
  if(!pts.length)return [];
  const start=Math.max(0,Number(App?.routeProgressIndex||0));
  const ahead=pts.slice(Math.min(start,pts.length-1)); if(!ahead.length)return [];
  const count=Math.min(6,ahead.length),out=[];
  for(let i=0;i<count;i++)out.push(ahead[Math.min(ahead.length-1,Math.round(i*(ahead.length-1)/Math.max(1,count-1)))]);
  return out;
 }
 function placeQuery(command){
  const raw=String(command||'').replace(/^\s*radar[, ]*/i,'').trim(),n=norm(raw);
  if(!/(no caminho|na rota|pelo caminho|mais a frente|mais à frente|adiante)/.test(n))return '';
  const known=[['mcdonald','McDonald’s'],['mc donald','McDonald’s'],['farmacia','farmácia'],['posto de gasolina','posto de gasolina'],['posto','posto de gasolina'],['restaurante','restaurante'],['hospital','hospital'],['mercado','supermercado'],['supermercado','supermercado'],['lanchonete','lanchonete']];
  for(const [k,v] of known)if(n.includes(k))return v;
  let m=raw.match(/(?:tem|ha|há|existe|procure|acha|encontre|onde tem)\s+(?:algum(?:a)?\s+)?(.+?)\s+(?:no caminho|na rota|pelo caminho|mais a frente|mais à frente|adiante)/i);
  return m?m[1].replace(/[?.!,]+$/,'').trim():'';
 }
 async function searchAlongRoute(query){
  const pts=routePoints(); if(pts.length<2)return [];
  const samples=sampleAhead(pts),found=[];
  for(const p of samples){
   try{
    const path='/search/2/search/'+encodeURIComponent(query)+'.json?lat='+Number(p[1])+'&lon='+Number(p[0])+'&radius=4500&limit=6&countrySet=BR&language=pt-BR';
    const r=await fetch(WORKER+'/v1/tomtom?path='+encodeURIComponent(path),{cache:'no-store'}); if(!r.ok)continue;
    const d=await r.json(); for(const x of (d?.results||[]))found.push(x);
   }catch(e){}
  }
  const seen=new Set(),unique=[];
  for(const x of found){const pos=x?.position;if(!pos)continue;const key=String(x?.id||x?.poi?.name||'')+'|'+Number(pos.lat).toFixed(4)+'|'+Number(pos.lon).toFixed(4);if(seen.has(key))continue;seen.add(key);unique.push(x);}
  const start=Math.max(0,Number(App?.routeProgressIndex||0));
  return unique.map(x=>{
   const p=[Number(x.position.lon),Number(x.position.lat)];let best=Infinity,bestI=-1;
   const step=Math.max(1,Math.floor(pts.length/500));
   for(let i=start;i<pts.length;i+=step){const d=hav(p,[Number(pts[i][0]),Number(pts[i][1])]);if(d<best){best=d;bestI=i;}}
   return {x,d:best,i:bestI};
  }).filter(o=>o.i>=start&&o.d<=1800).sort((a,b)=>a.i-b.i||a.d-b.d);
 }
 async function answerPlaceAlongRoute(query){
  if(!App?.route){VoiceAssistant.reply('Trace uma rota primeiro para eu procurar lugares no caminho.');return true;}
  App.toast('Procurando '+query+' no caminho...',4000);
  const items=await searchAlongRoute(query);
  if(!items.length){VoiceAssistant.reply('Não encontrei '+query+' próximo da sua rota com os dados da TomTom agora.');return true;}
  const o=items[0],x=o.x,name=x?.poi?.name||query,address=x?.address?.freeformAddress||x?.address?.streetName||'';
  const extra=address?' Fica em '+address+'.':'';
  VoiceAssistant.reply('Sim. Encontrei '+name+' no seu caminho, a cerca de '+(o.d<1000?Math.max(50,Math.round(o.d/50)*50)+' metros':(o.d/1000).toFixed(1).replace('.',',')+' quilômetro'+(o.d>=2000?'s':''))+' da rota.'+extra);
  return true;
 }
 const installPlaceIntent=()=>{
  if(typeof VoiceAssistant==='undefined'||VoiceAssistant.__poiRouteV56)return false;
  VoiceAssistant.__poiRouteV56=true;
  const orig=VoiceAssistant.handleFlexibleIntent;
  if(typeof orig==='function'){
   VoiceAssistant.handleFlexibleIntent=async function(command,normalized){
    const q=placeQuery(command); if(q)return answerPlaceAlongRoute(q);
    return orig.call(this,command,normalized);
   };
  }
  const origAI=VoiceAssistant.askAI;
  if(typeof origAI==='function'&&!origAI.__poiV56){
   const wrapped=async function(question,...rest){const q=placeQuery(question);if(q)return answerPlaceAlongRoute(q);return origAI.call(this,question,...rest);};wrapped.__poiV56=true;VoiceAssistant.askAI=wrapped;
  }
  return true;
 };
 if(!installPlaceIntent()){let n=0,id=setInterval(()=>{if(installPlaceIntent()||++n>60)clearInterval(id)},250)}

 window.RadarMapCleanV56={hideGeneralTraffic,searchAlongRoute,reverseFresh};
 console.info('Radar v56 mapa limpo, localização fresca e POI na rota ativos');
})();
</script>
'''
pos=s.lower().rfind('</body>')
if pos<0: raise SystemExit('body final nao encontrado')
s=s[:pos]+patch+s[pos:]
p.write_text(s,encoding='utf-8')
print('patch v56 aplicado')
