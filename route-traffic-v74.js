/* Radar Seguro RJ PRO v74 — trânsito somente na rota ativa */
(() => {
  'use strict';
  if (window.__radarRouteTrafficV74) return;
  window.__radarRouteTrafficV74 = true;

  const WORKER = 'https://radar-seguro-ia-rj.claudio41cg.workers.dev';
  const SOURCE_ID = 'route-traffic-v74';
  const LAYER_ID = 'route-traffic-v74-line';
  const MAX_SAMPLES = 18;
  const COLORS = {
    free: '#2563eb',
    moderate: '#f59e0b',
    heavy: '#ef4444'
  };

  function getApp(){
    try { if (typeof App !== 'undefined' && App) return App; } catch (_) {}
    return window.App || null;
  }

  function hideGlobalTraffic(){
    const app = getApp();
    const map = app?.map;
    if (!map) return;
    try {
      const style = map.getStyle?.();
      for (const layer of style?.layers || []) {
        const id = String(layer.id || '').toLowerCase();
        const src = String(layer.source || '').toLowerCase();
        if (id === LAYER_ID) continue;
        if (/tomtom.*traffic|traffic.*tomtom|traffic-flow|flow.*traffic/.test(id + ' ' + src)) {
          try { map.setLayoutProperty(layer.id, 'visibility', 'none'); } catch (_) {}
          try { if (layer.type === 'raster') map.setPaintProperty(layer.id, 'raster-opacity', 0); } catch (_) {}
          try { if (layer.type === 'line') map.setPaintProperty(layer.id, 'line-opacity', 0); } catch (_) {}
        }
      }
    } catch (_) {}
  }

  function trafficStatus(data){
    const current = Number(data?.flowSegmentData?.currentSpeed);
    const free = Number(data?.flowSegmentData?.freeFlowSpeed);
    if (!Number.isFinite(current) || !Number.isFinite(free) || free <= 0) return 'free';
    const ratio = current / free;
    if (ratio < 0.50) return 'heavy';
    if (ratio < 0.75) return 'moderate';
    return 'free';
  }

  async function flowAt(coord){
    const lon = Number(coord?.[0]);
    const lat = Number(coord?.[1]);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return 'free';
    const path = `/traffic/services/4/flowSegmentData/absolute/10/json?point=${encodeURIComponent(lat + ',' + lon)}&unit=KMPH&openLr=false`;
    const url = `${WORKER}/v1/tomtom?path=${encodeURIComponent(path)}`;
    try {
      const r = await fetch(url, { cache: 'no-store' });
      if (!r.ok) return 'free';
      return trafficStatus(await r.json());
    } catch (_) {
      return 'free';
    }
  }

  function sampleIndexes(length){
    if (length < 2) return [];
    const segmentCount = Math.min(MAX_SAMPLES, Math.max(1, length - 1));
    const out = [];
    for (let i = 0; i < segmentCount; i++) {
      const a = Math.floor(i * (length - 1) / segmentCount);
      const b = Math.max(a + 1, Math.floor((i + 1) * (length - 1) / segmentCount));
      out.push([a, Math.min(length - 1, b)]);
    }
    return out;
  }

  async function buildTrafficFeatures(coords){
    const ranges = sampleIndexes(coords.length);
    return Promise.all(ranges.map(async ([a,b]) => {
      const mid = coords[Math.floor((a+b)/2)] || coords[a];
      const status = await flowAt(mid);
      return {
        type: 'Feature',
        properties: { status },
        geometry: { type: 'LineString', coordinates: coords.slice(a, b + 1) }
      };
    }));
  }

  function ensureLayer(map, data){
    try {
      if (map.getLayer(LAYER_ID)) map.removeLayer(LAYER_ID);
      if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID);
      map.addSource(SOURCE_ID, { type: 'geojson', data });
      map.addLayer({
        id: LAYER_ID,
        type: 'line',
        source: SOURCE_ID,
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': ['match', ['get','status'], 'heavy', COLORS.heavy, 'moderate', COLORS.moderate, COLORS.free],
          'line-width': ['interpolate', ['linear'], ['zoom'], 12, 4, 15, 7, 18, 10],
          'line-opacity': 0.96
        }
      });
    } catch (e) {
      console.warn('Radar v74: erro ao desenhar trânsito da rota', e);
    }
  }

  let refreshToken = 0;
  async function refreshRouteTraffic(route){
    const app = getApp();
    const map = app?.map;
    const coords = route?.coords;
    if (!map || !Array.isArray(coords) || coords.length < 2) return;
    hideGlobalTraffic();
    const token = ++refreshToken;
    const features = await buildTrafficFeatures(coords);
    if (token !== refreshToken) return;
    ensureLayer(map, { type: 'FeatureCollection', features });
  }

  function install(){
    const app = getApp();
    if (!app || app.__routeTrafficV74Installed) return false;
    app.__routeTrafficV74Installed = true;

    const originalDrawRoute = typeof app.drawRoute === 'function' ? app.drawRoute.bind(app) : null;
    if (originalDrawRoute) {
      app.drawRoute = function(route, fit){
        const result = originalDrawRoute(route, fit);
        setTimeout(() => refreshRouteTraffic(route), 80);
        return result;
      };
    }

    try { app.map?.on?.('styledata', () => setTimeout(hideGlobalTraffic, 60)); } catch (_) {}
    try { app.map?.on?.('idle', hideGlobalTraffic); } catch (_) {}
    [150,500,1200,2500].forEach(ms => setTimeout(hideGlobalTraffic, ms));
    if (app.route?.coords?.length) setTimeout(() => refreshRouteTraffic(app.route), 250);
    return true;
  }

  let tries = 0;
  const timer = setInterval(() => {
    tries++;
    if (install() || tries > 120) clearInterval(timer);
  }, 250);

  window.RadarRouteTrafficV74 = { refresh: () => refreshRouteTraffic(getApp()?.route), hideGlobalTraffic };
})();
