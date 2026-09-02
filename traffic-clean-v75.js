/* Radar Seguro RJ PRO v77 — trânsito global bloqueado com baixo custo */
(() => {
  'use strict';
  if (window.__radarTrafficCleanV77) return;
  window.__radarTrafficCleanV77 = true;

  function getApp(){
    try { if (typeof App !== 'undefined' && App) return App; } catch (_) {}
    return window.App || null;
  }

  function removeGlobalTraffic(){
    const app = getApp();
    const map = app?.map;
    if (!map) return false;

    try { if (map.getLayer('tomtom-traffic-flow')) map.removeLayer('tomtom-traffic-flow'); } catch (_) {}
    try { if (map.getSource('tomtom-traffic')) map.removeSource('tomtom-traffic'); } catch (_) {}
    return true;
  }

  function install(){
    const app = getApp();
    if (!app) return false;

    app.addTomTomTrafficLayer = function(){
      removeGlobalTraffic();
    };

    removeGlobalTraffic();

    // style.load é raro. Evitamos listeners em idle/styledata e timers longos,
    // que antes acordavam a CPU repetidamente mesmo sem necessidade.
    try { app.map?.on?.('style.load', removeGlobalTraffic); } catch (_) {}
    return true;
  }

  let tries = 0;
  const timer = setInterval(() => {
    tries += 1;
    if (install() || tries >= 40) clearInterval(timer);
  }, 150);

  window.RadarTrafficCleanV77 = { remove: removeGlobalTraffic };
})();
