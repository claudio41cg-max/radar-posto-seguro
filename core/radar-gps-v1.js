/* Radar Seguro RJ PRO — GPS Module v2
   Módulo GPS isolado.

   Responsabilidade EXCLUSIVA:
   - possuir watchPosition/getCurrentPosition;
   - iniciar/parar/reiniciar o GPS;
   - manter estado raw/filtered/canonical;
   - filtrar posição (Kalman adaptativo);
   - calcular velocidade/bearing base;
   - possuir continuidade curta durante falha de GPS;
   - publicar fixes/estado pelo RadarKernel.

   Fora deste módulo:
   - cálculo da rota;
   - map matching;
   - câmera;
   - desenho da seta;
   - voz.

   Compatibilidade:
   O App ainda recebe espelhos de userPos/rawUserPos/filteredPos/currentSpeed/
   currentBearing para os módulos legados que ainda dependem dessas propriedades.
   Porém, a origem e a atualização desses valores passam a ser controladas aqui.
*/
(()=>{'use strict';

if(window.RadarGPS)return;

const kernel=window.RadarKernel;
if(!kernel){
  console.error('[RadarGPS] RadarKernel não carregado.');
  return;
}

const gpsState=kernel.createDomain('gps',{
  status:'idle',
  supported:!!navigator.geolocation,
  permission:'unknown',
  watching:false,
  raw:null,
  filtered:null,
  canonical:null,
  accuracy:null,
  speedKmh:0,
  bearing:0,
  lastFix:null,
  lastError:null,
  lastFixAt:0
});

let appRef=null;
let watchId=null;
let continuityTimer=null;
let resumeTimer=null;

const state={
  kalman:null,
  rawPos:null,
  rawAt:0,
  filteredPos:null,
  canonicalPos:null,
  accuracy:999,
  speedKmh:0,
  bearing:0,
  lastGPSAt:0,
  lastTrustedSpeed:0,
  lastTrustedProgressMeters:0
};

function app(){
  return appRef||window.RadarApp||window.App||null;
}

function normalizePosition(position){
  const c=position?.coords;
  if(!c)return null;

  const lat=Number(c.latitude);
  const lon=Number(c.longitude);

  if(!Number.isFinite(lat)||!Number.isFinite(lon))return null;

  return {
    lat,
    lon,
    accuracy:Number(c.accuracy||999),
    altitude:Number.isFinite(Number(c.altitude))?Number(c.altitude):null,
    altitudeAccuracy:Number.isFinite(Number(c.altitudeAccuracy))?Number(c.altitudeAccuracy):null,
    heading:Number.isFinite(Number(c.heading))?Number(c.heading):null,
    speedMps:Number.isFinite(Number(c.speed))?Math.max(0,Number(c.speed)):null,
    timestamp:Number.isFinite(Number(position.timestamp))?Number(position.timestamp):Date.now()
  };
}

function publishState(meta={}){
  gpsState.update({
    raw:state.rawPos?state.rawPos.slice():null,
    filtered:state.filteredPos?state.filteredPos.slice():null,
    canonical:state.canonicalPos?state.canonicalPos.slice():null,
    accuracy:state.accuracy,
    speedKmh:state.speedKmh,
    bearing:state.bearing,
    lastFixAt:state.lastGPSAt
  },meta);
}

function publishFix(position){
  const fix=normalizePosition(position);
  if(!fix)return null;

  gpsState.update({
    status:'active',
    watching:true,
    lastFix:fix,
    lastFixAt:Date.now(),
    lastError:null
  },{source:'watchPosition'});

  kernel.emit('gps:fix',fix);
  return fix;
}

function publishError(error){
  const code=Number(error?.code||0);
  const normalized={
    code,
    message:String(error?.message||'Erro de GPS'),
    at:Date.now()
  };

  gpsState.update({
    status:code===1?'blocked':'waiting',
    lastError:normalized
  },{source:'watchPosition'});

  kernel.emit('gps:error',normalized);
}

function filterPosition(raw,accuracy,speedKmh,timestamp){
  const measurementAccuracy=Math.max(5,Math.min(100,accuracy||100));

  if(
    !state.kalman||
    !Number.isFinite(state.kalman.timestamp)||
    timestamp-state.kalman.timestamp>15000
  ){
    state.kalman={
      point:[raw[0],raw[1]],
      variance:measurementAccuracy*measurementAccuracy,
      timestamp
    };

    return [raw[0],raw[1]];
  }

  const dt=Math.max(.2,Math.min(5,(timestamp-state.kalman.timestamp)/1000));
  const processSigma=2.5+Math.max(0,speedKmh)/7.2;

  state.kalman.variance+=processSigma*processSigma*dt;

  const measurementVariance=measurementAccuracy*measurementAccuracy;
  const minimumGain=speedKmh>60?.28:speedKmh>25?.20:.10;
  const gain=Math.max(
    minimumGain,
    Math.min(
      .86,
      state.kalman.variance/(state.kalman.variance+measurementVariance)
    )
  );

  state.kalman.point=[
    state.kalman.point[0]+(raw[0]-state.kalman.point[0])*gain,
    state.kalman.point[1]+(raw[1]-state.kalman.point[1])*gain
  ];

  state.kalman.variance=Math.max(4,(1-gain)*state.kalman.variance);
  state.kalman.timestamp=timestamp;

  return state.kalman.point.slice();
}

function mirrorToLegacy(a){
  if(!a)return;

  a.rawUserPos=state.rawPos?state.rawPos.slice():null;
  a.filteredPos=state.filteredPos?state.filteredPos.slice():null;
  a.userPos=state.canonicalPos?state.canonicalPos.slice():null;
  a.currentAccuracy=state.accuracy;
  a.currentSpeed=state.speedKmh;
  a.currentBearing=state.bearing;
  a.lastGPSAt=state.lastGPSAt;
  a.lastRawPos=state.rawPos?state.rawPos.slice():null;
  a.lastRawAt=state.rawAt;
  a.lastTrustedSpeed=state.lastTrustedSpeed;
  a.lastTrustedProgressMeters=state.lastTrustedProgressMeters;
}

function processPosition(position){
  const a=app();
  if(!a)return false;

  const c=position?.coords;
  if(!c)return false;

  const timestamp=Number.isFinite(Number(position.timestamp))
    ?Number(position.timestamp)
    :Date.now();

  const raw=[Number(c.longitude),Number(c.latitude)];
  if(!raw.every(Number.isFinite))return false;

  state.accuracy=Number(c.accuracy||999);

  let movedMeters=0;
  if(state.rawPos){
    try{
      movedMeters=Utils.distanceKm(state.rawPos,raw)*1000;
    }catch(_){}
  }

  const sampleSeconds=state.rawAt
    ?Math.max(.25,Math.min(12,(timestamp-state.rawAt)/1000))
    :1;

  const derivedSpeed=state.rawPos&&sampleSeconds<10
    ?movedMeters/sampleSeconds*3.6
    :0;

  let speedKmh=(
    c.speed!=null&&
    !Number.isNaN(c.speed)&&
    c.speed>=0
  )
    ?c.speed*3.6
    :derivedSpeed;

  if(speedKmh<2&&derivedSpeed>4&&state.accuracy<45){
    speedKmh=derivedSpeed;
  }

  speedKmh=Math.max(0,Math.min(180,speedKmh));

  if(state.accuracy>100&&state.canonicalPos){
    return false;
  }

  if(state.rawPos){
    const allowedJump=Math.max(
      85,
      state.accuracy*3.2,
      (Math.max(speedKmh,state.speedKmh,10)/3.6)*sampleSeconds*3+35
    );

    if(movedMeters>allowedJump&&sampleSeconds<12){
      return false;
    }
  }

  state.lastGPSAt=Date.now();

  const stationary=
    speedKmh<2.2&&
    movedMeters<Math.max(5,Math.min(9,state.accuracy*.22));

  if(stationary&&state.filteredPos){
    state.rawPos=raw;
    state.rawAt=timestamp;
    state.speedKmh=0;
    state.lastTrustedSpeed=0;

    mirrorToLegacy(a);
    publishState({source:'stationary'});

    try{a.updateSpeedUI?.()}catch(_){}
    try{a.setGPSStatus?.(true,'GPS ATIVO')}catch(_){}
    try{a.runAdaptiveGPSTasks?.()}catch(_){}

    return true;
  }

  state.filteredPos=filterPosition(
    raw,
    state.accuracy,
    speedKmh,
    timestamp
  );

  let heading=c.heading;

  if(
    (heading==null||Number.isNaN(heading))&&
    state.rawPos&&
    movedMeters>5
  ){
    try{heading=Utils.bearing(state.rawPos,raw)}catch(_){}
  }

  if(
    heading!=null&&
    !Number.isNaN(heading)&&
    speedKmh>4
  ){
    const delta=((heading-state.bearing+540)%360)-180;
    const headingGain=speedKmh>45?.46:.34;
    state.bearing=(state.bearing+delta*headingGain+360)%360;
  }

  state.rawPos=raw;
  state.rawAt=timestamp;

  state.speedKmh=state.speedKmh>0
    ?state.speedKmh*.56+speedKmh*.44
    :speedKmh;

  /*
    Map matching continua pertencendo à navegação.
    O GPS fornece a posição filtrada e recebe de volta a posição canônica
    quando há uma rota ativa.
  */
  let match={
    point:state.filteredPos,
    confidence:1,
    snapped:false,
    progress:Number(a.routeProgressMeters||0),
    index:Number(a.routeProgressIndex||0)
  };

  try{
    if(typeof a.matchPositionToRoute==='function'){
      match=a.matchPositionToRoute(state.filteredPos,sampleSeconds)||match;
    }
  }catch(error){
    console.warn('[RadarGPS] map matching:',error);
  }

  state.canonicalPos=Array.isArray(match?.point)
    ?match.point.slice()
    :state.filteredPos.slice();

  if(a.route&&match?.snapped){
    a.routeProgressIndex=Math.max(
      Number(a.routeProgressIndex||0),
      Number(match.index||0)
    );

    a.routeProgressMeters=Math.max(
      Number(a.routeProgressMeters||0),
      Number(match.progress||0)
    );

    state.lastTrustedProgressMeters=a.routeProgressMeters;
    state.lastTrustedSpeed=state.speedKmh;

    try{a.updateRemainingRouteLine?.()}catch(_){}
  }

  mirrorToLegacy(a);
  a.matchConfidence=Number(match?.confidence||0);

  publishState({source:'processed'});

  try{a.updateUserMarker?.()}catch(_){}
  try{a.updateSpeedUI?.()}catch(_){}
  try{a.setGPSStatus?.(true,'GPS ATIVO')}catch(_){}

  if(!a._firstGPS){
    a._firstGPS=true;

    try{
      a.map?.flyTo?.({
        center:state.canonicalPos,
        zoom:16,
        duration:700
      });
    }catch(_){}

    try{FuelModule?.load?.(state.canonicalPos)}catch(_){}
  }

  try{a.updateNavigation?.()}catch(_){}
  try{a.checkOffRoute?.(match)}catch(_){}
  try{a.runAdaptiveGPSTasks?.()}catch(_){}

  kernel.emit('gps:processed',{
    raw:state.rawPos?.slice()||null,
    filtered:state.filteredPos?.slice()||null,
    canonical:state.canonicalPos?.slice()||null,
    speedKmh:state.speedKmh,
    bearing:state.bearing,
    accuracy:state.accuracy,
    match
  });

  return true;
}

function handleError(error){
  const a=app();
  const gap=Date.now()-state.lastGPSAt;

  if(
    a?.navActive&&
    gap<8000&&
    state.speedKmh>6
  ){
    continueDuringGap();
    return;
  }

  try{
    a?.setGPSStatus?.(
      false,
      Number(error?.code)===1?'GPS BLOQ.':'GPS...'
    );
  }catch(_){}
}

function continueDuringGap(){
  const a=app();

  if(
    !a?.navActive||
    !a.route?.cumulative?.length||
    !state.lastGPSAt||
    a.rerouting
  ){
    return false;
  }

  const gapMs=Date.now()-state.lastGPSAt;
  if(gapMs<=2200)return false;

  if(
    gapMs>8000||
    state.lastTrustedSpeed<6||
    state.accuracy>50
  ){
    if(gapMs>8000){
      try{a.setGPSStatus?.(false,'GPS...')}catch(_){}
    }
    return false;
  }

  const speedMps=state.lastTrustedSpeed/3.6;
  const advance=Math.min(45,speedMps*(gapMs/1000));

  const total=a.route.cumulative[a.route.cumulative.length-1]||0;
  const target=Math.min(total,state.lastTrustedProgressMeters+advance);

  if(target<=Number(a.routeProgressMeters||0)+.5){
    return false;
  }

  const index=a.findIndexForOffset?.(a.route,target);
  if(!Number.isFinite(index))return false;

  const nextIndex=Math.min(index+1,a.route.coords.length-1);
  const p0=a.route.coords[index];
  const p1=a.route.coords[nextIndex];
  if(!p0||!p1)return false;

  const d0=a.route.cumulative[index]||0;
  const d1=a.route.cumulative[nextIndex]||d0;
  const t=Math.max(0,Math.min(1,(target-d0)/Math.max(1,d1-d0)));

  state.canonicalPos=Utils.interpolatePoint(p0,p1,t);
  state.bearing=Utils.bearing(p0,p1);

  a.routeProgressIndex=Math.max(
    Number(a.routeProgressIndex||0),
    index
  );

  a.routeProgressMeters=target;

  mirrorToLegacy(a);
  publishState({source:'gap-estimate'});

  /*
    Importante: não redesenha rota/HUD completo durante GPS estimado.
    Isso evita voz duplicada e re-renderização agressiva.
  */
  try{a.updateUserMarker?.()}catch(_){}
  try{a.updateSpeedUI?.()}catch(_){}
  try{a.setGPSStatus?.(true,'GPS EST.')}catch(_){}

  kernel.emit('gps:estimated',{
    canonical:state.canonicalPos.slice(),
    bearing:state.bearing,
    routeProgressMeters:target
  });

  return true;
}

function clearWatch(){
  if(watchId!=null){
    try{navigator.geolocation?.clearWatch?.(watchId)}catch(_){}
    watchId=null;
  }

  gpsState.update({watching:false},{source:'stop'});
}

function clearContinuity(){
  if(continuityTimer){
    clearInterval(continuityTimer);
    continuityTimer=null;
  }
}

function startContinuity(){
  clearContinuity();

  continuityTimer=setInterval(()=>{
    try{
      if(!app()?.navActive)return;
      continueDuringGap();
    }catch(error){
      console.warn('[RadarGPS] continuidade:',error);
    }
  },1000);
}

function startTracking(){
  const a=app();

  if(!navigator.geolocation){
    gpsState.update({
      supported:false,
      status:'unsupported',
      watching:false
    },{source:'start'});

    try{a?.setGPSStatus?.(false,'SEM GPS')}catch(_){}
    return false;
  }

  clearWatch();

  gpsState.update({
    supported:true,
    status:'starting',
    watching:true,
    lastError:null
  },{source:'start'});

  startContinuity();

  watchId=navigator.geolocation.watchPosition(
    position=>{
      publishFix(position);
      processPosition(position);
    },
    error=>{
      publishError(error);
      handleError(error);
    },
    {
      enableHighAccuracy:true,
      maximumAge:500,
      timeout:10000
    }
  );

  if(a)a.GPSWatch=watchId;
  return true;
}

function suspendIfIdle(){
  const a=app();
  if(a?.navActive)return false;

  clearWatch();
  clearContinuity();

  gpsState.update({status:'suspended'},{source:'visibility'});

  if(a){
    a.GPSWatch=null;
  }

  return true;
}

function resume(){
  if(resumeTimer)clearTimeout(resumeTimer);

  resumeTimer=setTimeout(()=>{
    resumeTimer=null;

    if(document.visibilityState==='visible'){
      startTracking();
    }
  },350);

  return true;
}

function stop(){
  const a=app();

  if(resumeTimer){
    clearTimeout(resumeTimer);
    resumeTimer=null;
  }

  clearWatch();
  clearContinuity();

  gpsState.update({
    status:'stopped',
    watching:false
  },{source:'stop'});

  if(a)a.GPSWatch=null;
}

function lastFix(maxAgeMs=15000){
  const current=gpsState.get();
  const fix=current.lastFix;
  if(!fix)return null;

  if(Date.now()-Number(current.lastFixAt||0)>maxAgeMs)return null;
  return fix;
}

function getFresh(options={}){
  const timeout=Math.max(1000,Number(options.timeout||8000));
  const maximumAge=Math.max(0,Number(options.maximumAge||0));

  return new Promise(resolve=>{
    if(!navigator.geolocation){
      resolve(null);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      position=>{
        const fix=publishFix(position);
        /*
          Consulta pontual não altera navegação/userPos.
          Isso elimina o antigo efeito colateral de "onde estou?"
          modificar a posição do navegador.
        */
        resolve(fix);
      },
      ()=>resolve(lastFix(Number(options.fallbackAge||15000))),
      {
        enableHighAccuracy:true,
        maximumAge,
        timeout
      }
    );
  });
}

function isRealRadarApp(candidate){
  return !!(
    candidate&&
    typeof candidate.setGPSStatus==='function'&&
    typeof candidate.updateUserMarker==='function'&&
    typeof candidate.runAdaptiveGPSTasks==='function'
  );
}

function bindApp(){
  const candidate=window.RadarApp||window.App||null;

  /*
    app-main cria um RadarApp provisório antes do DOMContentLoaded.
    Nunca prender o GPS nesse placeholder: o dono real precisa ser o
    App completo, já com UI/mapa/fachadas disponíveis.
  */
  if(!isRealRadarApp(candidate))return false;

  if(
    appRef===candidate&&
    candidate.__radarGpsModuleV2Bound
  ){
    return true;
  }

  appRef=candidate;
  candidate.__radarGpsModuleV2Bound=true;

  /*
    Fachadas de compatibilidade:
    o App não contém mais lógica de GPS; apenas delega ao RadarGPS.
  */
  candidate.startGPS=()=>startTracking();
  candidate.resumeGPS=()=>resume();
  candidate.suspendIdleGPS=()=>suspendIfIdle();
  candidate.handleGPS=position=>processPosition(position);
  candidate.handleGPSError=error=>handleError(error);
  candidate.filterGPSPosition=(raw,accuracy,speed,timestamp)=>
    filterPosition(raw,accuracy,speed,timestamp);
  candidate.continueDuringGPSGap=()=>continueDuringGap();

  kernel.emit('gps:bound',{module:'gps-v2'});
  return true;
}

const api={
  version:'2.1.0',
  start:startTracking,
  stop,
  resume,
  suspendIfIdle,
  process:processPosition,
  handleError,
  filter:filterPosition,
  continueDuringGap,
  last:lastFix,
  fresh:getFresh,
  state:()=>gpsState.get(),
  subscribe:fn=>gpsState.subscribe(fn),
  bindApp
};

window.RadarGPS=Object.freeze(api);

const registration=kernel.registerModule({
  name:'gps-v1',
  version:'2.1.0',
  owns:['gps.position','gps.continuity'],

  async start({resources}){
    const id=resources.interval(()=>{
      if(bindApp()){
        clearInterval(id);

        /*
          Padrão de app de navegação: ao entrar em estado ativo e com o
          App real pronto, o provedor de localização começa imediatamente.
          Não depender de refresh/pageshow para criar o primeiro watch.
        */
        if(document.visibilityState==='visible'){
          startTracking();
        }
      }
    },100);

    resources.listen(document,'visibilitychange',()=>{
      if(document.visibilityState==='hidden'){
        suspendIfIdle();
      }else{
        resume();
      }
    });

    resources.listen(window,'pagehide',()=>stop());

    resources.listen(window,'pageshow',()=>{
      if(document.visibilityState==='visible'){
        resume();
      }
    });

    return api;
  },

  async stop(){
    stop();
  }
});

registration.start().catch(error=>{
  console.error('[RadarGPS] falha ao iniciar módulo:',error);
});

})();