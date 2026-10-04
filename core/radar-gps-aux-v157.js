/* Radar Seguro RJ PRO — tarefas auxiliares do GPS v157
   Responsabilidade: limitar a frequência de tarefas auxiliares disparadas
   por atualizações de posição. Não adquire GPS e não altera a rota.
*/
(()=>{'use strict';

if(window.RadarGPSAuxV157)return;

function run(app,force=false){
  const now=Date.now();
  const moving=app.currentSpeed>=3;

  const interval=
    app.navActive
      ?(moving?1200:4000)
      :(moving?2500:7000);

  if(
    !force&&
    app._lastGPSAuxAt&&
    now-app._lastGPSAuxAt<interval
  ){
    return false;
  }

  app._lastGPSAuxAt=now;

  app.checkCommunityDanger();
  app.updateCommunityBillboard();
  app.renderHazards();

  return true;
}

window.RadarGPSAuxV157=Object.freeze({
  run,
  version:'157'
});

})();