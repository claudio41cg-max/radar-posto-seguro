/* Radar Seguro RJ PRO — seta/marker do veículo v157 */
(()=>{'use strict';

if(window.RadarArrowV157)return;

function update(app,Utils){
  if(!app.userPos)return false;

  if(!app.userMarker){
    const el=document.createElement('div');
    el.className='user-marker-waze';

    app.userMarker=
      new maplibregl.Marker({
        element:el,
        rotationAlignment:'map'
      })
      .setLngLat(app.userPos)
      .addTo(app.map);
  }else{
    app.userMarker.setLngLat(app.userPos);
  }

  if(app.currentSpeed>4){
    let markerBearing=app.currentBearing;

    if(app.navActive&&app.route){
      const ahead=app.pointAhead(72);

      if(ahead){
        markerBearing=Utils.bearing(
          app.userPos,
          ahead
        );
      }
    }

    app.userMarker.setRotation(markerBearing);
  }

  return true;
}

window.RadarArrowV157=Object.freeze({
  update,
  version:'157'
});

})();