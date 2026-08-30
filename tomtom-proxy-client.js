/* Radar Seguro RJ PRO — ponte protegida TomTom + IA
   Mantém as chaves fora do navegador e corrige a integração do assistente.
   Também melhora o modo mãos livres sem alterar os recursos locais existentes. */
(() => {
  'use strict';

  if (window.__radarTomTomProxyInstalled) return;
  window.__radarTomTomProxyInstalled = true;

  const WORKER_BASE = 'https://radar-seguro-ia-rj.claudio41cg.workers.dev';
  const AI_CHAT = `${WORKER_BASE}/v1/chat`;
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
    const base = new URL(WORKER_BASE);
    return url.origin === base.origin && (url.pathname === '/' || url.pathname === '');
  }

  function buildProxyUrl(value) {
    const source = value instanceof Request ? new URL(value.url) : new URL(String(value), location.href);
    source.searchParams.delete('key');
    const path = source.pathname + (source.search || '');
    return `${WORKER_BASE}/v1/tomtom?path=${encodeURIComponent(path)}`;
  }

  function cloneInitFromRequest(request, override) {
    if (!(request instanceof Request)) return { ...(override || {}) };
    return {
      method: request.method,
      headers: new Headers(request.headers),
      body: request.method === 'GET' || request.method === 'HEAD' ? undefined : request.clone().body,
      signal: request.signal,
      ...(override || {})
    };
  }

  window.fetch = function radarProtectedFetch(input, init) {
    const method = String(init?.method || (input instanceof Request ? input.method : 'GET')).toUpperCase();

    // O index legado envia perguntas gerais para a raiz do Worker.
    // O serviço atual recebe IA em /v1/chat. A ponte abaixo funciona tanto
    // para fetch(url, init) quanto para fetch(new Request(...)).
    if (method === 'POST' && isWorkerRoot(input)) {
      const nextInit = cloneInitFromRequest(input, init);
      nextInit.method = 'POST';
      return nativeFetch(AI_CHAT, nextInit);
    }

    if (!isTomTomUrl(input)) return nativeFetch(input, init);
    if (method !== 'GET') return nativeFetch(input, init);

    const proxyUrl = buildProxyUrl(input);
    const nextInit = cloneInitFromRequest(input, init);
    delete nextInit.mode;
    delete nextInit.credentials;
    return nativeFetch(proxyUrl, nextInit);
  };

  // Aprimoramento conservador do mãos livres: preserva "Radar" como palavra
  // de ativação para evitar comandos acidentais enquanto a pessoa dirige,
  // mas mantém a escuta pronta depois que o assistente termina de falar.
  function improveHandsFree() {
    const assistant = window.VoiceAssistant;
    if (!assistant || assistant.__conversationBridgeInstalled) return Boolean(assistant);

    assistant.__conversationBridgeInstalled = true;
    assistant.conversationWindowMs = 12000;
    assistant.conversationUntil = 0;

    const originalReply = typeof assistant.reply === 'function' ? assistant.reply.bind(assistant) : null;
    if (originalReply) {
      assistant.reply = function enhancedReply(text, ...rest) {
        if (this.handsFree) this.conversationUntil = Date.now() + this.conversationWindowMs;
        return originalReply(text, ...rest);
      };
    }

    const originalHasWakeWord = typeof assistant.hasWakeWord === 'function'
      ? assistant.hasWakeWord.bind(assistant)
      : null;

    if (originalHasWakeWord) {
      assistant.hasWakeWord = function enhancedWakeWord(text) {
        // Durante uma conversa recém-iniciada, permite a continuação natural
        // sem repetir "Radar" a cada frase. Fora dessa janela, exige a palavra
        // de ativação, evitando que rádio/conversas virem comandos.
        return originalHasWakeWord(text) || (this.handsFree && Date.now() < this.conversationUntil);
      };
    }

    const originalRemoveWakeWord = typeof assistant.removeWakeWord === 'function'
      ? assistant.removeWakeWord.bind(assistant)
      : null;

    if (originalRemoveWakeWord) {
      assistant.removeWakeWord = function enhancedRemoveWakeWord(text) {
        return originalRemoveWakeWord(text);
      };
    }

    return true;
  }

  // VoiceAssistant é criado pelo index depois deste arquivo.
  // Tentamos instalar a melhoria assim que estiver disponível.
  let attempts = 0;
  const installTimer = setInterval(() => {
    attempts += 1;
    if (improveHandsFree() || attempts > 120) clearInterval(installTimer);
  }, 250);

  window.RadarTomTom = {
    proxyBase: `${WORKER_BASE}/v1/tomtom`,
    aiBase: AI_CHAT,
    protected: true,
    buildProxyUrl
  };
})();
