/* Radar Seguro RJ PRO v133 — decisão conservadora de rota: TomTom rápido + segurança local */
(()=>{'use strict';if(window.__radarRouteSafetyV133)return;window.__radarRouteSafetyV133=true;
let lastDecision='',busy=false;
function app(){return window.RadarApp||window.App||null;}
function alt(){return window.RadarRouteAlternativesV116||null;}
function routeKey(c){if(!Array.isArray(c)||!c.length)return'';return[.18,.38,.58,.78,.92].map(f=>c[Math.min(c.length-1,Math.floor((c.length-1)*f))]).map(p=>`${(+p[0]).toFixed(3)},${(+p[1]).toFixed(3)}`).join('|');}
function destinationKey(a){const d=a?.destination,e=Array.isArray(d)?d:[d?.lon??d?.lng,d?.lat];return `${Number(e?.[0]).toFixed(4)},${Number(e?.[1]).toFixed(4)}`;}
function activeSeconds(a){return Number(a?.route?.duration||a?.route?.time||0);}
function activeKm(a){const c=a?.route?.coords||[];let d=0;const R=6371,r=x=>x*Math.PI/180;for(let i=1;i<c.length;i++){const x=c[i-1],y=c[i],d1=r(y[1]-x[1]),d2=r(y[0]-x[0]),q=Math.sin(d1/2)**2+Math.cos(r(x[1]))*Math.cos(r(y[1]))*Math.sin(d2/2)**2;d+=2*R*Math.asin(Math.sqrt(q));}return d;}
async function evaluate(){if(busy)return;const a=app(),api=alt();if(!a?.route?.coords?.length||!a.destination||!api?.current||!api?.chooseById)return;if(window.RadarRouteChoiceLock?.active)return;const decision=destinationKey(a)+'|'+routeKey(a.route.coords);if(decision===lastDecision)return;const items=api.current();if(!items?.length)return;
/* O módulo de alternativas v132 marca safer somente quando a rota ativa cruza uma área de comunidade e a alternativa não cruza. Aqui só promovemos se a alternativa segura também for competitiva. */
const sec=activeSeconds(a),km=activeKm(a),safe=items.filter(x=>x?.safer&&x?.risk?.score===0&&Number.isFinite(+x.sec)&&Number.isFinite(+x.km)).sort((x,y)=>x.sec-y.sec)[0];if(!safe){lastDecision=decision;return;}
const extraSec=sec>0?safe.sec-sec:0,extraKm=km>0?safe.km-km:0;const timeOK=sec<=0||extraSec<=Math.max(240,sec*.12);const distanceOK=km<=0||safe.km<=km*1.18+1.5;
if(!timeOK||!distanceOK){lastDecision=decision;return;}
busy=true;lastDecision=decision;try{console.info('Radar v133: promovendo rota segura competitiva',{extraMin:Math.round(extraSec/60),extraKm:+extraKm.toFixed(1)});await api.chooseById(safe.id);}catch(e){console.warn('Radar v133 segurança de rota',e);}finally{busy=false;}}
function schedule(){clearTimeout(window.__radarSafetyTimer);window.__radarSafetyTimer=setTimeout(evaluate,1900);}
function install(){const a=app();if(!a)return false;if(a.__routeSafetyV133)return true;a.__routeSafetyV133=true;const old=typeof a.drawRoute==='function'?a.drawRoute.bind(a):null;if(old)a.drawRoute=function(...args){const out=old(...args);schedule();return out;};setTimeout(schedule,2500);return true;}
let n=0,t=setInterval(()=>{n++;if(install()||n>180)clearInterval(t);},200);window.RadarRouteSafetyV133={evaluate,version:'133-conservative'};})();