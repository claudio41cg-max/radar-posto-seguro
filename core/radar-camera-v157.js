/* Radar Seguro RJ PRO — câmera de navegação v157
   Referência profissional:
   - follow mode mantém mapa ligado à posição;
   - direção do mapa e direção do veículo usam a mesma referência de rota;
   - look-ahead continua responsável por centro/antecipação visual, não pelo bearing.
*/
(()=>{'use strict';

if(window.RadarCameraV157)return;

function update(app,Utils){
  if(!app.followMode||!app.userPos)return false;

  const now=Date.now();
  if(now-app.lastCameraUpdate<520)return false;
  app.lastCameraUpdate=now;

  if(!app.navActive){
    window.RadarMapMotionV157.easeTo(app.map,{
      center:app.userPos,
      zoom:app.map.getZoom(),
      pitch:0,
      bearing:0,
      duration:520,
      essential:true
    });
    return true;
  }

  if(app.rerouting)return false;

  let zoom=18.05;
  let lookAhead=72;

  if(app.currentSpeed>70){
    zoom=16.10;
    lookAhead=290;
  }else if(app.currentSpeed>52){
    zoom=16.55;
    lookAhead=215;
  }else if(app.currentSpeed>32){
    zoom=17.10;
    lookAhead=145;
  }else if(app.currentSpeed>18){
    zoom=17.60;
    lookAhead=100;
  }

  const guidance=app.getUpcomingGuidance();
  const roadName=String(guidance?.step?.name||'');
  const majorRoad=/(avenida|estrada|rodovia|linha|br-|presidente|expressa)/i.test(roadName);

  if(majorRoad&&app.currentSpeed>28)zoom-=.18;

  if(guidance&&app.isTurnStep(guidance.step)){
    if(guidance.distance<350)zoom=Math.max(zoom,17.15);
    if(guidance.distance<170)zoom=Math.max(zoom,17.65);
    if(guidance.distance<75)zoom=Math.max(zoom,18.05);
  }

  let center=app.userPos;

  if(app.route){
    const ahead=app.pointAhead(lookAhead);

    if(ahead){
      center=Utils.interpolatePoint(
        app.userPos,
        ahead,
        .38
      );
    }
  }

  /*
    A rotação da câmera usa a mesma referência de rota da seta.
    Isso evita que a seta vire por um critério e o mapa permaneça
    apontando por outro.
  */
  let targetBearing=Number(app.currentBearing||0);

  if(app.route){
    const routeBearing=
      window.RadarArrowV157?.routeBearing?.(
        app,
        Utils
      );

    if(Number.isFinite(routeBearing)){
      targetBearing=routeBearing;
    }
  }

  /*
    Em navegação ativa e com rota válida, não congelar o bearing
    só porque a velocidade caiu numa esquina/rotatória.
    Se não houver referência de rota, aí sim preservamos o bearing atual.
  */
  if(
    app.currentSpeed<3&&
    !app.route
  ){
    targetBearing=app.map.getBearing();
  }

  window.RadarMapMotionV157.easeTo(app.map,{
    center,
    zoom,
    pitch:62,
    bearing:targetBearing,
    duration:520,
    essential:true
  });

  return true;
}

window.RadarCameraV157=Object.freeze({
  update,
  version:'157.1'
});

})();