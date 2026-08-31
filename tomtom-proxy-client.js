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

  function isWorkerAI(value) {
    const url = toUrl(value);
    if (!url) return false;
    const base = new URL(WORKER_BASE);
    return url.origin === base.origin && (url.pathname === '/' || url.pathname === '' || url.pathname === '/v1/chat');
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

  function normalizeAIBody(body) {
    if (typeof body !== 'string') return body;
    try {
      const payload = JSON.parse(body || '{}');
      if (!payload.message && typeof payload.pergunta === 'string') {
        payload.message = payload.pergunta;
        delete payload.pergunta;
      }
      if (!Array.isArray(payload.history)) payload.history = [];
      return JSON.stringify(payload);
    } catch (_) {
      return body;
    }
  }

  async function normalizeAIResponse(response) {
    try {
      const data = await response.clone().json();
      const normalized = { ...data };

      // Compatibilidade com o assistente legado do index.html.
      // O Worker Groq responde { reply, error }; o app antigo espera
      // { resposta, erro }.
      if (typeof normalized.resposta !== 'string' && typeof normalized.reply === 'string') {
        normalized.resposta = normalized.reply;
      }
      if (typeof normalized.erro !== 'string' && typeof normalized.error === 'string') {
        normalized.erro = normalized.error;
      }

      return new Response(JSON.stringify(normalized), {
        status: response.status,
        statusText: response.statusText,
        headers: {
          'Content-Type': 'application/json; charset=utf-8'
        }
      });
    } catch (_) {
      return response;
    }
  }

  window.fetch = function radarProtectedFetch(input, init) {
    const method = String(init?.method || (input instanceof Request ? input.method : 'GET')).toUpperCase();

    // Corrige a integração legada da IA diretamente antes da requisição sair
    // do navegador: "pergunta" -> "message", garante history como array e
    // adapta a resposta Groq para o formato esperado pelo assistente antigo.
    if (method === 'POST' && isWorkerAI(input)) {
      const nextInit = cloneInitFromRequest(input, init);
      nextInit.method = 'POST';
      nextInit.headers = new Headers(nextInit.headers || {});
      nextInit.headers.set('Content-Type', 'application/json');
      nextInit.body = normalizeAIBody(nextInit.body);
      return nativeFetch(AI_CHAT, nextInit).then(normalizeAIResponse);
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
