/* Radar Seguro RJ PRO — selo de versao do prototipo v214 */
(()=>{'use strict';
if(window.__radarPrototypeVersionV214)return;window.__radarPrototypeVersionV214=true;
function install(){
 const postos=[...document.querySelectorAll('button')].find(b=>/postos/i.test(b.textContent||''));
 if(!postos)return false;
 if(document.getElementById('radarPrototypeVersion'))return true;
 const badge=document.createElement('div');badge.id='radarPrototypeVersion';badge.textContent='V 214';
 badge.style.cssText='position:fixed;z-index:10050;padding:2px 7px;border-radius:9px;background:rgba(7,19,31,.88);border:1px solid rgba(56,189,248,.72);color:#eaf8ff;font:800 10px/1.2 Arial,sans-serif;letter-spacing:.4px;box-shadow:0 3px 10px rgba(0,0,0,.28);pointer-events:none;white-space:nowrap';
 document.body.appendChild(badge);
 const place=()=>{try{const r=postos.getBoundingClientRect();badge.style.left=Math.round(r.left+(r.width-badge.offsetWidth)/2)+'px';badge.style.top=Math.round(r.bottom+3)+'px';}catch(_){}};
 place();window.addEventListener('resize',place,{passive:true});window.addEventListener('orientationchange',()=>setTimeout(place,150),{passive:true});
 setInterval(place,1200);return true;
}
let n=0,t=setInterval(()=>{n++;if(install()||n>200)clearInterval(t)},100);
window.RadarPrototypeVersion={version:'214'};
})();
