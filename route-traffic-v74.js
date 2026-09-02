/* Radar Seguro RJ PRO v80 — trânsito somente na rota ativa, com cache de baixo consumo */
(() => {
  'use strict';
  if (window.__radarRouteTrafficV80) return;
  window.__radarRouteTrafficV80 = true;

  const WORKER = 'https://radar-seguro-ia-rj.claudio41cg.workers.dev';
  const SOURCE_ID = 'route-traffic-v74';
  const LAYER_ID = 'route-traffic-v74-line';
  const MAX_SAMPLES = 12;
  const FLOW_CACHE_MS = 45000;
  const MAX_FLOW_CACHE_ITEMS = 96;
  const flowCache = new Map();
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
      if (map.getLayer?.('tomtom-traffic-flow')) map.removeLayer('tomtom-traffic-flow');
    } catch (_) {}
    try {
      if (map.getSource?.('tomtom-traffic')) map.removeSource('tomtom-traffic');
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

  function cacheKey(lat, lon){
    // ~11 m de precisão: suficiente para reutilizar amostras na mesma via.
    return `${lat.toFixed(4)},${lon.toFixed(4)}`;
  }

  function getCachedFlow(key){
    const entry = flowCache.get(key);
    if (!entry) return '';
    if (Date.now() - entry.at > FLOW_CACHE_MS) {
      flowCache.delete(key);
      return '';
    }
    // LRU: item usado volta para o fim do Map.
    flowCache.delete(key);
    flowCache.set(key, entry);
    return entry.status;
  }

  function setCachedFlow(key, status){
    if (flowCache.has(key)) flowCache.delete(key);
    flowCache.set(key, { status, at: Date.now() });
    while (flowCache.size > MAX_FLOW_CACHE_ITEMS) {
      flowCache.delete(flowCache.keys().next().value);
    }
  }

  async function flowAt(coord){
    const lon = Number(coord?.[0]);
    const lat = Number(coord?.[1]);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return 'free';

    const key = cacheKey(lat, lon);
    const cached = getCachedFlow(key);
    if (cached) return cached;

    const path = `/traffic/services/4/flowSegmentData/absolute/10/json?point=${encodeURIComponent(lat + ',' + lon)}&unit=KMPH&openLr=false`;
    const url = `${WORKER}/v1/tomtom?path=${encodeURIComponent(path)}`;
    try {
      const r = await fetch(url, { cache: 'no-store' });
      if (!r.ok) return 'free';
      const status = trafficStatus(await r.json());
      setCachedFlow(key, status);
      return status;
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
      const source = map.getSource(SOURCE_ID);
      if (source?.setData) {
        source.setData(data);
        return;
      }
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
      console.warn('Radar v80: erro ao desenhar trânsito da rota', e);
    }
  }

  let refreshToken = 0;
  let lastRouteKey = '';

  function routeKey(route){
    const coords = route?.coords;
    if (!Array.isArray(coords) || coords.length < 2) return '';
    const first = coords[0] || [];
    const last = coords[coords.length - 1] || [];
    return `${coords.length}:${Number(first[0]).toFixed(5)},${Number(first[1]).toFixed(5)}:${Number(last[0]).toFixed(5)},${Number(last[1]).toFixed(5)}`;
  }

  async function refreshRouteTraffic(route, force = false){
    const app = getApp();
    const map = app?.map;
    const coords = route?.coords;
    if (!map || !Array.isArray(coords) || coords.length < 2) return;

    const key = routeKey(route);
    if (!force && key && key === lastRouteKey && map.getSource?.(SOURCE_ID)) return;
    lastRouteKey = key;

    hideGlobalTraffic();
    const token = ++refreshToken;
    const features = await buildTrafficFeatures(coords);
    if (token !== refreshToken) return;
    ensureLayer(map, { type: 'FeatureCollection', features });
  }

  function install(){
    const app = getApp();
    if (!app || app.__routeTrafficV80Installed) return false;
    app.__routeTrafficV80Installed = true;

    const originalDrawRoute = typeof app.drawRoute === 'function' ? app.drawRoute.bind(app) : null;
    if (originalDrawRoute) {
      app.drawRoute = function(route, fit){
        const result = originalDrawRoute(route, fit);
        setTimeout(() => refreshRouteTraffic(route), 100);
        return result;
      };
    }

    hideGlobalTraffic();
    if (app.route?.coords?.length) setTimeout(() => refreshRouteTraffic(app.route), 250);
    return true;
  }

  let tries = 0;
  const timer = setInterval(() => {
    tries++;
    if (install() || tries > 60) clearInterval(timer);
  }, 250);

  window.addEventListener('pagehide', () => flowCache.clear());

  window.RadarRouteTrafficV74 = {
    version: '80-low-power-flow-cache',
    refresh: () => refreshRouteTraffic(getApp()?.route, true),
    hideGlobalTraffic,
    clearCache: () => flowCache.clear()
  };
})();
