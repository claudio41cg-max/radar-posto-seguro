/* Radar Seguro RJ PRO v226 — restaura a ponte comprovada IA -> VoiceAssistant do Radar. */
(()=>{'use strict';
if(window.__radarAiToolsV226)return;window.__radarAiToolsV226=true;
const old=window.RadarAiToolsV224;
if(!old)return;
const originalExecute=old.execute.bind(old);
async function execute(name,args={}){
  if(name!=='start_route') return originalExecute(name,args);
  const destination=String(args.destination||'').trim();
  if(!destination) throw new Error('Destino vazio');
  const va=window.VoiceAssistant;
  if(typeof va?.routeTo!=='function') throw new Error('Navegacao por voz do Radar indisponivel');
  await va.routeTo(destination);
  const a=window.RadarApp||window.App;
  const active=!!a?.navActive && !!a?.route;
  if(!active) throw new Error('O Radar recebeu o destino, mas a navegacao nao iniciou');
  return {started:true,navigationActive:true,provider:'Radar Seguro',destination};
}
window.RadarAiToolsV224={...old,version:'226-voiceassistant-bridge',execute};
})();