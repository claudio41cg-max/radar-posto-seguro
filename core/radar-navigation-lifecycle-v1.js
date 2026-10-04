(()=>{'use strict';

if(window.RadarNavigationLifecycle)return;

function el(id){
  return document.getElementById(id);
}

function setShown(id,show){
  const node=el(id);
  if(node)node.classList.toggle('show',!!show);
}

function setHiddenForNav(id,hide){
  const node=el(id);
  if(node)node.classList.toggle('hide-nav',!!hide);
}

function resetNavigationState(app){
  app.routeProgressIndex=0;
  app.routeProgressMeters=0;
  app.lastTrustedProgressMeters=0;
  app.lastTrustedSpeed=0;
  app.routeStepIndex=0;
  app.activeGuidanceStep=-1;
  app.lastArrivalAnnounced=false;
}

function start(app,deps={}){
  if(!app?.route){
    app?.toast?.('Calcule uma rota primeiro.');
    return false;
  }

  app.navActive=true;
  app.followMode=true;
  resetNavigationState(app);

  document.body?.classList.add('nav-mode');
  setShown('wazeHud',true);
  setHiddenForNav('mainTopbar',true);
  setHiddenForNav('mainBottomActions',true);

  app.toggleSheet?.(false);
  app.fetchHazardsAlongRoute?.();

  if(!window.__RADAR_GEMINI_ROUTE_STARTING){
    deps.speak?.('Iniciando Radar Seguro.',true);
  }

  app.recenter?.();
  app.updateNavigation?.();

  try{
    window.RadarKernel?.emit?.('navigation:started',{app});
  }catch(_){}

  return true;
}

function stop(app,deps={}){
  if(!app)return false;

  app.navActive=false;
  app.followMode=false;
  app.offRouteHits=0;
  app.rerouting=false;

  app.removeCommunityBillboard?.();
  app.clearHazards?.();

  deps.stopAssistant?.();
  deps.clearVoice?.();

  document.body?.classList.remove('nav-mode');
  setShown('wazeHud',false);
  setHiddenForNav('mainTopbar',false);
  setHiddenForNav('mainBottomActions',false);

  try{
    app.map?.easeTo?.({
      pitch:0,
      bearing:0,
      duration:500
    });
  }catch(error){
    console.warn('[RadarNavigationLifecycle] reset-camera:',error);
  }

  try{
    window.RadarKernel?.emit?.('navigation:stopped',{app});
  }catch(_){}

  return true;
}

function clear(app,deps={}){
  if(!app)return false;

  stop(app,deps);

  try{
    if(app.map?.getLayer?.('route-main')){
      app.map.removeLayer('route-main');
    }

    if(app.map?.getLayer?.('route-outline')){
      app.map.removeLayer('route-outline');
    }

    if(app.map?.getSource?.('route')){
      app.map.removeSource('route');
    }
  }catch(error){
    console.warn('[RadarNavigationLifecycle] clear-route-map:',error);
  }

  if(app.destinationMarker){
    try{
      app.destinationMarker.remove();
    }catch(error){
      console.warn('[RadarNavigationLifecycle] destination-marker:',error);
    }
    app.destinationMarker=null;
  }

  app.route=null;
  app.destination=null;
  app.routeProgressIndex=0;
  app.routeProgressMeters=0;
  app.lastTrustedProgressMeters=0;
  app.lastTrustedSpeed=0;
  app.routeStepIndex=0;

  el('wazeSheet')?.classList.remove('show');

  try{
    window.RadarKernel?.emit?.('navigation:cleared',{app});
  }catch(_){}

  return true;
}

window.RadarNavigationLifecycle={
  start,
  stop,
  clear,
  version:'1.1.0-events'
};

})();