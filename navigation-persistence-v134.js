/* Radar Seguro RJ PRO v134 — persistência de navegação consolidada.
   ETAPA 1:
   - Cancelamento cria um "tombstone" persistente.
   - Rota cancelada não pode ser salva/restaurada em visibilitychange/pageshow.
   - clearRoute também cancela persistência.
   - Retorno ao app NÃO força reroute automático.
   - Uma nova rota válida reabre a persistência somente após calculateRoute/startNavigation.
*/
(()=>{'use strict';
if(window.__radarPersistenceV134)return;
window.__radarPersistenceV134=true;

const KEY='radar-nav-v134';
const CANCEL_KEY='radar-nav-cancelled-v1';
const THEME='radar-theme-choice';
const MAX_RESTORE_AGE_MS=30*60*1000;

const app=()=>window.RadarApp||window.App||null;
const validRoute=r=>Array.isArray(r?.coords)&&r.coords.length>1;

let blocked=false;

function now(){return Date.now();}
function readCancelTs(){
  try{return Number(localStorage.getItem(CANCEL_KEY)||0)||0}catch(_){return 0}
}
function writeCancelTs(ts=now()){
  try{localStorage.setItem(CANCEL_KEY,String(ts))}catch(_){}
  return ts;
}
function clearCancelTs(){
  try{localStorage.removeItem(CANCEL_KEY)}catch(_){}
}
function destination(a){
  const d=a?.destination;
  if(Array.isArray(d))return d.slice(0,2);
  if(d)return{lon:d.lon??d.lng,lat:d.lat,label:d.label||d.name||''};
  return null;
}
function isNavigationActive(a){
  return !!(a?.navActive||a?.navigating||a?.navigationActive||a?.routeActive);
}

function clearStoredRoute(){
  try{localStorage.removeItem(KEY)}catch(_){}
}

function cancel(){
  blocked=true;
  const ts=writeCancelTs();
  clearStoredRoute();
  try{
    const a=app();
    if(a){
      a.__routeCancelledAt=ts;
      a.__routePersistenceBlocked=true;
    }
  }catch(_){}
  return true;
}

function armNewRoute(){
  blocked=false;
  clearCancelTs();
  try{
    const a=app();
    if(a){
      a.__routeCancelledAt=0;
      a.__routePersistenceBlocked=false;
    }
  }catch(_){}
}

function save(){
  const a=app();

  if(
    blocked ||
    a?.__routePersistenceBlocked ||
    !a ||
    !validRoute(a.route) ||
    !a.destination ||
    !isNavigationActive(a)
  ){
    // Importante: se não há navegação ativa, não deixa snapshot antigo sobrevivendo.
    clearStoredRoute();
    return false;
  }

  const cancelTs=readCancelTs();
  if(cancelTs>0){
    clearStoredRoute();
    return false;
  }

  try{
    localStorage.setItem(
      KEY,
      JSON.stringify({
        ts:now(),
        destination:destination(a),
        route:a.route,
        navActive:true
      })
    );
    return true;
  }catch(_){
    return false;
  }
}

function clear(options={}){
  clearStoredRoute();
  if(options.cancel===true)return cancel();
  return true;
}

function restore(){
  const a=app();
  if(!a||validRoute(a.route))return false;
  if(blocked||a.__routePersistenceBlocked)return false;

  const cancelTs=readCancelTs();

  let s;
  try{s=JSON.parse(localStorage.getItem(KEY)||'null')}
  catch(_){return false}

  if(!s)return false;

  const savedTs=Number(s.ts||0)||0;

  if(
    cancelTs>0 ||
    now()-savedTs>MAX_RESTORE_AGE_MS ||
    !validRoute(s.route) ||
    !s.destination ||
    s.navActive===false
  ){
    clearStoredRoute();
    return false;
  }

  a.destination=s.destination;

  /*
    A rota salva não entra mais diretamente no App.
    RadarRouting volta a ser a única autoridade para aplicar a rota
    e sincronizar routeState com a interface.
  */
  const routing=window.RadarRouting;
  if(!routing?.apply){
    return false;
  }

  try{
    routing.apply(
      s.route,
      {
        fit:false,
        recalculate:false
      }
    );
  }catch(error){
    console.warn(
      '[RadarPersistence] falha ao restaurar rota:',
      error
    );
    clearStoredRoute();
    return false;
  }

  a.navActive=true;
  a.navigating=true;
  a.navigationActive=true;
  a.routeActive=true;

  for(const f of['updateRouteUI','updateNavigation','updateHUD']){
    try{a[f]?.()}catch(_){}
  }

  setTimeout(()=>{
    try{window.RadarRouteTrafficV74?.refresh?.()}catch(_){}
    try{window.RadarHazardDeclutterV119?.apply?.()}catch(_){}
  },500);

  return true;
}

function themeValue(){
  const root=document.documentElement,body=document.body;
  const s=((root.dataset.theme||'')+' '+(body?.dataset?.theme||'')+' '+root.className+' '+(body?.className||'')).toLowerCase();
  if(/dark|night|noturno|escuro/.test(s))return'dark';
  if(/light|day|claro/.test(s))return'light';
  return null;
}
function rememberTheme(){
  const v=themeValue();
  if(v)try{localStorage.setItem(THEME,v)}catch(_){}
}
function applyTheme(){
  let v;
  try{v=localStorage.getItem(THEME)}catch(_){}
  if(!v)return;
  const root=document.documentElement,body=document.body;
  root.dataset.radarTheme=v;
  root.style.colorScheme=v;
  root.classList.toggle('radar-force-light',v==='light');
  root.classList.toggle('radar-force-dark',v==='dark');
  if(body){
    body.classList.toggle('radar-force-light',v==='light');
    body.classList.toggle('radar-force-dark',v==='dark');
  }
}

function bind(){
  const a=app();
  if(!a||a.__persistV134)return false;
  a.__persistV134=true;

  // Estado cancelado deve sobreviver a refresh/reabertura.
  if(readCancelTs()>0){
    blocked=true;
    a.__routePersistenceBlocked=true;
    clearStoredRoute();
  }

  /*
    Persistência agora reage a eventos oficiais.
    Nenhuma função de rota/navegação é mais substituída por wrapper.
  */
  const kernel=window.RadarKernel;

  if(kernel?.on){
    kernel.on('route:calculated',()=>{
      const current=app();
      if(validRoute(current?.route)&&current?.destination){
        armNewRoute();
      }
    });

    kernel.on('route:recalculated',()=>{
      const current=app();
      if(validRoute(current?.route)&&current?.destination){
        armNewRoute();
      }
    });

    kernel.on('navigation:started',()=>{
      const current=app();
      if(validRoute(current?.route)&&current?.destination){
        armNewRoute();
        setTimeout(save,80);
      }
    });

    kernel.on('navigation:stopped',()=>{
      cancel();
    });

    kernel.on('navigation:cleared',()=>{
      cancel();
    });
  }

  document.addEventListener('click',e=>{
    const t=((e.target?.closest?.('button,[role="button"],a')?.textContent)||'').toLowerCase();
    if(/sair da rota|cancelar rota|cancelar navega[cç][aã]o|encerrar rota|finalizar rota/.test(t))cancel();
    if(/claro|escuro|dia|noite|tema/.test(t)){
      setTimeout(()=>{rememberTheme();applyTheme()},120);
    }
  },true);

  document.addEventListener('visibilitychange',()=>{
    if(document.hidden){
      if(!blocked)save();
      return;
    }

    applyTheme();

    // Importante: voltar ao app NÃO recalcula rota e NÃO ressuscita rota cancelada.
    if(blocked||readCancelTs()>0){
      clearStoredRoute();
      return;
    }

    if(!validRoute(app()?.route)){
      setTimeout(()=>restore(),350);
    }
  });

  window.addEventListener('pagehide',()=>{
    if(!blocked)save();
    else clearStoredRoute();
  });

  window.addEventListener('pageshow',()=>{
    applyTheme();
    if(blocked||readCancelTs()>0){
      clearStoredRoute();
      return;
    }
    setTimeout(()=>restore(),300);
  });

  // Mantém snapshot somente enquanto há navegação ativa.
  setInterval(()=>{
    if(blocked||readCancelTs()>0){
      clearStoredRoute();
      return;
    }
    save();
  },5000);

  applyTheme();

  if(!blocked&&readCancelTs()===0){
    setTimeout(()=>restore(),500);
  }

  return true;
}

let n=0,t=setInterval(()=>{
  if(bind()||++n>200)clearInterval(t);
},200);

window.RadarNavigationPersistenceV134={
  save,
  restore,
  clear,
  cancel,
  armNewRoute,
  version:'134-stage3-events'
};
})();