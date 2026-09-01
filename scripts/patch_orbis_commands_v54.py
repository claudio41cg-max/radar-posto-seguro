from pathlib import Path
import re
p=Path('index.html')
s=p.read_text(encoding='utf-8')
s=re.sub(r'<meta name="radar-build" content="[^"]+">','<meta name="radar-build" content="54-orbis-commands">',s,count=1)
marker='RADAR_ORBIS_V54'
if marker in s:
    print('v54 ja aplicado'); raise SystemExit(0)
patch=r'''
<script id="radar-orbis-v54">
/* RADAR_ORBIS_V54 — usa TomTom Orbis v3 para rota/trânsito sem alterar o núcleo de navegação. */
(()=>{
 const WORKER='https://radar-seguro-ia-rj.claudio41cg.workers.dev';
 const norm=t=>(t||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
 async function orbisRoute(a,b,alternatives=2){
   const body={routePlanningLocations:{origin:{type:'Point',coordinates:[Number(a[0]),Number(a[1])]},destination:{type:'Point',coordinates:[Number(b[0]),Number(b[1])]}},travelMode:'car',routeType:'fast',traffic:'live',departureDateTime:'now',maxPathAlternativeRoutes:Math.max(0,Math.min(5,alternatives))};
   const path='/maps/orbis/routing/routes/calculate?apiVersion=3';
   const r=await fetch(WORKER+'/v1/tomtom?path='+encodeURIComponent(path),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),cache:'no-store'});
   if(!r.ok) throw new Error('TomTom Orbis '+r.status);
   return r.json();
 }
 function summary(rt){const x=rt?.summary||{};return {travelSec:Number(x.travelDurationInSeconds||x.travelTimeInSeconds||0),delaySec:Number(x.trafficDelayDurationInSeconds||x.trafficDelayInSeconds||0),distance:Number(x.lengthInMeters||0),trafficLength:Number(x.trafficLengthInMeters||0)};}
 window.RadarTomTomV54={orbisRoute,summary};
 // O v51 consulta trânsito pela rota antiga. Troca somente o snapshot por Orbis v3.
 const install=()=>{
   if(typeof TrafficAssistantV40==='undefined'||TrafficAssistantV40.__orbisV54)return false;
   TrafficAssistantV40.__orbisV54=true;
   TrafficAssistantV40.getTrafficSnapshot=async function(){
     if(!Array.isArray(App?.userPos)||!App?.destination) throw new Error('rota/localizacao indisponivel');
     const d=await orbisRoute(App.userPos,App.destination,0); const rt=d?.routes?.[0]; if(!rt)throw new Error('sem rota Orbis');
     const x=summary(rt); return {...x,route:rt,source:'tomtom-orbis-v3'};
   };
   return true;
 };
 if(!install()){let n=0;const id=setInterval(()=>{if(install()||++n>40)clearInterval(id)},250);}
 // Amplia frases naturais sem interferir no reconhecimento/microfone.
 if(typeof VoiceAssistant!=='undefined' && !VoiceAssistant.__trafficIntentV54){
   VoiceAssistant.__trafficIntentV54=true;
 }
 window.RadarTrafficIntentV54=t=>{const q=norm(t);return /\b(transito|engarraf|retenc|congestion|travado|travada|parado|parada|lento|lenta|fluxo|trafego|trafico)\b/.test(q)&&/\b(aqui|agora|frente|caminho|rota|trajeto|via|rua|avenida|ate|indo|destino|como|tem|esta|ta)\b/.test(q);};
 console.info('Radar TomTom Orbis v54 ativo');
})();
</script>
'''
pos=s.lower().rfind('</body>')
if pos<0: raise SystemExit('body final nao encontrado')
s=s[:pos]+patch+s[pos:]
p.write_text(s,encoding='utf-8')
print('patch v54 aplicado')
