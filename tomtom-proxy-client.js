/* Radar Seguro RJ PRO — ponte protegida TomTom + IA
   Mantém as chaves fora do navegador, preserva compatibilidade com o app legado
   e acrescenta memória curta de conversa + contexto seguro do GPS. */
(() => {
  'use strict';

  if (window.__radarTomTomProxyInstalled) return;
  window.__radarTomTomProxyInstalled = true;

  const WORKER_BASE = 'https://radar-seguro-ia-rj.claudio41cg.workers.dev';
  const AI_CHAT = `${WORKER_BASE}/v1/chat`;
  const nativeFetch = window.fetch.bind(window);
  const MEMORY_KEY = 'radar_ai_conversation_v1';
  const MAX_MEMORY_ITEMS = 12;
  const LOCATION_CACHE_MS = 30000;
  let locationCache = { at: 0, lat: null, lon: null, text: '' };

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

  function cleanMemoryItem(item) {
    const role = item?.role === 'assistant' || item?.role === 'model' ? 'assistant' : 'user';
    const content = String(item?.content ?? item?.text ?? '').replace(/\s+/g, ' ').trim().slice(0, 500);
    return content ? { role, content } : null;
  }

  function loadConversation() {
    try {
      const parsed = JSON.parse(sessionStorage.getItem(MEMORY_KEY) || '[]');
      if (!Array.isArray(parsed)) return [];
      return parsed.map(cleanMemoryItem).filter(Boolean).slice(-MAX_MEMORY_ITEMS);
    } catch (_) {
      return [];
    }
  }

  function saveConversation(items) {
    try {
      const clean = (Array.isArray(items) ? items : [])
        .map(cleanMemoryItem)
        .filter(Boolean)
        .slice(-MAX_MEMORY_ITEMS);
      sessionStorage.setItem(MEMORY_KEY, JSON.stringify(clean));
    } catch (_) {}
  }

  function rememberExchange(question, answer) {
    const history = loadConversation();
    const q = cleanMemoryItem({ role: 'user', content: question });
    const a = cleanMemoryItem({ role: 'assistant', content: answer });
    if (q) history.push(q);
    if (a) history.push(a);
    saveConversation(history);
  }

  function currentGps() {
    try {
      const pos = window.App?.userPos;
      if (!Array.isArray(pos) || pos.length < 2) return null;
      const lon = Number(pos[0]);
      const lat = Number(pos[1]);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
      return { lat, lon };
    } catch (_) {
      return null;
    }
  }

  function nearbyCachedLocation(gps) {
    if (!locationCache.text || Date.now() - locationCache.at > LOCATION_CACHE_MS) return '';
    if (!Number.isFinite(locationCache.lat) || !Number.isFinite(locationCache.lon)) return '';
    const dLat = Math.abs(gps.lat - locationCache.lat);
    const dLon = Math.abs(gps.lon - locationCache.lon);
    return dLat < 0.001 && dLon < 0.001 ? locationCache.text : '';
  }

  function formatTomTomAddress(data, gps) {
    const result = data?.addresses?.[0];
    const a = result?.address || {};
    const parts = [];
    const street = String(a.streetName || '').trim();
    const number = String(a.streetNumber || '').trim();
    const district = String(a.municipalitySubdivision || a.localName || '').trim();
    const city = String(a.municipality || '').trim();
    const state = String(a.countrySubdivision || '').trim();

    if (street) parts.push(number ? `${street}, ${number}` : street);
    if (district && !parts.includes(district)) parts.push(district);
    if (city && !parts.includes(city)) parts.push(city);
    if (state && !parts.includes(state)) parts.push(state);

    const freeform = String(a.freeformAddress || '').trim();
    const address = parts.join(', ') || freeform;
    if (address) return `${address}. Coordenadas aproximadas: ${gps.lat.toFixed(5)}, ${gps.lon.toFixed(5)}.`;
    return `Coordenadas aproximadas: ${gps.lat.toFixed(5)}, ${gps.lon.toFixed(5)}.`;
  }

  async function getLocationContext() {
    const gps = currentGps();
    if (!gps) return '';

    const cached = nearbyCachedLocation(gps);
    if (cached) return cached;

    let text = `Coordenadas aproximadas: ${gps.lat.toFixed(5)}, ${gps.lon.toFixed(5)}.`;
    try {
      const tomtomUrl = `https://api.tomtom.com/search/2/reverseGeocode/${gps.lat},${gps.lon}.json?language=pt-BR&radius=80`;
      const response = await nativeFetch(buildProxyUrl(tomtomUrl), {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        cache: 'no-store'
      });
      if (response.ok) {
        const data = await response.json();
        text = formatTomTomAddress(data, gps);
      }
    } catch (_) {}

    locationCache = { at: Date.now(), lat: gps.lat, lon: gps.lon, text };
    return text;
  }

  async function normalizeAIBody(body) {
    if (typeof body !== 'string') return { body, question: '' };
    try {
      const payload = JSON.parse(body || '{}');
      if (!payload.message && typeof payload.pergunta === 'string') {
        payload.message = payload.pergunta;
        delete payload.pergunta;
      }

      const question = String(payload.message || '').trim();
      if (!Array.isArray(payload.history) || payload.history.length === 0) {
        payload.history = loadConversation();
      }

      const location = await getLocationContext();
      if (location && question) {
        payload.message = `${question}\n\n[Contexto do Radar: o GPS do aplicativo está ligado e indica a localização atual do motorista como ${location} Use essa informação somente se for útil para responder à pergunta. Não diga que não tem acesso ao GPS quando esse contexto estiver presente.]`;
      }

      return { body: JSON.stringify(payload), question };
    } catch (_) {
      return { body, question: '' };
    }
  }

  async function normalizeAIResponse(response, question) {
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

      if (response.ok && question && typeof normalized.resposta === 'string' && normalized.resposta.trim()) {
        rememberExchange(question, normalized.resposta);
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

    // Corrige a integração legada da IA, injeta a memória curta da conversa e,
    // quando o GPS está disponível, fornece ao modelo a localização atual do app.
    if (method === 'POST' && isWorkerAI(input)) {
      const nextInit = cloneInitFromRequest(input, init);
      nextInit.method = 'POST';
      nextInit.headers = new Headers(nextInit.headers || {});
      nextInit.headers.set('Content-Type', 'application/json');

      return normalizeAIBody(nextInit.body).then(({ body, question }) => {
        nextInit.body = body;
        return nativeFetch(AI_CHAT, nextInit).then((response) => normalizeAIResponse(response, question));
      });
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
    buildProxyUrl,
    clearConversation() {
      try { sessionStorage.removeItem(MEMORY_KEY); } catch (_) {}
    }
  };
})();
