/* Radar Seguro RJ PRO v223 — limite legal da via vindo da rota TomTom.
   Nao estima limite pela velocidade do carro. Usa somente tomtomSpeedLimits da rota atual.
   Se a TomTom nao informar limite para o trecho, nao inventa valor nem marca excesso. */
(()=>{'use strict';
if(window.__radarSpeedLimitTomTomV223)return;window.__radarSpeedLimitTomTomV223=true;
const app=()=>{try{return window.RadarApp||window.App||null}catch(_){return null}};
let last=null,sign=null;
function ensureSign(){if(sign?.isConnected)return sign;sign=document.createElement('div');sign.id='tomtomSpeedLimitV223';Object.assign(sign.style,{position:'fixed',left:'22px',bottom:'258px',zIndex:'2147480500',width:'48px',height:'48px',borderRadius:'50%',background:'#fff',border:'5px solid #d71920',color:'#111',display:'none',alignItems:'center',justifyContent:'center',font:'900 19px Arial,sans-serif',boxShadow:'0 3px 10px rgba(0,0,0,.28)',pointerEvents:'none'});document.body.appendChild(sign);return sign;}
function section(a){const list=a?.route?.tomtomSpeedLimits,idx=Math.max(0,+a?.routeProgressIndex||0);if(!Array.isArray(list)||!list.length)return null;return list.find(x=>idx>=+x.startPointIndex&&idx<=+x.endPointIndex)||null;}
function paint(){const a=app(),box=document.getElementById('speedometerBox'),s=ensureSign();if(!a?.navActive){s.style.display='none';last=null;return;}const sec=section(a),limit=sec&&Number.isFinite(+sec.maxSpeedLimitInKmh)?+sec.maxSpeedLimitInKmh:null,speed=Math.max(0,+a.currentSpeed||0);a.currentSpeedLimit=limit;a.currentSpeedLimitSource=limit?'tomtom-route':null;
 if(limit){s.textContent=String(Math.round(limit));s.style.display='flex';s.title='Limite legal informado pela TomTom para o trecho atual';}else{s.style.display='none';}
 /* O velocimetro continua mostrando a velocidade REAL. A cor vermelha agora significa
    somente que a velocidade real ultrapassou um limite legal conhecido da TomTom. */
 if(box){const over=Number.isFinite(limit)&&speed>limit+2;box.style.background=over?'rgba(100,0,0,.90)':'rgba(5,18,31,.94)';box.style.borderColor=over?'#ef4444':'#0ea5e9';box.style.boxShadow=over?'0 4px 18px rgba(239,68,68,.38)':'0 4px 16px rgba(0,0,0,.34)';}
 if(limit!==last){last=limit;try{window.dispatchEvent(new CustomEvent('radar:speed-limit',{detail:{limit,source:limit?'tomtom-route':null}}));}catch(_){}}
}
setInterval(paint,350);setTimeout(paint,500);
window.RadarSpeedLimitTomTomV223={version:'223',current:()=>last,refresh:paint};
})();