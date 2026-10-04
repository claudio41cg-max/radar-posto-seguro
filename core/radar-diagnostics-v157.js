/* Radar Seguro RJ PRO — diagnóstico canônico v157 */
/* RADAR_CANONICAL_GPS_DIAGNOSTICS_V59 — compatibilidade após modularização GPS.
   IMPORTANTE:
   - não abre um segundo getCurrentPosition por conta própria;
   - não sobrescreve window.RadarApp.userPos;
   - não monkeypatcha VoiceAssistant;
   - toda leitura canônica vem de RadarGPS.
*/
(()=>{
 'use strict';

 function valid(lat,lon){
   return Number.isFinite(Number(lat))&&
          Number.isFinite(Number(lon))&&
          Math.abs(Number(lat))<=90&&
          Math.abs(Number(lon))<=180;
 }

 function fromPos(pos,label){
   if(Array.isArray(pos)&&pos.length>=2&&valid(pos[1],pos[0])){
     return {lat:Number(pos[1]),lon:Number(pos[0]),source:label};
   }
   if(pos&&typeof pos==='object'){
     const lat=Number(pos.lat??pos.latitude??pos.coords?.latitude);
     const lon=Number(pos.lon??pos.lng??pos.longitude??pos.coords?.longitude);
     if(valid(lat,lon))return {lat,lon,source:label};
   }
   return null;
 }

 function appCandidates(){
   const out=[];
   try{
     [
       ['userPos',window.RadarApp?.userPos],
       ['filteredPos',window.RadarApp?.filteredPos],
       ['rawUserPos',window.RadarApp?.rawUserPos],
       ['lastPosition',window.RadarApp?.lastPosition],
       ['gpsPosition',window.RadarApp?.gpsPosition]
     ].forEach(([k,v])=>{
       const p=fromPos(v,k);
       if(p)out.push(p);
     });
   }catch(_){}
   return out;
 }

 async function canonicalGps(force=true){
   const gps=window.RadarGPS;
   if(!gps)return appCandidates()[0]||null;

   const fix=force
     ?await gps.fresh({timeout:8000,maximumAge:0,fallbackAge:15000})
     :gps.last(15000);

   return fix
     ?{...fix,source:force?'radar-gps-fresh':'radar-gps-last'}
     :(appCandidates()[0]||null);
 }

 window.RadarCanonicalGPS={
   get:canonicalGps,
   candidates:appCandidates,
   last:()=>window.RadarGPS?.last?.(15000)||null
 };

 window.RadarDebug59={
   async report(){
     const fresh=await canonicalGps(false);
     const candidates=appCandidates();
     const data={
       fresh,
       candidates,
       gpsModule:window.RadarGPS?.state?.()||null,
       kernel:window.RadarKernel?.diagnostics?.()||null
     };
     console.table(candidates);
     console.log('RADAR DEBUG V59',data);
     return data;
   }
 };

 console.info('Radar v59 compatível com RadarGPS; sem escrita em window.RadarApp.userPos.');
})();

