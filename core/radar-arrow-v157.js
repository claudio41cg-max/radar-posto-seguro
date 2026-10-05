/* Radar Seguro RJ PRO — seta/marker do veículo v157
   Direção da seta:
   - usa a tangente do segmento atual da rota;
   - suaviza com o próximo segmento;
   - evita mirar dezenas de metros à frente em curvas/rotatórias.
*/
(()=>{'use strict';

if(window.RadarArrowV157)return;

function clamp(value,min,max){
  return Math.max(min,Math.min(max,value));
}

function angleDelta(from,to){
  return ((to-from+540)%360)-180;
}

function blendBearing(from,to,weight){
  return (from+angleDelta(from,to)*clamp(weight,0,1)+360)%360;
}

function routeBearing(app,Utils){
  const route=app.route;
  const coords=route?.coords;
  const cumulative=route?.cumulative;

  if(
    !Array.isArray(coords)||
    coords.length<2
  ){
    return null;
  }

  const maxIndex=coords.length-2;
  const index=clamp(
    Number(app.routeProgressIndex||0),
    0,
    maxIndex
  );

  const a=coords[index];
  const b=coords[index+1];

  if(!a||!b)return null;

  const currentBearing=Utils.bearing(a,b);

  if(index>=maxIndex){
    return currentBearing;
  }

  const c=coords[index+2];
  if(!c)return currentBearing;

  const nextBearing=Utils.bearing(b,c);

  let segmentProgress=.5;

  if(
    Array.isArray(cumulative)&&
    cumulative.length>index+1
  ){
    const start=Number(cumulative[index]||0);
    const end=Number(cumulative[index+1]||start);
    const span=Math.max(1,end-start);

    segmentProgress=clamp(
      (
        Number(app.routeProgressMeters||start)-
        start
      )/span,
      0,
      1
    );
  }

  const turnAngle=Math.abs(
    angleDelta(currentBearing,nextBearing)
  );

  /*
    Em curva suave/rotatória, começa a suavizar cedo.
    Em virada forte, só antecipa perto do fim do segmento,
    evitando a seta apontar atravessada para a rua seguinte.
  */
  const nextWeight=
    turnAngle>80
      ?clamp((segmentProgress-.68)/.32,0,1)*.55
      :.15+segmentProgress*.45;

  return blendBearing(
    currentBearing,
    nextBearing,
    nextWeight
  );
}

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
      const matchedBearing=routeBearing(app,Utils);

      if(Number.isFinite(matchedBearing)){
        markerBearing=matchedBearing;
      }
    }

    app.userMarker.setRotation(markerBearing);
  }

  return true;
}

window.RadarArrowV157=Object.freeze({
  update,
  routeBearing,
  version:'157.1'
});

})();