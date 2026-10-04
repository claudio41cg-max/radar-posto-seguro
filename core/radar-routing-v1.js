/* Radar Seguro RJ PRO — Routing Authority v1
   Única autoridade de criação/substituição de rota.

   Responsabilidade:
   - consultar TomTom;
   - criar a rota canônica;
   - impedir resposta antiga de sobrescrever rota nova;
   - recalcular;
   - aplicar a rota no estado do App.

   Não faz:
   - GPS;
   - map matching;
   - guidance/voz;
   - câmera;
   - persistência.

   Estratégia de provedor:
   - TomTom é a fonte principal;
   - OSRM é contingência explícita, controlada por este mesmo módulo;
   - nenhuma outra parte do app cria/substitui rota.
*/
(()=>{'use strict';

if(window.RadarRouting)return;

const kernel=window.RadarKernel;
if(!kernel){
  console.error('[RadarRouting] RadarKernel não carregado.');
  return;
}

const WORKER='https://radar-seguro-ia-rj.claudio41cg.workers.dev';
const routeState=kernel.createDomain('routing',{
  status:'idle',
  requestId:0,
  lastError:null,
  activeRoute:null,
  origin:null,
  destination:null,
  provider:null,
  primaryError:null
});

let appRef=null;
let activeController=null;
let generation=0;

function app(){
  return appRef||window.RadarApp||window.App||null;
}

function reportRouteSideEffectError(stage,error){
  console.warn(
    '[RadarRouting] '+stage+':',
    error
  );

  try{
    kernel.emit(
      'routing:side-effect-error',
      {
        stage,
        message:String(
          error?.message||
          error
        )
      }
    );
  }catch(_){}
}

function modifier(type){
  const t=String(type||'').toUpperCase();
  if(t.includes('LEFT'))return 'left';
  if(t.includes('RIGHT'))return 'right';
  if(t.includes('ROUNDABOUT'))return 'roundabout';
  if(t.includes('UTURN'))return 'uturn';
  return 'straight';
}

function validPoint(p){
  return Array.isArray(p)&&
    p.length>=2&&
    Number.isFinite(Number(p[0]))&&
    Number.isFinite(Number(p[1]));
}

function resetProgress(a){
  a.routeProgressIndex=0;
  a.routeProgressMeters=0;
  a.lastTrustedProgressMeters=0;
  a.lastTrustedSpeed=0;
  a.routeStepIndex=0;
  a.activeGuidanceStep=-1;
  a.lastGuidanceStep=-1;
  a.announced={};
}

function normalizeRoute(rt){
  const coords=(rt.legs||[])
    .flatMap(leg=>(leg.points||[])
      .map(p=>[Number(p.longitude),Number(p.latitude)]))
    .filter(validPoint);

  if(coords.length<2){
    throw new Error('TomTom retornou geometria inválida');
  }

  const steps=(rt.guidance?.instructions||[]).map(i=>({
    name:i.street||i.roadNumbers?.[0]||'Siga pela via',
    maneuver:{
      type:i.maneuver||'',
      modifier:modifier(i.maneuver),
      location:[
        Number(i.point?.longitude),
        Number(i.point?.latitude)
      ]
    },
    routeOffsetMeters:Number(i.routeOffsetInMeters)||0,
    tomtomInstruction:i
  }));

  const route={
    coords,
    steps,
    distance:Number(rt.summary?.lengthInMeters)||0,
    duration:Number(rt.summary?.travelTimeInSeconds)||0,
    trafficDelaySeconds:Number(rt.summary?.trafficDelayInSeconds||0),
    liveTraffic:true,
    engine:'tomtom',
    routingVersion:'routing-authority-v1',
    tomtomRoute:rt
  };

  window.RadarRouteProgress?.prepare?.(route);
  return route;
}

function normalizeOSRMRoute(rt,primaryError=''){
  const coords=(rt?.geometry?.coordinates||[])
    .map(p=>[Number(p?.[0]),Number(p?.[1])])
    .filter(validPoint);

  if(coords.length<2){
    throw new Error('OSRM retornou geometria inválida');
  }

  const steps=(rt?.legs||[])
    .flatMap(leg=>leg?.steps||[])
    .map(step=>({
      name:step?.name||'Siga pela via',
      maneuver:{
        type:step?.maneuver?.type||'',
        modifier:step?.maneuver?.modifier||'straight',
        location:[
          Number(step?.maneuver?.location?.[0]),
          Number(step?.maneuver?.location?.[1])
        ]
      },
      routeOffsetMeters:null,
      osrmStep:step
    }));

  const route={
    coords,
    steps,
    distance:Number(rt?.distance)||0,
    duration:Number(rt?.duration)||0,
    trafficDelaySeconds:0,
    liveTraffic:false,
    engine:'osrm',
    provider:'OSRM',
    routingVersion:'routing-authority-v1',
    fallbackFrom:'tomtom',
    primaryError:String(primaryError||'TomTom indisponível')
  };

  window.RadarRouteProgress?.prepare?.(route);
  return route;
}

function consumeViaPoint(explicitVia){
  if(validPoint(explicitVia))return explicitVia;

  const holder=window.RadarRouteViaV115;
  const pending=holder?.state?.pending;

  if(
    pending&&
    Number.isFinite(Number(pending.lon))&&
    Number.isFinite(Number(pending.lat))
  ){
    const via=[Number(pending.lon),Number(pending.lat)];

    try{
      holder.state.current={...pending};
      holder.state.pending=null;
    }catch(_){}

    return via;
  }

  return null;
}

async function fetchTomTomRoute(origin,destination,options={}){
  const a=app();

  if(!a)throw new Error('Radar indisponível');
  if(!validPoint(origin)||!validPoint(destination)){
    throw new Error('Origem ou destino inválido');
  }

  const mode=a.transportMode==='motorcycle'?'motorcycle':'car';
  const via=consumeViaPoint(options.via);

  const pointText=p=>
    Number(p[1]).toFixed(6)+','+
    Number(p[0]).toFixed(6);

  const routePoints=via
    ?pointText(origin)+':'+pointText(via)+':'+pointText(destination)
    :pointText(origin)+':'+pointText(destination);

  /*
    Mantém a autoridade única e maxAlternatives=0, mas usa o mesmo formato
    de requisição TomTom que já era estável nas versões V223:
    geometria explícita, guidance completo e announcement points.
  */
  const params=new URLSearchParams({
    traffic:'true',
    travelMode:mode,
    instructionsType:'text',
    instructionAnnouncementPoints:'all',
    language:'pt-BR',
    routeType:'fastest',
    avoid:'unpavedRoads',
    routeRepresentation:'polyline',
    computeTravelTimeFor:'all',
    maxAlternatives:'0'
  });

  params.append('sectionType','speedLimit');

  const path=
    '/routing/1/calculateRoute/'+
    routePoints+
    '/json?'+params.toString();

  if(activeController){
    try{activeController.abort()}catch(_){}
  }

  const controller=new AbortController();
  activeController=controller;

  const timeout=setTimeout(()=>controller.abort(),12000);

  try{
    const response=await fetch(
      WORKER+'/v1/tomtom?path='+encodeURIComponent(path),
      {
        signal:controller.signal,
        cache:'no-store'
      }
    );

    if(!response.ok){
      throw new Error('TomTom HTTP '+response.status);
    }

    const data=await response.json();

    if(!data.routes?.length){
      throw new Error('TomTom sem rota');
    }

    return normalizeRoute(data.routes[0]);

  }finally{
    clearTimeout(timeout);

    if(activeController===controller){
      activeController=null;
    }
  }
}


async function fetchOSRMRoute(origin,destination,options={}){
  if(!validPoint(origin)||!validPoint(destination)){
    throw new Error('Origem ou destino inválido');
  }

  const via=validPoint(options.via)?options.via:null;
  const points=[
    origin,
    ...(via?[via]:[]),
    destination
  ];

  const coordText=points
    .map(p=>Number(p[0]).toFixed(6)+','+Number(p[1]).toFixed(6))
    .join(';');

  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),8000);

  try{
    const response=await fetch(
      'https://router.project-osrm.org/route/v1/driving/'+
      coordText+
      '?overview=full&geometries=geojson&steps=true&alternatives=false',
      {
        signal:controller.signal,
        cache:'no-store'
      }
    );

    if(!response.ok){
      throw new Error('OSRM HTTP '+response.status);
    }

    const data=await response.json();
    const route=data?.routes?.[0];

    if(!route){
      throw new Error('OSRM sem rota');
    }

    return route;

  }finally{
    clearTimeout(timeout);
  }
}

