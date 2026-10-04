/* Radar Seguro RJ PRO — look-ahead da rota v157
   Responsabilidade exclusiva: obter um ponto à frente na geometria da rota.
*/
(()=>{'use strict';

if(window.RadarLookAheadV157)return;

function pointAhead(app,Utils,distanceMeters){
  if(
    !app.route?.coords?.length||
    !app.route.cumulative?.length
  ){
    return app.userPos;
  }

  const target=
    app.routeProgressMeters+
    distanceMeters;

  const idx=
    app.findIndexForOffset(
      app.route,
      target
    );

  const a=app.route.coords[idx];
  const next=Math.min(idx+1,app.route.coords.length-1);
  const b=app.route.coords[next];

  const aDist=app.route.cumulative[idx]||0;
  const bDist=app.route.cumulative[
    Math.min(idx+1,app.route.cumulative.length-1)
  ]||aDist;

  const span=Math.max(1,bDist-aDist);
  const t=Math.max(
    0,
    Math.min(
      1,
      (target-aDist)/span
    )
  );

  return Utils.interpolatePoint(a,b,t);
}

window.RadarLookAheadV157=Object.freeze({
  pointAhead,
  version:'157'
});

})();