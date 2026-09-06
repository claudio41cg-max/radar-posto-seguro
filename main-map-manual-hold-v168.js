/* Radar Seguro RJ PRO v168 — primeira tela: não recentralizar automaticamente após gesto manual.
   Navegação mantém o comportamento original de voltar ao acompanhamento após 10 segundos. */
(()=>{
'use strict';
if(window.__radarMainMapManualHoldV168)return;window.__radarMainMapManualHoldV168=true;
function app(){try{return window.RadarApp?.map?window.RadarApp:(typeof App!=='undefined'?App:null)}catch(_){return null}}
function install(){const a=app(),m=a?.map;if(!m?.on)return false;if(m.__manualHoldV168Installed)return true;m.__manualHoldV168Installed=true;
 const hold=()=>{try{if(a.navActive)return;a.followMode=false;clearTimeout(a.manualFollowTimer);a.manualFollowTimer=null;m.__mainManualHoldV168=true;}catch(_){}};
 ['dragstart','zoomstart','rotatestart','pitchstart'].forEach(ev=>m.on(ev,e=>{if(e&&e.originalEvent)setTimeout(hold,0);}));
 const locate=document.getElementById('locateBtn');
 if(locate)locate.addEventListener('click',()=>{try{if(a.navActive)return;m.__mainManualHoldV168=false;clearTimeout(a.manualFollowTimer);a.manualFollowTimer=null;a.followMode=true;setTimeout(()=>a.updateCamera&&a.updateCamera(),0);}catch(_){}} ,true);
 return true;
}
let n=0,t=setInterval(()=>{n++;if(install()||n>180)clearInterval(t)},100);
})();