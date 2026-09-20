/* Radar Seguro RJ PRO v227 — ponte mínima Gemini -> VoiceAssistant, sem tocar na busca/navegação. */
(()=>{'use strict';
if(window.__radarGeminiRouteBridgeV227)return;window.__radarGeminiRouteBridgeV227=true;
function install(){
 const g=window.RadarAiToolsV224;
 const va=window.VoiceAssistant;
 if(!g||typeof g.execute!=='function'||typeof va?.routeTo!=='function')return false;
 if(g.__routeBridgeV227)return true;
 const prev=g.execute.bind(g);
 g.execute=async function(name,args={}){
   if(name!=='start_route')return prev(name,args);
   const destination=String(args.destination||'').trim();
   if(!destination)throw new Error('Destino vazio');
   await va.routeTo(destination);
   const a=window.RadarApp||window.App;
   return {started:!!(a?.route&&a?.navActive),navigationActive:!!a?.navActive,destination};
 };
 g.__routeBridgeV227=true;
 return true;
}
if(!install()){let n=0,t=setInterval(()=>{if(install()||++n>120)clearInterval(t)},100)}
})();