async function fetchAuthoritativeRoute(origin,destination,options={},requestId=null){
  let primaryError=null;
  const via=consumeViaPoint(options.via);
  const providerOptions={
    ...options,
    via
  };

  try{
    const route=await fetchTomTomRoute(
      origin,
      destination,
      providerOptions
    );
    route.provider='TomTom';
    routeState.update({
      provider:'tomtom',
      primaryError:null
    },{source:'provider:tomtom'});
    return route;

  }catch(error){
    if(
      error?.name==='AbortError'&&
      requestId!=null&&
      requestId!==generation
    ){
      throw error;
    }

    primaryError=String(error?.message||error);
    console.warn('[RadarRouting] TomTom falhou; tentando contingência OSRM:',primaryError);

    routeState.update({
      provider:'osrm-fallback',
      primaryError
    },{source:'provider:fallback'});

    try{
      const osrmRaw=await fetchOSRMRoute(
        origin,
        destination,
        providerOptions
      );

      return normalizeOSRMRoute(
        osrmRaw,
        primaryError
      );

    }catch(fallbackError){
      const fallbackMessage=String(fallbackError?.message||fallbackError);
      throw new Error(
        'TomTom: '+primaryError+
        ' | OSRM: '+fallbackMessage
      );
    }
  }
}

