/* Radar Seguro RJ PRO — núcleo de navegação consolidado inspirado em SDKs maduros.
   Princípios:
   1) TomTom é a única autoridade de rota/manobras.
   2) Voz de manobra usa os announcement points retornados pela TomTom.
   3) A lógica legada 350/120/35 é silenciada, sem afetar alertas Radar.
   4) Perda curta de GPS usa continuidade conservadora sem redesenhar rota/HUD a cada segundo.
*/
(()=>{
'use strict';
if(window.__radarProfessionalCoreV1)return;
window.__radarProfessionalCoreV1=true;

const WORKER='https://radar-seguro-ia-rj.claudio41cg.workers.dev';
const app=()=>{try{return window.RadarApp||window.App||null}catch(_){return null}};
const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ').trim();

let routeRef=null;
let events=[];
let rawSpeak=null;
let voiceWrapped=false;
let lastTomTomSpeakAt=0;

function isTomTomRoute(a){
  return !!(a?.route&&a.route.engine==='tomtom'&&a.route.tomtomRoute);
}
function isArrival(i){
  const m=String(i?.maneuver||'').toUpperCase();
  return m.startsWith('ARRIVE')||String(i?.instructionType||'').toUpperCase()==='LOCATION_ARRIVAL';
}
function isDeparture(i){
  const m=String(i?.maneuver||'').toUpperCase();
  return m==='DEPART'||String(i?.instructionType||'').toUpperCase()==='LOCATION_DEPARTURE';
}
function buildEvents(route){
  routeRef=route;events=[];
  const ins=route?.tomtomRoute?.guidance?.instructions||[];
  ins.forEach((i,idx)=>{
    if(isArrival(i)||isDeparture(i))return;
    const offset=Math.max(0,Number(i.routeOffsetInMeters)||0);
    const phases=[
      ['early',i.earlyWarningAnnouncement],
      ['main',i.mainAnnouncement],
      ['confirmation',i.confirmationAnnouncement]
    ];
    for(const [phase,p] of phases){
      if(!p||!Number.isFinite(+p.distanceInMeters))continue;
      const d=Math.max(0,+p.distanceInMeters);
      const trigger=Math.max(0,offset-d);
      events.push({id:idx+':'+phase,idx,phase,trigger,offset,d,instruction:i,spoken:false});
    }
  });
  events.sort((a,b)=>a.trigger-b.trigger||a.offset-b.offset);
}
function roundedDistance(m){
  m=Math.max(0,Math.round(m));
  if(m<100)return Math.max(10,Math.round(m/10)*10);
  if(m<1000)return Math.max(50,Math.round(m/50)*50);
  return Math.round(m/100)*100;
}
function instructionText(e,progress){
  const i=e.instruction||{};
  const base=String((e.phase==='early'&&i.combinedMessage)||i.message||'').trim();
  if(!base)return'';
  if(e.phase==='confirmation')return base;
  const remain=Math.max(0,e.offset-progress);
  const d=roundedDistance(remain);
  if(d<=0)return base;
  if(d>=1000&&d%1000===0){
    const km=d/1000;
    return 'Em '+km+' quilômetro'+(km===1?'':'s')+', '+base.charAt(0).toLowerCase()+base.slice(1);
  }
  return 'Em '+d+' metros, '+base.charAt(0).toLowerCase()+base.slice(1);
}
function legacyManeuverVoice(text){
  const a=app();
  if(!a?.navActive||!isTomTomRoute(a))return false;
  const s=norm(text);
  if(!s)return false;
  // Alertas próprios do Radar continuam permitidos.
  if(
    s.startsWith('atencao')||
    s.includes('comunidade')||
    s.includes('radar')||
    s.includes('transito')||
    s.includes('velocidade')||
    s.includes('rota mais rapida')||
    s.includes('voce chegou')||
    s.includes('recalcul')
  )return false;
  // Bloqueia apenas a navegação falada legada.
  if(/^em\s+\d+(?:[.,]\d+)?\s+(?:metros?|quilometros?)/.test(s))return true;
  if(/^(?:vire|siga|continue|mantenha|pegue|entre|saia|acesse|faca|faça|retorne|converta|use|prossiga|contorne|na rotatoria|na rotatória)\b/.test(s))return true;
  return false;
}
function wrapVoice(){
  if(voiceWrapped)return true;
  const v=window.Voice;
  if(!v||typeof v.speak!=='function')return false;
  rawSpeak=v.speak.bind(v);
  v.speak=function(text,priority=false){
    if(legacyManeuverVoice(text))return;
    return rawSpeak(text,priority);
  };
  voiceWrapped=true;
  return true;
}
function speakTomTom(text){
  if(!text||!rawSpeak)return;
  lastTomTomSpeakAt=Date.now();
  rawSpeak(text,true);
}
function markPassed(progress){
  for(const e of events){
    if(!e.spoken&&progress>e.offset+40)e.spoken=true;
  }
}
function guidanceTick(){
  const a=app();
  wrapVoice();
  if(!a?.route){routeRef=null;events=[];return;}
  if(a.route!==routeRef)buildEvents(a.route);
  if(!isTomTomRoute(a)||!a.navActive||!events.length||!rawSpeak)return;
  const progress=Math.max(0,Number(a.routeProgressMeters)||0);
  markPassed(progress);
  if(Date.now()-lastTomTomSpeakAt<900)return;
  const due=events.filter(e=>!e.spoken&&progress+8>=e.trigger&&progress<=e.offset+30);
  if(!due.length)return;
  const firstOffset=Math.min(...due.map(e=>e.offset));
  const sameTurn=due.filter(e=>Math.abs(e.offset-firstOffset)<3).sort((x,y)=>y.trigger-x.trigger);
  const chosen=sameTurn[0];
  // Marca fases anteriores da mesma manobra para não repetir.
  for(const e of events){
    if(e.idx===chosen.idx&&e.trigger<=chosen.trigger+1)e.spoken=true;
  }
  const text=instructionText(chosen,progress);
  if(text)speakTomTom(text);
}

async function fetchTomTomAuthoritative(a,b){
  const A=app();
  if(!A)throw new Error('Radar indisponível');
  const mode=A.transportMode==='motorcycle'?'motorcycle':'car';
  const path='/routing/1/calculateRoute/'+a[1]+','+a[0]+':'+b[1]+','+b[0]+
    '/json?traffic=true&travelMode='+encodeURIComponent(mode)+
    '&instructionsType=text&language=pt-BR&routeType=fastest&avoid=unpavedRoads&computeTravelTimeFor=all&maxAlternatives=2';
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),9000);
  try{
    const r=await fetch(WORKER+'/v1/tomtom?path='+encodeURIComponent(path),{signal:controller.signal,cache:'no-store'});
    if(!r.ok)throw new Error('TomTom HTTP '+r.status);
    const j=await r.json();
    if(!j.routes?.length)throw new Error('TomTom sem rota');
    const rt=j.routes[0];
    const coords=(rt.legs||[]).flatMap(leg=>(leg.points||[]).map(p=>[p.longitude,p.latitude]));
    const steps=(rt.guidance?.instructions||[]).map(i=>({
      name:i.street||i.roadNumbers?.[0]||'Siga pela via',
      maneuver:{
        type:i.maneuver||'',
        modifier:typeof A.tomTomModifier==='function'?A.tomTomModifier(i.maneuver):'straight',
        location:[i.point?.longitude,i.point?.latitude]
      },
      routeOffsetMeters:Number(i.routeOffsetInMeters)||0,
      tomtomInstruction:i
    }));
    const route={
      coords,
      steps,
      distance:Number(rt.summary?.lengthInMeters)||0,
      duration:Number(rt.summary?.travelTimeInSeconds)||0,
      trafficDelaySeconds:Number(rt.summary?.trafficDelayInSeconds||0),
      liveTraffic:true,
      engine:'tomtom',
      routingVersion:'professional-v1',
      tomtomRoute:rt
    };
    if(typeof A.prepareRouteGeometry==='function')A.prepareRouteGeometry(route);
    return route;
  }finally{clearTimeout(timeout);}
}

