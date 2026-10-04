/* Radar Seguro RJ PRO — alertas de comunidades v156 */
(()=>{'use strict';

if(window.RadarCommunityAlertsV156)return;

function routeNear(app,Utils,riskRadius,area){
  if(!app.route?.coords?.length)return false;

  const limit=riskRadius(area)+.08;
  const start=app.routeProgressIndex;
  const end=Math.min(app.route.coords.length-1,start+500);

  for(let i=start;i<end;i+=5){
    const d=Utils.distanceKm(app.route.coords[i],area.c);
    if(d<=limit)return true;
  }

  return false;
}

function checkDanger(app,Utils,riskRadius,areas,Voice){
  if(!app.userPos)return false;

  let nearest=null;
  let nearestDistance=Infinity;

  areas.forEach(area=>{
    const d=Utils.distanceKm(app.userPos,area.c);

    if(d<nearestDistance){
      nearestDistance=d;
      nearest=area;
    }

    const previous=app.lastCommunityDistance[area.name];
    app.lastCommunityDistance[area.name]=d;

    if(
      previous!=null&&
      d>previous&&
      d>riskRadius(area)+.35
    ){
      delete app.nearbyCommunityAlerted[area.name];
      delete app.insideCommunityAlerted[area.name];
    }
  });

  if(!nearest)return false;

  const radius=riskRadius(nearest);
  const sign=document.getElementById('communitySign');
  const tag=document.getElementById('hudDangerTag');
  const nearLimit=radius+.22;

  if(nearestDistance<=nearLimit&&nearestDistance>radius){
    if(tag){
      tag.textContent='⚠ '+nearest.name.toUpperCase();
      tag.classList.add('active');
    }

    if(!app.nearbyCommunityAlerted[nearest.name]){
      app.nearbyCommunityAlerted[nearest.name]=true;

      if(sign){
        sign.textContent='⚠ Comunidade próxima: '+nearest.name;
        sign.classList.add('show');
        setTimeout(()=>sign.classList.remove('show'),4200);
      }

      if(app.navActive&&app.currentSpeed>5){
        Voice?.speak?.(
          'Atenção. Comunidade próxima: '+nearest.name+'.'
        );
      }
    }
  }else{
    tag?.classList.remove('active');
  }

  if(
    nearestDistance<=radius&&
    !app.insideCommunityAlerted[nearest.name]
  ){
    app.insideCommunityAlerted[nearest.name]=true;

    const banner=document.getElementById('dangerBanner');
    const text=document.getElementById('dangerBannerText');

    if(text){
      text.textContent=
        '⚠ Você entrou na área marcada de '+
        nearest.name+
        '. Fique atento.';
    }

    banner?.classList.add('show');

    if(app.navActive){
      Voice?.speak?.(
        'Atenção. Você entrou na área marcada de '+
        nearest.name+
        '.',
        true
      );
    }

    if(banner){
      setTimeout(()=>banner.classList.remove('show'),6500);
    }
  }

  return true;
}

function checkDestination(app,Utils,riskRadius,areas){
  if(!app.destination)return false;

  const watched=new Set([
    'Carobinha (Campo Grande)',
    'Barbante (Inhoaíba)',
    'Cesarão (Santa Cruz)',
    'Comunidade do Rola (Santa Cruz)',
    'Comunidade de Antares (Santa Cruz)',
    'Pantanal (Santa Cruz)',
    'Comunidade do Aço (Santa Cruz)',
    'Nova Sepetiba'
  ]);

  for(const area of areas){
    if(!watched.has(area.name))continue;

    const d=Utils.distanceKm(app.destination,area.c);

    if(d<=riskRadius(area)+.08){
      app.toast('⚠ Destino próximo de '+area.name+'.',5000);
      return true;
    }
  }

  return false;
}

window.RadarCommunityAlertsV156=Object.freeze({
  routeNear,
  checkDanger,
  checkDestination,
  version:'156'
});

})();