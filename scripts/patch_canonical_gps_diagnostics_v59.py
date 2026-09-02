from pathlib import Path
import re

p=Path('index.html')
s=p.read_text(encoding='utf-8')
marker='RADAR_CANONICAL_GPS_DIAGNOSTICS_V59'
if marker in s:
    print('v59 ja aplicado')
    raise SystemExit(0)

s=re.sub(r'<meta name="radar-build" content="[^"]+">','<meta name="radar-build" content="59-canonical-gps-diagnostics">',s,count=1)

patch=r'''
<script id="radar-canonical-gps-diagnostics-v59">
/* RADAR_CANONICAL_GPS_DIAGNOSTICS_V59
   Fonte canônica de GPS para assistente/POI e diagnóstico da malha visual.
   Não altera o núcleo da navegação nem o ciclo do microfone. */
(()=>{
 const norm=t=>String(t||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ').trim();
 const valid=(lat,lon)=>Number.isFinite(Number(lat))&&Number.isFinite(Number(lon))&&Math.abs(Number(lat))<=90&&Math.abs(Number(lon))<=180;
 const hav=(a,b)=>{const R=6371000,r=x=>x*Math.PI/180,d1=r(b.lat-a.lat),d2=r(b.lon-a.lon),q=Math.sin(d1/2)**2+Math.cos(r(a.lat))*Math.cos(r(b.lat))*Math.sin(d2/2)**2;return 2*R*Math.asin(Math.sqrt(q));};
 let lastFresh=null;

 function fromPos(pos,label){
   if(Array.isArray(pos)&&pos.length>=2&&valid(pos[1],pos[0])) return {lat:Number(pos[1]),lon:Number(pos[0]),source:label};
   if(pos&&typeof pos==='object'){
     const lat=Number(pos.lat??pos.latitude??pos.coords?.latitude),lon=Number(pos.lon??pos.lng??pos.longitude??pos.coords?.longitude);
     if(valid(lat,lon)) return {lat,lon,source:label};
   }
   return null;
 }
 function appCandidates(){
   const out=[];
   try{
     [['userPos',App?.userPos],['filteredPos',App?.filteredPos],['rawUserPos',App?.rawUserPos],['lastPosition',App?.lastPosition],['gpsPosition',App?.gpsPosition]].forEach(([k,v])=>{const p=fromPos(v,k);if(p)out.push(p)});
   }catch(e){}
   return out;
 }
 function browserGps(){
   return new Promise(resolve=>{
     if(!navigator.geolocation){resolve(null);return;}
     navigator.geolocation.getCurrentPosition(p=>{
       const x={lat:Number(p.coords.latitude),lon:Number(p.coords.longitude),accuracy:Number(p.coords.accuracy||0),source:'browser-fresh',at:Date.now()};
       if(valid(x.lat,x.lon)){lastFresh=x;resolve(x)}else resolve(null);
     },()=>resolve(null),{enableHighAccuracy:true,maximumAge:0,timeout:9000});
   });
 }
 async function canonicalGps(force=true){
   if(force){const f=await browserGps();if(f)return f;}
   if(lastFresh&&Date.now()-lastFresh.at<15000)return lastFresh;
   const c=appCandidates();
   return c[0]||null;
 }
 window.RadarCanonicalGPS={get:canonicalGps,candidates:appCandidates,last:()=>lastFresh};

 // Exibe diagnóstico somente quando chamado no console: RadarDebug59.report()
 function mapObj(){try{if(App?.map?.getStyle)return App.map}catch(e){};try{if(typeof map!=='undefined'&&map?.getStyle)return map}catch(e){};return null;}
 function layerReport(){
   const m=mapObj(),rows=[];if(!m)return rows;
   const st=m.getStyle?.()||{};
   for(const l of (st.layers||[])){
     if(l.type!=='line'&&l.type!=='raster')continue;
     let color='',width='',opacity='',src='';
     try{color=m.getPaintProperty(l.id,'line-color')}catch(e){}
     try{width=m.getPaintProperty(l.id,'line-width')}catch(e){}
     try{opacity=m.getPaintProperty(l.id,l.type==='raster'?'raster-opacity':'line-opacity')}catch(e){}
     try{src=JSON.stringify(st.sources?.[l.source]||{}).slice(0,500)}catch(e){}
     rows.push({id:l.id,type:l.type,source:l.source||'',color,width,opacity,sourceDef:src});
   }
   return rows;
 }
 window.RadarDebug59={
   async report(){
     const fresh=await canonicalGps(true),candidates=appCandidates();
     const destination=(()=>{try{return App?.destination}catch(e){return null}})();
     const data={fresh,candidates,destination,layers:layerReport()};
     console.table(candidates.map(x=>({...x,distanceFromFresh:fresh?Math.round(hav(fresh,x)):null})));
     console.table(data.layers);
     console.log('RADAR DEBUG V59',data);
     return data;
   }
 };

 function install(){
   if(typeof VoiceAssistant==='undefined'||VoiceAssistant.__canonicalGpsV59)return false;
   VoiceAssistant.__canonicalGpsV59=true;
   // Faz o getCurrentAddress consolidado usar sempre o GPS fresco quando possível.
   const prev=VoiceAssistant.getCurrentAddress?.bind(VoiceAssistant);
   VoiceAssistant.getCurrentAddress=async function(force=false){
     const gps=await canonicalGps(true);
     if(gps){
       try{
         // Sincroniza a posição pública consumida por módulos auxiliares; não toca em filtered/raw usados pelo navegador.
         if(typeof App!=='undefined') App.userPos=[gps.lon,gps.lat];
       }catch(e){}
     }
     return prev?prev(true):null;
   };
   return true;
 }
 if(!install()){let n=0;const id=setInterval(()=>{if(install()||++n>80)clearInterval(id)},250)}
 console.info('Radar v59 GPS canônico + diagnóstico ativo');
})();
</script>
'''

s=s.replace('</body>',patch+'\n</body>',1)
p.write_text(s,encoding='utf-8')
print('v59 aplicado')
