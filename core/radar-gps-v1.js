/* Radar Seguro RJ PRO — GPS Module v1
   Primeiro módulo extraído da arquitetura antiga.

   Responsabilidade EXCLUSIVA:
   - possuir o watchPosition do navegador;
   - iniciar/parar/reiniciar o GPS;
   - possuir o timer de continuidade do GPS;
   - publicar o último fix bruto em um domínio do RadarKernel.

   Não faz:
   - map matching;
   - câmera;
   - desenho da seta;
   - cálculo de rota;
   - voz.

   Durante esta fase de migração, o processamento existente do App continua
   recebendo os fixes por App.handleGPS()/App.handleGPSError().
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
  lastFix:null,
  lastError:null,
  lastFixAt:0
});

let appRef=null;
let watchId=null;
let continuityTimer=null;
let resumeTimer=null;
let started=false;

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

function publishFix(position){
  const fix=normalizePosition(position);
  if(!fix)return;

  gpsState.update({
    status:'active',
    watching:true,
    lastFix:fix,
    lastFixAt:Date.now(),
    lastError:null
  },{source:'watchPosition'});

  kernel.emit('gps:fix',fix);
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

function clearWatch(){
  if(watchId!=null){
    try{navigator.geolocation?.clearWatch?.(watchId)}catch(_){}
    watchId=null;
  }

  gpsState.update({
    watching:false
  },{source:'stop'});
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
      if(!appRef?.navActive)return;
      appRef?.continueDuringGPSGap?.();
    }catch(error){
      console.warn('[RadarGPS] continuidade:',error);
    }
  },1000);
}

function startTracking(){
  if(!navigator.geolocation){
    gpsState.update({
      supported:false,
      status:'unsupported',
      watching:false
    },{source:'start'});

    try{appRef?.setGPSStatus?.(false,'SEM GPS')}catch(_){}
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

      /*
        Compatibilidade temporária:
        o módulo GPS possui o sensor; o motor legado apenas processa o fix.
        Na próxima etapa, handleGPS também será retirado do index.html.
      */
      try{
        appRef?.handleGPS?.(position);
      }catch(error){
        console.error('[RadarGPS] handleGPS legado:',error);
      }
    },
    error=>{
      publishError(error);

      try{
        appRef?.handleGPSError?.(error);
      }catch(handlerError){
        console.error('[RadarGPS] handleGPSError legado:',handlerError);
      }
    },
    {
      enableHighAccuracy:true,
      maximumAge:500,
      timeout:10000
    }
  );

  if(appRef)appRef.GPSWatch=watchId;
  return true;
}

function suspendIfIdle(){
  if(appRef?.navActive)return false;

  clearWatch();
  clearContinuity();

  gpsState.update({
    status:'suspended'
  },{source:'visibility'});

  if(appRef){
    appRef.GPSWatch=null;
    appRef.gpsContinuityTimer=null;
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

  if(appRef){
    appRef.GPSWatch=null;
    appRef.gpsContinuityTimer=null;
  }
}

function lastFix(maxAgeMs=15000){
  const state=gpsState.get();
  const fix=state.lastFix;
  if(!fix)return null;

  if(Date.now()-Number(state.lastFixAt||0)>maxAgeMs)return null;
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
        publishFix(position);
        resolve(normalizePosition(position));
      },
      ()=>{
        resolve(lastFix(Number(options.fallbackAge||15000)));
      },
      {
        enableHighAccuracy:true,
        maximumAge,
        timeout
      }
    );
  });
}

function bindApp(){
  const candidate=window.RadarApp||window.App||null;
  if(!candidate)return false;
  if(candidate.__radarGpsModuleV1Bound)return true;

  appRef=candidate;
  candidate.__radarGpsModuleV1Bound=true;

  /*
    A partir daqui existe UM único dono do watchPosition:
    RadarGPS. O App mantém os nomes antigos apenas como fachada de compatibilidade.
  */
  candidate.startGPS=function(){
    return startTracking();
  };

  candidate.resumeGPS=function(){
    return resume();
  };

  candidate.suspendIdleGPS=function(){
    return suspendIfIdle();
  };

  /*
    Espelha somente IDs/estado operacional para código legado que ainda consulta
    essas propriedades. O timer real continua pertencendo ao RadarGPS.
  */
  Object.defineProperty(candidate,'gpsContinuityTimer',{
    configurable:true,
    get(){return continuityTimer},
    set(value){
      // bloqueia criação de segundo timer externo; aceita apenas limpeza.
      if(value==null)clearContinuity();
    }
  });

  kernel.emit('gps:bound',{module:'gps-v1'});
  return true;
}

const registration=kernel.registerModule({
  name:'gps-v1',
  version:'1.0.0',
  owns:['gps.position','gps.continuity'],

  async start({resources}){
    const id=resources.interval(()=>{
      if(bindApp()){
        clearInterval(id);
      }
    },100);

    resources.listen(document,'visibilitychange',()=>{
      if(document.visibilityState==='hidden'){
        suspendIfIdle();
      }else{
        resume();
      }
    });

    resources.listen(window,'pagehide',()=>{
      stop();
    });

    return api;
  },

  async stop(){
    stop();
  }
});

const api={
  version:'1.0.0',
  start:startTracking,
  stop,
  resume,
  suspendIfIdle,
  last:lastFix,
  fresh:getFresh,
  state:()=>gpsState.get(),
  subscribe:fn=>gpsState.subscribe(fn),
  bindApp
};

window.RadarGPS=Object.freeze(api);

registration.start().catch(error=>{
  console.error('[RadarGPS] falha ao iniciar módulo:',error);
});

})();