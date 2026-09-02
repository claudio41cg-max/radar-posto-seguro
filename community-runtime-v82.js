/* Radar Seguro RJ PRO v82 — ponte do mapa para o índice externo de comunidades */
(() => {
  'use strict';
  if (window.__radarCommunityRuntimeV82) return;
  window.__radarCommunityRuntimeV82 = true;

  const VERSION = '82-external-index-authoritative';

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
      console.warn('Radar v82: não foi possível atualizar polígonos das comunidades.', e);
    }

    try {
      if (typeof communitiesPointGeoJSON === 'function') {
        const source = map.getSource?.('community-points');
        if (source?.setData) source.setData(communitiesPointGeoJSON());
      }
    } catch (e) {
      console.warn('Radar v82: não foi possível atualizar pontos das comunidades.', e);
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
      console.warn('Radar v82: índice externo de comunidades indisponível.', e);
      return false;
    }

    if (!Array.isArray(areas) || !areas.length) return false;

    try {
      if (typeof rawAreas === 'undefined' || !Array.isArray(rawAreas)) return false;

      const externalNames = new Set(areas.map(a => String(a?.name || '')).filter(Boolean));
      const legacyNames = new Set(rawAreas.map(a => String(a?.name || '')).filter(Boolean));

      // Segurança de migração: só troca a fonte se o catálogo externo cobrir
      // integralmente a lista já usada pelo aplicativo.
      for (const name of legacyNames) {
        if (!externalNames.has(name)) {
          console.warn('Radar v82: catálogo externo incompleto; mantendo catálogo interno.', name);
          return false;
        }
      }

      rawAreas.splice(0, rawAreas.length, ...areas.map(a => ({
        name: String(a.name),
        c: [Number(a.c?.[0]), Number(a.c?.[1])],
        r: Number(a.r)
      })));

      refreshMapSources();
      window.dispatchEvent(new CustomEvent('radar:communities-index-ready', {
        detail: { version: VERSION, count: rawAreas.length }
      }));
      return true;
    } catch (e) {
      console.warn('Radar v82: falha ao adotar índice externo.', e);
      return false;
    }
  }

  let tries = 0;
  const timer = setInterval(async () => {
    tries += 1;
    if (window.RadarCommunityData?.index) {
      clearInterval(timer);
      const ok = await adoptExternalIndex();
      window.RadarCommunityRuntimeV82 = {
        version: VERSION,
        externalIndexActive: ok,
        reload: adoptExternalIndex
      };
    } else if (tries >= 60) {
      clearInterval(timer);
    }
  }, 150);
})();
