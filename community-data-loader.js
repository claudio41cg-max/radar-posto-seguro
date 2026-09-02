/* Radar Seguro RJ PRO v81 — carregador leve de dados de comunidades */
(() => {
  'use strict';
  if (window.RadarCommunityData) return;

  const REGISTRY_URL = './data/community-datasets.json';
  const INDEX_URL = './data/community-index.json';
  const MAX_MEMORY_DATASETS = 2;
  const BACKGROUND_CLEAR_MS = 45000;
  const registryCache = { value: null, promise: null };
  const indexCache = { value: null, promise: null };
  const datasetCache = new Map();
  const inflight = new Map();
  let backgroundTimer = null;

  async function loadJsonCached(holder, url, label){
    if (holder.value) return holder.value;
    if (holder.promise) return holder.promise;
    holder.promise = fetch(url, { cache: 'default' })
      .then(r => {
        if (!r.ok) throw new Error(`Falha ao carregar ${label}: ${r.status}`);
        return r.json();
      })
      .then(data => {
        holder.value = data;
        return data;
      })
      .finally(() => { holder.promise = null; });
    return holder.promise;
  }

  async function getRegistry(){
    return loadJsonCached(registryCache, REGISTRY_URL, 'catálogo de geometrias');
  }

  async function getIndex(){
    const data = await loadJsonCached(indexCache, INDEX_URL, 'índice de comunidades');
    return Array.isArray(data?.areas) ? data.areas.slice() : [];
  }

  async function list(){
    const registry = await getRegistry();
    return Array.isArray(registry?.datasets) ? registry.datasets.slice() : [];
  }

  function touch(id, data){
    if (datasetCache.has(id)) datasetCache.delete(id);
    datasetCache.set(id, data);
    while (datasetCache.size > MAX_MEMORY_DATASETS) {
      const oldest = datasetCache.keys().next().value;
      datasetCache.delete(oldest);
    }
  }

  async function load(id){
    if (datasetCache.has(id)) {
      const data = datasetCache.get(id);
      touch(id, data);
      return data;
    }
    if (inflight.has(id)) return inflight.get(id);

    const promise = (async () => {
      const datasets = await list();
      const item = datasets.find(d => d.id === id);
      if (!item) throw new Error(`Conjunto de comunidades não encontrado: ${id}`);
      const response = await fetch(item.path, { cache: 'default' });
      if (!response.ok) throw new Error(`Falha ao carregar ${id}: ${response.status}`);
      const data = await response.json();
      touch(id, data);
      return data;
    })().finally(() => inflight.delete(id));

    inflight.set(id, promise);
    return promise;
  }

  function unload(id){ datasetCache.delete(id); }
  function clear(){ datasetCache.clear(); }

  function cancelBackgroundClear(){
    if (backgroundTimer) {
      clearTimeout(backgroundTimer);
      backgroundTimer = null;
    }
  }

  document.addEventListener('visibilitychange', () => {
    cancelBackgroundClear();
    if (document.hidden) {
      backgroundTimer = setTimeout(() => {
        clear();
        backgroundTimer = null;
      }, BACKGROUND_CLEAR_MS);
    }
  });

  window.addEventListener('pagehide', () => {
    cancelBackgroundClear();
    clear();
  });

  window.RadarCommunityData = {
    version: '81-external-community-index',
    index: getIndex,
    list,
    load,
    unload,
    clear,
    isLoaded: id => datasetCache.has(id),
    loadedIds: () => Array.from(datasetCache.keys())
  };
})();
