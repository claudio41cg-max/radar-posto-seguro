/* Radar Seguro RJ PRO — v191 sem camera interna.
   Preserva matching GPS, progresso, recálculo e chegada do v191. Somente a camera interna
   e neutralizada para que o controlador FOLLOW v221 seja o unico dono visual do mapa. */
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
  if(rawEase)m.easeTo=block;if(rawJump)m.jumpTo=block;if(rawFly)m.flyTo=block;
  const r=await fetch(src,{cache:'no-store'});if(!r.ok)throw new Error('navigation-engine '+r.status);
  const code=await r.text();(0,eval)(code+'\n//# sourceURL=navigation-engine-v191.js');
 } finally {
  if(rawJump)m.jumpTo=rawJump;if(rawFly)m.flyTo=rawFly;
 }
 window.__RADAR_SINGLE_CAMERA_OWNER='v221';
 m.__radarV191InternalCameraDisabled=true;
 /* O v191 usa easeTo para sua camera. Enquanto a navegacao esta ativa, essas chamadas
    ficam bloqueadas. O v221 usa jumpTo e continua livre. Fora da navegacao, easeTo original
    permanece disponivel para a tela comum. */
 if(rawEase)m.easeTo=function(opts){
   try{if((app()?.navActive)&&window.__RADAR_SINGLE_CAMERA_OWNER==='v221')return m;}catch(_){}
   return rawEase(opts);
 };
}
let tries=0,t=setInterval(()=>{const a=app();if(a?.map){clearInterval(t);load().catch(e=>console.error('Radar v191 no-camera',e));}else if(++tries>300)clearInterval(t);},50);
})();