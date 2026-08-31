/* Radar Seguro RJ PRO — contexto local do assistente
   Liga perguntas de localização e ETA aos dados reais do navegador/rota. */
(() => {
  'use strict';
  if (window.__radarAssistantContextV1) return;
  window.__radarAssistantContextV1 = true;

  const WORKER_BASE = 'https://radar-seguro-ia-rj.claudio41cg.workers.dev';
  const normalize = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

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

  function isWhere(question) {
    const n = normalize(question).replace(/^radar[, ]*/, '');
    return /^(onde|aonde) (eu )?(estou|to)$/.test(n) || n.includes('minha localizacao') || n.includes('qual e minha localizacao');
  }

  function isEta(question) {
    const n = normalize(question).replace(/^radar[, ]*/, '');
    return n.includes('quanto tempo falta') || n.includes('falta quanto tempo') || n.includes('quanto falta para chegar') || n.includes('quanto falta pra chegar') || n.includes('hora de chegada') || n.includes('tempo ate o destino') || n.includes('tempo até o destino');
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
    if (!gps) return '';
    try {
      const path = `/search/2/reverseGeocode/${gps.lat},${gps.lon}.json?language=pt-BR&radius=80`;
      const url = `${WORKER_BASE}/v1/tomtom?path=${encodeURIComponent(path)}`;
      const r = await fetch(url, { cache: 'no-store' });
      if (!r.ok) throw new Error('reverse');
      const data = await r.json();
      const a = data?.addresses?.[0]?.address || {};
      const parts = [];
      const street = String(a.streetName || '').trim();
      const number = String(a.streetNumber || '').trim();
      const district = String(a.municipalitySubdivision || a.localName || '').trim();
      const city = String(a.municipality || '').trim();
      if (street) parts.push(number ? `${street}, ${number}` : street);
      if (district && !parts.includes(district)) parts.push(district);
      if (city && !parts.includes(city)) parts.push(city);
      return parts.join(', ') || String(a.freeformAddress || '').trim();
    } catch (_) {
      return '';
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
    if (isWhere(question)) {
      const gps = await browserGps();
      if (!gps) return 'O GPS está ativo no mapa, mas não consegui ler a posição agora. Tente novamente em alguns segundos.';
      const address = await reverseAddress(gps);
      if (address) return `Você está em ${address}.`;
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
    if (!assistant || assistant.__gpsEtaDirectV1) return Boolean(assistant?.__gpsEtaDirectV1);
    assistant.__gpsEtaDirectV1 = true;

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
