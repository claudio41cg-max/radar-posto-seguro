/* Radar Seguro RJ PRO v84 — comunidades externas com inicialização resiliente */
(() => {
  'use strict';
  if (window.__radarCommunityRuntimeV84) return;
  window.__radarCommunityRuntimeV84 = true;

  const VERSION = '84-external-index-resilient';
  let adopted = false;
  let refreshTimer = null;
  let refreshTries = 0;

  function getApp(){
    try { if (typeof App !== 'undefined' && App) return App; } catch (_) {}
    return window.App || null;
  }

  function occurrenceStatusMap(app){
    const result = {};
    for (const [name, info] of Object.entries(app?.communityOccurrenceInfo || {})) {
      result[name] = info?.status || 'normal';
    }
    return result;
  }

  function refreshMapSources(){
    const app = getApp();
    const map = app?.map;
    if (!map) return false;

    let refreshed = false;

    try {
      const source = map.getSource?.('communities');
      if (source?.setData && typeof communitiesPolygonGeoJSON === 'function') {
        source.setData(communitiesPolygonGeoJSON(occurrenceStatusMap(app)));
        refreshed = true;
      }
    } catch (e) {
      console.warn('Radar v84: falha ao atualizar polígonos.', e);
    }

    try {
      const source = map.getSource?.('community-points');
      if (source?.setData && typeof communitiesPointGeoJSON === 'function') {
        source.setData(communitiesPointGeoJSON());
        refreshed = true;
      }
    } catch (e) {
      console.warn('Radar v84: falha ao atualizar pontos.', e);
    }

    try {
      const source = map.getSource?.('community-bridges');
      if (source?.setData && typeof communityBridgesGeoJSON === 'function') {
        source.setData(communityBridgesGeoJSON());
      }
    } catch (_) {}

    // Se o mapa foi criado antes de o catálogo externo chegar e ainda não possui
    // as fontes de comunidades, pede ao próprio App para criá-las agora.
    if (!refreshed && typeof app?.addCommunityLayers === 'function') {
      try {
        app.addCommunityLayers();
        refreshed = Boolean(
          map.getSource?.('communities') || map.getSource?.('community-points')
        );
      } catch (e) {
        console.warn('Radar v84: falha ao recriar camadas de comunidades.', e);
      }
    }

    return refreshed;
  }

  function scheduleRefresh(){
    if (refreshTimer) clearInterval(refreshTimer);
    refreshTries = 0;

    const attempt = () => {
      refreshTries += 1;
      const ok = refreshMapSources();
      if (ok || refreshTries >= 80) {
        clearInterval(refreshTimer);
        refreshTimer = null;
        if (ok) {
          window.dispatchEvent(new CustomEvent('radar:communities-map-ready', {
            detail: { version: VERSION, count: safeCount() }
          }));
        }
      }
    };

    attempt();
    if (!refreshMapSources()) refreshTimer = setInterval(attempt, 250);
  }

  function safeCount(){
    try { return Array.isArray(rawAreas) ? rawAreas.length : 0; } catch (_) { return 0; }
  }

  async function adoptExternalIndex(){
    const api = window.RadarCommunityData;
    if (!api?.index) return false;

    let areas;
    try {
      areas = await api.index();
    } catch (e) {
      console.warn('Radar v84: índice externo indisponível.', e);
      return false;
    }

    const normalized = (Array.isArray(areas) ? areas : [])
      .map(a => ({
        name: String(a?.name || '').trim(),
        c: [Number(a?.c?.[0]), Number(a?.c?.[1])],
        r: Number(a?.r)
      }))
      .filter(a => a.name && Number.isFinite(a.c[0]) && Number.isFinite(a.c[1]) && Number.isFinite(a.r));

    if (!normalized.length) return false;

    try {
      if (typeof rawAreas === 'undefined' || !Array.isArray(rawAreas)) return false;
      rawAreas.splice(0, rawAreas.length, ...normalized);
      adopted = true;
    } catch (e) {
      console.warn('Radar v84: não foi possível preencher rawAreas.', e);
      return false;
    }

    scheduleRefresh();

    // Atualiza os dados de ocorrências após o catálogo existir, sem bloquear o mapa.
    try {
      const app = getApp();
      if (typeof window.RadarApp?.refreshFogoCruzado === 'function') {
        Promise.resolve(window.RadarApp.refreshFogoCruzado()).catch(() => {});
      } else if (typeof app?.refreshCommunityOccurrenceLayer === 'function') {
        Promise.resolve(app.refreshCommunityOccurrenceLayer()).catch(() => {});
      }
    } catch (_) {}

    window.dispatchEvent(new CustomEvent('radar:communities-index-ready', {
      detail: { version: VERSION, count: normalized.length }
    }));
    return true;
  }

  async function boot(){
    let tries = 0;
    while (tries < 80) {
      tries += 1;
      if (window.RadarCommunityData?.index) break;
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    const ok = await adoptExternalIndex();
    window.RadarCommunityRuntimeV83 = {
      version: VERSION,
      externalIndexActive: ok,
      get count(){ return safeCount(); },
      reload: adoptExternalIndex,
      refresh: refreshMapSources
    };
  }

  window.addEventListener('load', () => {
    if (adopted) scheduleRefresh();
  }, { once: true });

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && adopted) scheduleRefresh();
  });

  boot();
})();
