/* Radar Seguro RJ PRO — aparência do mapa v156 */
(()=>{'use strict';

if(window.RadarMapThemeV156)return;

const STORAGE_KEY='radar.mapTheme.v1';
const VALID_MODES=new Set(['auto','light','dark','sat']);

function load(app){
  try{
    const saved=localStorage.getItem(STORAGE_KEY);
    if(VALID_MODES.has(saved)){
      app.themeMode=saved;
      return saved;
    }
  }catch(_){}
  return app.themeMode||'auto';
}

function automaticNow(){
  const hour=new Date().getHours();
  return hour>=6&&hour<18?'light':'dark';
}

function getStyle(app,{styleVector,satelliteStyle,darkStyle}){
  const mode=app.themeMode;

  if(mode==='sat')return satelliteStyle();

  if(
    mode==='dark'||
    (mode==='auto'&&automaticNow()==='dark')
  ){
    return darkStyle();
  }

  return styleVector;
}

function apply(app,deps){
  app.appliedTheme=
    app.themeMode==='auto'
      ?automaticNow()
      :app.themeMode;

  app.map?.setStyle?.(
    getStyle(app,deps)
  );

  return app.appliedTheme;
}

function refresh(app,deps){
  if(app.themeMode!=='auto')return false;

  const wanted=automaticNow();

  if(app.appliedTheme!==wanted){
    apply(app,deps);
    return true;
  }

  return false;
}

function set(app,mode,deps){
  if(!VALID_MODES.has(mode))return false;

  app.themeMode=mode;

  try{
    localStorage.setItem(STORAGE_KEY,mode);
  }catch(_){}

  apply(app,deps);

  document
    .getElementById('mapAppearanceModal')
    ?.classList.remove('show');

  return true;
}

window.RadarMapThemeV156=Object.freeze({
  load,
  automaticNow,
  getStyle,
  apply,
  refresh,
  set,
  version:'156'
});

})();