/* Radar Seguro RJ PRO — melhorias modulares de navegação
   Mantém semáforos apenas como pontos no mapa, adiciona avisos de radar,
   mensagens de recálculo, chegada automática e instruções naturais. */
(() => {
  'use strict';

  if (typeof App === 'undefined' || typeof Voice === 'undefined') return;
  if (App.__navEnhancementsInstalled) return;
  App.__navEnhancementsInstalled = true;

  App.radarVoiceAnnounced = Object.create(null);
  App.exitPrepAnnounced = Object.create(null);
  App.autoArrivalSince = 0;
  App.autoArrivalDone = false;
  App.lastForcedRerouteVoiceAt = 0;

  App.refreshTrafficFlow = async function () {};
  App.updateTrafficLightHUD = function () {
    this.trafficStopSince = 0;
    const hud = document.getElementById('trafficLightHud');
    if (hud) hud.classList.remove('show');
    if (typeof this.clearTrafficLights === 'function') this.clearTrafficLights();
  };

  const originalManeuverText = typeof App.maneuverText === 'function'
    ? App.maneuverText.bind(App)
    : null;

  App.maneuverText = function (step) {
    if (!step) return originalManeuverText ? originalManeuverText(step) : 'Siga em frente';

    const maneuver = step.maneuver || {};
    const type = String(maneuver.type || step.type || '').toLowerCase();
    const modifier = String(maneuver.modifier || step.modifier || '').toLowerCase();
    const name = String(step.name || step.streetName || '').trim();
    const left = modifier.includes('left') || modifier.includes('esquer');
    const right = modifier.includes('right') || modifier.includes('direit');
    const road = name && !/siga pela via/i.test(name) ? ` para ${name}` : '';

    if (type.includes('fork')) {
      if (left) return `Mantenha-se à esquerda${road}`;
      if (right) return `Mantenha-se à direita${road}`;
    }

    if (type.includes('exit') || type.includes('ramp')) {
      if (left) return `Pegue a saída à esquerda${road}`;
      if (right) return `Pegue a saída à direita${road}`;
      return road ? `Pegue a saída${road}` : 'Pegue a saída à frente';
    }

    return originalManeuverText ? originalManeuverText(step) : 'Siga em frente';
  };

  App.isExitLikeStep = function (step) {
    const type = String(step?.maneuver?.type || '').toLowerCase();
    return type.includes('exit') || type.includes('ramp') || type.includes('fork');
  };

  App.checkExitPreparationVoice = function () {
    if (!this.navActive || !this.route || !this.userPos || this.currentSpeed < 18) return;

    const guidance = this.getUpcomingGuidance?.();
    if (!guidance?.step || !this.isExitLikeStep(guidance.step)) return;

    const distance = Number(guidance.distance) || 0;
    if (distance < 420 || distance > 900) return;

    const key = `exit-prep-${guidance.index}`;
    if (this.exitPrepAnnounced[key]) return;

    const now = Date.now();
    if (now - this.lastStepVoiceAt < 4500) return;
    if (Voice.speaking || Voice.queue?.length) return;

    const mod = String(guidance.step.maneuver?.modifier || '').toLowerCase();
    const side = mod.includes('left') ? ' à esquerda' : mod.includes('right') ? ' à direita' : '';
    const name = String(guidance.step.name || '').trim();
    const destination = name && !/siga pela via/i.test(name) ? ` para ${name}` : '';

    this.exitPrepAnnounced[key] = true;
    this.lastStepVoiceAt = now;
    Voice.speak(`Prepare-se para pegar a saída${side}${destination}.`);
  };

  App.checkRadarVoice = function () {
    if (!this.navActive || !this.route || !this.userPos || this.currentSpeed < 4.5) return;

    const cumulative = this.route.cumulative || [];
    const progress = Number(this.routeProgressMeters) || 0;

    for (let i = 0; i < (this.routeHazards || []).length; i++) {
      const hazard = this.routeHazards[i];
      if (!hazard || hazard.type !== 'radar') continue;
      if (hazard.routeIndex < this.routeProgressIndex - 4) continue;

      const radarProgress = Number(cumulative[hazard.routeIndex]);
      if (!Number.isFinite(radarProgress)) continue;

      const distance = radarProgress - progress;
      if (distance < -35 || distance > 520) continue;

      const id = `${hazard.routeIndex}-${hazard.coords?.[0] || 0}-${hazard.coords?.[1] || 0}`;
      const farKey = `${id}-far`;
      const nearKey = `${id}-near`;
      const now = Date.now();

      if (distance <= 350 && distance > 110 && !this.radarVoiceAnnounced[farKey]) {
        if (now - this.lastStepVoiceAt < 2600) return;
        const spokenDistance = Math.max(100, Math.round(distance / 50) * 50);
        this.radarVoiceAnnounced[farKey] = true;
        this.lastStepVoiceAt = now;
        Voice.speak(`Atenção, radar a ${spokenDistance} metros.`);
        return;
      }

      if (distance <= 85 && distance >= 0 && !this.radarVoiceAnnounced[nearKey]) {
        if (now - this.lastStepVoiceAt < 2200) return;
        this.radarVoiceAnnounced[nearKey] = true;
        this.radarVoiceAnnounced[farKey] = true;
        this.lastStepVoiceAt = now;
        Voice.speak('Radar logo à frente.');
        return;
      }
    }
  };

  App.routeHasSharpBendSoon = function () {
    if (!this.route) return false;

    const coords = this.route.coords || this.route.coordinates || this.route.geometry?.coordinates || [];
    const cumulative = this.route.cumulative || [];
    const start = Math.max(0, Number(this.routeProgressIndex) || 0);
    if (!Array.isArray(coords) || coords.length < start + 3) return false;

    const bearing = (a, b) => {
      const toRad = Math.PI / 180;
      const lat1 = Number(a[1]) * toRad;
      const lat2 = Number(b[1]) * toRad;
      const dLon = (Number(b[0]) - Number(a[0])) * toRad;
      const y = Math.sin(dLon) * Math.cos(lat2);
      const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
      return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
    };
    const angleDiff = (a, b) => {
      let d = Math.abs(a - b) % 360;
      return d > 180 ? 360 - d : d;
    };

    const baseProgress = Number(this.routeProgressMeters) || Number(cumulative[start]) || 0;
    let previousBearing = null;

    for (let i = start; i < Math.min(coords.length - 1, start + 18); i++) {
      const routeMeters = Number(cumulative[i]);
      if (Number.isFinite(routeMeters) && routeMeters - baseProgress > 75) break;

      const a = coords[i];
      const b = coords[i + 1];
      if (!Array.isArray(a) || !Array.isArray(b)) continue;

      const currentBearing = bearing(a, b);
      if (previousBearing !== null && angleDiff(previousBearing, currentBearing) >= 28) return true;
      previousBearing = currentBearing;
    }
    return false;
  };

  App.shouldSuppressLongVoiceNearBend = function (text) {
    if (!this.navActive || !this.routeHasSharpBendSoon?.()) return false;
    const match = String(text || '').match(/\b(\d{2,4})\s*(?:m|metro|metros)\b/i);
    if (!match) return false;
    const meters = Number(match[1]);
    return Number.isFinite(meters) && meters >= 100;
  };

  App.checkAutomaticArrival = function () {
    if (!this.navActive || !this.route || !this.userPos || !this.destination || this.autoArrivalDone) return;

    const destination = Array.isArray(this.destination)
      ? this.destination
      : (this.destination.coords || this.destination.coordinates || null);
    if (!Array.isArray(destination) || destination.length < 2) return;

    let distanceKm = Infinity;
    try {
      if (typeof Utils !== 'undefined' && typeof Utils.distanceKm === 'function') {
        distanceKm = Utils.distanceKm(this.userPos[0], this.userPos[1], Number(destination[0]), Number(destination[1]));
      }
    } catch (error) {}

    if (!Number.isFinite(distanceKm)) return;

    const distanceMeters = distanceKm * 1000;
    const speed = Number(this.currentSpeed) || 0;
    const now = Date.now();

    if (distanceMeters <= 24 && speed <= 14) {
      if (!this.autoArrivalSince) this.autoArrivalSince = now;
      if (now - this.autoArrivalSince < 5500) return;

      this.autoArrivalDone = true;
      this.autoArrivalSince = 0;

      setTimeout(() => {
        if (!this.navActive) return;
        try {
          if (typeof this.stopNavigation === 'function') {
            this.stopNavigation();
          } else if (typeof this.clearRoute === 'function') {
            this.clearRoute();
          }
        } catch (error) {
          console.warn('Radar Seguro: não foi possível encerrar a navegação automaticamente.', error);
          this.autoArrivalDone = false;
        }
      }, 900);
      return;
    }

    if (distanceMeters > 38 || speed > 18) this.autoArrivalSince = 0;
  };

  const originalUpdateNavigation = App.updateNavigation.bind(App);
  App.updateNavigation = function () {
    const originalSpeak = Voice.speak.bind(Voice);
    Voice.speak = (text, force) => {
      if (this.shouldSuppressLongVoiceNearBend(text)) return;
      return originalSpeak(text, force);
    };

    try {
      originalUpdateNavigation();
    } finally {
      Voice.speak = originalSpeak;
    }

    this.checkExitPreparationVoice();
    this.checkRadarVoice();
    this.checkAutomaticArrival();
  };

  const resetVoiceState = function () {
    this.radarVoiceAnnounced = Object.create(null);
    this.exitPrepAnnounced = Object.create(null);
    this.autoArrivalSince = 0;
    this.autoArrivalDone = false;
  };

  const originalStartNavigation = App.startNavigation.bind(App);
  App.startNavigation = function () {
    resetVoiceState.call(this);
    return originalStartNavigation();
  };

  const originalClearRoute = App.clearRoute.bind(App);
  App.clearRoute = function () {
    resetVoiceState.call(this);
    return originalClearRoute();
  };

  const originalRecalculateRoute = App.recalculateRoute.bind(App);
  App.recalculateRoute = async function () {
    if (!this.destination || !this.userPos || this.rerouting) return;

    const previousRoute = this.route;
    const now = Date.now();
    if (this.navActive && now - this.lastForcedRerouteVoiceAt > 3500) {
      this.lastForcedRerouteVoiceAt = now;
      Voice.speak('Você saiu da rota. Recalculando o melhor caminho.', true);
    }

    try {
      await originalRecalculateRoute();
    } catch (error) {
      throw error;
    }

    if (this.route && this.route !== previousRoute) {
      resetVoiceState.call(this);
      setTimeout(() => {
        if (this.navActive) {
          Voice.speak('Nova rota calculada. Siga as novas orientações.');
        }
      }, 900);
    }
  };
})();
