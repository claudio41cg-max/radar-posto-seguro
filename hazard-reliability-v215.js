/* Radar Seguro RJ PRO v215 — garante nova busca dos hazards da rota sem mudar os dados/filtros v211. */
(()=>{'use strict';if(window.__radarHazardReliabilityV215)return;window.__radarHazardReliabilityV215=true;
const app=()=>{try{return window.RadarApp||window.App||null}catch(_){return null}};let sig='';
function routeSig(a){const c=a?.route?.coords;if(!Array.isArray(c)||c.length<2)return'';const f=c[0],l=c[c.length-1];return `${c.length}|${Number(f?.[0]).toFixed(5)},${Number(f?.[1]).toFixed(5)}|${Number(l?.[0]).toFixed(5)},${Number(l?.[1]).toFixed(5)}`}
function request(a){if(!a?.route?.coords?.length||typeof a.fetchHazardsAlongRoute!=='function')return;[150,900,2600,6000].forEach(ms=>setTimeout(()=>{const x=app();if(!x?.route?.coords?.length)return;if((x.routeHazards||[]).length&&ms>900)return;try{x.fetchHazardsAlongRoute()}catch(_){}},ms))}
let n=0,t=setInterval(()=>{n++;const a=app();if(a?.map){const s=routeSig(a);if(s&&s!==sig){sig=s;request(a)}else if(!s)sig='';}if(n>12000)clearInterval(t)},350);
window.RadarHazardReliabilityV215={version:'215',refresh:()=>request(app())};})();