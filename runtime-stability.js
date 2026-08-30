/* Radar Seguro RJ PRO — proteção leve de estabilidade
   Evita trabalho desnecessário quando o app está em segundo plano,
   protege contra rajadas de eventos e mantém a tela ativa na navegação. */
(() => {
  'use strict';

  if (window.__radarRuntimeStabilityInstalled) return;
  window.__radarRuntimeStabilityInstalled = true;

  const debounce = (fn, wait = 250) => {
    let timer = 0;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), wait);
    };
  };

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) return;
    try {
      if (typeof App !== 'undefined' && App.map && typeof App.map.resize === 'function') {
        requestAnimationFrame(() => App.map.resize());
      }
    } catch (error) {
      console.warn('Radar Seguro: ajuste de retorno ao app ignorado.', error);
    }
  }, { passive: true });

  const resizeMap = debounce(() => {
    try {
      if (typeof App !== 'undefined' && App.map && typeof App.map.resize === 'function') {
        App.map.resize();
      }
    } catch (error) {
      console.warn('Radar Seguro: resize do mapa ignorado.', error);
    }
  }, 180);

  window.addEventListener('resize', resizeMap, { passive: true });
  window.addEventListener('orientationchange', resizeMap, { passive: true });

  window.RadarRuntime = window.RadarRuntime || {};
  window.RadarRuntime.online = navigator.onLine;
  window.RadarRuntime.visible = !document.hidden;
  window.RadarRuntime.wakeLock = null;
  window.RadarRuntime.wakeLockSupported = 'wakeLock' in navigator;

  const updateRuntimeState = debounce(() => {
    window.RadarRuntime.online = navigator.onLine;
    window.RadarRuntime.visible = !document.hidden;
    window.RadarRuntime.changedAt = Date.now();
  }, 120);

  window.addEventListener('online', updateRuntimeState, { passive: true });
  window.addEventListener('offline', updateRuntimeState, { passive: true });
  document.addEventListener('visibilitychange', updateRuntimeState, { passive: true });

  const releaseWakeLock = async () => {
    const lock = window.RadarRuntime.wakeLock;
    window.RadarRuntime.wakeLock = null;
    if (!lock) return;
    try {
      await lock.release();
    } catch (error) {
      console.warn('Radar Seguro: não foi possível liberar o bloqueio de tela.', error);
    }
  };

  const requestWakeLock = async () => {
    if (!window.RadarRuntime.wakeLockSupported) return false;
    if (document.hidden) return false;
    if (typeof App === 'undefined' || !App.navActive) return false;
    if (window.RadarRuntime.wakeLock) return true;

    try {
      const lock = await navigator.wakeLock.request('screen');
      window.RadarRuntime.wakeLock = lock;
      lock.addEventListener('release', () => {
        if (window.RadarRuntime.wakeLock === lock) {
          window.RadarRuntime.wakeLock = null;
        }
      }, { once: true });
      return true;
    } catch (error) {
      console.warn('Radar Seguro: Wake Lock indisponível neste momento.', error);
      return false;
    }
  };

  window.RadarRuntime.requestWakeLock = requestWakeLock;
  window.RadarRuntime.releaseWakeLock = releaseWakeLock;

  // O Android pode liberar o Wake Lock quando a aba perde visibilidade.
  // Ao voltar para a navegação, solicitamos novamente sem reiniciar GPS/rota.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) return;
    setTimeout(() => requestWakeLock(), 120);
  }, { passive: true });

  // Conecta o Wake Lock ao ciclo de navegação sem alterar a implementação
  // principal. Se o navegador não oferecer a API, tudo continua funcionando.
  const installNavigationWakeLock = () => {
    if (typeof App === 'undefined' || App.__wakeLockIntegrationInstalled) return false;
    if (typeof App.startNavigation !== 'function' || typeof App.clearRoute !== 'function') return false;

    App.__wakeLockIntegrationInstalled = true;

    const originalStartNavigation = App.startNavigation.bind(App);
    App.startNavigation = function (...args) {
      const result = originalStartNavigation(...args);
      Promise.resolve(result).finally(() => {
        if (this.navActive) requestWakeLock();
      });
      return result;
    };

    const originalClearRoute = App.clearRoute.bind(App);
    App.clearRoute = function (...args) {
      releaseWakeLock();
      return originalClearRoute(...args);
    };

    if (typeof App.stopNavigation === 'function') {
      const originalStopNavigation = App.stopNavigation.bind(App);
      App.stopNavigation = function (...args) {
        releaseWakeLock();
        return originalStopNavigation(...args);
      };
    }

    if (App.navActive) requestWakeLock();
    return true;
  };

  if (!installNavigationWakeLock()) {
    let attempts = 0;
    const timer = setInterval(() => {
      attempts += 1;
      if (installNavigationWakeLock() || attempts >= 40) clearInterval(timer);
    }, 250);
  }
})();
