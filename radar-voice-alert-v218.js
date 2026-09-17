/* Radar Seguro RJ PRO v218 — avisos sonoros isolados somente para radares.
   Lombadas e semáforos continuam apenas com o comportamento existente. */
(()=>{'use strict';
if(window.__radarVoiceAlertV218)return;window.__radarVoiceAlertV218=true;
const app=()=>{try{return window.RadarApp||window.App||null}catch(_){return null}};
const point=p=>Array.isArray(p)&&p.length>=2&&Number.isFinite(+p[0])&&Number.isFinite(+p[1]);
const rad=d=>d*Math.PI/180;
function distM(a,b){if(!point(a)||!point(b))return Infinity;const R=6371000,p1=rad(+a[1]),p2=rad(+b[1]),d1=p2-p1,d2=rad(+b[0]-+a[0]);const q=Math.sin(d1/2)**2+Math.cos(p1)*Math.cos(p2)*Math.sin(d2/2)**2;return 2*R*Math.asin(Math.min(1,Math.sqrt(q)));}
function speak(t){try{if(window.Voice?.speak)return window.Voice.speak(t,true);}catch(_){}try{const u=new SpeechSynthesisUtterance(t);u.lang='pt-BR';speechSynthesis.speak(u);}catch(_){}}
const state=new Map();
function key(h){return String(h?.id||h?.osmId||h?.coords?.join(',')||h?.routeIndex||'radar');}
function userPoint(a){return point(a?.matchedUserPos)?a.matchedUserPos:point(a?.userPos)?a.userPos:point(a?.filteredPos)?a.filteredPos:point(a?.rawUserPos)?a.rawUserPos:null;}
function tick(){const a=app();if(!a?.navActive||!a?.route)return;const p=userPoint(a);if(!point(p))return;const idx=Number.isFinite(+a.routeProgressIndex)?+a.routeProgressIndex:0;for(const h of(a.routeHazards||[])){if(h?.type!=='radar'||!point(h.coords))continue;if(Number.isFinite(+h.routeIndex)&&+h.routeIndex<idx-3)continue;const d=distM(p,h.coords);if(!Number.isFinite(d)||d>900)continue;const k=key(h),s=state.get(k)||{far:false,near:false};
/* Primeiro aviso: adaptado à velocidade, aproximadamente 15–20 s antes, limitado a 300–500 m. */
const kmh=Math.max(0,+a.currentSpeed||0),dynamic=Math.max(300,Math.min(500,(kmh/3.6)*18)),far=Math.round(dynamic/25)*25;
if(!s.far&&d<=far&&d>125){s.far=true;speak(`Atenção, radar à frente, aproximadamente ${far} metros.`);}
if(!s.near&&d<=110){s.near=true;speak('Radar a 100 metros.');}
state.set(k,s);}}
function resetIfNeeded(){const a=app();if(!a?.navActive)state.clear();}
setInterval(()=>{try{tick();resetIfNeeded();}catch(_){}},650);
window.RadarVoiceAlertV218={version:'218',reset:()=>state.clear()};
})();