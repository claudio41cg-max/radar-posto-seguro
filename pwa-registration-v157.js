/* Radar Seguro RJ PRO — registro PWA v157 */
(()=>{
  'use strict';

  if(!('serviceWorker' in navigator))return;

  window.addEventListener('load',()=>{
    navigator.serviceWorker
      .register('./service-worker.js',{scope:'./',updateViaCache:'none'})
      .then(registration=>{
        registration.update().catch(()=>{});
      })
      .catch(error=>{
        console.warn('[Radar PWA] falha ao registrar Service Worker:',error);
      });
  },{once:true});
})();
