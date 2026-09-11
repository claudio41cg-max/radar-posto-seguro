/* Radar Seguro RJ PRO v178 — evita chegada falsa parado e trava o mapa comum onde o motorista deixou. */
(()=>{
'use strict';
if(window.__radarNavigationGuardsV178)return;
window.__radarNavigationGuardsV178=true;

const S={
  mainHold:false,
  navStartedAt:0,
  navOrigin:null,
  lastNavRaw:null,
  lastNavRawAt:0,
  maxFromStart:0,
  realMovement:0,
  movingSamples:0,
  maxProgress:0
};

const app=()=>{
  try{
    if(window.RadarApp?.map)return window.RadarApp;
    if(typeof App!=='undefined'&&App?.map)return App;
  }catch(_){}
  return null;
};

const point=p=>Array.isArray(p)&&p.length>=2&&Number.isFinite(+p[0])&&Number.isFinite(+p[1]);
const rad=d=>d*Math.PI/180;
function distM(a,b){
  if(!point(a)||!point(b))return Infinity;
  const R=6371000,p1=rad(+a[1]),p2=rad(+b[1]),d1=p2-p1,d2=rad(+b[0]-+a[0]);
  const q=Math.sin(d1/2)**2+Math.cos(p1)*Math.cos(p2)*Math.sin(d2/2)**2;
  return 2*R*Math.asin(Math.min(1,Math.sqrt(q)));
}
function destination(a){
  const d=a?.destination;
  if(point(d))return [+d[0],+d[1]];
  if(d&&Number.isFinite(+(d.lon??d.lng))&&Number.isFinite(+d.lat))return [+(d.lon??d.lng),+d.lat];
  return null;
}
function routeTotal(a){
  const c=a?.route?.cumulative;
  if(Array.isArray(c)&&c.length)return +c[c.length-1]||0;
  return +a?.route?.distance||0;
}
function resetTrip(a){
  S.navStartedAt=Date.now();
  const p=point(a?.rawUserPos)?a.rawUserPos:(point(a?.filteredPos)?a.filteredPos:a?.userPos);
  S.navOrigin=point(p)?[+p[0],+p[1]]:null;
  S.lastNavRaw=S.navOrigin?S.navOrigin.slice():null;
  S.lastNavRawAt=Date.now();
  S.maxFromStart=0;
  S.realMovement=0;
  S.movingSamples=0;
  S.maxProgress=0;
  try{a.lastArrivalAnnounced=false;}catch(_){}
}
function noteMovement(a,position){
  if(!a?.navActive)return;
  const c=position?.coords;
  if(!c||!Number.isFinite(+c.longitude)||!Number.isFinite(+c.latitude))return;
  const p=[+c.longitude,+c.latitude];
  const acc=+c.accuracy||999;
  const ts=Number.isFinite(+position.timestamp)?+position.timestamp:Date.now();
  if(!S.navStartedAt)resetTrip(a);
  if(!S.navOrigin)S.navOrigin=p.slice();
  if(acc<=55){
    S.maxFromStart=Math.max(S.maxFromStart,distM(S.navOrigin,p));
    if(point(S.lastNavRaw)&&S.lastNavRawAt){
      const d=distM(S.lastNavRaw,p);
      const dt=Math.max(.25,Math.min(12,(ts-S.lastNavRawAt)/1000));
      const kmh=d/dt*3.6;
      const plausible=d<=Math.max(80,acc*3+35)&&kmh<150;
      if(plausible&&d>=3.5){
        S.realMovement+=d;
        if(kmh>=4.5)S.movingSamples++;
      }
    }
  }
  S.lastNavRaw=p;
  S.lastNavRawAt=ts;
  S.maxProgress=Math.max(S.maxProgress,+a.routeProgressMeters||0);
}
function arrivalEligible(a){
  if(!a?.navActive||!S.navStartedAt)return false;
  const dest=destination(a);
  const p=point(a.rawUserPos)?a.rawUserPos:(point(a.filteredPos)?a.filteredPos:a.userPos);
  if(!dest||!point(p))return false;
  const direct=distM(p,dest);
  const total=routeTotal(a);
  const progress=Math.max(0,+a.routeProgressMeters||0);
  const remaining=total>0?Math.max(0,total-progress):direct;
  const elapsed=Date.now()-S.navStartedAt;
  const movedForReal=S.movingSamples>=2&&(S.realMovement>=18||S.maxFromStart>=18);
  const accuracy=(+a.currentAccuracy||999)<=55;
  const slow=(+a.currentSpeed||0)<16;
  return elapsed>=7000&&movedForReal&&accuracy&&slow&&direct<=28&&remaining<=38;
}
function holdMain(a){
  if(!a||a.navActive)return;
  S.mainHold=true;
  a.followMode=false;
  try{clearTimeout(a.manualFollowTimer);a.manualFollowTimer=null;}catch(_){}
}
function releaseMain(a){
  S.mainHold=false;
  if(a&&!a.navActive)a.followMode=true;
}

function install(){
  const a=app(),m=a?.map;
  if(!a||!m)return false;
  if(a.__navigationGuardsV178)return true;
  a.__navigationGuardsV178=true;

  ['dragstart','zoomstart','rotatestart','pitchstart'].forEach(ev=>{
    m.on(ev,e=>{if(e?.originalEvent&&!a.navActive)setTimeout(()=>holdMain(a),0);});
  });

  const oldCamera=typeof a.updateCamera==='function'?a.updateCamera.bind(a):null;
  if(oldCamera)a.updateCamera=function(...args){
    if(!this.navActive&&S.mainHold)return;
    return oldCamera(...args);
  };

  const oldNav=typeof a.updateNavigation==='function'?a.updateNavigation.bind(a):null;
  if(oldNav)a.updateNavigation=function(...args){
    const allowed=arrivalEligible(this);
    const was=!!this.lastArrivalAnnounced;
    if(!allowed&&!was)this.lastArrivalAnnounced=true;
    const out=oldNav(...args);
    if(!allowed&&!was)this.lastArrivalAnnounced=false;
    return out;
  };

  const oldHandle=typeof a.handleGPS==='function'?a.handleGPS.bind(a):null;
  if(oldHandle)a.handleGPS=function(position,...args){
    noteMovement(this,position);
    const out=oldHandle(position,...args);
    if(this.navActive){
      S.maxProgress=Math.max(S.maxProgress,+this.routeProgressMeters||0);
    }else if(S.mainHold){
      this.followMode=false;
      try{clearTimeout(this.manualFollowTimer);this.manualFollowTimer=null;}catch(_){}
    }
    return out;
  };

  const oldStart=typeof a.startNavigation==='function'?a.startNavigation.bind(a):null;
  if(oldStart)a.startNavigation=function(...args){
    S.mainHold=false;
    const out=oldStart(...args);
    resetTrip(this);
    return out;
  };

  const oldStop=typeof a.stopNavigation==='function'?a.stopNavigation.bind(a):null;
  if(oldStop)a.stopNavigation=function(...args){
    const out=oldStop(...args);
    S.navStartedAt=0;
    S.navOrigin=null;
    S.lastNavRaw=null;
    return out;
  };

  const oldRecenter=typeof a.recenter==='function'?a.recenter.bind(a):null;
  if(oldRecenter)a.recenter=function(...args){
    if(!this.navActive)releaseMain(this);
    return oldRecenter(...args);
  };

  ['locateBtn'].forEach(id=>document.getElementById(id)?.addEventListener('click',()=>releaseMain(a),true));

  setInterval(()=>{
    const x=app();
    if(!x)return;
    if(!x.navActive&&S.mainHold){
      x.followMode=false;
      try{clearTimeout(x.manualFollowTimer);x.manualFollowTimer=null;}catch(_){}
    }
  },700);

  if(a.navActive)resetTrip(a);
  return true;
}

let tries=0,t=setInterval(()=>{tries++;if(install()||tries>180)clearInterval(t);},100);
window.RadarNavigationGuardsV178={
  version:'178',
  releaseMain:()=>{const a=app();if(a)releaseMain(a);},
  arrivalEligible:()=>{const a=app();return !!(a&&arrivalEligible(a));}
};
})();