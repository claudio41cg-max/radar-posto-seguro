/* Radar Seguro RJ PRO — cliente TomTom protegido
   Encaminha chamadas TomTom do navegador para o Cloudflare Worker.
   Nenhuma chave TomTom é enviada pelo cliente. */
(() => {
  'use strict';

  if (window.__radarTomTomProxyInstalled) return;
  window.__radarTomTomProxyInstalled = true;

  const WORKER_BASE = 'https://radar-seguro-ia-rj.claudio41cg.workers.dev';
  const nativeFetch = window.fetch.bind(window);

  function isTomTomUrl(value) {
    try {
      const url = value instanceof Request ? new URL(value.url) : new URL(String(value), location.href);
      return url.hostname === 'api.tomtom.com';
    } catch (_) {
      return false;
    }
  }

  function buildProxyUrl(value) {
    const source = value instanceof Request ? new URL(value.url) : new URL(String(value), location.href);
    source.searchParams.delete('key');
    const path = source.pathname + (source.search || '');
    return `${WORKER_BASE}/v1/tomtom?path=${encodeURIComponent(path)}`;
  }

  window.fetch = function radarProtectedFetch(input, init) {
    if (!isTomTomUrl(input)) return nativeFetch(input, init);

    const method = String(init?.method || (input instanceof Request ? input.method : 'GET')).toUpperCase();
    if (method !== 'GET') return nativeFetch(input, init);

    const proxyUrl = buildProxyUrl(input);
    const nextInit = { ...(init || {}) };
    delete nextInit.mode;
    delete nextInit.credentials;

    return nativeFetch(proxyUrl, nextInit);
  };

  window.RadarTomTom = {
    proxyBase: `${WORKER_BASE}/v1/tomtom`,
    protected: true,
    buildProxyUrl
  };
})();