function applyRoute(route,{fit=true,recalculate=false}={}){
  const a=app();
  if(!a)throw new Error('Radar indisponível');

  a.route=route;
  resetProgress(a);

  /*
    Compatibilidade temporária com UI antiga.
    O estado da rota pertence a RadarRouting; desenho/painéis serão
    separados em módulos próprios nas próximas etapas.
  */
  try{a.drawRoute?.(route,fit)}catch(error){
    console.warn('[RadarRouting] drawRoute:',error);
  }

  try{
    a.renderDestinationFlag?.();
  }catch(error){
    reportRouteSideEffectError(
      'render-destination',
      error
    );
  }

  try{
    a.updateRouteSummary?.();
  }catch(error){
    reportRouteSideEffectError(
      'update-route-summary',
      error
    );
  }

  if(!recalculate){
    try{
      a.checkDestinationCommunity?.();
    }catch(error){
      reportRouteSideEffectError(
        'check-destination-community',
        error
      );
    }
  }else{
    try{
      a.fetchHazardsAlongRoute?.();
    }catch(error){
      reportRouteSideEffectError(
        'fetch-route-hazards',
        error
      );
    }
  }

  routeState.update({
    status:'ready',
    activeRoute:route,
    origin:a.userPos?Array.from(a.userPos):null,
    destination:a.destination?Array.from(a.destination):null,
    lastError:null,
    provider:route.engine||route.provider||null,
    primaryError:route.primaryError||null
  },{source:recalculate?'recalculate':'calculate'});

  kernel.emit(
    recalculate?'route:recalculated':'route:calculated',
    {route}
  );

  return route;
}

async function calculateRoute(options={}){
  const a=app();
  if(!a)return null;

  const origin=options.origin||a.userPos;
  const destination=options.destination||a.destination;

  if(!validPoint(origin)){
    try{a.toast?.('Aguardando localização GPS.')}catch(_){}
    return null;
  }

  if(!validPoint(destination)){
    return null;
  }

  const requestId=++generation;

  routeState.update({
    status:'calculating',
    requestId,
    origin:Array.from(origin),
    destination:Array.from(destination),
    lastError:null
  },{source:'calculate'});

  try{a.toast?.('Calculando melhor rota...')}catch(_){}

  try{
    const route=await fetchAuthoritativeRoute(
      origin,
      destination,
      options,
      requestId
    );

    /*
      Se outra solicitação começou depois, esta resposta ficou velha.
      Ela não pode sobrescrever a rota mais recente.
    */
    if(requestId!==generation){
      return null;
    }

    return applyRoute(route,{fit:options.fit!==false,recalculate:false});

  }catch(error){
    if(error?.name==='AbortError'&&requestId!==generation){
      return null;
    }

    routeState.update({
      status:'error',
      lastError:String(error?.message||error)
    },{source:'calculate'});

    console.error('[RadarRouting] cálculo:',error);

    const detail=String(error?.message||error||'Erro desconhecido')
      .replace(/\s+/g,' ')
      .trim()
      .slice(0,180);

    try{
      a.toast?.(
        'Falha de rota: '+detail,
        12000
      );
    }catch(_){}

    return null;
  }
}

