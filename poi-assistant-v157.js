/* Radar Seguro RJ PRO — POI e localização contextual v157
   Responsabilidade:
   - localização textual atual;
   - lugar mais próximo;
   - lugar ao longo da rota;
   - confirmação de parada/destino.
   Não é autoridade de GPS ou rota.
*/
(()=>{'use strict';

if(window.RadarPOIAssistantV157)return;

function serviceProxy(getTarget){
  return new Proxy({},{
    get(_target,prop){
      const target=getTarget?.();
      const value=target?.[prop];
      return typeof value==='function'?value.bind(target):value;
    },
    set(_target,prop,value){
      const target=getTarget?.();
      if(!target)return false;
      target[prop]=value;
      return true;
    }
  });
}

const App=serviceProxy(()=>window.RadarApp);
const VoiceAssistant=serviceProxy(()=>window.VoiceAssistant);
const Utils=window.RADAR_MAP_UTILS_V101?.Utils;

 const WORKER='https://radar-seguro-ia-rj.claudio41cg.workers.dev';
 const norm=t=>String(t||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ').trim();
 const hav=(a,b)=>{const R=6371000,rad=x=>x*Math.PI/180,dlat=rad(b[1]-a[1]),dlon=rad(b[0]-a[0]);const q=Math.sin(dlat/2)**2+Math.cos(rad(a[1]))*Math.cos(rad(b[1]))*Math.sin(dlon/2)**2;return 2*R*Math.asin(Math.sqrt(q));};
 const getMap=()=>{try{return App?.map?.getStyle?App.map:null}catch(e){return null}};

 async function reverseTomTom(lat,lon){
  try{
   const path='/search/2/reverseGeocode/'+lat+','+lon+'.json?language=pt-BR&radius=50';
   const r=await fetch(WORKER+'/v1/tomtom?path='+encodeURIComponent(path),{cache:'no-store'});
   const d=r.ok?await r.json():null,a=d?.addresses?.[0]?.address||{};
   return {street:String(a.streetName||'').trim(),number:String(a.streetNumber||'').trim(),district:String(a.municipalitySubdivision||a.localName||'').trim(),city:String(a.municipality||'').trim(),state:String(a.countrySubdivision||'').trim(),postalCode:String(a.postalCode||'').trim()};
  }catch(e){return {};}
 }
 async function reverseOSM(lat,lon){
  try{
   const u='https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat='+encodeURIComponent(lat)+'&lon='+encodeURIComponent(lon)+'&zoom=18&addressdetails=1&accept-language=pt-BR';
   const r=await fetch(u,{headers:{'Accept-Language':'pt-BR,pt;q=.9'},cache:'no-store'});
   const d=r.ok?await r.json():null,a=d?.address||{};
   return {street:String(a.road||a.pedestrian||a.residential||a.highway||'').trim(),number:String(a.house_number||'').trim(),district:String(a.suburb||a.neighbourhood||a.city_district||a.quarter||'').trim(),city:String(a.city||a.town||a.municipality||'').trim(),state:String(a.state||'').trim(),postalCode:String(a.postcode||'').trim()};
  }catch(e){return {};}
 }
 async function resolvePlace(lon,lat){
  const [tt,osm]=await Promise.all([reverseTomTom(lat,lon),reverseOSM(lat,lon)]);
  const street=tt.street||osm.street;
  const number=tt.number||osm.number;
  const postalCode=tt.postalCode||osm.postalCode;
  const district=osm.district||tt.district;
  const city=osm.city||tt.city;
  const state=osm.state||tt.state;
  const parts=[];
  if(street)parts.push(street+(number?', '+number:''));
  if(district)parts.push(district);
  if(city)parts.push(city);
  return {street,number,postalCode,district,city,state,label:parts.join(', '),lon,lat};
 }

 async function freshGps(){
  // GPS modular: consultas pontuais não abrem um segundo canal de geolocalização
  // fora do RadarGPS e não alteram App.userPos.
  try{
   const fix=await window.RadarGPS?.fresh?.({
    timeout:8000,
    maximumAge:0,
    fallbackAge:15000
   });
   if(fix)return {
    lat:Number(fix.lat),
    lon:Number(fix.lon),
    accuracy:Number(fix.accuracy||0)
   };
  }catch(e){}
  try{
   const p=App?.userPos;
   return Array.isArray(p)
    ?{lon:Number(p[0]),lat:Number(p[1]),accuracy:0}
    :null;
  }catch(e){
   return null;
  }
 }

 function isLocationQuestion(q){
  const n=norm(q).replace(/^radar[, ]*/,'');
  return /\b(onde estou|onde eu estou|qual e minha localizacao atual|qual e minha localizacao|minha localizacao atual|minha localizacao|qual meu bairro|qual e meu bairro|que bairro estou|qual minha rua|qual e minha rua|que rua estou|em que rua estou)\b/.test(n);
 }
 function formatCurrentPlace(p,q){
  if(!p||!p.label)return 'Não consegui confirmar sua posição agora. Aguarde alguns segundos e tente novamente.';
  const n=norm(q);
  if(n.includes('bairro'))return p.district?('Seu bairro é '+p.district+'.'):'Consegui confirmar sua rua, mas não o bairro com segurança agora.';
  if(n.includes('rua'))return p.street?('Você está na '+p.street+(p.number?', número '+p.number:'')+'.'):'Não consegui confirmar o nome da rua agora.';
  return 'Você está em '+p.label+(p.postalCode?', CEP '+p.postalCode:'')+'.';
 }

 let pendingPlace=null;
 function nearestPlaceQuery(q){
  let n=norm(q).replace(/^radar[, ]*/,'').trim();
  const hasProximity=/(mais proximo|mais proxima|mais perto|mais perto de casa|mais perto da minha casa|mais proximo da minha casa|mais proxima da minha casa|perto da minha casa|perto de casa|perto de mim|perto daqui|proximo de mim|proxima de mim)/.test(n);
  if(!hasProximity)return '';
  n=n
   .replace(/^(me leve|me leva|leve me|leva me|quero ir|va|vá|ir)\s+(para|pra|pro|para o|para a|ate|até|ao|a)\s+/,'')
   .replace(/(o|a)\s+(mais proximo|mais proxima|mais perto)/g,' ')
   .replace(/(mais proximo|mais proxima|mais perto|perto da minha casa|mais perto da minha casa|mais proximo da minha casa|mais proxima da minha casa|perto de casa|perto de mim|perto daqui|proximo de mim|proxima de mim|da minha casa)/g,' ')
   .replace(/\s+/g,' ').trim();
  if(!n)return '';
  if(/mcdonald|mc donald/.test(n))return 'McDonald’s';
  return n;
 }
 async function tomtomNearest(query,gps){
  const path='/search/2/search/'+encodeURIComponent(query)+'.json?lat='+gps.lat+'&lon='+gps.lon+'&radius=20000&limit=20&countrySet=BR&language=pt-BR';
  const r=await fetch(WORKER+'/v1/tomtom?path='+encodeURIComponent(path),{cache:'no-store'});
  if(!r.ok)throw new Error('search '+r.status);
  const d=await r.json();
  const items=(d?.results||[]).filter(x=>Number.isFinite(Number(x?.position?.lat))&&Number.isFinite(Number(x?.position?.lon)));
  items.forEach(x=>x.__dist=hav([gps.lon,gps.lat],[Number(x.position.lon),Number(x.position.lat)]));
  items.sort((a,b)=>a.__dist-b.__dist);
  return items[0]||null;
 }
 async function routeSummaryTo(gps,dest){
  try{
   const path='/maps/orbis/routing/routes/calculate?apiVersion=3';
   const body={routePlanningLocations:{origin:{type:'Point',coordinates:[gps.lon,gps.lat]},destination:{type:'Point',coordinates:[dest.lon,dest.lat]}},travelMode:'car',routeType:'fast',traffic:'live',departureDateTime:'now',maxPathAlternativeRoutes:0};
   const r=await fetch(WORKER+'/v1/tomtom?path='+encodeURIComponent(path),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),cache:'no-store'});
   if(!r.ok)throw new Error('route '+r.status);
   const d=await r.json(),s=d?.routes?.[0]?.summary||{};
   return {meters:Number(s.lengthInMeters||0),seconds:Number(s.travelDurationInSeconds||s.travelTimeInSeconds||0)};
  }catch(e){return {meters:0,seconds:0};}
 }
 async function answerNearestPlace(query){
  const gps=await freshGps();
  if(!gps){VoiceAssistant.reply('Não consegui confirmar sua posição para procurar '+query+' agora.');return true;}
  try{
   App.toast('Procurando '+query+' perto de você...',3500);
   const x=await tomtomNearest(query,gps);
   if(!x){VoiceAssistant.reply('Não encontrei '+query+' próximo de você nos dados da TomTom agora.');return true;}
   const lon=Number(x.position.lon),lat=Number(x.position.lat);
   const place=await resolvePlace(lon,lat);
   const rr=await routeSummaryTo(gps,{lon,lat});
   const name=String(x?.poi?.name||query).trim();
   pendingPlace={name,lon,lat,createdAt:Date.now()};
   let text='O '+name+' mais próximo';
   if(place.label)text+=' fica em '+place.label;
   if(rr.meters>0)text+=', a cerca de '+(rr.meters/1000).toFixed(1).replace('.',',')+' km';
   if(rr.seconds>0)text+=' e '+Math.max(1,Math.round(rr.seconds/60))+' minutos';
   text+='. Quer iniciar a rota?';
   VoiceAssistant.reply(text);
  }catch(e){console.warn('v58 poi',e);VoiceAssistant.reply('Não consegui consultar esse lugar na TomTom agora.');}
  return true;
 }
 function alongRouteQuery(q){
  let n=norm(q).replace(/^radar[, ]*/,'').trim();
  if(!/(no caminho|na minha rota|pela minha rota|ao longo da rota|durante o caminho|no trajeto)/.test(n))return '';

  n=n
   .replace(/\b(me leve|me leva|leve me|leva me|quero ir|quero parar|preciso parar|vamos|navegue|navegar|traca a rota|tracar rota)\b/g,' ')
   .replace(/\b(para|pra|pro|ate|até|em|num|numa|no|na)\b/g,' ')
   .replace(/\b(veja|ve|vê|procura|procurar|encontra|encontrar|ache|achar|tem|se tem)\b/g,' ')
   .replace(/\b(no caminho|na minha rota|pela minha rota|ao longo da rota|durante o caminho|no trajeto)\b/g,' ')
   .replace(/\b(mais proximo|mais proxima|mais perto|perto)\b/g,' ')
   .replace(/\b(um|uma|o|a)\b/g,' ')
   .replace(/\s+/g,' ')
   .trim();

  if(!n)return '';
  if(/mcdonald|mc donald/.test(n))return 'McDonald’s';
  if(/posto.*combustivel|posto.*gasolina|abastecer/.test(n))return 'posto de combustível';
  if(/supermercado/.test(n))return 'supermercado';
  if(/mercado/.test(n))return 'mercado';
  if(/hospital|pronto atendimento|emergencia/.test(n))return 'hospital';
  return n;
 }

 function wantsAlongRouteNavigation(q){
  const n=norm(q);
  return /\b(me leve|me leva|quero ir|quero parar|preciso parar|vamos para|navegue para|traca a rota|tracar rota)\b/.test(n);
 }

 async function tomtomSearchAround(query,lat,lon,radius=4500){
  const path='/search/2/search/'+encodeURIComponent(query)+
   '.json?lat='+Number(lat).toFixed(6)+
   '&lon='+Number(lon).toFixed(6)+
   '&radius='+Math.round(radius)+
   '&limit=12&countrySet=BR&language=pt-BR';

  const r=await fetch(WORKER+'/v1/tomtom?path='+encodeURIComponent(path),{cache:'no-store'});
  if(!r.ok)throw new Error('search '+r.status);
  const d=await r.json();
  return (d?.results||[]).filter(x=>
   Number.isFinite(Number(x?.position?.lat))&&
   Number.isFinite(Number(x?.position?.lon))
  );
 }

 function scorePlaceOnRemainingRoute(item){
  const route=App?.route;
  const coords=route?.coords;
  if(!Array.isArray(coords)||coords.length<2)return null;

  const point=[
   Number(item.position.lon),
   Number(item.position.lat)
  ];

  const start=Math.max(0,Math.min(
   Number(App.routeProgressIndex||0),
   coords.length-2
  ));

  let bestDistance=Infinity;
  let bestIndex=start;

  for(let i=start;i<coords.length-1;i++){
   const hit=Utils.pointToSegment(
    point,
    coords[i],
    coords[i+1]
   );

   if(hit.distanceMeters<bestDistance){
    bestDistance=hit.distanceMeters;
    bestIndex=i;
   }
  }

  const cumulative=route.cumulative||[];
  const currentMeters=Math.max(0,Number(App.routeProgressMeters||0));
  const routeMeters=Number(cumulative[bestIndex]||0);
  const aheadMeters=Math.max(0,routeMeters-currentMeters);

  if(bestDistance>2500)return null;

  return {
   item,
   lateralMeters:bestDistance,
   aheadMeters,
   score:aheadMeters+bestDistance*4
  };
 }

 async function findPlaceAlongRoute(query){
  const route=App?.route;
  const coords=route?.coords;

  if(!App?.navActive||!Array.isArray(coords)||coords.length<2){
   return null;
  }

  const start=Math.max(0,Math.min(
   Number(App.routeProgressIndex||0),
   coords.length-2
  ));

  const end=coords.length-1;
  const fractions=[0.12,0.42,0.72];
  const sampleIndexes=[start];

  for(const fraction of fractions){
   sampleIndexes.push(
    Math.min(
     end,
     start+Math.round((end-start)*fraction)
    )
   );
  }

  const uniqueIndexes=[...new Set(sampleIndexes)];
  const candidates=new Map();

  for(const idx of uniqueIndexes){
   const p=coords[idx];
   if(!p)continue;

   try{
    const items=await tomtomSearchAround(
     query,
     p[1],
     p[0],
     4500
    );

    for(const item of items){
     const lat=Number(item.position.lat);
     const lon=Number(item.position.lon);
     const key=String(item.id||'')||lat.toFixed(5)+','+lon.toFixed(5);
     if(!candidates.has(key))candidates.set(key,item);
    }
   }catch(e){
    console.warn('v58 busca ao longo da rota',e);
   }
  }

  const ranked=[...candidates.values()]
   .map(scorePlaceOnRemainingRoute)
   .filter(Boolean)
   .sort((a,b)=>a.score-b.score);

  if(!ranked.length)return null;

  const best=ranked[0];
  const item=best.item;
  return {
   name:String(item?.poi?.name||query).trim(),
   lon:Number(item.position.lon),
   lat:Number(item.position.lat),
   address:item?.address?.freeformAddress||
    [item?.address?.streetName,item?.address?.municipalitySubdivision,item?.address?.municipality]
     .filter(Boolean).join(', '),
   lateralMeters:best.lateralMeters,
   aheadMeters:best.aheadMeters
  };
 }

 async function answerAlongRoutePlace(query,autoNavigate=false){
  if(!App?.navActive||!App?.route?.coords?.length){
   VoiceAssistant.reply('Você ainda não está em uma rota ativa. Posso procurar '+query+' perto de você.');
   return answerNearestPlace(query);
  }

  try{
   App.toast('Procurando '+query+' no seu caminho...',5000);

   const found=await findPlaceAlongRoute(query);

   if(!found){
    VoiceAssistant.reply('Não encontrei '+query+' suficientemente perto da sua rota atual.');
    return true;
   }

   pendingPlace={
    ...found,
    mode:'route-stop',
    createdAt:Date.now()
   };

   let text='Encontrei '+found.name+' no seu caminho';
   if(found.address)text+=' em '+found.address;
   if(found.aheadMeters>0){
    text+=', aproximadamente '+(
     found.aheadMeters<1000
      ?Math.max(50,Math.round(found.aheadMeters/50)*50)+' metros'
      :(found.aheadMeters/1000).toFixed(1).replace('.',',')+' km'
    )+' adiante';
   }
   text+='.';

   if(autoNavigate){
    VoiceAssistant.reply(text+' Vou incluir como parada na sua rota.');
    return acceptPendingPlace();
   }

   VoiceAssistant.reply(text+' Quer incluir como parada na rota?');
   return true;

  }catch(e){
   console.warn('v58 parada na rota',e);
   VoiceAssistant.reply('Não consegui procurar esse local ao longo da rota agora.');
   return true;
  }
 }

 async function acceptPendingPlace(){
  if(!pendingPlace||Date.now()-pendingPlace.createdAt>90000){pendingPlace=null;return false;}
  const p=pendingPlace;pendingPlace=null;
  try{
   if(
    p.mode==='route-stop'&&
    App?.destination&&
    App?.route&&
    window.RadarRouteViaV115?.useViaPoint
   ){
    VoiceAssistant.reply('Certo. Vou incluir '+p.name+' como parada no caminho.');
    const ok=await window.RadarRouteViaV115.useViaPoint({
     lat:p.lat,
     lon:p.lon,
     label:p.name,
     query:p.name
    },false);
    if(!ok)throw new Error('não foi possível inserir a parada');
    return true;
   }

   App.destination=[p.lon,p.lat];
   App.destinationName=p.name;
   App.destinationLabel=p.name;
   const input=document.getElementById('destInput');if(input)input.value=p.name;
   VoiceAssistant.reply('Certo. Calculando a rota para '+p.name+'.');
   if(typeof App.recalculateRoute==='function')await App.recalculateRoute();
   else if(typeof App.calculateRoute==='function')await App.calculateRoute();
   else throw new Error('sem calculador de rota');
  }catch(e){console.warn('v58 rota poi',e);VoiceAssistant.reply('Encontrei o local, mas não consegui abrir a rota agora.');}
  return true;
 }



async function getCurrentAddress(force=false){
  let gps=null;
  if(force)gps=await freshGps();
  if(!gps&&Array.isArray(App?.userPos)&&App.userPos.length>=2){
    gps={lon:Number(App.userPos[0]),lat:Number(App.userPos[1])};
  }
  if(!gps)return null;
  return resolvePlace(gps.lon,gps.lat);
}

async function handle(command){
  
      const n=norm(command);
      if(pendingPlace&&Date.now()-pendingPlace.createdAt<=90000){
        if(/^(sim|pode|pode sim|quero|vai|vamos|inicia|iniciar|comece|comeca|começar|beleza)$/.test(n))return acceptPendingPlace();
        if(/^(nao|não|cancela|cancelar|deixa|deixa pra la|deixa pra lá)$/.test(n)){pendingPlace=null;VoiceAssistant.reply('Tudo bem. Não vou mudar sua rota.');return;}
      }
      if(isLocationQuestion(command)){const p=await getCurrentAddress(true);VoiceAssistant.reply(formatCurrentPlace(p,command));return;}
      let normalizedCommand=norm(command).replace(/[.,!?;:]+$/g,'').trim();
      // Sem a palavra "casa", reconhecimento de voz pode entregar pontuação ou pequenas
      // variações no fim. Convertemos qualquer final "mais perto/mais próximo" para a
      // mesma referência que já funciona: "mais próximo da minha casa".
      normalizedCommand=normalizedCommand.replace(
        /\b(mais proximo|mais proxima|mais perto)\s*$/,
        'mais proximo da minha casa'
      );
      command=normalizedCommand;
      // Teste real confirmou que "mais próximo da minha casa" usa a referência correta.
      // Normalize também as formas naturais "perto de minha casa" / "perto da minha casa"
      // para exatamente a mesma intenção antes de qualquer regex ou busca concorrente.
      normalizedCommand=normalizedCommand
        .replace(/\b(perto de minha casa|perto da minha casa|perto de casa)\b/g,'mais proximo da minha casa');
      command=normalizedCommand;
      // O usuário confirmou em teste real que "mais próximo da minha casa" funciona.
      // Portanto, quando a frase termina apenas em "mais próximo/mais perto", tratamos
      // isso como o mesmo pedido relativo à posição atual/casa, sem deixar outro fluxo decidir.
      command=normalizedCommand;
  
      const alongQuery=alongRouteQuery(command);
      if(alongQuery){
        return answerAlongRoutePlace(
          alongQuery,
          wantsAlongRouteNavigation(command)
        );
      }
  
      const pq=nearestPlaceQuery(command);
      if(pq){
        let cleaned=norm(command)
          .replace(/^radar[, ]*/,'')
          .replace(/\b(mais perto da minha casa|mais proximo da minha casa|mais proxima da minha casa|perto da minha casa|perto de casa|perto de mim|perto daqui|proximo de mim|proxima de mim|da minha casa)\b/g,' ')
          .replace(/\b(o|a)\s+(mais proximo|mais proxima|mais perto)\b/g,' ')
          .replace(/\b(mais proximo|mais proxima|mais perto)\b/g,' ')
          .replace(/\s+/g,' ').trim();
        if(!/^(me leve|me leva|leve me|leva me|quero ir|ir|va|vá)\b/.test(cleaned)) cleaned='me leva para '+pq;
        return answerNearestPlace(pq);
      }
      return false;
     
}

window.RadarPOIAssistantV157=Object.freeze({
  handle,
  getCurrentAddress,
  resolvePlace,
  answerNearestPlace,
  findPlaceAlongRoute,
  answerAlongRoutePlace,
  version:'157'
});

})();