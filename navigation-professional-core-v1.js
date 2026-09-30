/* Radar Seguro RJ PRO — núcleo de navegação consolidado inspirado em SDKs maduros.
   Princípios:
   1) Rota pertence exclusivamente ao RadarRouting.
   2) Este módulo consome a rota TomTom somente para guidance.
   3) Voz de manobra usa os announcement points retornados pela TomTom.
   4) GPS/continuidade pertencem exclusivamente ao RadarGPS.
*/
(()=>{
'use strict';
if(window.__radarProfessionalCoreV1)return;
window.__radarProfessionalCoreV1=true;

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

/* A autoridade de rota foi movida para core/radar-routing-v1.js.
   Este arquivo não cria, recalcula ou substitui rotas. */

/* GPS continuity foi removida deste módulo.
   RadarGPS é agora o único dono de gps.position/gps.continuity.
   Este núcleo continua responsável apenas por rota TomTom + guidance. */

function install(){
  const a=app();
  if(!a?.map)return false;
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