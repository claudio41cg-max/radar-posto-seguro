/* Radar Seguro RJ PRO — consulta de trânsito para voz v157
   Não é autoridade de rota. Apenas lê a rota canônica atual.
*/
(()=>{'use strict';

if(window.RadarTrafficAssistantV157)return;

function serviceProxy(getTarget){
  return new Proxy({},{
    get(_target,prop){
      const target=getTarget?.();
      const value=target?.[prop];
      return typeof value==='function'?value.bind(target):value;
    },
    set(_target,prop,value){
      const target=getTarget?.();
      if(!target)return false;
      target[prop]=value;
      return true;
    }
  });
}

function create(deps={}){
  const App=serviceProxy(deps.getApp);
  const VoiceAssistant=serviceProxy(deps.getVoiceAssistant);

  const TrafficAssistantV40={
  /*
    Compatibilidade após modularização de rota.
    Este objeto NÃO calcula rota, NÃO cria alternativas e NÃO escreve
    App.routeAlternatives. Ele só responde perguntas de trânsito usando
    a rota canônica já criada por RadarRouting e o módulo de trânsito v131.
  */
  timer:null,
  checking:false,
  pending:null,
  worker:'https://radar-seguro-ia-rj.claudio41cg.workers.dev',

  remainingSeconds(){
    if(!App.route)return NaN;

    const totalM=Number(
      App.route.distance ??
      App.route.summary?.lengthInMeters
    );

    const progressM=Math.max(
      0,
      Number(App.routeProgressMeters||0)
    );

    const remainingM=Number.isFinite(totalM)
      ?Math.max(0,totalM-progressM)
      :NaN;

    const totalSec=Number(
      App.route.duration ??
      App.route.summary?.travelTimeInSeconds
    );

    if(!Number.isFinite(totalSec))return NaN;

    if(
      Number.isFinite(totalM)&&
      totalM>0&&
      Number.isFinite(remainingM)
    ){
      return totalSec*(remainingM/totalM);
    }

    return totalSec;
  },

  async getTrafficSnapshot(){
    /*
      Não chama calculateRoute da TomTom.
      Usa somente o resumo da rota oficial já ativa.
    */
    if(!App.route)return null;

    try{
      window.RadarRouteTrafficV74?.refresh?.();
    }catch(_){}

    const totalSec=Number(
      App.route.duration ??
      App.route.summary?.travelTimeInSeconds
    );

    const delaySec=Number(
      App.route.trafficDelaySeconds ??
      App.route.summary?.trafficDelayInSeconds ??
      0
    );

    const distanceM=Number(
      App.route.distance ??
      App.route.summary?.lengthInMeters
    );

    return {
      travelSec:totalSec,
      delaySec,
      distanceM
    };
  },

  async answerTrafficQuestion(){
    if(App.route){
      const info=await this.getTrafficSnapshot();

      if(
        info&&
        Number.isFinite(info.travelSec)
      ){
        const mins=Math.max(
          1,
          Math.round(this.remainingSeconds()/60)
        );

        const delay=Math.max(
          0,
          Math.round(Number(info.delaySec||0)/60)
        );

        if(delay>=3){
          VoiceAssistant.reply(
            'O TomTom indica cerca de '+
            delay+
            ' minutos de atraso por trânsito. '+
            'O tempo restante estimado é '+
            mins+
            ' minutos.'
          );
        }else if(delay>0){
          VoiceAssistant.reply(
            'Há uma pequena retenção na rota, com cerca de '+
            delay+
            ' minuto'+
            (delay===1?'':'s')+
            ' de atraso. O tempo restante estimado é '+
            mins+
            ' minutos.'
          );
        }else{
          VoiceAssistant.reply(
            'O TomTom não indica retenção relevante na rota agora. '+
            'O tempo restante estimado é '+
            mins+
            ' minutos.'
          );
        }

        return true;
      }
    }

    if(
      Array.isArray(App.userPos)&&
      App.userPos.length>=2
    ){
      try{
        const [lon,lat]=App.userPos;

        const path=
          '/traffic/services/4/flowSegmentData/absolute/10/json?point='+
          lat+','+lon+
          '&unit=KMPH';

        const response=await fetch(
          this.worker+
          '/v1/tomtom?path='+
          encodeURIComponent(path),
          {cache:'no-store'}
        );

        if(!response.ok){
          throw new Error(
            'TomTom flow '+
            response.status
          );
        }

        const data=await response.json();
        const flow=data?.flowSegmentData;

        const current=Number(flow?.currentSpeed);
        const free=Number(flow?.freeFlowSpeed);

        if(
          !Number.isFinite(current)||
          !Number.isFinite(free)||
          free<=0
        ){
          throw new Error('fluxo incompleto');
        }

        const ratio=current/free;

        if(flow.roadClosure||ratio<=.32){
          VoiceAssistant.reply(
            'Na via em que você está agora, o TomTom indica trânsito bem lento ou parado.'
          );
        }else if(ratio<.70){
          VoiceAssistant.reply(
            'Há trânsito moderado na via atual, segundo o TomTom.'
          );
        }else{
          VoiceAssistant.reply(
            'O TomTom indica fluxo livre na via em que você está agora.'
          );
        }

      }catch(error){
        console.warn(
          'TomTom via atual:',
          error
        );

        VoiceAssistant.reply(
          'Não consegui consultar o trânsito real do TomTom agora.'
        );
      }

      return true;
    }

    VoiceAssistant.reply(
      'Ainda não tenho sua localização. Aguarde o GPS e tente novamente.'
    );

    return true;
  },

  async answerRadarQuestion(){
    if(!App.route){
      VoiceAssistant.reply(
        'Trace uma rota primeiro para eu verificar os radares do caminho.'
      );
      return true;
    }

    VoiceAssistant.reply(
      'Vou continuar avisando os radares detectados durante a navegação.'
    );

    return true;
  },

  check(){
    // Desativado: não existe mais verificação paralela de rota.
    return false;
  },

  schedule(){
    // Desativado: não agenda recálculo/alternativas em segundo plano.
    return false;
  },

  hasPending(){
    return false;
  },

  decline(){
    this.pending=null;
  },

  accept(){
    return false;
  },

  init(){
    /*
      Compatibilidade: não instala wrappers em startNavigation/clearRoute.
      RadarRouting é a única autoridade de rota.
    */
    return true;
  }
};

  return TrafficAssistantV40;
}

window.RadarTrafficAssistantV157=Object.freeze({
  create,
  version:'157'
});

})();