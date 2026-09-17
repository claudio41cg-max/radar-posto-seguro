/* Radar Seguro RJ PRO v217 — câmera de navegação com enquadramento seguro.
   Inspirada no padrão de FOLLOWING/viewport de SDKs profissionais: o carro é o ponto focal
   e a geometria à frente serve para bearing/contexto, não para arrastar o carro até a borda. */
(()=>{'use strict';
if(window.__radarNavigationCameraV217)return;window.__radarNavigationCameraV217=true;
const app=()=>{try{return window.RadarApp||window.App||null}catch(_){return null}};
const point=p=>Array.isArray(p)&&p.length>=2&&Number.isFinite(+p[0])&&Number.isFinite(+p[1]);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const rad=d=>d*Math.PI/180,deg=r=>r*180/Math.PI;
const dist=(a,b)=>{if(!point(a)||!point(b))return 0;const R=6371000,p1=rad(+a[1]),p2=rad(+b[1]),d1=p2-p1,d2=rad(+b[0]-+a[0]);const q=Math.sin(d1/2)**2+Math.cos(p1)*Math.cos(p2)*Math.sin(d2/2)**2;return 2*R*Math.asin(Math.min(1,Math.sqrt(q)))};
const bearing=(a,b)=>{if(!point(a)||!point(b))return null;const p1=rad(+a[1]),p2=rad(+b[1]),dl=rad(+b[0]-+a[0]),y=Math.sin(dl)*Math.cos(p2),x=Math.cos(p1)*Math.sin(p2)-Math.sin(p1)*Math.cos(p2)*Math.cos(dl);return(deg(Math.atan2(y,x))+360)%360};
const blend=(a,b,t)=>{const d=(((b-a)+540)%360)-180;return(a+d*t+360)%360};
function display(a){for(const p of[a?.matchedUserPos,a?.userPos,a?.filteredPos,a?.rawUserPos])if(point(p))return p;return null}
function routeAhead(a,meters){const c=a?.route?.coords;if(!Array.isArray(c)||c.length<2)return null;let i=clamp(+a.routeProgressIndex||0,0,c.length-2),left=meters;let start=display(a);if(!point(start))start=c[i];for(;i<c.length-1;i++){const p=i===clamp(+a.routeProgressIndex||0,0,c.length-2)?start:c[i],q=c[i+1],d=dist(p,q);if(d>=left&&d>0){const t=left/d;return[+p[0]+(+q[0]-+p[0])*t,+p[1]+(+q[1]-+p[1])*t]}left-=d}return c[c.length-1]}
function profile(speed){if(speed<15)return{zoom:17.9,pitch:58,look:45};if(speed<35)return{zoom:17.75,pitch:58,look:60};if(speed<55)return{zoom:17.5,pitch:57,look:78};if(speed<80)return{zoom:17.2,pitch:56,look:95};return{zoom:16.9,pitch:54,look:115}}
function heading(a,p,ahead){let h=Number.isFinite(+a?.currentBearing)?(+a.currentBearing+360)%360:null,r=point(ahead)?bearing(p,ahead):null,s=Math.max(0,+a?.currentSpeed||0);if(Number.isFinite(h)&&Number.isFinite(r)&&s>4)return blend(h,r,.42);if(Number.isFinite(r))return r;if(Number.isFinite(h))return h;try{return a.map.getBearing()}catch(_){return 0}}
function safeCamera(a){if(!a?.navActive||!a?.map||!a?.route)return;const p=display(a);if(!point(p))return;const speed=Math.max(0,+a.currentSpeed||0),cfg=profile(speed),ahead=routeAhead(a,cfg.look),br=heading(a,p,ahead);
 try{
   /* Padrão following: posição do motorista permanece como âncora horizontal.
      O padding inferior desloca o ponto focal para baixo, deixando estrada visível à frente,
      sem usar um ponto distante da curva como centro geográfico da câmera. */
   const canvas=a.map.getCanvas?.(),h=Math.max(400,canvas?.clientHeight||window.innerHeight||700),w=Math.max(280,canvas?.clientWidth||window.innerWidth||390);
   const side=Math.round(Math.min(54,Math.max(20,w*.055))),top=Math.round(Math.min(100,Math.max(58,h*.085))),bottom=Math.round(Math.min(h*.42,Math.max(150,h*.31)));
   a.followMode=true;
   a.map.easeTo({center:p,zoom:cfg.zoom,pitch:cfg.pitch,bearing:br,padding:{top,left:side,right:side,bottom},duration:320,essential:true});
 }catch(e){console.warn('Radar v217 camera',e)}
}
function install(){const a=app();if(!a?.map)return false;if(a.__cameraV217Installed)return true;a.__cameraV217Installed=true;
 /* v191 continua dono de GPS, matching e recálculo. Só neutralizamos sua rotina privada de câmera
    guardando a câmera nativa antes e aplicando nosso FOLLOWING depois de cada atualização GPS. */
 const old=typeof a.handleGPS==='function'?a.handleGPS.bind(a):null;if(old)a.handleGPS=function(...args){const out=old(...args);setTimeout(()=>safeCamera(a),20);return out};
 const start=typeof a.startNavigation==='function'?a.startNavigation.bind(a):null;if(start)a.startNavigation=function(...args){const out=start(...args);setTimeout(()=>safeCamera(a),160);return out};
 return true}
let n=0,t=setInterval(()=>{if(install()||++n>300)clearInterval(t)},100);
window.RadarNavigationCameraV217={version:'217',refresh:()=>safeCamera(app())};
})();