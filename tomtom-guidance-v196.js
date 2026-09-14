/* Radar Seguro RJ PRO v196 — orientação falada guiada pelos announcement points da TomTom.
   Remove os gatilhos fixos 350/120/35 para rotas TomTom v196, preservando alertas do Radar. */
(()=>{
'use strict';
if(window.__radarTomTomGuidanceV196)return;
window.__radarTomTomGuidanceV196=true;
const app=()=>{try{return window.RadarApp||window.App||null}catch(_){return null}};
let routeRef=null,events=[],rawSpeak=null,lastNativeSpeakAt=0,voiceWrapped=false;
const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ').trim();
function isOurRoute(a){return !!(a?.route&&a.route.engine==='tomtom'&&String(a.route.routingVersion||'').startsWith('196-'));}
function isArrival(i){const m=String(i?.maneuver||'').toUpperCase();return m.startsWith('ARRIVE')||String(i?.instructionType||'').toUpperCase()==='LOCATION_ARRIVAL';}
function isDeparture(i){return String(i?.maneuver||'').toUpperCase()==='DEPART'||String(i?.instructionType||'').toUpperCase()==='LOCATION_DEPARTURE';}
function build(route){
  routeRef=route;events=[];
  const ins=route?.tomtomRoute?.guidance?.instructions||[];
  ins.forEach((i,idx)=>{
    if(isArrival(i)||isDeparture(i))return;
    const offset=Math.max(0,Number(i.routeOffsetInMeters)||0),parts=[['early',i.earlyWarningAnnouncement],['main',i.mainAnnouncement],['confirmation',i.confirmationAnnouncement]];
    for(const [phase,p] of parts){
      if(!p||!Number.isFinite(+p.distanceInMeters))continue;
      const d=Math.max(0,+p.distanceInMeters),trigger=Math.max(0,offset-d);
      events.push({id:`${idx}:${phase}`,idx,phase,trigger,offset,d,instruction:i,spoken:false});
    }
  });
  events.sort((a,b)=>a.trigger-b.trigger||a.offset-b.offset);
}
function roundedDistance(m){m=Math.max(0,Math.round(m));if(m<100)return Math.max(10,Math.round(m/10)*10);if(m<1000)return Math.max(50,Math.round(m/50)*50);return Math.round(m/100)*100;}
function textFor(e,progress){
  const i=e.instruction||{},base=String((e.phase==='early'&&i.combinedMessage)||i.message||'').trim();
  if(!base)return'';
  if(e.phase==='confirmation')return base;
  const remain=Math.max(0,e.offset-progress),d=roundedDistance(remain);
  if(d<=0)return base;
  if(d>=1000&&d%1000===0)return`Em ${d/1000} quilômetro${d>=2000?'s':''}, ${base.charAt(0).toLowerCase()+base.slice(1)}`;
  return`Em ${d} metros, ${base.charAt(0).toLowerCase()+base.slice(1)}`;
}
function shouldSuppressLegacy(text){
  const a=app();if(!isOurRoute(a)||!a.navActive||!events.length)return false;
  const s=norm(text);if(!s)return false;
  if(s.startsWith('atencao')||s.includes('comunidade')||s.includes('transito')||s.includes('radar')||s.includes('velocidade')||s.startsWith('voce chegou')||s.includes('recalcul'))return false;
  if(/^em\s+\d+\s+(?:metros?|quilometros?)/.test(s))return true;
  if(/^(?:vire|siga|continue|mantenha|pegue|entre|saia|acesse|faca|retorne|converta|use|prossiga|contorne|na rotatoria|na rotatória)\b/.test(s))return true;
  const names=(a.route?.steps||[]).slice(Math.max(0,(a.activeGuidanceStep||0)-1),(a.activeGuidanceStep||0)+4).map(x=>norm(x?.name)).filter(x=>x.length>=5&&x!=='siga pela via');
  return names.some(n=>s.includes(n));
}
function wrapVoice(){
  if(voiceWrapped)return true;
  const v=window.Voice;if(!v||typeof v.speak!=='function')return false;
  rawSpeak=v.speak.bind(v);
  v.speak=function(text,priority=false){if(shouldSuppressLegacy(text))return;return rawSpeak(text,priority);};
  voiceWrapped=true;return true;
}
function speakNative(text){if(!text||!rawSpeak)return;lastNativeSpeakAt=Date.now();rawSpeak(text,true);}
function markPassed(progress){for(const e of events)if(!e.spoken&&progress>e.offset+35)e.spoken=true;}
function tick(){
  const a=app();wrapVoice();
  if(!a?.route){routeRef=null;events=[];return;}
  if(a.route!==routeRef)build(a.route);
  if(!isOurRoute(a)||!a.navActive||!events.length||!rawSpeak)return;
  const progress=Math.max(0,Number(a.routeProgressMeters)||0);markPassed(progress);
  if(Date.now()-lastNativeSpeakAt<950)return;
  const due=events.filter(e=>!e.spoken&&progress+7>=e.trigger&&progress<=e.offset+25);
  if(!due.length)return;
  const firstOffset=Math.min(...due.map(e=>e.offset));
  const sameTurn=due.filter(e=>Math.abs(e.offset-firstOffset)<3).sort((x,y)=>y.trigger-x.trigger);
  const chosen=sameTurn[0];
  for(const e of events)if(e.idx===chosen.idx&&e.trigger<=chosen.trigger+1)e.spoken=true;
  const text=textFor(chosen,progress);if(text)speakNative(text);
}
const timer=setInterval(tick,220);
window.addEventListener('pagehide',()=>clearInterval(timer),{once:true});
window.RadarTomTomGuidanceV196={version:'196',rebuild:()=>{const a=app();if(a?.route)build(a.route);},events:()=>events.map(e=>({phase:e.phase,trigger:e.trigger,offset:e.offset,spoken:e.spoken}))};
})();
