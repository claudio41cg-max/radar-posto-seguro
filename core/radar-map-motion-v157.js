/* Radar Seguro RJ PRO — movimento explícito do mapa v157
   Substitui o antigo monkeypatch global de map.easeTo.
   Mantém o mesmo ajuste histórico de conforto de zoom, mas apenas
   quando um módulo chama esta API de forma explícita.
*/
(()=>{'use strict';

if(window.RadarMapMotionV157)return;

function normalizeOptions(options={}){
  const out={...options};

  if(Number.isFinite(out.zoom)){
    out.zoom=Math.min(17.2,out.zoom+.35);
  }

  return out;
}

function easeTo(map,options={}){
  if(!map?.easeTo)return false;
  map.easeTo(normalizeOptions(options));
  return true;
}

window.RadarMapMotionV157=Object.freeze({
  easeTo,
  normalizeOptions,
  version:'157'
});

})();