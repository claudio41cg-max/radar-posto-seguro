from pathlib import Path
import re
p=Path('index.html')
s=p.read_text(encoding='utf-8')
marker='RADAR_LOCATION_MAP_CLEAN_V55'
if marker in s:
 print('v55 ja aplicado'); raise SystemExit(0)
s=re.sub(r'<meta name="radar-build" content="[^"]+">','<meta name="radar-build" content="55-location-map-clean">',s,count=1)
patch=r'''
<script id="radar-location-map-clean-v55">
/* RADAR_LOCATION_MAP_CLEAN_V55 — localização legível + mapa de navegação mais limpo. */
(()=>{
 const WORKER='https://radar-seguro-ia-rj.claudio41cg.workers.dev';
 const installLocation=()=>{
  if(typeof VoiceAssistant==='undefined'||VoiceAssistant.__locationV55)return false;
  VoiceAssistant.__locationV55=true;
  VoiceAssistant.getCurrentAddress=async function(force=false){
   if(!Array.isArray(App?.userPos)||App.userPos.length<2)return null;
   const lon=Number(App.userPos[0]),lat=Number(App.userPos[1]);
   if(!Number.isFinite(lat)||!Number.isFinite(lon))return null;
   if(!force&&this.lastKnownAddress&&Date.now()-(this.lastKnownAddressAt||0)<45000)return {label:this.lastKnownAddress,lat,lon};
   let label='',street='',number='',district='',city='';
   try{
    const path='/search/2/reverseGeocode/'+lat+','+lon+'.json?language=pt-BR&radius=100';
    const r=await fetch(WORKER+'/v1/tomtom?path='+encodeURIComponent(path),{cache:'no-store'});
    const d=r.ok?await r.json():null,a=d?.addresses?.[0]?.address||{};
    street=a.streetName||a.street||''; number=a.streetNumber||'';
    district=a.municipalitySubdivision||a.localName||a.countrySecondarySubdivision||'';
    city=a.municipality||'';
    label=[street+(number?' '+number:''),district,city].filter((v,i,x)=>v&&x.indexOf(v)===i).join(', ');
    if(!street&&a.freeformAddress)label=a.freeformAddress;
   }catch(e){console.warn('reverse TomTom v55',e)}
   if(!label){
    try{
     const u='https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat='+encodeURIComponent(lat)+'&lon='+encodeURIComponent(lon)+'&zoom=18&addressdetails=1&accept-language=pt-BR';
     const r=await fetch(u,{headers:{'Accept-Language':'pt-BR,pt;q=.9'},cache:'no-store'}),d=r.ok?await r.json():null,a=d?.address||{};
     street=a.road||a.pedestrian||a.residential||a.highway||''; number=a.house_number||'';
     district=a.suburb||a.neighbourhood||a.quarter||a.city_district||''; city=a.city||a.town||a.municipality||'';
     label=[street+(number?' '+number:''),district,city].filter((v,i,x)=>v&&x.indexOf(v)===i).join(', ')||d?.display_name||'';
    }catch(e){console.warn('reverse OSM v55',e)}
   }
   if(label){this.lastKnownAddress=label;this.lastKnownAddressAt=Date.now();}
   return {label,street,number,district,city,lat,lon};
  };
  return true;
 };
 if(!installLocation()){let n=0,id=setInterval(()=>{if(installLocation()||++n>40)clearInterval(id)},250)}

 // Durante navegação, reduz a camada geral de trânsito: a rota escolhida continua destacada.
 function cleanTraffic(){
  if(!window.map||!document.body.classList.contains('nav-mode'))return;
  try{
   const st=map.getStyle?.(); if(!st?.layers)return;
   st.layers.forEach(l=>{
    const id=(l.id||'').toLowerCase(),src=(l.source||'').toString().toLowerCase();
    const isTraffic=(id.includes('traffic')||id.includes('flow')||src.includes('traffic')||src.includes('flow'));
    const isRoute=id.includes('route')||id.includes('radar-route');
    if(isTraffic&&!isRoute){
     try{map.setPaintProperty(l.id,'line-opacity',0.16)}catch(e){}
     try{map.setPaintProperty(l.id,'line-width',1.1)}catch(e){}
    }
   });
  }catch(e){console.warn('map clean v55',e)}
 }
 const schedule=()=>{setTimeout(cleanTraffic,400);setTimeout(cleanTraffic,1600)};
 if(window.map){map.on?.('styledata',schedule);map.on?.('idle',cleanTraffic)}
 new MutationObserver(schedule).observe(document.body,{attributes:true,attributeFilter:['class']});
 schedule();
 console.info('Radar v55 localização/mapa limpo ativo');
})();
</script>
'''
pos=s.lower().rfind('</body>')
if pos<0: raise SystemExit('body final nao encontrado')
s=s[:pos]+patch+s[pos:]
p.write_text(s,encoding='utf-8')
print('patch v55 aplicado')
