/* Radar Seguro RJ PRO — outdoor de comunidades v156 */
(()=>{'use strict';

if(window.RadarCommunityOutdoorV156)return;

function update(app,Utils,areas,distanceToCommunityKm){
  if(!app.navActive||!app.userPos){
    remove(app);
    return false;
  }

  let best=null;
  let bestScore=Infinity;

  for(const area of areas){
    const d=distanceToCommunityKm(app.userPos,area);

    if(d>.45)continue;

    const onRoute=app.routeNearCommunity(area);
    const score=d-(onRoute?.22:0);

    if(score<bestScore){
      best=area;
      bestScore=score;
    }
  }

  if(!best){
    remove(app);
    return false;
  }

  remove(app);

  const hud=document.getElementById('communityBillboardHud');
  if(!hud)return false;

  const directionBearing=Utils.bearing(app.userPos,best.c);
  const relative=(directionBearing-app.currentBearing+360)%360;
  const arrow=relative>0&&relative<180?'→':'←';

  const distance=Math.max(
    0,
    Math.round(distanceToCommunityKm(app.userPos,best)*1000)
  );

  hud.innerHTML=
    '<div class="community-billboard">'+
    '<small>COMUNIDADE AO LADO</small>'+
    Utils.sanitize(
      best.name.toUpperCase().startsWith('COMUNIDADE ')
        ?best.name
        :'COMUNIDADE '+best.name
    )+
    '<span class="community-direction">'+arrow+' '+distance+' m</span>'+
    '</div>';

  hud.classList.add('show');
  app.communityBillboardMarker=hud;
  app.nearestCommunityName=best.name;
  return true;
}

function remove(app){
  if(app.communityBillboardMarker){
    try{
      app.communityBillboardMarker.classList.remove('show');
      app.communityBillboardMarker.innerHTML='';
    }catch(_){}
  }

  app.communityBillboardMarker=null;
  app.nearestCommunityName=null;
  return true;
}

window.RadarCommunityOutdoorV156=Object.freeze({
  update,
  remove,
  version:'156'
});

})();