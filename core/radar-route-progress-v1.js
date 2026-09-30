/* Radar Seguro RJ PRO — Route Progress Module v1
   Responsabilidade:
   - map matching entre posição filtrada e rota;
   - cálculo de progresso em metros;
   - geometria cumulativa da rota;
   - ligação entre instruções e offsets da rota.

   Não faz:
   - leitura GPS;
   - cálculo de rota;
   - câmera;
   - voz;
   - desenho da seta.

   Objetivo: impedir que mudanças no GPS alterem diretamente a lógica de
   progresso/navegação e vice-versa.
*/
(()=>{'use strict';

if(window.RadarRouteProgress)return;

const kernel=window.RadarKernel;
if(!kernel){
  console.error('[RadarRouteProgress] RadarKernel não carregado.');
  return;
}

const Utils=window.RADAR_MAP_UTILS_V101?.Utils;
if(
  !Utils ||
  typeof Utils.distanceKm!=='function' ||
  typeof Utils.pointToSegment!=='function' ||
  typeof Utils.angleDiff!=='function'
){
  console.error('[RadarRouteProgress] RADAR_MAP_UTILS_V101.Utils não disponível.');
  return;
}

function app(){
  return window.RadarApp||window.App||null;
}

function findIndexForOffset(route,offset){
  const arr=route?.cumulative||[];
  if(!arr.length)return 0;

  let low=0;
  let high=arr.length-1;

  while(low<high){
    const mid=Math.floor((low+high)/2);

    if(arr[mid]<offset)low=mid+1;
    else high=mid;
  }

  return Math.max(0,low-1);
}

function prepareRouteGeometry(route){
  if(!route?.coords?.length)return route;

  route.cumulative=[0];

  let total=0;

  for(let i=1;i<route.coords.length;i++){
    total+=Utils.distanceKm(route.coords[i-1],route.coords[i])*1000;
    route.cumulative[i]=total;
  }

  let searchStart=0;

  for(const step of route.steps||[]){
    if(
      step.routeOffsetMeters!=null&&
      Number.isFinite(step.routeOffsetMeters)
    ){
      const idx=findIndexForOffset(route,step.routeOffsetMeters);

      step.routeIndex=Math.max(searchStart,idx);
      searchStart=step.routeIndex;
      continue;
    }

    const loc=step.maneuver?.location;

    if(!loc){
      step.routeIndex=searchStart;
      continue;
    }

    let bestIndex=searchStart;
    let bestDist=Infinity;

    for(let i=searchStart;i<route.coords.length-1;i++){
      const res=Utils.pointToSegment(
        loc,
        route.coords[i],
        route.coords[i+1]
      );

      if(res.distanceMeters<bestDist){
        bestDist=res.distanceMeters;
        bestIndex=i;
      }

      if(bestDist<8&&i>bestIndex+15)break;
    }

    step.routeIndex=bestIndex;
    step.routeOffsetMeters=route.cumulative[bestIndex]||0;
    searchStart=bestIndex;
  }

  kernel.emit('navigation:geometry-prepared',{
    points:route.coords.length,
    distanceMeters:route.cumulative[route.cumulative.length-1]||0
  });

  return route;
}

function calculateProgressMeters(index,point,routeOverride){
  const a=app();
  const route=routeOverride||a?.route;

  if(!route?.cumulative?.length)return 0;

  const safeIndex=Math.max(
    0,
    Math.min(
      Number(index)||0,
      route.coords.length-1
    )
  );

  const base=route.cumulative[safeIndex]||0;
  const segmentStart=route.coords[safeIndex];

  if(!segmentStart||!point)return base;

  return base+Utils.distanceKm(segmentStart,point)*1000;
}

function matchPositionToRoute(point,sampleSeconds=1,appOverride){
  const a=appOverride||app();

  if(!a||!point){
    return {
      point,
      index:0,
      distance:999,
      bearing:0,
      progress:0,
      snapped:false,
      confidence:0
    };
  }

  if(
    !a.route||
    !a.route.coords||
    a.route.coords.length<2
  ){
    return {
      point,
      index:0,
      distance:0,
      bearing:a.currentBearing,
      progress:0,
      snapped:false,
      confidence:1
    };
  }

  const coords=a.route.coords;

  const start=Math.max(
    0,
    Number(a.routeProgressIndex||0)-35
  );

  const end=Math.min(
    coords.length-2,
    Number(a.routeProgressIndex||0)+420
  );

  const speedMps=Math.max(
    0,
    Number(a.currentSpeed||0)
  )/3.6;

  const expectedProgress=
    Number(a.routeProgressMeters||0)+
    speedMps*
    Math.max(
      .5,
      Math.min(5,sampleSeconds)
    );

  const backwardTolerance=Math.max(
    16,
    speedMps*1.4
  );

  const forwardAllowance=Math.max(
    55,
    speedMps*
    Math.max(1,sampleSeconds)*
    3+
    30
  );

  let best=null;
  let bestScore=Infinity;

  for(let i=start;i<=end;i++){
    const r=Utils.pointToSegment(
      point,
      coords[i],
      coords[i+1]
    );

    const segmentLength=Math.max(
      0,
      (a.route.cumulative?.[i+1]||0)-
      (a.route.cumulative?.[i]||0)
    );

    const progress=
      (a.route.cumulative?.[i]||0)+
      segmentLength*r.t;

    const headingDifference=Utils.angleDiff(
      Number(a.currentBearing||0),
      r.bearing
    );

    const currentSpeed=Number(a.currentSpeed||0);

    const headingPenalty=currentSpeed>7
      ?headingDifference*(currentSpeed>38?.52:.34)
      :0;

    let continuityPenalty=0;

    if(
      progress<
      Number(a.routeProgressMeters||0)-
      backwardTolerance
    ){
      continuityPenalty+=
        120+
        (
          Number(a.routeProgressMeters||0)-
          backwardTolerance-
          progress
        )*2.4;
    }

    if(
      progress>
      expectedProgress+
      forwardAllowance
    ){
      continuityPenalty+=
        (
          progress-
          expectedProgress-
          forwardAllowance
        )*.58;
    }

    if(
      currentSpeed>12&&
      headingDifference>105
    ){
      continuityPenalty+=85;
    }

    const score=
      r.distanceMeters+
      headingPenalty+
      continuityPenalty;

    if(score<bestScore){
      bestScore=score;

      best={
        rawPoint:r.point,
        index:i,
        distance:r.distanceMeters,
        bearing:r.bearing,
        headingDifference,
        progress
      };
    }
  }

  if(!best){
    return {
      point,
      index:Number(a.routeProgressIndex||0),
      distance:999,
      bearing:Number(a.currentBearing||0),
      progress:Number(a.routeProgressMeters||0),
      snapped:false,
      confidence:0
    };
  }

  const accuracy=Math.max(
    5,
    Math.min(
      80,
      Number(a.currentAccuracy||80)
    )
  );

  const currentSpeed=Number(a.currentSpeed||0);

  const snapLimit=Math.min(
    64,
    Math.max(
      25,
      17+
      accuracy*.78+
      (currentSpeed>60?7:0)
    )
  );

  const directionOK=
    currentSpeed<8||
    best.headingDifference<=82||
    best.distance<=12;

  const progressOK=
    best.progress>=
    Number(a.routeProgressMeters||0)-
    backwardTolerance&&
    best.progress<=
    expectedProgress+
    forwardAllowance*1.8;

  const snapped=
    best.distance<=snapLimit&&
    directionOK&&
    progressOK;

  const distanceConfidence=Math.max(
    0,
    1-best.distance/snapLimit
  );

  const headingConfidence=currentSpeed<8
    ?1
    :Math.max(
      0,
      1-best.headingDifference/120
    );

  const result={
    point:snapped?best.rawPoint:point,
    index:snapped
      ?best.index
      :Number(a.routeProgressIndex||0),
    distance:best.distance,
    bearing:best.bearing,
    progress:snapped
      ?best.progress
      :Number(a.routeProgressMeters||0),
    snapped,
    confidence:snapped
      ?distanceConfidence*.72+
       headingConfidence*.28
      :0
  };

  kernel.emit('navigation:position-matched',{
    snapped:result.snapped,
    distance:result.distance,
    progress:result.progress,
    confidence:result.confidence
  });

  return result;
}

function bindApp(){
  const a=app();
  if(!a)return false;
  if(a.__radarRouteProgressModuleV1Bound)return true;

  a.__radarRouteProgressModuleV1Bound=true;

  a.matchPositionToRoute=(point,sampleSeconds=1)=>
    matchPositionToRoute(point,sampleSeconds,a);

  a.prepareRouteGeometry=route=>
    prepareRouteGeometry(route);

  a.findIndexForOffset=(route,offset)=>
    findIndexForOffset(route,offset);

  a.calculateProgressMeters=(index,point)=>
    calculateProgressMeters(index,point,a.route);

  kernel.emit('navigation:progress-bound',{
    module:'route-progress-v1'
  });

  return true;
}

const api={
  version:'1.1.0',
  match:matchPositionToRoute,
  prepare:prepareRouteGeometry,
  findIndexForOffset,
  calculateProgressMeters,
  bindApp
};

window.RadarRouteProgress=Object.freeze(api);

const registration=kernel.registerModule({
  name:'route-progress-v1',
  version:'1.1.0',
  owns:['navigation.progress'],

  async start({resources}){
    const id=resources.interval(()=>{
      if(bindApp())clearInterval(id);
    },100);

    return api;
  }
});

registration.start().catch(error=>{
  console.error('[RadarRouteProgress] falha ao iniciar módulo:',error);
});

})();