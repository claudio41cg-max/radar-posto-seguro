/* Radar Seguro RJ PRO v75 — remove o trânsito global do mapa */
(() => {
  'use strict';
  if (window.__radarTrafficCleanV75) return;
  window.__radarTrafficCleanV75 = true;

  function getApp(){
    try { if (typeof App !== 'undefined' && App) return App; } catch (_) {}
    return window.App || null;
  }

  function removeGlobalTraffic(){
    const app=getApp();
    const map=app?.map;
    if(!map) return false;

    try{
      if(map.getLayer('tomtom-traffic-flow')) map.removeLayer('tomtom-traffic-flow');
    }catch(_){}
    try{
      if(map.getSource('tomtom-traffic')) map.removeSource('tomtom-traffic');
    }catch(_){}

    try{
      const style=map.getStyle?.();
      for(const layer of style?.layers||[]){
        const id=String(layer.id||'').toLowerCase();
        const src=String(layer.source||'').toLowerCase();
        if(id==='route-traffic-v74-line') continue;
        if(/tomtom-traffic|traffic-flow|tomtom.*flow|flow.*tomtom/.test(id+' '+src)){
          try{ map.removeLayer(layer.id); }catch(_){}
        }
      }
    }catch(_){}

    return true;
  }

  function install(){
    const app=getApp();
    if(!app) return false;

    // Impede definitivamente que o index.html volte a criar o overlay verde/amarelo/vermelho.
    app.addTomTomTrafficLayer=function(){
      removeGlobalTraffic();
    };

    removeGlobalTraffic();

    try{
      app.map?.on?.('style.load',()=>setTimeout(removeGlobalTraffic,0));
      app.map?.on?.('styledata',()=>setTimeout(removeGlobalTraffic,0));
      app.map?.on?.('idle',removeGlobalTraffic);
    }catch(_){}

    return true;
  }

  let tries=0;
  const timer=setInterval(()=>{
    tries++;
    if(install()||tries>160) clearInterval(timer);
  },100);

  [0,100,250,500,1000,2000,4000,8000].forEach(ms=>setTimeout(removeGlobalTraffic,ms));

  window.RadarTrafficCleanV75={remove:removeGlobalTraffic};
})();
