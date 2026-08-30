/* Radar Seguro RJ PRO — melhorias modulares de navegação
   Mantém semáforos apenas como pontos no mapa, adiciona avisos de radar
   e mensagens de voz no recálculo sem alterar o núcleo do index.html. */
(() => {
  'use strict';

  if (typeof App === 'undefined' || typeof Voice === 'undefined') return;
  if (App.__navEnhancementsInstalled) return;
  App.__navEnhancementsInstalled = true;

  App.radarVoiceAnnounced = Object.create(null);

  // Semáforos continuam desenhados no mapa, mas não tentamos adivinhar
  // vermelho, amarelo ou verde pelo fluxo do trânsito.
  App.refreshTrafficFlow = async function () {};
  App.updateTrafficLightHUD = function () {
    this.trafficStopSince = 0;
    const hud = document.getElementById('trafficLightHud');
    if (hud) hud.classList.remove('show');
    if (typeof this.clearTrafficLights === 'function') this.clearTrafficLights();
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

  const originalUpdateNavigation = App.updateNavigation.bind(App);
  App.updateNavigation = function () {
    originalUpdateNavigation();
    this.checkRadarVoice();
  };

  const originalStartNavigation = App.startNavigation.bind(App);
  App.startNavigation = function () {
    this.radarVoiceAnnounced = Object.create(null);
    return originalStartNavigation();
  };

  const originalClearRoute = App.clearRoute.bind(App);
  App.clearRoute = function () {
    this.radarVoiceAnnounced = Object.create(null);
    return originalClearRoute();
  };

  const originalRecalculateRoute = App.recalculateRoute.bind(App);
  App.recalculateRoute = async function () {
    if (!this.destination || !this.userPos || this.rerouting) return;

    const previousRoute = this.route;
    const announceTimer = setTimeout(() => {
      if (this.rerouting) {
        Voice.speak('Você saiu da rota. Recalculando o melhor caminho.', true);
      }
    }, 180);

    try {
      await originalRecalculateRoute();
    } finally {
      clearTimeout(announceTimer);
    }

    if (this.route && this.route !== previousRoute) {
      this.radarVoiceAnnounced = Object.create(null);
      setTimeout(() => {
        if (this.navActive) {
          Voice.speak('Nova rota calculada. Siga as novas orientações.', true);
        }
      }, 450);
    }
  };
})();
