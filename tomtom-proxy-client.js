/* Radar Seguro RJ PRO — ponte protegida TomTom + IA
   Memória curta, contexto real do GPS/rota e comandos seguros do aparelho. */
(() => {
  'use strict';
  if (window.__radarTomTomProxyInstalled) return;
  window.__radarTomTomProxyInstalled = true;

  const WORKER_BASE = 'https://radar-seguro-ia-rj.claudio41cg.workers.dev';
  const AI_CHAT = `${WORKER_BASE}/v1/chat`;
  const nativeFetch = window.fetch.bind(window);
  const MEMORY_KEY = 'radar_ai_conversation_v3';
  const MAX_MEMORY_ITEMS = 12;
  const LOCATION_CACHE_MS = 30000;
  let locationCache = { at: 0, lat: null, lon: null, text: '' };

  const norm = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

  function getApp() {
    try {
      if (typeof App !== 'undefined' && App) return App;
    } catch (_) {}
    return window.App || null;
  }

  function getAssistant() {
    try {
      if (typeof VoiceAssistant !== 'undefined' && VoiceAssistant) return VoiceAssistant;
    } catch (_) {}
    return window.VoiceAssistant || null;
  }

  function getVoice() {
    try {
      if (typeof Voice !== 'undefined' && Voice) return Voice;
    } catch (_) {}
    return window.Voice || null;
  }

  function toUrl(value) {
    try {
      return value instanceof Request ? new URL(value.url) : new URL(String(value), location.href);
    } catch (_) {
      return null;
    }
  }

  function isTomTomUrl(value) {
    const u = toUrl(value);
    return Boolean(u && u.hostname === 'api.tomtom.com');
  }

  function isWorkerAI(value) {
    const u = toUrl(value);
    if (!u) return false;
    const b = new URL(WORKER_BASE);
    return u.origin === b.origin && (u.pathname === '/' || u.pathname === '' || u.pathname === '/v1/chat');
  }

  function buildProxyUrl(value) {
    const s = value instanceof Request ? new URL(value.url) : new URL(String(value), location.href);
    s.searchParams.delete('key');
    return `${WORKER_BASE}/v1/tomtom?path=${encodeURIComponent(s.pathname + (s.search || ''))}`;
  }

  function cloneInitFromRequest(r, o) {
    if (!(r instanceof Request)) return { ...(o || {}) };
    return {
      method: r.method,
      headers: new Headers(r.headers),
      body: r.method === 'GET' || r.method === 'HEAD' ? undefined : r.clone().body,
      signal: r.signal,
      ...(o || {})
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
      return Array.isArray(parsed) ? parsed.map(cleanMemoryItem).filter(Boolean).slice(-MAX_MEMORY_ITEMS) : [];
    } catch (_) {
      return [];
    }
  }

  function saveConversation(items) {
    try {
      sessionStorage.setItem(MEMORY_KEY, JSON.stringify((items || []).map(cleanMemoryItem).filter(Boolean).slice(-MAX_MEMORY_ITEMS)));
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

  function posToGps(pos) {
    if (Array.isArray(pos) && pos.length >= 2) {
      const lon = Number(pos[0]);
      const lat = Number(pos[1]);
      if (Number.isFinite(lat) && Number.isFinite(lon)) return { lat, lon };
    }
    if (pos && typeof pos === 'object') {
      const lat = Number(pos.lat ?? pos.latitude ?? pos.coords?.latitude);
      const lon = Number(pos.lon ?? pos.lng ?? pos.longitude ?? pos.coords?.longitude);
      if (Number.isFinite(lat) && Number.isFinite(lon)) return { lat, lon };
    }
    return null;
  }

  function currentGps() {
    try {
      const app = getApp();
      const candidates = [app?.userPos, app?.filteredPos, app?.rawUserPos, app?.lastPosition, app?.gpsPosition];
      for (const pos of candidates) {
        const gps = posToGps(pos);
        if (gps) return gps;
      }
    } catch (_) {}
    return null;
  }

  function nearbyCachedLocation(gps) {
    if (!locationCache.text || Date.now() - locationCache.at > LOCATION_CACHE_MS) return '';
    return Math.abs(gps.lat - locationCache.lat) < 0.001 && Math.abs(gps.lon - locationCache.lon) < 0.001 ? locationCache.text : '';
  }

  function formatAddress(data, gps) {
    const a = data?.addresses?.[0]?.address || {};
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
    return address ? `${address}.` : '';
  }

  async function getLocationContext() {
    const gps = currentGps();
    if (!gps) return '';
    const cached = nearbyCachedLocation(gps);
    if (cached) return cached;

    let text = `Coordenadas aproximadas: ${gps.lat.toFixed(5)}, ${gps.lon.toFixed(5)}.`;
    try {
      const u = `https://api.tomtom.com/search/2/reverseGeocode/${gps.lat},${gps.lon}.json?language=pt-BR&radius=80`;
      const response = await nativeFetch(buildProxyUrl(u), {
        method: 'GET',
        headers: { Accept: 'application/json' },
        cache: 'no-store'
      });
      if (response.ok) text = formatAddress(await response.json(), gps);
    } catch (_) {}

    locationCache = { at: Date.now(), lat: gps.lat, lon: gps.lon, text };
    return text;
  }

  function firstFinite(...values) {
    for (const value of values) {
      const n = Number(value);
      if (Number.isFinite(n)) return n;
    }
    return NaN;
  }

  function routeContext() {
    try {
      const app = getApp();
      if (!app?.route) return '';

      const route = app.route;
      const summary = route.summary || route.routes?.[0]?.summary || {};
      const totalSeconds = firstFinite(
        summary.travelTimeInSeconds,
        route.travelTimeInSeconds,
        route.duration,
        route.totalDuration,
        app.routeDurationSeconds
      );
      const remainingSecondsDirect = firstFinite(
        app.remainingTimeSeconds,
        app.remainingDuration,
        app.routeRemainingSeconds,
        route.remainingDuration,
        route.durationRemaining
      );
      const totalMeters = firstFinite(
        summary.lengthInMeters,
        route.lengthInMeters,
        route.distance,
        route.totalDistance,
        app.routeTotalMeters
      );
      const progressMeters = firstFinite(app.routeProgressMeters, app.progressMeters, 0);

      let remainingSeconds = remainingSecondsDirect;
      if (!Number.isFinite(remainingSeconds) && Number.isFinite(totalSeconds)) {
        if (Number.isFinite(totalMeters) && totalMeters > 0 && Number.isFinite(progressMeters)) {
          remainingSeconds = Math.max(0, totalSeconds * (1 - Math.min(1, progressMeters / totalMeters)));
        } else {
          remainingSeconds = totalSeconds;
        }
      }

      const parts = [];
      if (app.navActive) parts.push('A navegação do Radar está ativa.');
      if (Number.isFinite(remainingSeconds)) {
        parts.push(`Tempo estimado restante: aproximadamente ${Math.max(1, Math.round(remainingSeconds / 60))} minutos.`);
      }
      if (Number.isFinite(totalMeters)) {
        const remainingMeters = Math.max(0, totalMeters - (Number.isFinite(progressMeters) ? progressMeters : 0));
        parts.push(`Distância aproximada restante: ${remainingMeters >= 1000 ? (remainingMeters / 1000).toFixed(1) + ' km' : Math.round(remainingMeters) + ' metros'}.`);
      }
      const destination = app.destinationLabel || app.destinationName || app.routeDestinationName || app.destination?.label || app.destination?.name;
      if (destination) parts.push(`Destino: ${String(destination).slice(0, 160)}.`);
      return parts.join(' ');
    } catch (_) {
      return '';
    }
  }

  function isWhereAmI(question) {
    const n = norm(question).replace(/^radar[, ]*/, '');
    return /^(onde|aonde) (eu )?(estou|to)$/.test(n) || n.includes('minha localizacao atual') || n.includes('qual e minha localizacao');
  }

  function isEtaQuestion(question) {
    const n = norm(question).replace(/^radar[, ]*/, '');
    return n.includes('quanto tempo falta') || n.includes('falta quanto tempo') || n.includes('quanto falta para chegar') || n.includes('quanto falta pra chegar') || n.includes('hora de chegada') || n.includes('chegar no destino');
  }

  function localDeviceCommand(question) {
    const n = norm(question).replace(/^radar[, ]*/, '');
    if (/^(abra|abrir|abre) (o )?youtube/.test(n)) {
      window.open('https://www.youtube.com/', '_blank');
      return 'Abri o YouTube.';
    }
    if (/^(abra|abrir|abre) (o )?whatsapp/.test(n)) {
      window.open('https://wa.me/', '_blank');
      return 'Abri o WhatsApp.';
    }
    if (/^(abra|abrir|abre) (a )?camera/.test(n)) {
      try {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*,video/*';
        input.capture = 'environment';
        input.style.display = 'none';
        document.body.appendChild(input);
        input.onchange = () => input.remove();
        input.click();
        return 'Vou abrir a câmera. O Android pode pedir sua permissão.';
      } catch (_) {
        return 'Não consegui abrir a câmera neste navegador.';
      }
    }
    return '';
  }

  function speakLocal(text) {
    try {
      const assistant = getAssistant();
      if (assistant?.reply) return assistant.reply(text);
      const voice = getVoice();
      if (voice?.speak) return voice.speak(text, true);
    } catch (_) {}
  }

  async function localAnswer(question) {
    const device = localDeviceCommand(question);
    if (device) return device;

    if (isWhereAmI(question)) {
      const loc = await getLocationContext();
      if (loc) {
        const clean = loc.replace(/Coordenadas aproximadas:.*/i, '').trim().replace(/[.]$/, '');
        return clean ? `Você está em ${clean}.` : `Sua localização atual é ${loc}`;
      }
      return 'O mapa ainda não recebeu uma posição válida do GPS. Aguarde alguns segundos e tente novamente.';
    }

    if (isEtaQuestion(question)) {
      const route = routeContext();
      const match = route.match(/Tempo estimado restante: aproximadamente (\d+) minutos/i);
      if (match) return `Faltam aproximadamente ${match[1]} minutos para chegar ao destino.`;
      const app = getApp();
      if (app?.route) return 'A rota está carregada, mas ainda não consegui calcular o tempo restante desta navegação.';
      return 'Não há uma rota ativa no momento.';
    }

    return '';
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
      if (!Array.isArray(payload.history) || payload.history.length === 0) payload.history = loadConversation();

      const loc = await getLocationContext();
      const route = routeContext();
      const context = [];
      if (loc) context.push(`GPS atual do motorista: ${loc}`);
      if (route) context.push(route);
      if (context.length && question) {
        payload.message = `${question}\n\n[Contexto em tempo real fornecido pelo próprio Radar: ${context.join(' ')} Use esses dados diretamente para responder perguntas sobre posição, localização, rota, distância ou tempo de chegada. Não diga que não tem acesso ao GPS ou à rota quando esses dados estiverem presentes.]`;
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
      if (typeof normalized.resposta !== 'string' && typeof normalized.reply === 'string') normalized.resposta = normalized.reply;
      if (typeof normalized.erro !== 'string' && typeof normalized.error === 'string') normalized.erro = normalized.error;
      if (response.ok && question && typeof normalized.resposta === 'string' && normalized.resposta.trim()) {
        rememberExchange(question, normalized.resposta);
      }
      return new Response(JSON.stringify(normalized), {
        status: response.status,
        statusText: response.statusText,
        headers: { 'Content-Type': 'application/json; charset=utf-8' }
      });
    } catch (_) {
      return response;
    }
  }

  window.fetch = function radarProtectedFetch(input, init) {
    const method = String(init?.method || (input instanceof Request ? input.method : 'GET')).toUpperCase();
    if (method === 'POST' && isWorkerAI(input)) {
      const next = cloneInitFromRequest(input, init);
      next.method = 'POST';
      next.headers = new Headers(next.headers || {});
      next.headers.set('Content-Type', 'application/json');
      return normalizeAIBody(next.body).then(({ body, question }) => {
        next.body = body;
        return nativeFetch(AI_CHAT, next).then((r) => normalizeAIResponse(r, question));
      });
    }
    if (!isTomTomUrl(input) || method !== 'GET') return nativeFetch(input, init);
    const next = cloneInitFromRequest(input, init);
    delete next.mode;
    delete next.credentials;
    return nativeFetch(buildProxyUrl(input), next);
  };

  function improveAssistant() {
    const assistant = getAssistant();
    if (!assistant || assistant.__conversationBridgeInstalledV3) return Boolean(assistant);
    assistant.__conversationBridgeInstalledV3 = true;
    assistant.conversationWindowMs = 20000;
    assistant.conversationUntil = 0;

    const originalAskAI = typeof assistant.askAI === 'function' ? assistant.askAI.bind(assistant) : null;
    if (originalAskAI) {
      assistant.askAI = async function enhancedAskAI(question, ...rest) {
        const local = await localAnswer(question);
        if (local) {
          speakLocal(local);
          return true;
        }
        return originalAskAI(question, ...rest);
      };
    }

    const originalReply = typeof assistant.reply === 'function' ? assistant.reply.bind(assistant) : null;
    if (originalReply) {
      assistant.reply = function enhancedReply(text, ...rest) {
        if (this.handsFree) this.conversationUntil = Date.now() + this.conversationWindowMs;
        return originalReply(text, ...rest);
      };
    }

    const originalWake = typeof assistant.hasWakeWord === 'function' ? assistant.hasWakeWord.bind(assistant) : null;
    if (originalWake) {
      assistant.hasWakeWord = function enhancedWakeWord(text) {
        return originalWake(text) || (this.handsFree && Date.now() < this.conversationUntil);
      };
    }

    return true;
  }

  let attempts = 0;
  const timer = setInterval(() => {
    attempts += 1;
    if (improveAssistant() || attempts > 120) clearInterval(timer);
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
