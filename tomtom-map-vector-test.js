/* Radar Seguro RJ PRO — TESTE PARALELO TomTom Orbis vetorial.
   Nao substitui a base raster principal. Usa o mesmo Worker para nao expor a chave TomTom. */
(()=>{
'use strict';
if(window.__radarTomTomVectorTest)return;
window.__radarTomTomVectorTest=true;

const WORKER='https://radar-seguro-ia-rj.claudio41cg.workers.dev';
const app=()=>{try{return window.RadarApp||window.App||null}catch(_){return null}};

const diagState={
  style:'aguardando',
  vector:'aguardando',
  sprite:'aguardando',
  glyph:'aguardando',
  last:''
};

function classifyResource(url='',type=''){
  const s=(String(url)+' '+String(type)).toLowerCase();
  if(/glyph|font|\.pbf.*font|fonts/.test(s))return 'glyph';
  if(/sprite/.test(s))return 'sprite';
  if(/tile|\.pbf|vector/.test(s))return 'vector';
  if(/style/.test(s))return 'style';
  return null;
}

function diag(){
  let d=document.getElementById('vectorDiag');
  if(!d){
    d=document.createElement('div');
    d.id='vectorDiag';
    Object.assign(d.style,{
      position:'fixed',left:'10px',right:'10px',bottom:'188px',
      zIndex:'2147480002',padding:'8px 10px',borderRadius:'12px',
      font:'700 11px/1.35 Arial,sans-serif',background:'rgba(4,16,29,.90)',
      color:'#fff',border:'1px solid rgba(56,189,248,.55)',
      boxShadow:'0 4px 18px rgba(0,0,0,.35)',pointerEvents:'none'
    });
    document.body.appendChild(d);
  }
  d.textContent=
    'VETOR DIAG  •  estilo: '+diagState.style+
    '  •  tiles: '+diagState.vector+
    '  •  sprite: '+diagState.sprite+
    '  •  glyph: '+diagState.glyph+
    (diagState.last?'  •  '+diagState.last:'');
}

function setDiag(key,value,last=''){
  if(key&&key in diagState)diagState[key]=value;
  if(last)diagState.last=String(last).slice(0,115);
  diag();
}

function noteRequest(url,type){
  const k=classifyResource(url,type);
  if(k&&diagState[k]==='aguardando')setDiag(k,'pedido');
}


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

function installTransformRequest(map){
  const transform=(url,resourceType)=>{
    noteRequest(url,resourceType);
    const next=proxify(url);
    return {url:next};
  };
  try{
    if(typeof map?.setTransformRequest==='function'){
      map.setTransformRequest(transform);
      return 'setTransformRequest';
    }
  }catch(_){}
  try{
    if(map?._requestManager){
      map._requestManager._transformRequest=transform;
      return 'requestManager-fallback';
    }
  }catch(_){}
  return 'rewrite-only';
}

async function fetchVectorStyle(mode='light'){
  const dark=mode==='dark';
  const mapStyle=dark?'basic_street-dark':'basic_street-light';
  const path='/maps/orbis/assets/styles/0.*/style?apiVersion=1&map='+encodeURIComponent(mapStyle);
  const url=WORKER+'/v1/tomtom?path='+encodeURIComponent(path);
  setDiag('style','baixando');
  const r=await fetch(url,{cache:'no-store'});
  if(!r.ok){
    setDiag('style','erro','style HTTP '+r.status);
    throw new Error('TomTom Assets '+r.status);
  }
  const style=await r.json();
  setDiag('style','ok');
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
  diag();
  try{
    const mode=a.themeMode==='dark'?'dark':'light';
    const transformMode=installTransformRequest(a.map);
    const style=await fetchVectorStyle(mode);
    a.__tomTomVectorTestStyle=style;
    a.__tomTomVectorTransformMode=transformMode;
    a.map.setStyle(style,{diff:false});
    a.getThemeStyle=function(){return a.__tomTomVectorTestStyle||style;};
    let rendered=false;
    const markActive=()=>{
      if(rendered)return;
      rendered=true;
      badge('ativo');
    };
    a.map.once?.('idle',markActive);
    a.map.once?.('render',markActive);
    a.map.on?.('sourcedata',e=>{
      try{
        if(e?.isSourceLoaded)setDiag('vector','ok');
      }catch(_){}
    });
    a.map.on?.('styledata',()=>setDiag('style','ok'));
    a.map.on?.('error',e=>{
      const msg=String(e?.error?.message||e?.message||'erro');
      const source=String(e?.sourceId||'');
      const k=classifyResource(msg+' '+source,'');
      console.warn('Radar vetor recurso:',msg,e);
      if(k)setDiag(k,'erro',k+': '+msg);
      else setDiag(null,null,'erro: '+msg);
      if(!rendered)badge('recurso');
    });
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
  version:'test-3-diag',
  fetchVectorStyle,
  reload:async(mode='light')=>{
    const a=app();if(!a?.map)return false;
    installTransformRequest(a.map);
    const style=await fetchVectorStyle(mode);
    a.__tomTomVectorTestStyle=style;
    a.map.setStyle(style,{diff:false});
    return true;
  }
};
})();