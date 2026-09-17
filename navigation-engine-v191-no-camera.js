/* Radar Seguro RJ PRO — v191 sem camera interna.
   Carrega o motor v191 preservando matching, progresso e recalculo, mas bloqueia somente
   os movimentos de camera feitos durante a inicializacao do v191. A camera externa v221
   passa a ser a unica dona do acompanhamento visual. */
(()=>{'use strict';
if(window.__radarNavigationEngineNoCameraLoader)return;window.__radarNavigationEngineNoCameraLoader=true;
const src='./navigation-engine-v191.js?v=221';
const app=()=>{try{return window.RadarApp||window.App||null}catch(_){return null}};
async function load(){
 const a=app(),m=a?.map;if(!m)throw new Error('mapa indisponivel');
 const rawEase=typeof m.easeTo==='function'?m.easeTo.bind(m):null;
 const rawJump=typeof m.jumpTo==='function'?m.jumpTo.bind(m):null;
 const rawFly=typeof m.flyTo==='function'?m.flyTo.bind(m):null;
 const block=()=>m;
 try{
  /* O v191 instala sua camera via chamadas imediatas/timers. Durante a instalacao,
     neutralizamos apenas camera; o restante do motor continua intacto. */
  if(rawEase)m.easeTo=block;if(rawJump)m.jumpTo=block;if(rawFly)m.flyTo=block;
  const r=await fetch(src,{cache:'no-store'});if(!r.ok)throw new Error('navigation-engine '+r.status);
  const code=await r.text();(0,eval)(code+'\n//# sourceURL=navigation-engine-v191.js');
 } finally {
  if(rawEase)m.easeTo=rawEase;if(rawJump)m.jumpTo=rawJump;if(rawFly)m.flyTo=rawFly;
 }
 /* A camera interna do v191 continua chamando easeTo depois da instalacao. Marcamos o mapa
    para o controlador unico filtrar essas chamadas enquanto a navegacao estiver ativa. */
 m.__radarV191InternalCameraDisabled=true;
 window.__RADAR_SINGLE_CAMERA_OWNER='v221';
}
let tries=0,t=setInterval(()=>{const a=app();if(a?.map){clearInterval(t);load().catch(e=>console.error('Radar v191 no-camera',e));}else if(++tries>300)clearInterval(t);},50);
})();