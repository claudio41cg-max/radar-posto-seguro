/* Radar Seguro RJ PRO — cliente TomTom protegido
   Encaminha chamadas TomTom do navegador para o Cloudflare Worker.
   Nenhuma chave TomTom é enviada pelo cliente.
   Também corrige chamadas antigas do assistente de IA feitas para a raiz do Worker,
   redirecionando POSTs para /v1/chat sem alterar os comandos locais do app. */
(() => {
  'use strict';

  if (window.__radarTomTomProxyInstalled) return;
  window.__radarTomTomProxyInstalled = true;

  const WORKER_BASE = 'https://radar-seguro-ia-rj.claudio41cg.workers.dev';
  const nativeFetch = window.fetch.bind(window);

  function toUrl(value) {
    try {
      return value instanceof Request
        ? new URL(value.url)
        : new URL(String(value), location.href);
    } catch (_) {
      return null;
    }
  }

  function isTomTomUrl(value) {
    const url = toUrl(value);
    return Boolean(url && url.hostname === 'api.tomtom.com');
  }

  function isWorkerRoot(value) {
    const url = toUrl(value);
    if (!url) return false;

    try {
      const base = new URL(WORKER_BASE);
      return url.origin === base.origin && (url.pathname === '/' || url.pathname === '');
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
    const method = String(init?.method || (input instanceof Request ? input.method : 'GET')).toUpperCase();

    // Compatibilidade com a versão atual do index.html:
    // perguntas gerais ainda fazem POST para a raiz do Worker,
    // enquanto o Worker de IA recebe em /v1/chat.
    if (method === 'POST' && isWorkerRoot(input)) {
      const nextInit = { ...(init || {}) };
      return nativeFetch(`${WORKER_BASE}/v1/chat`, nextInit);
    }

    if (!isTomTomUrl(input)) return nativeFetch(input, init);
    if (method !== 'GET') return nativeFetch(input, init);

    const proxyUrl = buildProxyUrl(input);
    const nextInit = { ...(init || {}) };
    delete nextInit.mode;
    delete nextInit.credentials;

    return nativeFetch(proxyUrl, nextInit);
  };

  window.RadarTomTom = {
    proxyBase: `${WORKER_BASE}/v1/tomtom`,
    aiBase: `${WORKER_BASE}/v1/chat`,
    protected: true,
    buildProxyUrl
  };
})();
