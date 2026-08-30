/* Radar Seguro RJ PRO — proteção leve de estabilidade
   Evita trabalho desnecessário quando o app está em segundo plano e
   protege contra rajadas de eventos online/offline/resize no celular. */
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

  // Quando o usuário volta ao aplicativo, pedimos apenas um redesenho leve
  // do mapa. Não reiniciamos GPS, rota nem serviços que já estejam ativos.
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

  // Mudanças rápidas de orientação/tamanho no Android podem disparar vários
  // eventos. Um único resize após a rajada é suficiente para o MapLibre.
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

  // Estado simples de conectividade para outros módulos consultarem sem
  // criar listeners duplicados. Não altera rota nem mostra mensagens extras.
  window.RadarRuntime = window.RadarRuntime || {};
  window.RadarRuntime.online = navigator.onLine;
  window.RadarRuntime.visible = !document.hidden;

  const updateRuntimeState = debounce(() => {
    window.RadarRuntime.online = navigator.onLine;
    window.RadarRuntime.visible = !document.hidden;
    window.RadarRuntime.changedAt = Date.now();
  }, 120);

  window.addEventListener('online', updateRuntimeState, { passive: true });
  window.addEventListener('offline', updateRuntimeState, { passive: true });
  document.addEventListener('visibilitychange', updateRuntimeState, { passive: true });
})();
