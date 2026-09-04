/* Radar Seguro RJ PRO v135 — segurança orienta as opções sem escolher automaticamente */
(()=>{'use strict';if(window.__radarRouteSafetyV135)return;window.__radarRouteSafetyV135=true;
let lastDecision='';
function app(){return window.RadarApp||window.App||null;}
function alt(){return window.RadarRouteAlternativesV116||null;}
function routeKey(c){if(!Array.isArray(c)||!c.length)return'';return[.18,.38,.58,.78,.92].map(f=>c[Math.min(c.length-1,Math.floor((c.length-1)*f))]).map(p=>`${(+p[0]).toFixed(3)},${(+p[1]).toFixed(3)}`).join('|');}
function destinationKey(a){const d=a?.destination,e=Array.isArray(d)?d:[d?.lon??d?.lng,d?.lat];return `${Number(e?.[0]).toFixed(4)},${Number(e?.[1]).toFixed(4)}`;}
async function evaluate(){const a=app(),api=alt();if(!a?.route?.coords?.length||!a.destination||!api?.current)return;if(window.RadarRouteChoiceLock?.active)return;const decision=destinationKey(a)+'|'+routeKey(a.route.coords);if(decision===lastDecision)return;lastDecision=decision;const items=api.current();if(!items?.length)return;const safer=items.find(x=>x?.safer&&x?.risk?.score===0);if(safer)console.info('Radar v135: alternativa mais segura disponível para escolha do motorista',safer.id);}
function schedule(){clearTimeout(window.__radarSafetyTimer);window.__radarSafetyTimer=setTimeout(evaluate,1800);}
function install(){const a=app();if(!a)return false;if(a.__routeSafetyV135)return true;a.__routeSafetyV135=true;const old=typeof a.drawRoute==='function'?a.drawRoute.bind(a):null;if(old)a.drawRoute=function(...args){const out=old(...args);schedule();return out;};setTimeout(schedule,2200);return true;}
let n=0,t=setInterval(()=>{if(install()||++n>180)clearInterval(t);},200);window.RadarRouteSafetyV133={evaluate,version:'135-driver-choice'};})();