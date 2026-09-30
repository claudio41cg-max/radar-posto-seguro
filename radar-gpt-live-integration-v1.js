(()=>{
'use strict';

/*
  Radar GPT Live integration — Stage 3
  Problema atacado: voz Android concorrendo com GPT Live e GPT "esperando/pensando"
  em perguntas que o Radar já conhece.

  Arquitetura:
  - GPT Live é o único microfone/conversador enquanto estiver ativo.
  - SpeechRecognition local é suspenso e impedido de reiniciar.
  - Perguntas de estado (onde estou, destino, distância, tempo, velocidade)
    são respondidas pelo próprio GPT usando contexto vivo já sincronizado.
  - O parser local permanece apenas para comandos operacionais do Radar.
  - VoiceAssistant.reply não aciona TTS Android enquanto GPT Live estiver ativo.
*/

const VOICE_KEY='radar.gptLiveVoice.v1';
const VOICES=[
  ['cove','Cove'],['juniper','Juniper'],['maple','Maple'],
  ['spruce','Spruce'],['ember','Ember'],['vale','Vale'],
  ['breeze','Breeze'],['arbor','Arbor'],['sol','Sol']
];

let active=false;
let starting=false;
let patched=false;
let outputGuardsPatched=false;

let originalReply=null;
let originalAskAI=null;
let originalGetCurrentAddress=null;
let originalVoiceSpeak=null;
let originalToast=null;
let originalScheduleHandsFree=null;
let originalResumeHandsFree=null;
let originalOnAssistantSpeechEnded=null;
let originalHandle=null;

let syncTimer=null;
let addressTimer=null;
let lastContextSignature='';
let lastResolvedAddress='';
let lastAddressPoint=null;
let lastLocalFact='';
let lastMentionedPlace='';
let localCommandInFlight=false;

function getLexical(name){
  try{return (0,eval)('typeof '+name+' !== "undefined" ? '+name+' : null')}
  catch{return null}
}

function assistant(){
  return getLexical('VoiceAssistant')||window.VoiceAssistant||null;
}

function app(){
  return getLexical('App')||window.App||window.RadarApp||null;
}

function voiceObject(){
  return getLexical('Voice')||window.Voice||null;
}

function liveOwnsVoice(){
  return !!(
    active||
    starting||
    window.RadarGPTLive?.state?.running||
    window.RadarGPTLive?.state?.starting
  );
}

function selectedVoice(){
  const saved=String(localStorage.getItem(VOICE_KEY)||'cove').trim();
  return VOICES.some(v=>v[0]===saved)?saved:'cove';
}

function uiToast(text,ms=2500){
  try{
    if(originalToast)originalToast(text,ms);
    else app()?.toast?.(text,ms);
  }catch{}
}

function normalizeText(text){
  return String(text||'')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g,'')
    .toLowerCase()
    .replace(/\s+/g,' ')
    .trim();
}

function extractMentionedPlace(text){
  const raw=String(text||'').trim();
  const match=raw.match(
    /onde\s+(?:e\s+que\s+)?fica\s+(?:o\s+|a\s+)?(.+?)[?.!,;:]*$/i
  );

  if(!match)return '';

  const place=String(match[1]||'')
    .replace(/\s+/g,' ')
    .trim();

  if(
    !place||
    /^(meu destino|o destino|destino final|a minha rua|minha rua|meu bairro|minha localizacao)$/i.test(place)
  ){
    return '';
  }

  return place;
}

function refersToLastPlace(text){
  const s=normalizeText(text);

  return (
    /\b(me leve|me leva|quero ir|vamos|navegue|ir)\b/.test(s)&&
    /\b(la|ali|esse lugar|esse local|pra la|para la|ate la)\b/.test(s)
  );
}

function isUsefulLocalFact(text){
  const s=normalizeText(text);
  if(!s)return false;

  return !/calma ai|aguarde|um momento|estou verificando|vou verificar|estou pesquisando|estou pensando|ainda estou aqui/.test(s);
}

function isLocationQuestion(s){
  return /\b(onde estou|onde eu estou|qual rua|que rua|rua estou|minha localizacao|meu local|meu bairro|qual bairro)\b/.test(s);
}

function isDestinationQuestion(s){
  return /\b(para onde estou indo|pra onde estou indo|qual destino|meu destino|destino atual|destino final|onde fica o destino final|onde e o destino final|qual e o destino final|local final)\b/.test(s);
}

function isDistanceQuestion(s){
  return /\b(qual e a distancia|qual a distancia|distancia ate|distancia para|quanto falta|quantos km|quantos quilometros|distancia da rota)\b/.test(s);
}

function isTimeQuestion(s){
  return /\b(quanto tempo falta|falta quanto tempo|tempo falta|hora de chegada|quanto falta para chegar|quanto falta pra chegar)\b/.test(s);
}

function isSpeedQuestion(s){
  return /\b(qual minha velocidade|qual e minha velocidade|que velocidade|velocidade atual)\b/.test(s);
}

function isDirectStateQuestion(text){
  const s=normalizeText(text);

  return (
    isLocationQuestion(s)||
    isDestinationQuestion(s)||
    isDistanceQuestion(s)||
    isTimeQuestion(s)||
    isSpeedQuestion(s)
  );
}

function isOperationalCommand(text){
  const s=normalizeText(text);
  if(!s)return false;

  return (
    /\b(rota|navegar|navegacao|iniciar navegacao|cancelar navegacao|cancelar rota|sair da rota|encerrar rota|trocar rota|recalcular rota)\b/.test(s)||
    /\b(me leve|me leva|levar para|ir para|vamos para|quero ir|quero ir pra|quero ir para|navegue para|traca a rota|tracar rota)\b/.test(s)||
    /\b(no caminho|na minha rota|pela minha rota|ao longo da rota|durante o caminho)\b/.test(s)||
    /\b(zoom|satelite|street view|mapa|comunidade|comunidades|postos|posto|radar proximo|radares proximos)\b/.test(s)
  );
}

function destinationFromUI(){
  const a=app();

  return String(
    document.getElementById('destInput')?.value||
    a?.destinationLabel||
    a?.destinationName||
    ''
  ).trim();
}

function streetFromUI(){
  const a=app();

  const values=[
    lastResolvedAddress,
    assistant()?.lastKnownAddress,
    a?.currentStreet,
    a?.streetName,
    document.getElementById('currentStreet')?.textContent,
    document.getElementById('streetName')?.textContent
  ];

  for(const value of values){
    const text=String(value||'').trim();

    if(
      text&&
      text!=='--'&&
      !/^siga pela via$/i.test(text)
    ){
      return text;
    }
  }

  return '';
}

function roundedGps(a){
  if(
    !Array.isArray(a?.userPos)||
    a.userPos.length<2
  ){
    return null;
  }

  const lon=Number(a.userPos[0]);
  const lat=Number(a.userPos[1]);

  if(
    !Number.isFinite(lat)||
    !Number.isFinite(lon)
  ){
    return null;
  }

  return {
    lat:Number(lat.toFixed(5)),
    lon:Number(lon.toFixed(5))
  };
}

function routeRemaining(){
  const a=app();
  const route=a?.route;

  if(!route)return null;

  const totalM=Number(
    route.distance??
    route.summary?.lengthInMeters
  );

  const progressM=Math.max(
    0,
    Number(a.routeProgressMeters||0)
  );

  const remainingM=
    Number.isFinite(totalM)
      ?Math.max(0,totalM-progressM)
      :NaN;

  const totalSec=Number(
    route.duration??
    route.summary?.travelTimeInSeconds
  );

  const ratio=
    Number.isFinite(totalM)&&
    totalM>0&&
    Number.isFinite(remainingM)
      ?remainingM/totalM
      :NaN;

  const remainingSec=
    Number.isFinite(totalSec)&&
    Number.isFinite(ratio)
      ?Math.max(0,totalSec*ratio)
      :NaN;

  return {
    meters:remainingM,
    seconds:remainingSec
  };
}

function contextData(){
  const a=app();
  const remaining=routeRemaining();

  return {
    gps:roundedGps(a),
    street:streetFromUI(),
    destination:destinationFromUI(),
    navActive:!!a?.navActive,
    speed:Number.isFinite(Number(a?.currentSpeed))
      ?Math.round(Number(a.currentSpeed))
      :null,
    remainingMeters:Number.isFinite(remaining?.meters)
      ?Math.round(remaining.meters)
      :null,
    remainingMinutes:Number.isFinite(remaining?.seconds)
      ?Math.max(1,Math.round(remaining.seconds/60))
      :null,
    localFact:lastLocalFact
  };
}

function context(){
  const d=contextData();

  const parts=[
    'Você é a voz inteligente do aplicativo Radar Seguro RJ PRO.',
    'Fale sempre em português brasileiro, de forma curta e natural.',
    'Os dados abaixo vêm do próprio Radar e são a fonte da verdade sobre o estado atual.',
    'Se o usuário perguntar onde está, qual rua, bairro, destino, distância restante, tempo restante ou velocidade, responda IMEDIATAMENTE usando os dados do Radar abaixo.',
    'Nunca responda uma localização apenas com coordenadas se houver endereço/local confirmado.',
    'Não diga "estou pensando", "estou pesquisando", "aguarde", "só um momento" ou frases semelhantes para informações que já aparecem neste contexto.',
    'Se um dado não estiver disponível, diga apenas que o Radar ainda não conseguiu confirmá-lo.',
    'Nunca invente ocorrência, trânsito, fiscalização ou preço de combustível.'
  ];

  if(d.gps){
    parts.push(
      'GPS atual do Radar: latitude '+
      d.gps.lat+
      ', longitude '+
      d.gps.lon+
      '.'
    );
  }

  if(d.street){
    parts.push(
      'ENDEREÇO/LOCAL ATUAL CONFIRMADO PELO RADAR: '+
      d.street+
      '.'
    );
  }else{
    parts.push(
      'Endereço textual ainda não confirmado; não leia coordenadas como resposta ao motorista.'
    );
  }

  if(d.destination){
    parts.push(
      'DESTINO ATUAL: '+
      d.destination+
      '.'
    );
  }else{
    parts.push(
      'Não há destino ativo.'
    );
  }

  parts.push(
    d.navActive
      ?'A navegação está ativa.'
      :'A navegação não está ativa.'
  );

  if(Number.isFinite(d.speed)){
    parts.push(
      'VELOCIDADE ATUAL: '+
      d.speed+
      ' km/h.'
    );
  }

  if(Number.isFinite(d.remainingMeters)){
    parts.push(
      'DISTÂNCIA RESTANTE ATÉ O DESTINO: '+
      d.remainingMeters+
      ' metros.'
    );
  }

  if(Number.isFinite(d.remainingMinutes)){
    parts.push(
      'TEMPO RESTANTE ESTIMADO: '+
      d.remainingMinutes+
      ' minutos.'
    );
  }

  if(d.localFact){
    parts.push(
      'Último fato confirmado pelo Radar: '+
      d.localFact+
      '.'
    );
  }

  return parts.join('\n');
}

function contextSignature(){
  return JSON.stringify(contextData());
}

function syncContext(force=false){
  if(!liveOwnsVoice())return false;

  const live=window.RadarGPTLive;
  if(!live?.updateContext)return false;

  const sig=contextSignature();

  if(
    !force&&
    sig===lastContextSignature
  ){
    return false;
  }

  lastContextSignature=sig;

  return live.updateContext(
    context()
  );
}

function gpsDistanceMeters(a,b){
  if(!a||!b)return Infinity;

  const R=6371000;
  const rad=x=>x*Math.PI/180;

  const dLat=rad(b.lat-a.lat);
  const dLon=rad(b.lon-a.lon);

  const x=
    Math.sin(dLat/2)**2+
    Math.cos(rad(a.lat))*
    Math.cos(rad(b.lat))*
    Math.sin(dLon/2)**2;

  return 2*R*Math.asin(Math.sqrt(x));
}

async function refreshAddress(force=false){
  if(!liveOwnsVoice())return false;

  const va=assistant();
  const a=app();
  const gps=roundedGps(a);

  if(!va?.getCurrentAddress||!gps){
    return false;
  }

  if(
    !force&&
    lastAddressPoint&&
    gpsDistanceMeters(lastAddressPoint,gps)<45
  ){
    return false;
  }

  try{
    const result=
      await va.getCurrentAddress(true);

    const text=String(
      result?.label||
      result?.address||
      result?.display_name||
      ''
    ).trim();

    if(text){
      lastResolvedAddress=text;
      lastAddressPoint=gps;
      syncContext(true);
      return true;
    }
  }catch(error){
    console.warn(
      '[Radar GPT] endereço:',
      error
    );
  }

  return false;
}

function startContextSync(){
  stopContextSync();

  syncTimer=setInterval(
    ()=>syncContext(false),
    2000
  );

  addressTimer=setInterval(
    ()=>refreshAddress(false),
    12000
  );
}

function stopContextSync(){
  if(syncTimer){
    clearInterval(syncTimer);
    syncTimer=null;
  }

  if(addressTimer){
    clearInterval(addressTimer);
    addressTimer=null;
  }
}

function suspendLocalRecognizer(){
  const va=assistant();
  if(!va)return;

  try{va.stopHandsFree?.(false)}catch(_){}
  try{va.cancelFollowUpWindow?.()}catch(_){}
  try{va.releaseMicrophone?.()}catch(_){}

  try{
    clearTimeout(va.restartTimer);
    va.restartTimer=null;
  }catch(_){}

  try{
    va.handsFree=false;
    va.followUpMode=false;
    va.followUpRequested=false;
    va.conversationUntil=0;
    va.transcript='';
    va.lastError='aborted';
  }catch(_){}

  try{
    if(va.recognition){
      va.recognition.abort();
    }
  }catch(_){}

  try{
    va.listening=false;
  }catch(_){}
}

function patchOutputGuards(){
  if(outputGuardsPatched)return;

  const a=app();
  const v=voiceObject();

  if(!a||!v)return;

  outputGuardsPatched=true;

  if(typeof v.speak==='function'){
    originalVoiceSpeak=v.speak.bind(v);

    v.speak=function(text,...rest){
      /*
        Só bloqueia TTS Android que nasce de um comando local enquanto
        GPT Live está ativo. Guidance/alertas continuam independentes.
      */
      if(
        localCommandInFlight&&
        liveOwnsVoice()
      ){
        const spoken=String(text||'').trim();

        if(isUsefulLocalFact(spoken)){
          lastLocalFact=spoken;
          syncContext(true);
        }

        return true;
      }

      return originalVoiceSpeak(
        text,
        ...rest
      );
    };
  }

  if(typeof a.toast==='function'){
    originalToast=a.toast.bind(a);

    a.toast=function(text,...rest){
      if(
        localCommandInFlight&&
        liveOwnsVoice()
      ){
        return true;
      }

      return originalToast(
        text,
        ...rest
      );
    };
  }
}

function patchLocalAssistant(){
  if(patched)return;

  const va=assistant();
  if(!va)return;

  patched=true;

  originalReply=
    typeof va.reply==='function'
      ?va.reply.bind(va)
      :null;

  originalAskAI=
    typeof va.askAI==='function'
      ?va.askAI.bind(va)
      :null;

  originalGetCurrentAddress=
    typeof va.getCurrentAddress==='function'
      ?va.getCurrentAddress.bind(va)
      :null;

  originalScheduleHandsFree=
    typeof va.scheduleHandsFree==='function'
      ?va.scheduleHandsFree.bind(va)
      :null;

  originalResumeHandsFree=
    typeof va.resumeHandsFree==='function'
      ?va.resumeHandsFree.bind(va)
      :null;

  originalOnAssistantSpeechEnded=
    typeof va.onAssistantSpeechEnded==='function'
      ?va.onAssistantSpeechEnded.bind(va)
      :null;

  originalHandle=
    typeof va.handle==='function'
      ?va.handle.bind(va)
      :null;

  /*
    Com GPT Live ativo, somente este controlador pode entregar comandos
    operacionais ao parser local. Qualquer evento atrasado do
    SpeechRecognition antigo é descartado antes de processar a fala.
  */
  if(originalHandle){
    va.handle=function(text,...rest){
      if(
        liveOwnsVoice()&&
        !localCommandInFlight
      ){
        return true;
      }

      return originalHandle(
        text,
        ...rest
      );
    };
  }

  if(originalReply){
    va.reply=function(text,priority=true){
      const spoken=String(text||'').trim();

      if(isUsefulLocalFact(spoken)){
        lastLocalFact=spoken;
      }

      if(liveOwnsVoice()){
        /*
          GPT Live ativo: o assistente local NÃO fala com speechSynthesis
          e NÃO abre o quadro preto de resposta.
        */
        syncContext(true);
        return true;
      }

      return originalReply(
        text,
        priority
      );
    };
  }

  if(originalAskAI){
    va.askAI=async function(question,...rest){
      if(liveOwnsVoice()){
        return true;
      }

      return originalAskAI(
        question,
        ...rest
      );
    };
  }

  if(originalGetCurrentAddress){
    va.getCurrentAddress=async function(...args){
      const result=
        await originalGetCurrentAddress(
          ...args
        );

      const text=String(
        result?.label||
        result?.address||
        result?.display_name||
        ''
      ).trim();

      if(text){
        lastResolvedAddress=text;

        if(liveOwnsVoice()){
          setTimeout(
            ()=>syncContext(true),
            20
          );
        }
      }

      return result;
    };
  }

  if(originalScheduleHandsFree){
    va.scheduleHandsFree=function(...args){
      if(liveOwnsVoice()){
        return false;
      }

      return originalScheduleHandsFree(
        ...args
      );
    };
  }

  if(originalResumeHandsFree){
    va.resumeHandsFree=function(...args){
      if(liveOwnsVoice()){
        return false;
      }

      return originalResumeHandsFree(
        ...args
      );
    };
  }

  if(originalOnAssistantSpeechEnded){
    va.onAssistantSpeechEnded=function(...args){
      if(liveOwnsVoice()){
        return false;
      }

      return originalOnAssistantSpeechEnded(
        ...args
      );
    };
  }

  patchOutputGuards();
}

async function runOperationalAction(text){
  const va=assistant();
  if(!va?.handle)return false;

  localCommandInFlight=true;

  try{
    await Promise.resolve(
      va.handle(
        String(text||'')
      )
    );

    return true;

  }catch(error){
    console.warn(
      'Radar comando local:',
      error
    );

    return false;

  }finally{
    localCommandInFlight=false;

    setTimeout(
      ()=>syncContext(true),
      80
    );
  }
}

async function handleFinalUserTranscript(text){
  const phrase=String(text||'').trim();
  if(!phrase)return;

  /*
    Perguntas de estado ficam EXCLUSIVAMENTE com GPT Live.
    O GPT já recebeu o áudio; o contexto vivo contém a resposta.
    Não chamamos parser local e não criamos uma segunda resposta.
  */
  if(isDirectStateQuestion(phrase)){
    syncContext(true);
    return;
  }

  /*
    "Onde fica X?" é conversa, não rota. Guardamos apenas o referente
    para uma possível continuação explícita como "me leva pra lá".
  */
  const mentioned=extractMentionedPlace(phrase);
  if(mentioned){
    lastMentionedPlace=mentioned;
    return;
  }

  let operationalPhrase=phrase;

  if(
    lastMentionedPlace&&
    refersToLastPlace(phrase)
  ){
    operationalPhrase=
      'me leva para '+
      lastMentionedPlace;
  }

  /*
    Apenas comandos que realmente alteram o Radar seguem para o parser local.
  */
  if(isOperationalCommand(operationalPhrase)){
    await runOperationalAction(operationalPhrase);
  }
}

function buttonState(on,thinking=false){
  const main=
    document.getElementById(
      'assistantMicBtn'
    );

  const nav=
    document.getElementById(
      'navAssistantMicBtn'
    );

  if(main){
    main.classList.toggle(
      'listening',
      !!on
    );

    main.classList.toggle(
      'radar-gpt-live-on',
      !!on
    );

    main.setAttribute(
      'aria-pressed',
      on?'true':'false'
    );

    main.title=
      thinking
        ?'Conectando ao GPT Live...'
        :on
          ?'Desligar GPT Live'
          :'Falar com o Radar usando GPT Live';
  }

  if(nav){
    nav.classList.toggle(
      'hands-free',
      !!on
    );

    nav.classList.toggle(
      'radar-gpt-live-on',
      !!on
    );

    nav.setAttribute(
      'aria-pressed',
      on?'true':'false'
    );

    nav.textContent=
      on
        ?'🟢 GPT Live'
        :'🎙️ Radar';

    nav.title=
      on
        ?'Desligar GPT Live'
        :'Falar com o Radar usando GPT Live';
  }
}

async function stop(){
  starting=false;
  active=false;

  stopContextSync();

  try{
    await window.RadarGPTLive
      ?.stop
      ?.();
  }catch{}

  buttonState(false);

  uiToast(
    'GPT Live desligado.',
    1500
  );
}

async function start(){
  if(starting||active)return;

  patchLocalAssistant();
  patchOutputGuards();

  /*
    Antes de abrir o WebRTC, encerra completamente o reconhecedor Android/browser.
    Assim não existem dois microfones interpretando a mesma frase.
  */
  suspendLocalRecognizer();

  const live=window.RadarGPTLive;

  if(!live?.start){
    uiToast(
      'GPT Live ainda não carregou.',
      2800
    );

    return;
  }

  starting=true;

  buttonState(
    true,
    true
  );

  try{
    lastContextSignature='';

    /*
      Antes de abrir a sessão Live, resolve a localização textual atual.
      Assim o GPT já nasce sabendo rua/bairro/local, em vez de depender
      de uma atualização de contexto posterior que pode chegar tarde.
    */
    await refreshAddress(true);

    await live.start({
      voice:selectedVoice(),
      instructions:context(),

      onTranscript:event=>{
        if(
          !event?.final||
          event.role!=='user'||
          !event.text
        ){
          return;
        }

        handleFinalUserTranscript(
          event.text
        );
      },

      onState:(name,detail)=>{
        if(name==='live'){
          starting=false;
          active=true;

          /*
            Garante novamente que nenhum SpeechRecognition local tenha
            reiniciado durante a negociação WebRTC.
          */
          suspendLocalRecognizer();

          buttonState(true);
          startContextSync();
          syncContext(true);

          /*
            Atualiza endereço em segundo plano; não fala nada e não abre toast.
          */
          setTimeout(
            ()=>refreshAddress(true),
            120
          );

          uiToast(
            'GPT Live conectado.',
            1400
          );
        }

        else if(name==='user-speaking'){
          buttonState(true);
        }

        else if(name==='assistant-speaking'){
          buttonState(true);
        }

        else if(name==='error'){
          starting=false;
          active=false;

          stopContextSync();
          buttonState(false);

          console.warn(
            'GPT Live:',
            detail
          );

          uiToast(
            'GPT Live temporariamente indisponível.',
            2200
          );
        }

        else if(
          name==='stopped'&&
          !starting
        ){
          active=false;
          stopContextSync();
          buttonState(false);
        }
      }
    });

  }catch(error){
    starting=false;
    active=false;

    stopContextSync();
    buttonState(false);

    uiToast(
      String(
        error?.message||
        'Não foi possível abrir o GPT Live.'
      ),
      3200
    );
  }
}

async function toggle(){
  return (
    active||
    starting
  )
    ?stop()
    :start();
}

function installPicker(){
  if(
    document.getElementById(
      'radarGptVoice'
    )
  ){
    return;
  }

  const mic=
    document.getElementById(
      'assistantMicBtn'
    );

  if(!mic?.parentElement)return;

  const select=
    document.createElement('select');

  select.id='radarGptVoice';
  select.title='Voz do GPT Live';

  select.setAttribute(
    'aria-label',
    'Voz do GPT Live'
  );

  select.innerHTML=
    VOICES.map(
      ([id,label])=>
        '<option value="'+
        id+
        '" '+
        (id===selectedVoice()?'selected':'')+
        '>GPT '+
        label+
        '</option>'
    ).join('');

  select.onchange=async()=>{
    localStorage.setItem(
      VOICE_KEY,
      select.value
    );

    if(active||starting){
      await stop();
      setTimeout(start,180);
    }
  };

  mic.insertAdjacentElement(
    'afterend',
    select
  );

  const style=
    document.createElement('style');

  style.textContent=`
    #radarGptVoice{
      height:38px;
      max-width:92px;
      border:1px solid rgba(92,190,255,.5);
      border-radius:11px;
      background:#0b2437;
      color:#dff7ff;
      font-size:11px;
      font-weight:800;
      padding:0 6px
    }

    .radar-gpt-live-on{
      box-shadow:
        0 0 0 3px rgba(41,255,163,.22),
        0 0 20px rgba(41,255,163,.45)!important
    }
  `;

  document.head.appendChild(style);
}

function bindContextTriggers(){
  const dest=
    document.getElementById(
      'destInput'
    );

  if(
    dest&&
    !dest.dataset.gptContextBound
  ){
    dest.dataset.gptContextBound='1';

    const update=
      ()=>setTimeout(
        ()=>syncContext(true),
        40
      );

    dest.addEventListener(
      'input',
      update
    );

    dest.addEventListener(
      'change',
      update
    );
  }
}

function bind(){
  patchLocalAssistant();
  patchOutputGuards();
  installPicker();
  bindContextTriggers();

  [
    'assistantMicBtn',
    'navAssistantMicBtn'
  ].forEach(id=>{
    const el=
      document.getElementById(id);

    if(
      !el||
      el.dataset.gptLiveBound
    ){
      return;
    }

    el.dataset.gptLiveBound='1';

    el.addEventListener(
      'click',
      event=>{
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();

        toggle();
      },
      true
    );
  });

  buttonState(false);
}

if(document.readyState==='loading'){
  document.addEventListener(
    'DOMContentLoaded',
    ()=>setTimeout(bind,500)
  );
}else{
  setTimeout(bind,500);
}

setTimeout(bind,1600);

window.RadarGPTLiveController={
  start,
  stop,
  toggle,
  syncContext,
  refreshAddress,
  suspendLocalRecognizer,
  isDirectStateQuestion,
  isOperationalCommand,

  get active(){
    return active;
  },

  get localCommandInFlight(){
    return localCommandInFlight;
  },

  voice:selectedVoice
};

})();