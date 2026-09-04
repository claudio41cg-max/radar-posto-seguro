/* Radar Seguro RJ PRO v134 — seleção final de rota: alternativas somem após escolha */
(()=>{'use strict';if(window.__radarAltChoiceV134)return;window.__radarAltChoiceV134=true;
const app=()=>window.RadarApp||window.App||null;
function hideAlternatives(){try{window.RadarRouteAlternativesV116?.clear?.();}catch(_){}window.RadarRouteChoiceLock={active:true,chosenAt:Date.now(),until:Date.now()+45*60*1000,allowMajor:false,hideAlternatives:true};}
function install(){const api=window.RadarRouteAlternativesV116,a=app();if(!api||!a)return false;if(api.__choiceV134)return true;api.__choiceV134=true;const old=api.chooseById?.bind(api);if(old)api.chooseById=async function(id){const r=await old(id);setTimeout(hideAlternatives,1200);return r;};
/* Captura o toque diretamente nas camadas alternativas, inclusive handlers antigos. */
const m=a.map;if(m&&!m.__choiceV134){m.__choiceV134=true;const handler=()=>setTimeout(hideAlternatives,1500);for(const id of['route-alt-v132-hit','route-alt-v132-line','route-alt-v132-label'])try{m.on?.('click',id,handler);}catch(_){}}
/* Se o usuário já escolheu uma rota, não redesenha opções durante a viagem. */
const oldRefresh=api.refresh?.bind(api);if(oldRefresh)api.refresh=function(...args){if(window.RadarRouteChoiceLock?.hideAlternatives)return Promise.resolve([]);return oldRefresh(...args);};return true;}
let n=0,t=setInterval(()=>{if(install()||++n>200)clearInterval(t);},200);window.RadarRouteChoiceV134={hideAlternatives,version:'134-final-choice'};})();