function installTomTomAuthority(a){
  if(a.__professionalTomTomV1)return;
  a.__professionalTomTomV1=true;
  a.fetchTomTomRoute=fetchTomTomAuthoritative;
  a.getRoute=async function(start,destination){
    // Sem fallback silencioso: se TomTom falhar, o Radar avisa em vez de inventar outra rota.
    return await fetchTomTomAuthoritative(start,destination);
  };
}

function installGpsGapPolicy(a){
  if(a.__professionalGpsGapV1)return;
  a.__professionalGpsGapV1=true;
  a.continueDuringGPSGap=function(){
    if(!this.navActive||!this.route?.cumulative?.length||!this.lastGPSAt||this.rerouting)return;
    const gapMs=Date.now()-this.lastGPSAt;
    if(gapMs<=2200)return;
    if(gapMs>8000||this.lastTrustedSpeed<6||this.currentAccuracy>50){
      if(gapMs>8000)this.setGPSStatus?.(false,'GPS...');
      return;
    }
    const speedMps=this.lastTrustedSpeed/3.6;
    const advance=Math.min(45,speedMps*(gapMs/1000));
    const total=this.route.cumulative[this.route.cumulative.length-1]||0;
    const target=Math.min(total,this.lastTrustedProgressMeters+advance);
    if(target<=this.routeProgressMeters+.5)return;
    const index=this.findIndexForOffset(this.route,target);
    const nextIndex=Math.min(index+1,this.route.coords.length-1);
    const p0=this.route.coords[index],p1=this.route.coords[nextIndex];
    if(!p0||!p1)return;
    const d0=this.route.cumulative[index]||0;
    const d1=this.route.cumulative[nextIndex]||d0;
    const t=Math.max(0,Math.min(1,(target-d0)/Math.max(1,d1-d0)));
    this.userPos=Utils.interpolatePoint(p0,p1,t);
    this.routeProgressIndex=Math.max(this.routeProgressIndex,index);
    this.routeProgressMeters=target;
    this.currentBearing=Utils.bearing(p0,p1);
    // Intencionalmente NÃO chama updateRemainingRouteLine/updateNavigation:
    // evita re-renderização e voz duplicada enquanto o GPS real está ausente.
    this.updateUserMarker?.();
    this.updateSpeedUI?.();
    this.setGPSStatus?.(true,'GPS EST.');
  };
}

function install(){
  const a=app();
  if(!a?.map)return false;
  installTomTomAuthority(a);
  installGpsGapPolicy(a);
  wrapVoice();
  if(!window.__radarProfessionalGuidanceTimer){
    window.__radarProfessionalGuidanceTimer=setInterval(guidanceTick,220);
  }
  return true;
}
let tries=0;
const boot=setInterval(()=>{tries++;if(install()||tries>300)clearInterval(boot)},100);
window.addEventListener('pagehide',()=>{try{clearInterval(window.__radarProfessionalGuidanceTimer)}catch(_){}},{once:true});
window.RadarProfessionalCoreV1={
  version:'1',
  rebuild:()=>{const a=app();if(a?.route)buildEvents(a.route);},
  events:()=>events.map(e=>({id:e.id,phase:e.phase,trigger:e.trigger,offset:e.offset,spoken:e.spoken}))
};
})();