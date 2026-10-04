/* Radar Seguro RJ PRO — runtime de UI básica v157
   Responsabilidade: apresentação e controles visuais simples.
   Não possui GPS, rota, voz, câmera ou mapa.
*/
(()=>{'use strict';

if(window.RadarUIRuntimeV157)return;

function showRoutePanel(app){
  const sheet=document.getElementById('wazeSheet');
  if(!sheet)return false;

  sheet.classList.add('show');
  sheet.classList.add('expanded');
  app.sheetExpanded=true;

  const toggle=document.getElementById('sheetToggleBtn');
  if(toggle)toggle.textContent='Recolher ▾';

  return true;
}

function toggleSheet(app,force=null){
  app.sheetExpanded=
    force!==null
      ?force
      :!app.sheetExpanded;

  document
    .getElementById('wazeSheet')
    ?.classList.toggle('expanded',app.sheetExpanded);

  const toggle=document.getElementById('sheetToggleBtn');
  if(toggle){
    toggle.textContent=
      app.sheetExpanded
        ?'Recolher ▾'
        :'Opções ▴';
  }

  return app.sheetExpanded;
}

function toast(app,text,time=3200){
  const el=document.getElementById('toast');
  if(!el)return false;

  el.textContent=text;
  el.classList.add('show');

  clearTimeout(app._toastTimer);

  app._toastTimer=setTimeout(()=>{
    el.classList.remove('show');
  },time);

  return true;
}

function updateSpeed(app){
  const val=Math.max(
    0,
    Math.round(app.currentSpeed)
  );

  const speed=document.getElementById('speedVal');
  if(speed)speed.textContent=val;

  document
    .getElementById('speedometerBox')
    ?.classList.toggle(
      'speed-alert',
      app.speedAlertEnabled&&val>80
    );

  return val;
}

function setGPSStatus(_app,ok,text){
  const el=document.getElementById('gpsBadge');
  if(!el)return false;

  el.textContent=text;
  el.style.background=ok?'#059669':'#475569';
  return true;
}

function shareRide(app){
  if(!app.destination){
    toast(app,'Calcule uma rota primeiro.');
    return false;
  }

  const destinationText=
    document.getElementById('destInput')?.value||'';

  const text=encodeURIComponent(
    '🛡️ Radar Seguro RJ PRO\n'+
    'Destino: '+destinationText+'\n'+
    'Google Maps: https://www.google.com/maps?q='+
    app.destination[1]+','+app.destination[0]
  );

  window.open(
    'https://api.whatsapp.com/send?text='+text,
    '_blank'
  );

  return true;
}

window.RadarUIRuntimeV157=Object.freeze({
  showRoutePanel,
  toggleSheet,
  toast,
  updateSpeed,
  setGPSStatus,
  shareRide,
  version:'157'
});

})();