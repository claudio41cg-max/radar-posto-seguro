/* Radar Seguro RJ PRO v117 — intenção "pela/por [via]" sem interceptar fetch.
   A escolha do ponto intermediário continua disponível, mas a montagem da rota
   pertence exclusivamente ao RadarRouting.
*/
(()=>{
'use strict';

if(window.__radarRouteViaV117)return;
window.__radarRouteViaV117=true;

const state={
  pending:null,
  current:null,
  installed:false
};

function lexical(name){
  try{return (0,eval)(`typeof ${name}!=='undefined'?${name}:null`)}
  catch(_){return null}
}

function app(){
  return lexical('App')||window.RadarApp||window.App||null;
}

function assistant(){
  return lexical('VoiceAssistant')||window.VoiceAssistant||null;
}

function splitVia(query){
  const s=String(query||'').trim();

  const m=s.match(
    /^(.+?)\s+(?:pela|pelo|por meio da|por meio do|passando pela|passando pelo)\s+(.+)$/i
  );

  if(!m)return null;

  return {
    destination:m[1].trim(),
    via:m[2].trim()
  };
}

async function geocode(q){
  const a=app();
  if(!a?.searchAddress)return null;

  const r=await a.searchAddress(q);
  const x=r?.[0];

  return (
    x&&
    Number.isFinite(Number(x.lat))&&
    Number.isFinite(Number(x.lon))
  )
    ?{
      lat:Number(x.lat),
      lon:Number(x.lon),
      label:x.name||x.display||q
    }
    :null;
}

async function useViaPoint(via,announce=true){
  const a=app();

  if(
    !a?.destination||
    !a?.userPos||
    !via
  ){
    return false;
  }

  state.pending={
    lat:Number(via.lat),
    lon:Number(via.lon),
    label:via.label||'via intermediária',
    query:via.query||via.label||'via intermediária'
  };

  state.current=null;

  try{
    if(announce){
      assistant()?.reply?.(
        'Certo. Vou usar essa via no caminho.'
      );
    }

    a.showRoutePanel?.();

    /*
      Não existe mais monkeypatch de window.fetch.
      RadarRouting consome state.pending e monta a única requisição TomTom.
    */
    const route=
      await window.RadarRouting
      ?.calculate?.({
        via:[
          state.pending.lon,
          state.pending.lat
        ]
      });

    if(route){
      state.current={...state.pending};
      state.pending=null;
      a.startNavigation?.();
      return true;
    }

  }catch(error){
    console.warn(
      'Radar rota via:',
      error
    );
  }finally{
    if(state.pending)state.pending=null;
  }

  return false;
}

async function install(){
  const va=assistant();

  if(!va||va.__routeViaV117)return false;

  const original=
    typeof va.routeTo==='function'
      ?va.routeTo.bind(va)
      :null;

  if(!original)return false;

  va.__routeViaV117=true;

  va.routeTo=async function(query,...rest){
    const parsed=splitVia(query);

    if(!parsed){
      state.pending=null;
      state.current=null;
      return original(query,...rest);
    }

    try{
      this.reply?.(
        'Certo. Vou calcular a rota para '+
        parsed.destination+
        ' passando por '+
        parsed.via+
        '.'
      );

      const via=await geocode(parsed.via);

      if(!via){
        this.reply?.(
          'Não encontrei com segurança a via '+
          parsed.via+
          '. Vou calcular a rota normal.'
        );

        return original(
          parsed.destination,
          ...rest
        );
      }

      state.pending={
        ...via,
        query:parsed.via
      };

      state.current=null;

      /*
        O fluxo original resolve o destino final.
        Quando ele chamar calculateRoute(), RadarRouting consome state.pending.
      */
      const result=
        await original(
          parsed.destination,
          ...rest
        );

      return result;

    }catch(error){
      state.pending=null;

      return original(
        parsed.destination,
        ...rest
      );
    }
  };

  state.installed=true;
  return true;
}

let tries=0;

const timer=setInterval(()=>{
  tries++;

  if(
    install()||
    tries>100
  ){
    clearInterval(timer);
  }
},200);

window.RadarRouteViaV115={
  state,
  splitVia,
  get currentVia(){
    return state.current;
  },
  clear(){
    state.pending=null;
    state.current=null;
  },
  useViaPoint
};

})();