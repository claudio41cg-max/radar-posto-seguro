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

   Regra: sem fallback silencioso para OSRM.
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
  destination:null
});

let appRef=null;
let activeController=null;
let generation=0;

function app(){
  return appRef||window.RadarApp||window.App||null;
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

async function fetchTomTomRoute(origin,destination){
  const a=app();

  if(!a)throw new Error('Radar indisponível');
  if(!validPoint(origin)||!validPoint(destination)){
    throw new Error('Origem ou destino inválido');
  }

  const mode=a.transportMode==='motorcycle'?'motorcycle':'car';

  /*
    maxAlternatives=0:
    esta autoridade pede somente a rota principal.
    Nenhum módulo paralelo pode criar "segunda rota" por conta própria.
  */
  const path=
    '/routing/1/calculateRoute/'+
    origin[1]+','+origin[0]+':'+
    destination[1]+','+destination[0]+
    '/json?traffic=true'+
    '&travelMode='+encodeURIComponent(mode)+
    '&instructionsType=text'+
    '&language=pt-BR'+
    '&routeType=fastest'+
    '&avoid=unpavedRoads'+
    '&computeTravelTimeFor=all'+
    '&maxAlternatives=0';

  if(activeController){
    try{activeController.abort()}catch(_){}
  }

  const controller=new AbortController();
  activeController=controller;

  const timeout=setTimeout(()=>controller.abort(),9000);

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

  try{a.renderDestinationFlag?.()}catch(_){}
  try{a.updateRouteSummary?.()}catch(_){}

  if(!recalculate){
    try{a.checkDestinationCommunity?.()}catch(_){}
  }else{
    try{a.fetchHazardsAlongRoute?.()}catch(_){}
  }

  routeState.update({
    status:'ready',
    activeRoute:route,
    origin:a.userPos?Array.from(a.userPos):null,
    destination:a.destination?Array.from(a.destination):null,
    lastError:null
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
    const route=await fetchTomTomRoute(origin,destination);

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

    try{a.toast?.('Não foi possível calcular a rota.')}catch(_){}
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
    const newRoute=await fetchTomTomRoute(
      routeOrigin,
      a.destination
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

    try{a.toast?.('Não foi possível atualizar a rota.')}catch(_){}
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

  appRef=a;

  if(a.__radarRoutingAuthorityV1Bound)return true;
  a.__radarRoutingAuthorityV1Bound=true;

  /*
    Fachadas: o App não decide mais de onde vem a rota.
    Todas as entradas passam por RadarRouting.
  */
  a.tomTomModifier=modifier;
  a.fetchTomTomRoute=(origin,destination)=>
    fetchTomTomRoute(origin,destination);

  a.getRoute=(origin,destination)=>
    fetchTomTomRoute(origin,destination);

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
  version:'1.0.0',
  fetch:fetchTomTomRoute,
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
  version:'1.0.0',
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