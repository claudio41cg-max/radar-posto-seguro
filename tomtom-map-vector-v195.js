/* Radar Seguro RJ PRO v195 — TomTom Orbis vetorial oficial via Assets API.
   MapLibre continua como renderer; mapa/estilo/fontes/sprites vêm da TomTom.
   Mantém a chave protegida pelo Worker e evita o raster 512px usado no teste v194. */
(()=>{
'use strict';
if(window.__radarTomTomVectorMapV195)return;
window.__radarTomTomVectorMapV195=true;

const WORKER='https://radar-seguro-ia-rj.claudio41cg.workers.dev';
const app=()=>{try{return window.RadarApp||window.App||null}catch(_){return null}};
const styleCache=new Map();

function styleName(mode){
  if(mode==='sat'||mode==='satellite')return'basic_street-satellite';
  if(mode==='dark')return'basic_street-dark-driving';
  return'basic_street-light-driving';
}
function stylePath(mode){
  return `/maps/orbis/assets/styles/0.*/style?apiVersion=1&map=${encodeURIComponent(styleName(mode))}`;
}
function proxyPath(path){
  let encoded=encodeURIComponent(path);
  // MapLibre precisa enxergar os placeholders para substituir z/x/y/fontstack/range.
  encoded=encoded.replace(/%7B/gi,'{').replace(/%7D/gi,'}');
  return `${WORKER}/v1/tomtom?path=${encoded}`;
}
function proxifyTomTomUrl(value){
  if(typeof value!=='string')return value;
  if(!/^https:\/\/(?:[abcd]\.)?api\.tomtom\.com\//i.test(value))return value;
  try{
    const u=new URL(value);
    u.searchParams.delete('key');
    return proxyPath(u.pathname+(u.search||''));
  }catch(_){return value;}
}
function rewriteTomTomUrls(value){
  if(Array.isArray(value))return value.map(rewriteTomTomUrls);
  if(value&&typeof value==='object'){
    const out={};
    for(const [k,v] of Object.entries(value))out[k]=rewriteTomTomUrls(v);
    return out;
  }
  return proxifyTomTomUrl(value);
}
async function fetchStyle(mode){
  const key=mode==='dark'?'dark':((mode==='sat'||mode==='satellite')?'sat':'light');
  if(styleCache.has(key))return styleCache.get(key);
  const r=await fetch(proxyPath(stylePath(key)),{cache:'force-cache',headers:{Accept:'application/json'}});
  if(!r.ok)throw new Error('TomTom Assets HTTP '+r.status);
  const raw=await r.json();
  const style=rewriteTomTomUrls(raw);
  if(!style||style.version!==8||!Array.isArray(style.layers))throw new Error('Estilo vetorial TomTom inválido');
  styleCache.set(key,style);
  return style;
}
function resolvedMode(a,mode){
  let m=mode||a?.themeMode||'light';
  if(m==='auto'){
    try{m=a.automaticThemeNow?.()||'light';}catch(_){m='light';}
  }
  return m==='dark'?'dark':((m==='sat'||m==='satellite')?'sat':'light');
}
function badge(){
  let b=document.getElementById('mapProviderV195');
  if(!b){
    b=document.createElement('div');b.id='mapProviderV195';
    Object.assign(b.style,{position:'fixed',left:'10px',bottom:'150px',zIndex:'2147480000',padding:'5px 8px',borderRadius:'999px',font:'700 10px Arial,sans-serif',letterSpacing:'.3px',background:'rgba(0,100,180,.92)',color:'#fff',boxShadow:'0 3px 12px rgba(0,0,0,.35)',pointerEvents:'none'});
    document.body.appendChild(b);
  }
  b.textContent='MAPA • TOMTOM ORBIS VECTOR';
}
async function apply(a,mode){
  const resolved=resolvedMode(a,mode);
  const style=await fetchStyle(resolved);
  a.appliedTheme=resolved;
  a.map.setStyle(style,{diff:false});
  badge();
  return style;
}
async function install(){
  const a=app();
  if(!a?.map)return false;
  if(a.__tomTomVectorMapV195Installed)return true;
  a.__tomTomVectorMapV195Installed=true;
  const oldGet=typeof a.getThemeStyle==='function'?a.getThemeStyle.bind(a):null;
  const oldApply=typeof a.applyThemeStyle==='function'?a.applyThemeStyle.bind(a):null;
  a.__getThemeStyleBeforeTomTomVectorV195=oldGet;
  a.__applyThemeStyleBeforeTomTomVectorV195=oldApply;
  a.getThemeStyle=function(mode){
    const k=resolvedMode(this,mode);
    return styleCache.get(k)||(oldGet?oldGet(mode):this.map.getStyle());
  };
  a.applyThemeStyle=function(){
    const mode=this.themeMode||'auto';
    apply(this,mode).catch(e=>{console.warn('Radar v195 mapa vetorial TomTom:',e);this.toast?.('Não consegui carregar o mapa vetorial TomTom agora.',2600);});
  };
  try{
    await apply(a,a.themeMode||'auto');
    return true;
  }catch(e){
    console.warn('Radar v195 mapa vetorial TomTom:',e);
    a.toast?.('Mapa vetorial TomTom indisponível. Mantive o mapa anterior.',3000);
    return true;
  }
}

let readyResolve;
const ready=new Promise(r=>readyResolve=r);
let tries=0,t=setInterval(async()=>{
  tries++;
  const a=app();
  if(a?.map){clearInterval(t);await install();readyResolve(true);}
  else if(tries>260){clearInterval(t);readyResolve(false);}
},80);

window.RadarTomTomVectorMapV195={version:'195',ready,fetchStyle,apply:(mode)=>{const a=app();return a?apply(a,mode):Promise.reject(new Error('Mapa não iniciado'));}};
})();
