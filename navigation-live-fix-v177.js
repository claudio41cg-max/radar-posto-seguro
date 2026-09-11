/* Radar Seguro RJ PRO v177 — correção de acompanhamento GPS, rotação, progresso e HUD em tempo real. */
(()=>{
'use strict';
if(window.__radarNavigationLiveFixV177)return;
window.__radarNavigationLiveFixV177=true;

const state={
  prevPoint:null,
  prevTime:0,
  movementBearing:null,
  movementAt:0,
  lastManualAt:0,
  lastCameraAt:0,
  displayPoint:null,
  displayAt:0,
  timer:null
};

const app=()=>{
  try{
    if(window.RadarApp?.map)return window.RadarApp;
    if(typeof App!=='undefined'&&App?.map)return App;
  }catch(_){}
  return null;
};

const finitePoint=p=>Array.isArray(p)&&p.length>=2&&Number.isFinite(+p[0])&&Number.isFinite(+p[1]);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const rad=d=>d*Math.PI/180;
const deg=r=>r*180/Math.PI;

function distanceM(a,b){
  if(!finitePoint(a)||!finitePoint(b))return Infinity;
  const R=6371000;
  const p1=rad(+a[1]),p2=rad(+b[1]);
  const d1=p2-p1,d2=rad(+b[0]-+a[0]);
  const q=Math.sin(d1/2)**2+Math.cos(p1)*Math.cos(p2)*Math.sin(d2/2)**2;
  return 2*R*Math.asin(Math.min(1,Math.sqrt(q)));
}

function bearingDeg(a,b){
  if(!finitePoint(a)||!finitePoint(b))return 0;
  const p1=rad(+a[1]),p2=rad(+b[1]),dl=rad(+b[0]-+a[0]);
  const y=Math.sin(dl)*Math.cos(p2);
  const x=Math.cos(p1)*Math.sin(p2)-Math.sin(p1)*Math.cos(p2)*Math.cos(dl);
  return (deg(Math.atan2(y,x))+360)%360;
}

function angleDiff(a,b){
  return Math.abs((((a-b)+540)%360)-180);
}

function blendAngle(a,b,t){
  const d=(((b-a)+540)%360)-180;
  return (a+d*t+360)%360;
}

function destinationPoint(p,bearing,distance){
  if(!finitePoint(p))return p;
  const R=6371000;
  const br=rad(bearing),d=distance/R,lat1=rad(+p[1]),lon1=rad(+p[0]);
  const lat2=Math.asin(Math.sin(lat1)*Math.cos(d)+Math.cos(lat1)*Math.sin(d)*Math.cos(br));
  const lon2=lon1+Math.atan2(Math.sin(br)*Math.sin(d)*Math.cos(lat1),Math.cos(d)-Math.sin(lat1)*Math.sin(lat2));
  return [deg(lon2),deg(lat2)];
}

function modifierFromManeuver(value){
  const s=String(value||'').toUpperCase();
  if(s.includes('UTURN')||s.includes('U_TURN'))return 'uturn';
  if(s.includes('LEFT'))return 'left';
  if(s.includes('RIGHT'))return 'right';
  if(s.includes('ROUNDABOUT')||s.includes('ROTARY'))return 'roundabout';
  return 'straight';
}

function buildCumulative(route){
  if(!Array.isArray(route?.coords)||route.coords.length<2)return [];
  const out=[0];
  let total=0;
  for(let i=1;i<route.coords.length;i++){
    const d=distanceM(route.coords[i-1],route.coords[i]);
    total+=Number.isFinite(d)?d:0;
    out[i]=total;
  }
  route.cumulative=out;
  if(!Number.isFinite(+route.distance)||+route.distance<=0)route.distance=total;
  return out;
}

function normalizeRoute(a,route){
  if(!route||!Array.isArray(route.coords)||route.coords.length<2)return route;
  const sig=[route.coords.length,route.steps?.length||0,route.coords[0]?.join(','),route.coords[route.coords.length-1]?.join(',')].join('|');
  if(route.__v177Normalized===sig&&Array.isArray(route.cumulative)&&route.cumulative.length===route.coords.length)return route;

  buildCumulative(route);
  const total=route.cumulative[route.cumulative.length-1]||+route.distance||0;
  const steps=Array.isArray(route.steps)?route.steps:[];

  for(let i=0;i<steps.length;i++){
    const s=steps[i]||{};
    if(!s.name)s.name=s.street||s.roadName||s.instruction||'Siga pela via';

    const rawM=s.maneuver;
    if(typeof rawM==='string'){
      s.maneuver={
        type:rawM,
        modifier:modifierFromManeuver(rawM),
        location:finitePoint(s.point)?s.point:null
      };
    }else{
      s.maneuver=s.maneuver||{};
      if(!s.maneuver.type&&s.type)s.maneuver.type=s.type;
      if(!s.maneuver.modifier)s.maneuver.modifier=modifierFromManeuver(s.maneuver.type||s.type||'');
      if(!finitePoint(s.maneuver.location)&&finitePoint(s.point))s.maneuver.location=s.point;
    }

    const off=Number(s.routeOffsetMeters??s.distance??s.offset??NaN);
    if(Number.isFinite(off))s.routeOffsetMeters=clamp(off,0,total);
  }

  try{
    if(typeof a?.prepareRouteGeometry==='function')a.prepareRouteGeometry(route);
  }catch(_){
    buildCumulative(route);
  }

  route.__v177Normalized=sig;
  return route;
}

function segmentProjection(p,a,b){
  const lat0=rad(+p[1]);
  const sx=111320*Math.max(.2,Math.cos(lat0));
  const sy=110574;
  const ax=(+a[0]-+p[0])*sx,ay=(+a[1]-+p[1])*sy;
  const bx=(+b[0]-+p[0])*sx,by=(+b[1]-+p[1])*sy;
  const dx=bx-ax,dy=by-ay,den=dx*dx+dy*dy;
  const t=den>0?clamp((-(ax*dx+ay*dy))/den,0,1):0;
  const x=ax+dx*t,y=ay+dy*t;
  return {
    t,
    distance:Math.hypot(x,y),
    point:[+a[0]+(+b[0]-+a[0])*t,+a[1]+(+b[1]-+a[1])*t],
    bearing:bearingDeg(a,b)
  };
}

function repairProgress(a,dt=1){
  const route=normalizeRoute(a,a?.route);
  if(!a?.navActive||!route?.cumulative?.length||!finitePoint(a.rawUserPos||a.filteredPos||a.userPos))return null;
  const p=finitePoint(a.rawUserPos)?a.rawUserPos:(finitePoint(a.filteredPos)?a.filteredPos:a.userPos);
  const coords=route.coords;
  const current=Number.isFinite(+a.routeProgressMeters)?+a.routeProgressMeters:0;
  const idx=clamp(Number.isFinite(+a.routeProgressIndex)?+a.routeProgressIndex:0,0,coords.length-2);
  const start=Math.max(0,idx-30);
  const end=Math.min(coords.length-2,idx+700);
  const speed=Math.max(0,+a.currentSpeed||0);
  const maxAdvance=dt>8?1600:Math.max(180,(speed/3.6)*Math.max(.5,dt)*8+100);
  let best=null;

  for(let i=start;i<=end;i++){
    const pr=segmentProjection(p,coords[i],coords[i+1]);
    const seg=(route.cumulative[i+1]||route.cumulative[i]||0)-(route.cumulative[i]||0);
    const progress=(route.cumulative[i]||0)+Math.max(0,seg)*pr.t;
    if(progress<current-28)continue;
    if(progress>current+maxAdvance)continue;
    let score=pr.distance;
    if(progress<current)score+=(current-progress)*1.4;
    const refBearing=state.movementBearing;
    if(Number.isFinite(refBearing)&&speed>5)score+=angleDiff(refBearing,pr.bearing)*.10;
    if(!best||score<best.score)best={...pr,index:i,progress,score};
  }

  if(!best){state.displayPoint=p;state.displayAt=Date.now();return null;}
  const accuracy=clamp(+a.currentAccuracy||35,5,90);
  const threshold=clamp(15+accuracy*1.45,30,78);
  if(best.distance>threshold){state.displayPoint=p;state.displayAt=Date.now();return best;}

  state.displayPoint=best.point;
  state.displayAt=Date.now();

  if(best.progress>current+.8){
    a.routeProgressMeters=best.progress;
    a.routeProgressIndex=best.index;
    a.lastTrustedProgressMeters=best.progress;
    if(speed>0)a.lastTrustedSpeed=speed;
    a.matchConfidence=Math.max(+a.matchConfidence||0,clamp(1-best.distance/threshold,0,1));
  }

  state.routeBearing=best.bearing;
  try{a.updateRemainingRouteLine?.();}catch(_){}
  return best;
}

function isArrival(step){
  return /arrive|destination|cheg/i.test(String(step?.maneuver?.type||step?.instruction||''));
}

function improvedGuidance(a){
  const route=normalizeRoute(a,a?.route);
  if(!route?.coords?.length)return null;
  const total=route.cumulative?.[route.cumulative.length-1]||+route.distance||0;
  const progress=clamp(+a.routeProgressMeters||0,0,total||Infinity);
  const remaining=Math.max(0,total-progress);
  const steps=Array.isArray(route.steps)?route.steps:[];

  if(!steps.length){
    return {
      index:0,
      step:{name:'Siga pela via',maneuver:{type:'continue',modifier:'straight'},routeOffsetMeters:total},
      distance:remaining,
      next:{name:'Destino',maneuver:{type:'arrive',modifier:'straight'},routeOffsetMeters:total}
    };
  }

  const turnLike=s=>{
    try{return !!a.isTurnStep?.(s);}catch(_){return isArrival(s)||/(left|right|turn|roundabout|exit|fork|ramp|uturn)/i.test(String(s?.maneuver?.type||'')+' '+String(s?.maneuver?.modifier||''));}
  };

  let chosen=-1;
  for(let i=Math.max(0,(+a.routeStepIndex||0)-2);i<steps.length;i++){
    const off=Number(steps[i]?.routeOffsetMeters);
    if(!Number.isFinite(off)||off<progress-4)continue;
    if(turnLike(steps[i])){chosen=i;break;}
  }

  if(chosen<0){
    for(let i=0;i<steps.length;i++){
      const off=Number(steps[i]?.routeOffsetMeters);
      if(Number.isFinite(off)&&off>=progress+8){chosen=i;break;}
    }
  }

  if(chosen<0){
    return {
      index:steps.length-1,
      step:{name:'Siga pela via',maneuver:{type:'continue',modifier:'straight'},routeOffsetMeters:total},
      distance:remaining,
      next:{name:'Destino',maneuver:{type:'arrive',modifier:'straight'},routeOffsetMeters:total}
    };
  }

  let step=steps[chosen];
  let off=Number(step.routeOffsetMeters);
  if(!Number.isFinite(off))off=total;
  let distance=Math.max(0,off-progress);

  /* Se o passo atual ficou alguns metros para trás após a curva, avança logo para o próximo. */
  if(distance<=1&&progress>off+2){
    for(let i=chosen+1;i<steps.length;i++){
      const noff=Number(steps[i]?.routeOffsetMeters);
      if(Number.isFinite(noff)&&noff>progress+5){chosen=i;step=steps[i];off=noff;distance=noff-progress;break;}
    }
  }

  let next=null;
  for(let i=chosen+1;i<steps.length;i++){
    const noff=Number(steps[i]?.routeOffsetMeters);
    if(Number.isFinite(noff)&&noff>off+3&&turnLike(steps[i])){next=steps[i];break;}
  }

  a.routeStepIndex=Math.max(+a.routeStepIndex||0,chosen);

  /* Em trechos sem outra conversão, mostra distância real até o destino em vez de 0 m no passo inicial. */
  if(isArrival(step)&&distance>30){
    return {
      index:chosen,
      step:{
        name:'Siga pela via',
        maneuver:{type:'continue',modifier:'straight',location:step.maneuver?.location},
        routeOffsetMeters:off
      },
      distance,
      next:{name:'Destino',maneuver:{type:'arrive',modifier:'straight'},routeOffsetMeters:off}
    };
  }

  return {index:chosen,step,distance,next};
}

function updateRemainingSummary(a){
  const route=normalizeRoute(a,a?.route);
  if(!route)return;
  const total=route.cumulative?.[route.cumulative.length-1]||+route.distance||0;
  if(!(total>0))return;
  const progress=clamp(+a.routeProgressMeters||0,0,total);
  const remaining=Math.max(0,total-progress);
  const totalSec=Math.max(0,+route.duration||+route.time||0);
  const remainSec=totalSec>0?totalSec*(remaining/total):0;
  const mins=remaining<25?1:Math.max(1,Math.ceil(remainSec/60));
  const t=document.getElementById('sheetTime');
  const d=document.getElementById('sheetDist');
  if(t)t.textContent=mins+' min';
  if(d){
    const text=remaining<1000
      ? Math.max(0,Math.round(remaining/10)*10)+' m'
      : (remaining/1000).toFixed(1)+' km';
    d.textContent=text+' • chegada prevista';
  }
}

function chooseHeading(a){
  const speed=Math.max(0,+a.currentSpeed||0);
  const recentMovement=Number.isFinite(state.movementBearing)&&Date.now()-state.movementAt<4500;
  const rb=Number.isFinite(state.routeBearing)?state.routeBearing:(()=>{
    const r=a.route,idx=clamp(+a.routeProgressIndex||0,0,(r?.coords?.length||2)-2);
    if(r?.coords?.[idx]&&r?.coords?.[idx+1])return bearingDeg(r.coords[idx],r.coords[idx+1]);
    return null;
  })();

  if(speed>4&&recentMovement){
    if(Number.isFinite(rb)&&angleDiff(state.movementBearing,rb)<55)return blendAngle(state.movementBearing,rb,.28);
    return state.movementBearing;
  }
  if(Number.isFinite(rb)&&speed>3)return rb;
  if(Number.isFinite(+a.currentBearing))return +a.currentBearing;
  try{return a.map.getBearing();}catch(_){return 0;}
}

function followCamera(a,force=false){
  if(!a?.map||!a.navActive||!a.followMode)return;
  const freshDisplay=finitePoint(state.displayPoint)&&Date.now()-state.displayAt<3500;
  const p=freshDisplay
    ? state.displayPoint
    : (finitePoint(a.rawUserPos)&&(+a.currentAccuracy||999)<=50
      ? a.rawUserPos
      : (finitePoint(a.filteredPos)?a.filteredPos:a.userPos));
  if(!finitePoint(p))return;
  const now=Date.now();
  if(!force&&now-state.lastCameraAt<330)return;
  state.lastCameraAt=now;

  const speed=Math.max(0,+a.currentSpeed||0);
  const heading=chooseHeading(a);
  if(speed>4&&Number.isFinite(heading)){
    a.currentBearing=blendAngle(Number.isFinite(+a.currentBearing)?+a.currentBearing:heading,heading,.72);
    try{a.userMarker?.setRotation?.(heading);}catch(_){}
  }

  let zoom=17.65;
  let ahead=34;
  if(speed>70){zoom=15.95;ahead=82;}
  else if(speed>52){zoom=16.25;ahead=68;}
  else if(speed>32){zoom=16.75;ahead=54;}
  else if(speed>18){zoom=17.20;ahead=44;}
  if(speed<4.5)ahead=0;

  const center=ahead>0?destinationPoint(p,heading,ahead):p;
  let bearing=heading;
  try{if(speed<4.5)bearing=a.map.getBearing();}catch(_){}

  try{
    a.map.easeTo({
      center,
      zoom,
      pitch:62,
      bearing,
      duration:300,
      essential:true
    });
  }catch(_){}
}

function measuredSpeed(position){
  const c=position?.coords;
  if(!c||!Number.isFinite(+c.longitude)||!Number.isFinite(+c.latitude))return null;
  const p=[+c.longitude,+c.latitude];
  const ts=Number.isFinite(+position.timestamp)?+position.timestamp:Date.now();
  let derived=NaN,move=0,dt=0;
  if(finitePoint(state.prevPoint)&&state.prevTime){
    dt=clamp((ts-state.prevTime)/1000,.2,15);
    move=distanceM(state.prevPoint,p);
    if(dt<=10)derived=move/dt*3.6;
    if(move>=3&&dt<=8){
      state.movementBearing=bearingDeg(state.prevPoint,p);
      state.movementAt=Date.now();
    }
  }
  const sensor=Number.isFinite(+c.speed)&&+c.speed>=0?+c.speed*3.6:NaN;
  let value=Number.isFinite(sensor)?sensor:derived;
  if(Number.isFinite(derived)&&derived>4&&(!Number.isFinite(sensor)||sensor<2))value=derived;
  state.prevPoint=p;
  state.prevTime=ts;
  return {value:Number.isFinite(value)?clamp(value,0,180):null,dt:dt||1,move,point:p,accuracy:+c.accuracy||999};
}

function bindManualTracking(a){
  const m=a?.map;
  if(!m?.on||m.__v177ManualTracking)return;
  m.__v177ManualTracking=true;
  const mark=e=>{if(e?.originalEvent)state.lastManualAt=Date.now();};
  ['dragstart','zoomstart','rotatestart','pitchstart'].forEach(ev=>m.on(ev,mark));
  ['northBtn','zoomIn','zoomOut'].forEach(id=>document.getElementById(id)?.addEventListener('click',()=>{if(a.navActive)state.lastManualAt=Date.now();},true));
}

function install(){
  const a=app();
  if(!a?.map)return false;
  if(a.__navigationLiveFixV177)return true;
  a.__navigationLiveFixV177=true;
  bindManualTracking(a);

  const oldDraw=typeof a.drawRoute==='function'?a.drawRoute.bind(a):null;
  if(oldDraw)a.drawRoute=function(route,...args){
    normalizeRoute(this,route);
    const out=oldDraw(route,...args);
    setTimeout(()=>{normalizeRoute(this,this.route);updateRemainingSummary(this);},60);
    return out;
  };

  const oldGuidance=typeof a.getUpcomingGuidance==='function'?a.getUpcomingGuidance.bind(a):null;
  a.getUpcomingGuidance=function(){
    try{return improvedGuidance(this)||oldGuidance?.();}
    catch(e){return oldGuidance?.();}
  };

  const oldCamera=typeof a.updateCamera==='function'?a.updateCamera.bind(a):null;
  a.updateCamera=function(...args){
    if(!this.navActive)return oldCamera?.(...args);
    followCamera(this,false);
  };

  const oldSummary=typeof a.updateRouteSummary==='function'?a.updateRouteSummary.bind(a):null;
  a.updateRouteSummary=function(...args){
    const out=oldSummary?.(...args);
    updateRemainingSummary(this);
    return out;
  };

  const oldHandle=typeof a.handleGPS==='function'?a.handleGPS.bind(a):null;
  if(oldHandle)a.handleGPS=function(position,...args){
    const ms=measuredSpeed(position);
    const out=oldHandle(position,...args);

    if(ms?.value!=null){
      const cur=Math.max(0,+this.currentSpeed||0);
      if(ms.value>3.5&&cur<2.5)this.currentSpeed=ms.value;
      else if(ms.value>2.5)this.currentSpeed=cur*.55+ms.value*.45;
      else if(ms.move<2&&ms.value<1.2)this.currentSpeed=0;
      try{this.updateSpeedUI?.();}catch(_){}
    }

    if(this.navActive){
      normalizeRoute(this,this.route);
      const repaired=repairProgress(this,ms?.dt||1);
      if(finitePoint(state.displayPoint)){
        try{this.userMarker?.setLngLat?.(state.displayPoint);}catch(_){}
      }
      updateRemainingSummary(this);
      try{this.updateNavigation?.();}catch(_){}
      if(!this.followMode&&Date.now()-state.lastManualAt>9800)this.followMode=true;
      if(this.followMode)followCamera(this,true);
    }
    return out;
  };

  const oldStart=typeof a.startNavigation==='function'?a.startNavigation.bind(a):null;
  if(oldStart)a.startNavigation=function(...args){
    normalizeRoute(this,this.route);
    const out=oldStart(...args);
    this.followMode=true;
    state.lastManualAt=0;
    setTimeout(()=>{
      normalizeRoute(this,this.route);
      repairProgress(this,1);
      updateRemainingSummary(this);
      try{this.updateNavigation?.();}catch(_){}
      followCamera(this,true);
    },180);
    return out;
  };

  const oldRecenter=typeof a.recenter==='function'?a.recenter.bind(a):null;
  if(oldRecenter)a.recenter=function(...args){
    const out=oldRecenter(...args);
    if(this.navActive){
      this.followMode=true;
      state.lastManualAt=0;
      setTimeout(()=>followCamera(this,true),80);
    }
    return out;
  };

  state.timer=setInterval(()=>{
    const x=app();
    if(!x?.navActive)return;
    normalizeRoute(x,x.route);
    updateRemainingSummary(x);
    if(!x.followMode&&Date.now()-state.lastManualAt>10000)x.followMode=true;
    if(x.followMode&&Date.now()-(+x.lastGPSAt||0)<7000)followCamera(x,false);
  },1000);

  document.addEventListener('visibilitychange',()=>{
    const x=app();
    if(document.visibilityState==='visible'&&x?.navActive){
      x.followMode=true;
      state.lastManualAt=0;
      try{x.startGPS?.();}catch(_){}
      setTimeout(()=>followCamera(x,true),300);
    }
  });

  window.addEventListener('pageshow',()=>{
    const x=app();
    if(x?.navActive){x.followMode=true;setTimeout(()=>followCamera(x,true),250);}
  });

  normalizeRoute(a,a.route);
  updateRemainingSummary(a);
  return true;
}

let tries=0;
const boot=setInterval(()=>{
  tries++;
  if(install()||tries>180)clearInterval(boot);
},100);

window.RadarNavigationLiveFixV177={
  install,
  repairProgress:()=>{const a=app();return a?repairProgress(a,1):null;},
  follow:()=>{const a=app();if(a){a.followMode=true;followCamera(a,true);}},
  version:'177'
};
})();
