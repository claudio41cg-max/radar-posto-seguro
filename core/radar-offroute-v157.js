/* Radar Seguro RJ PRO — detecção de saída da rota v157
   Responsabilidade exclusiva:
   - avaliar distância/qualidade do match;
   - decidir quando pedir recálculo;
   - não calcula rota e não toca em voz/câmera/seta.
*/
(()=>{'use strict';

if(window.RadarOffRouteV157)return;

function isRoundaboutSoon(app){
  const guidance=app.getUpcomingGuidance?.();

  if(!guidance?.step)return false;

  return Boolean(
    app.isRoundaboutStep?.(guidance.step)&&
    guidance.distance<=180
  );
}

function check(app,match){
  if(
    !app.navActive||
    !app.route||
    !app.userPos||
    app.rerouting
  )return false;

  if(app.currentSpeed<4){
    app.offRouteHits=0;
    return false;
  }

  if(app.currentAccuracy>55)return false;

  let threshold=Math.max(
    28,
    Math.min(
      48,
      24+app.currentAccuracy*.38
    )
  );

  if(isRoundaboutSoon(app))threshold=60;

  if(match.distance>threshold){
    app.offRouteHits++;
  }else{
    app.offRouteHits=0;
    return false;
  }

  const now=Date.now();

  if(now-app.lastRerouteAt<2500)return false;

  const requiredHits=
    app.currentAccuracy<=20
      ?2
      :3;

  const clearlyAway=
    match.distance>
    Math.max(
      75,
      app.currentAccuracy*2+30
    );

  if(
    clearlyAway||
    app.offRouteHits>=requiredHits
  ){
    app.offRouteHits=0;
    window.RadarRouting?.recalculate?.();
    return true;
  }

  return false;
}

window.RadarOffRouteV157=Object.freeze({
  isRoundaboutSoon,
  check,
  version:'157'
});

})();