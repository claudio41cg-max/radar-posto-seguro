/* Radar Seguro RJ PRO v78 — carregador leve de dados de comunidades */
(() => {
  'use strict';
  if (window.RadarCommunityData) return;

  const REGISTRY_URL = './data/community-datasets.json';
  const MAX_MEMORY_DATASETS = 2;
  const registryCache = { value: null, promise: null };
  const datasetCache = new Map();
  const inflight = new Map();

  async function getRegistry(){
    if (registryCache.value) return registryCache.value;
    if (registryCache.promise) return registryCache.promise;
    registryCache.promise = fetch(REGISTRY_URL, { cache: 'default' })
      .then(r => {
        if (!r.ok) throw new Error(`Falha ao carregar catálogo de comunidades: ${r.status}`);
        return r.json();
      })
      .then(data => {
        registryCache.value = data;
        return data;
      })
      .finally(() => { registryCache.promise = null; });
    return registryCache.promise;
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

  function unload(id){
    datasetCache.delete(id);
  }

  function clear(){
    datasetCache.clear();
  }

  window.addEventListener('pagehide', () => {
    // Os arquivos continuam no Cache Storage; liberamos apenas objetos pesados da RAM.
    clear();
  });

  window.RadarCommunityData = {
    version: '78-lazy-lru-community-data',
    list,
    load,
    unload,
    clear,
    isLoaded: id => datasetCache.has(id),
    loadedIds: () => Array.from(datasetCache.keys())
  };
})();
