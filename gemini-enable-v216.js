/* Radar Seguro RJ PRO v216 — habilita o Gemini Live v205 sem alterar o módulo aprovado. */
(()=>{'use strict';
const env=String(window.__RADAR_TEST_ENV||'');
if(!env.includes('GEMINI-LIVE-v205')) window.__RADAR_TEST_ENV=(env+' GEMINI-LIVE-v205').trim();
})();