async function recalculateRoute(){
  const a=app();

  if(
    !a?.destination||
    !a.userPos||
    a.rerouting
  ){
    return null;
  }

  a.rerouting=true;
  a.lastRerouteAt=Date.now();

  try{window.Voice?.clear?.()}catch(_){}
  try{a.toast?.('Atualizando rota...')}catch(_){}

  const routeOrigin=
    a.filteredPos||
    a.rawUserPos||
    a.userPos;

  const requestId=++generation;

  routeState.update({
    status:'recalculating',
    requestId,
    origin:Array.from(routeOrigin),
    destination:Array.from(a.destination),
    lastError:null
  },{source:'recalculate'});

  try{
    const newRoute=await fetchAuthoritativeRoute(
      routeOrigin,
      a.destination,
      {},
      requestId
    );

    if(requestId!==generation){
      return null;
    }

    applyRoute(
      newRoute,
      {
        fit:false,
        recalculate:true
      }
    );

    try{a.toast?.('Rota atualizada.')}catch(_){}

    setTimeout(()=>{
      try{a.updateNavigation?.()}catch(_){}
    },350);

    return newRoute;

  }catch(error){
    if(error?.name==='AbortError'&&requestId!==generation){
      return null;
    }

    routeState.update({
      status:'error',
      lastError:String(error?.message||error)
    },{source:'recalculate'});

    console.warn('[RadarRouting] recálculo:',error);

    const detail=String(error?.message||error||'Erro desconhecido')
      .replace(/\s+/g,' ')
      .trim()
      .slice(0,180);

    try{
      a.toast?.(
        'Falha ao atualizar rota: '+detail,
        12000
      );
    }catch(_){}

    return null;

  }finally{
    a.rerouting=false;
  }
}

function cancelPending(){
  generation++;

  if(activeController){
    try{activeController.abort()}catch(_){}
    activeController=null;
  }

  routeState.update({
    status:'idle'
  },{source:'cancel-pending'});
}

function bindApp(){
  const a=window.RadarApp||window.App||null;
  if(!a)return false;

  /*
    Durante o carregamento o index cria primeiro um RadarApp provisório
    contendo apenas sendReport. Não podemos ligar a autoridade de rota
    nesse objeto temporário, porque ele é substituído pelo App real no
    DOMContentLoaded.
  */
  const ready=
    typeof a.searchAddress==='function' &&
    typeof a.drawRoute==='function' &&
    typeof a.startNavigation==='function' &&
    Object.prototype.hasOwnProperty.call(a,'userPos') &&
    Object.prototype.hasOwnProperty.call(a,'destination');

  if(!ready)return false;

  /*
    Se o objeto global foi substituído, reconecta a autoridade ao App real.
  */
  if(appRef!==a){
    appRef=a;
  }

  if(a.__radarRoutingAuthorityV1Bound)return true;
  a.__radarRoutingAuthorityV1Bound=true;

  /*
    Fachadas: o App não decide mais de onde vem a rota.
    Todas as entradas passam por RadarRouting.
  */
  a.tomTomModifier=modifier;
  a.fetchTomTomRoute=(origin,destination,options={})=>
    fetchTomTomRoute(origin,destination,options);

  a.getRoute=(origin,destination,options={})=>
    fetchAuthoritativeRoute(origin,destination,options);

  a.calculateRoute=(options)=>
    calculateRoute(options||{});

  a.recalculateRoute=()=>
    recalculateRoute();

  kernel.emit('routing:bound',{
    module:'routing-authority-v1'
  });

  return true;
}

const api={
  version:'1.1.0',
  fetch:fetchAuthoritativeRoute,
  fetchTomTom:fetchTomTomRoute,
  fetchOSRM:fetchOSRMRoute,
  calculate:calculateRoute,
  recalculate:recalculateRoute,
  apply:applyRoute,
  cancelPending,
  modifier,
  state:()=>routeState.get(),
  subscribe:fn=>routeState.subscribe(fn),
  bindApp
};

window.RadarRouting=Object.freeze(api);

const registration=kernel.registerModule({
  name:'routing-authority-v1',
  version:'1.1.0',
  owns:['navigation.route'],

  async start({resources}){
    const id=resources.interval(()=>{
      if(bindApp())clearInterval(id);
    },100);

    resources.listen(window,'pagehide',()=>{
      cancelPending();
    });

    return api;
  },

  async stop(){
    cancelPending();
  }
});

registration.start().catch(error=>{
  console.error('[RadarRouting] falha ao iniciar módulo:',error);
});

})();