/* Radar Seguro RJ PRO — TESTE PARALELO TomTom Orbis vetorial.
   Nao substitui a base raster principal. Usa o mesmo Worker para nao expor a chave TomTom. */
(()=>{
'use strict';
if(window.__radarTomTomVectorTest)return;
window.__radarTomTomVectorTest=true;

const WORKER='https://radar-seguro-ia-rj.claudio41cg.workers.dev';
const app=()=>{try{return window.RadarApp||window.App||null}catch(_){return null}};

function cleanTomTomPath(raw){
  let s=String(raw||'');
  try{
    if(/^https?:\/\//i.test(s)){
      const u=new URL(s);
      if(!/tomtom\.com$/i.test(u.hostname)&&!/\.tomtom\.com$/i.test(u.hostname))return null;
      u.searchParams.delete('key');
      return u.pathname+(u.search||'');
    }
  }catch(_){}
  if(s.startsWith('/maps/')){
    try{
      const u=new URL('https://api.tomtom.com'+s);
      u.searchParams.delete('key');
      return u.pathname+(u.search||'');
    }catch(_){return s;}
  }
  return null;
}

function proxify(raw){
  const path=cleanTomTomPath(raw);
  return path?WORKER+'/v1/tomtom?path='+encodeURIComponent(path):raw;
}

function rewriteTomTomUrls(value){
  if(Array.isArray(value))return value.map(rewriteTomTomUrls);
  if(value&&typeof value==='object'){
    const out={};
    for(const [k,v] of Object.entries(value))out[k]=rewriteTomTomUrls(v);
    return out;
  }
  if(typeof value==='string')return proxify(value);
  return value;
}

async function fetchVectorStyle(mode='light'){
  const dark=mode==='dark';
  const mapStyle=dark?'basic_street-dark-driving':'basic_street-light-driving';
  const path='/maps/orbis/assets/styles/0.*/style?apiVersion=1&map='+encodeURIComponent(mapStyle);
  const url=WORKER+'/v1/tomtom?path='+encodeURIComponent(path);
  const r=await fetch(url,{cache:'no-store'});
  if(!r.ok)throw new Error('TomTom Assets '+r.status);
  const style=await r.json();
  const fixed=rewriteTomTomUrls(style);
  fixed.name=(fixed.name||'TomTom Orbis')+' • Radar Vector Test';
  return fixed;
}

function badge(state='carregando'){
  let b=document.getElementById('mapProviderVectorTest');
  if(!b){
    b=document.createElement('div');
    b.id='mapProviderVectorTest';
    Object.assign(b.style,{
      position:'fixed',left:'10px',bottom:'150px',zIndex:'2147480001',
      padding:'5px 9px',borderRadius:'999px',font:'800 10px Arial,sans-serif',
      letterSpacing:'.3px',background:'rgba(7,120,95,.94)',color:'#fff',
      boxShadow:'0 3px 12px rgba(0,0,0,.35)',pointerEvents:'none'
    });
    document.body.appendChild(b);
  }
  b.textContent='MAPA • TOMTOM VETOR • '+String(state).toUpperCase();
}

async function install(){
  const a=app();
  if(!a?.map)return false;
  if(a.__tomTomVectorTestInstalled)return true;
  a.__tomTomVectorTestInstalled=true;
  badge('carregando');
  try{
    const mode=a.themeMode==='dark'?'dark':'light';
    const style=await fetchVectorStyle(mode);
    a.__tomTomVectorTestStyle=style;
    a.map.setStyle(style,{diff:false});
    a.getThemeStyle=function(){return a.__tomTomVectorTestStyle||style;};
    a.map.once?.('idle',()=>badge('ativo'));
    setTimeout(()=>badge('ativo'),2500);
    return true;
  }catch(e){
    console.warn('Radar teste vetorial TomTom:',e);
    badge('erro');
    a.__tomTomVectorTestInstalled=false;
    return false;
  }
}

let tries=0;
const t=setInterval(async()=>{
  tries++;
  if(await install()||tries>180)clearInterval(t);
},100);

window.RadarTomTomVectorTest={
  version:'test-1',
  fetchVectorStyle,
  reload:async(mode='light')=>{
    const a=app();if(!a?.map)return false;
    const style=await fetchVectorStyle(mode);
    a.__tomTomVectorTestStyle=style;
    a.map.setStyle(style,{diff:false});
    return true;
  }
};
})();