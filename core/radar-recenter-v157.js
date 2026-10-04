/* Radar Seguro RJ PRO — recentralização v157
   Responsabilidade exclusiva: recentralizar a câmera a pedido do usuário.
*/
(()=>{'use strict';

if(window.RadarRecenterV157)return;

function recenter(app,Utils){
  if(!app.userPos){
    app.toast('Obtendo localização...');
    app.startGPS();
    return false;
  }

  app.followMode=true;
  clearTimeout(app.manualFollowTimer);

  const center=
    app.navActive&&app.route
      ?Utils.interpolatePoint(
          app.userPos,
          app.pointAhead(105)||app.userPos,
          .36
        )
      :app.userPos;

  return window.RadarMapMotionV157.easeTo(
    app.map,
    {
      center,
      zoom:
        app.navActive
          ?Math.max(16.6,Math.min(18.05,app.map.getZoom()))
          :16.3,
      pitch:app.navActive?62:0,
      bearing:
        app.navActive&&app.currentSpeed>5
          ?app.currentBearing
          :0,
      duration:720
    }
  );
}

window.RadarRecenterV157=Object.freeze({
  recenter,
  version:'157'
});

})();