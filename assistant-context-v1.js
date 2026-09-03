/* Radar Seguro RJ PRO — contexto local do assistente v112
   Responde localização, rua, bairro e ETA usando os dados reais do aparelho/rota. */
(() => {
  'use strict';
  if (window.__radarAssistantContextV112) return;
  window.__radarAssistantContextV112 = true;

  const config = window.RADAR_CONFIG_V100 || {};
  const WORKER_BASE = config.AI_ENDPOINT || 'https://radar-seguro-ia-rj.claudio41cg.workers.dev';
  const normalize = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
  const cleanQuestion = (s) => normalize(s).replace(/^radar[, ]*/, '').trim();

  function getLexical(name) {
    try { return (0, eval)(`typeof ${name} !== 'undefined' ? ${name} : null`); } catch (_) { return null; }
  }

  function getApp() {
    return getLexical('App') || window.App || null;
  }

  function getAssistant() {
    return getLexical('VoiceAssistant') || window.VoiceAssistant || null;
  }

  function getVoice() {
    return getLexical('Voice') || window.Voice || null;
  }

  function locationIntent(question) {
    const n = cleanQuestion(question);
    if (/^(onde|aonde) (eu )?(estou|to)( agora)?$/.test(n) || n.includes('minha localizacao') || n.includes('qual e minha localizacao')) return 'full';
    if (n.includes('qual bairro') || n.includes('que bairro') || n.includes('em que bairro') || n.includes('bairro eu estou') || n.includes('bairro eu to')) return 'district';
    if (n.includes('qual rua') || n.includes('que rua') || n.includes('em que rua') || n.includes('rua eu estou') || n.includes('rua eu to') || n.includes('nome da rua')) return 'street';
    return '';
  }

  function isEta(question) {
    const n = cleanQuestion(question);
    return n.includes('quanto tempo falta') || n.includes('falta quanto tempo') || n.includes('quanto falta para chegar') || n.includes('quanto falta pra chegar') || n.includes('hora de chegada') || n.includes('tempo ate o destino');
  }

  function speak(text) {
    const assistant = getAssistant();
    try {
      if (assistant?.reply) return assistant.reply(text);
      const voice = getVoice();
      if (voice?.speak) return voice.speak(text, true);
      if ('speechSynthesis' in window) {
        const u = new SpeechSynthesisUtterance(text);
        u.lang = 'pt-BR';
        speechSynthesis.cancel();
        speechSynthesis.speak(u);
      }
    } catch (_) {}
  }

  function appGps() {
    const app = getApp();
    const candidates = [app?.userPos, app?.filteredPos, app?.rawUserPos];
    for (const p of candidates) {
      if (Array.isArray(p) && p.length >= 2) {
        const lon = Number(p[0]), lat = Number(p[1]);
        if (Number.isFinite(lat) && Number.isFinite(lon)) return { lat, lon };
      }
      if (p && typeof p === 'object') {
        const lat = Number(p.lat ?? p.latitude ?? p.coords?.latitude);
        const lon = Number(p.lon ?? p.lng ?? p.longitude ?? p.coords?.longitude);
        if (Number.isFinite(lat) && Number.isFinite(lon)) return { lat, lon };
      }
    }
    return null;
  }

  async function browserGps() {
    const fromApp = appGps();
    if (fromApp) return fromApp;
    if (!navigator.geolocation) return null;
    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (p) => resolve({ lat: p.coords.latitude, lon: p.coords.longitude }),
        () => resolve(null),
        { enableHighAccuracy: true, maximumAge: 10000, timeout: 7000 }
      );
    });
  }

  async function reverseAddress(gps) {
    if (!gps) return null;
    try {
      const path = `/search/2/reverseGeocode/${gps.lat},${gps.lon}.json?language=pt-BR&radius=80`;
      const url = `${WORKER_BASE}/v1/tomtom?path=${encodeURIComponent(path)}`;
      const r = await fetch(url, { cache: 'no-store' });
      if (!r.ok) throw new Error('reverse');
      const data = await r.json();
      const a = data?.addresses?.[0]?.address || {};
      const street = String(a.streetName || '').trim();
      const number = String(a.streetNumber || '').trim();
      const district = String(a.municipalitySubdivision || a.localName || '').trim();
      const city = String(a.municipality || '').trim();
      const freeform = String(a.freeformAddress || '').trim();
      const parts = [];
      if (street) parts.push(number ? `${street}, ${number}` : street);
      if (district && !parts.includes(district)) parts.push(district);
      if (city && !parts.includes(city)) parts.push(city);
      return { street, number, district, city, full: parts.join(', ') || freeform };
    } catch (_) {
      return null;
    }
  }

  function etaMinutes() {
    const app = getApp();
    try {
      const route = app?.route;
      if (route) {
        const totalSeconds = Number(route.duration ?? route.summary?.travelTimeInSeconds);
        const totalMeters = Number(route.distance ?? route.summary?.lengthInMeters);
        const progress = Number(app?.routeProgressMeters || 0);
        if (Number.isFinite(totalSeconds)) {
          let seconds = totalSeconds;
          if (Number.isFinite(totalMeters) && totalMeters > 0 && Number.isFinite(progress)) {
            seconds = Math.max(0, totalSeconds * (1 - Math.min(1, progress / totalMeters)));
          }
          return Math.max(1, Math.round(seconds / 60));
        }
      }
    } catch (_) {}

    const sheet = document.getElementById('sheetTime');
    const match = String(sheet?.textContent || '').match(/(\d+)\s*min/i);
    return match ? Number(match[1]) : null;
  }

  async function localAnswer(question) {
    const intent = locationIntent(question);
    if (intent) {
      const gps = await browserGps();
      if (!gps) return 'Não consegui ler sua posição agora. Tente novamente em alguns segundos.';
      const address = await reverseAddress(gps);
      if (intent === 'district') {
        if (address?.district) return `Você está no bairro ${address.district}.`;
        if (address?.full) return `Sua localização atual é ${address.full}.`;
      }
      if (intent === 'street') {
        if (address?.street) return `Você está na ${address.street}${address.number ? `, próximo ao número ${address.number}` : ''}.`;
        if (address?.full) return `Sua localização atual é ${address.full}.`;
      }
      if (address?.full) return `Você está em ${address.full}.`;
      return `Sua posição atual é latitude ${gps.lat.toFixed(5)} e longitude ${gps.lon.toFixed(5)}.`;
    }

    if (isEta(question)) {
      const mins = etaMinutes();
      if (Number.isFinite(mins)) return `Faltam aproximadamente ${mins} minutos para chegar ao destino.`;
      return 'A navegação está aberta, mas ainda não consegui ler o tempo restante da rota.';
    }
    return '';
  }

  function install() {
    const assistant = getAssistant();
    if (!assistant || assistant.__localContextV112) return Boolean(assistant?.__localContextV112);
    assistant.__localContextV112 = true;

    const originalAskAI = typeof assistant.askAI === 'function' ? assistant.askAI.bind(assistant) : null;
    if (!originalAskAI) return false;

    assistant.askAI = async function(question, ...rest) {
      const answer = await localAnswer(question);
      if (answer) {
        speak(answer);
        return true;
      }
      return originalAskAI(question, ...rest);
    };
    return true;
  }

  if (!install()) {
    let tries = 0;
    const timer = setInterval(() => {
      tries += 1;
      if (install() || tries > 80) clearInterval(timer);
    }, 250);
  }
})();
