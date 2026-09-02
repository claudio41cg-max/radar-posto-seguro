/* Radar Seguro RJ PRO v83 — índice externo de comunidades como fonte principal */
(() => {
  'use strict';
  if (window.__radarCommunityRuntimeV83) return;
  window.__radarCommunityRuntimeV83 = true;

  const VERSION = '83-external-index-only';

  function getApp(){
    try { if (typeof App !== 'undefined' && App) return App; } catch (_) {}
    return window.App || null;
  }

  function refreshMapSources(){
    const app = getApp();
    const map = app?.map;
    if (!map) return;

    try {
      if (typeof communitiesPolygonGeoJSON === 'function') {
        const source = map.getSource?.('communities');
        if (source?.setData) {
          const status = app.communityOccurrenceInfo || {};
          const occurrenceStatusByName = {};
          for (const [name, info] of Object.entries(status)) {
            occurrenceStatusByName[name] = info?.status || 'normal';
          }
          source.setData(communitiesPolygonGeoJSON(occurrenceStatusByName));
        }
      }
    } catch (e) {
      console.warn('Radar v83: não foi possível atualizar polígonos das comunidades.', e);
    }

    try {
      if (typeof communitiesPointGeoJSON === 'function') {
        const source = map.getSource?.('community-points');
        if (source?.setData) source.setData(communitiesPointGeoJSON());
      }
    } catch (e) {
      console.warn('Radar v83: não foi possível atualizar pontos das comunidades.', e);
    }

    try {
      if (typeof communityBridgesGeoJSON === 'function') {
        const source = map.getSource?.('community-bridges');
        if (source?.setData) source.setData(communityBridgesGeoJSON());
      }
    } catch (_) {}
  }

  async function adoptExternalIndex(){
    const api = window.RadarCommunityData;
    if (!api?.index) return false;

    let areas;
    try {
      areas = await api.index();
    } catch (e) {
      console.warn('Radar v83: índice externo de comunidades indisponível.', e);
      return false;
    }

    if (!Array.isArray(areas) || !areas.length) return false;

    try {
      if (typeof rawAreas === 'undefined' || !Array.isArray(rawAreas)) return false;

      const normalized = areas
        .map(a => ({
          name: String(a?.name || '').trim(),
          c: [Number(a?.c?.[0]), Number(a?.c?.[1])],
          r: Number(a?.r)
        }))
        .filter(a => a.name && Number.isFinite(a.c[0]) && Number.isFinite(a.c[1]) && Number.isFinite(a.r));

      if (!normalized.length) return false;

      rawAreas.splice(0, rawAreas.length, ...normalized);
      refreshMapSources();

      window.dispatchEvent(new CustomEvent('radar:communities-index-ready', {
        detail: { version: VERSION, count: rawAreas.length }
      }));
      return true;
    } catch (e) {
      console.warn('Radar v83: falha ao adotar índice externo.', e);
      return false;
    }
  }

  let tries = 0;
  const timer = setInterval(async () => {
    tries += 1;
    if (window.RadarCommunityData?.index) {
      clearInterval(timer);
      const ok = await adoptExternalIndex();
      window.RadarCommunityRuntimeV83 = {
        version: VERSION,
        externalIndexActive: ok,
        reload: adoptExternalIndex
      };
    } else if (tries >= 60) {
      clearInterval(timer);
    }
  }, 150);
})();
