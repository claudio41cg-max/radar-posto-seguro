(()=>{
'use strict';

/*
  Radar GPT Live integration — Stage 2C
  Foco: eliminar a voz Android e a espera infinita do GPT em perguntas
  que o próprio Radar já consegue responder localmente.

  Regras:
  - Perguntas de estado do Radar (onde estou, destino, distância, tempo,
    velocidade) são resolvidas DIRETAMENTE neste módulo, sem passar pelo
    parser legado e sem chamar Voice.speak/App.toast.
  - O resultado confirmado é entregue ao GPT Live, que é a única voz.
  - Comandos operacionais continuam usando VoiceAssistant.handle(), mas
    a saída TTS/toast antiga é interceptada enquanto o comando local roda.
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

let syncTimer=null;
let lastContextSignature='';
let lastResolvedAddress='';
let lastLocalFact='';
let lastSpokenLocalResult='';
let lastSpokenLocalResultAt=0;
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

function uiToast(text,ms=3500){
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
  return isLocationQuestion(s)||isDestinationQuestion(s)||isDistanceQuestion(s)||isTimeQuestion(s)||isSpeedQuestion(s);
}

function isLocalRadarCommand(text){
  const s=normalizeText(text);
  if(!s)return false;

  return (
    isDirectStateQuestion(s)||
    /\b(rota|navegar|navegacao|iniciar navegacao|cancelar navegacao|cancelar rota|sair da rota|encerrar rota|trocar rota|recalcular rota)\b/.test(s)||
    /\b(me leve|me leva|levar para|ir para|vamos para|quero ir|navegue para)\b/.test(s)||
    /\b(onde fica)\b/.test(s)||
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
    a?.currentStreet,
    a?.streetName,
    document.getElementById('currentStreet')?.textContent,
    document.getElementById('streetName')?.textContent
  ];
  for(const v of values){
    const x=String(v||'').trim();
    if(x&&x!=='--'&&!/^siga pela via$/i.test(x))return x;
  }
  return '';
}

function roundedGps(a){
  if(!Array.isArray(a?.userPos)||a.userPos.length<2)return null;
  const lon=Number(a.userPos[0]),lat=Number(a.userPos[1]);
  if(!Number.isFinite(lat)||!Number.isFinite(lon))return null;
  return {lat:Number(lat.toFixed(4)),lon:Number(lon.toFixed(4))};
}

function routeRemaining(){
  const a=app();
  const route=a?.route;
  if(!route)return null;

  const totalM=Number(route.distance??route.summary?.lengthInMeters);
  const progressM=Math.max(0,Number(a.routeProgressMeters||0));
  const remainingM=Number.isFinite(totalM)?Math.max(0,totalM-progressM):NaN;

  const totalSec=Number(route.duration??route.summary?.travelTimeInSeconds);
  const ratio=Number.isFinite(totalM)&&totalM>0&&Number.isFinite(remainingM)
    ?remainingM/totalM
    :NaN;
  const remainingSec=Number.isFinite(totalSec)&&Number.isFinite(ratio)
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
    speed:Number.isFinite(Number(a?.currentSpeed))?Math.round(Number(a.currentSpeed)):null,
    remainingMeters:Number.isFinite(remaining?.meters)?Math.round(remaining.meters):null,
    remainingMinutes:Number.isFinite(remaining?.seconds)?Math.max(1,Math.round(remaining.seconds/60)):null,
    localFact:lastLocalFact
  };
}

function context(){
  const d=contextData();
  const parts=[
    'Você é a voz inteligente do aplicativo Radar Seguro RJ PRO.',
    'Fale sempre em português brasileiro, de forma curta e natural.',
    'Dados de localização, destino, distância, tempo e velocidade fornecidos pelo Radar são a fonte da verdade.',
    'Quando o usuário perguntar onde está, qual é a rua, destino, distância, tempo restante ou velocidade, NÃO improvise, NÃO use apenas coordenadas e NÃO diga que está pensando/pesquisando. Espere RADAR_LOCAL_RESULT e fale exatamente esse resultado de forma natural.',
    'Quando receber RADAR_LOCAL_RESULT, responda imediatamente e somente com essa informação.',
    'Nunca invente ocorrência, trânsito, fiscalização ou preço de combustível.'
  ];

  if(d.gps)parts.push('GPS atual do Radar: latitude '+d.gps.lat+', longitude '+d.gps.lon+'.');
  if(d.street)parts.push('Endereço/local atual confirmado: '+d.street+'.');
  if(d.destination)parts.push('Destino atual: '+d.destination+'.');
  parts.push(d.navActive?'A navegação está ativa.':'A navegação não está ativa.');
  if(Number.isFinite(d.speed))parts.push('Velocidade atual: '+d.speed+' km/h.');
  if(Number.isFinite(d.remainingMeters))parts.push('Distância restante da rota: '+d.remainingMeters+' metros.');
  if(Number.isFinite(d.remainingMinutes))parts.push('Tempo restante estimado: '+d.remainingMinutes+' minutos.');
  if(d.localFact)parts.push('Último fato local confirmado: '+d.localFact+'.');

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
  if(!force&&sig===lastContextSignature)return false;

  lastContextSignature=sig;
  return live.updateContext(context());
}

function startContextSync(){
  stopContextSync();
  syncTimer=setInterval(()=>syncContext(false),3000);
}

function stopContextSync(){
  if(syncTimer){
    clearInterval(syncTimer);
    syncTimer=null;
  }
}

async function speakLocalResult(text){
  const spoken=String(text||'').trim();
  if(!spoken)return false;

  lastLocalFact=spoken;

  const now=Date.now();
  if(spoken===lastSpokenLocalResult&&now-lastSpokenLocalResultAt<1500)return true;
  lastSpokenLocalResult=spoken;
  lastSpokenLocalResultAt=now;

  if(!liveOwnsVoice()){
    return false;
  }

  const live=window.RadarGPTLive;
  if(!live?.speakContext)return false;

  const ok=live.speakContext(
    'RADAR_LOCAL_RESULT: '+spoken+
    '\nFale isso agora ao motorista, em português brasileiro, sem acrescentar coordenadas, sem dizer que está pensando ou pesquisando.'
  );

  setTimeout(()=>syncContext(true),50);
  return !!ok;
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
      if(localCommandInFlight&&liveOwnsVoice()){
        const spoken=String(text||'').trim();
        if(spoken)speakLocalResult(spoken);
        return true;
      }
      return originalVoiceSpeak(text,...rest);
    };
  }

  if(typeof a.toast==='function'){
    originalToast=a.toast.bind(a);
    a.toast=function(text,...rest){
      if(localCommandInFlight&&liveOwnsVoice()){
        return true;
      }
      return originalToast(text,...rest);
    };
  }
}

async function resolveDirectStateQuestion(text){
  const va=assistant();
  const a=app();
  const s=normalizeText(text);

  if(isLocationQuestion(s)){
    try{
      const p=await va?.getCurrentAddress?.(true);
      const label=String(p?.label||p?.address||p?.display_name||'').trim();
      if(label){
        lastResolvedAddress=label;

        if(/\b(qual rua|que rua|rua estou|qual e minha rua|minha rua)\b/.test(s)){
          const street=String(p?.street||'').trim();
          const number=String(p?.number||'').trim();
          return street
            ?'Você está na '+street+(number?', número '+number:'')+'.'
            :'Você está em '+label+'.';
        }

        return 'Você está em '+label+'.';
      }
    }catch(e){
      console.warn('Radar localização local:',e);
    }

    const street=streetFromUI();
    if(street)return 'Você está em '+street+'.';

    return 'Ainda não consegui confirmar o nome da sua localização.';
  }

  if(isDestinationQuestion(s)){
    const destination=destinationFromUI();
    if(destination)return 'Seu destino é '+destination+'.';
    return 'Não há um destino ativo no Radar neste momento.';
  }

  if(isDistanceQuestion(s)){
    const r=routeRemaining();
    if(!r||!Number.isFinite(r.meters))return 'Não há uma rota ativa com distância disponível neste momento.';
    if(r.meters<1000){
      return 'Faltam aproximadamente '+Math.max(10,Math.round(r.meters/10)*10)+' metros para o destino.';
    }
    const km=r.meters/1000;
    return 'Faltam aproximadamente '+km.toFixed(km<10?1:0).replace('.',',')+' quilômetros para o destino.';
  }

  if(isTimeQuestion(s)){
    const r=routeRemaining();
    if(!r||!Number.isFinite(r.seconds))return 'Não há uma rota ativa com tempo restante disponível neste momento.';
    return 'Faltam aproximadamente '+Math.max(1,Math.round(r.seconds/60))+' minutos para chegar ao destino.';
  }

  if(isSpeedQuestion(s)){
    const speed=Number(a?.currentSpeed);
    if(Number.isFinite(speed))return 'Sua velocidade atual é de aproximadamente '+Math.round(speed)+' quilômetros por hora.';
    return 'Ainda não tenho uma leitura confiável da sua velocidade.';
  }

  return null;
}

function patchLocalAssistant(){
  if(patched)return;
  const va=assistant();
  if(!va)return;

  patched=true;

  originalReply=typeof va.reply==='function'?va.reply.bind(va):null;
  originalAskAI=typeof va.askAI==='function'?va.askAI.bind(va):null;
  originalGetCurrentAddress=typeof va.getCurrentAddress==='function'?va.getCurrentAddress.bind(va):null;

  if(originalReply){
    va.reply=function(text,priority=true){
      const spoken=String(text||'').trim();
      if(isUsefulLocalFact(spoken))lastLocalFact=spoken;

      if(liveOwnsVoice()){
        speakLocalResult(spoken);
        return true;
      }

      return originalReply(text,priority);
    };
  }

  if(originalAskAI){
    va.askAI=async function(question,...rest){
      if(liveOwnsVoice())return true;
      return originalAskAI(question,...rest);
    };
  }

  if(originalGetCurrentAddress){
    va.getCurrentAddress=async function(...args){
      const result=await originalGetCurrentAddress(...args);
      const text=String(result?.label||result?.address||result?.display_name||'').trim();
      if(text){
        lastResolvedAddress=text;
        if(liveOwnsVoice())setTimeout(()=>syncContext(true),20);
      }
      return result;
    };
  }

  patchOutputGuards();
}

async function runLocalAction(text){
  const va=assistant();
  if(!va?.handle)return false;

  const direct=await resolveDirectStateQuestion(text);
  if(direct){
    await speakLocalResult(direct);
    return true;
  }

  localCommandInFlight=true;

  try{
    window.RadarGPTLive?.appendContext?.(
      'RADAR_LOCAL_COMMAND: o Radar está executando internamente o pedido "'+
      String(text||'').slice(0,240)+
      '". Não responda por conta própria. Aguarde RADAR_LOCAL_RESULT.'
    );

    await Promise.resolve(va.handle(String(text||'')));
    return true;

  }catch(error){
    console.warn('Radar comando local:',error);
    return false;

  }finally{
    localCommandInFlight=false;
    setTimeout(()=>syncContext(true),80);
  }
}

async function handleFinalUserTranscript(text){
  const phrase=String(text||'').trim();
  if(!phrase)return;

  if(isLocalRadarCommand(phrase)){
    await runLocalAction(phrase);
    return;
  }

  // Perguntas gerais ficam exclusivamente com o GPT Live.
}

function buttonState(on,thinking=false){
  const main=document.getElementById('assistantMicBtn');
  const nav=document.getElementById('navAssistantMicBtn');

  if(main){
    main.classList.toggle('listening',!!on);
    main.classList.toggle('radar-gpt-live-on',!!on);
    main.setAttribute('aria-pressed',on?'true':'false');
    main.title=thinking?'Conectando ao GPT Live...':on?'Desligar GPT Live':'Falar com o Radar usando GPT Live';
  }

  if(nav){
    nav.classList.toggle('hands-free',!!on);
    nav.classList.toggle('radar-gpt-live-on',!!on);
    nav.setAttribute('aria-pressed',on?'true':'false');
    nav.textContent=on?'🟢 GPT Live':'🎙️ Radar';
    nav.title=on?'Desligar GPT Live':'Falar com o Radar usando GPT Live';
  }
}

async function stop(){
  starting=false;
  active=false;
  stopContextSync();

  try{await window.RadarGPTLive?.stop?.()}catch{}

  buttonState(false);
  uiToast('GPT Live desligado.',1600);
}

async function start(){
  if(starting||active)return;

  patchLocalAssistant();
  patchOutputGuards();

  const live=window.RadarGPTLive;
  if(!live?.start){
    uiToast('GPT Live ainda não carregou.',3000);
    return;
  }

  starting=true;
  buttonState(true,true);
  uiToast('Conectando ao GPT Live...',2200);

  try{
    lastContextSignature='';

    await live.start({
      voice:selectedVoice(),
      instructions:context(),

      onTranscript:event=>{
        if(!event?.final||event.role!=='user'||!event.text)return;
        handleFinalUserTranscript(event.text);
      },

      onState:(name,detail)=>{
        if(name==='live'){
          starting=false;
          active=true;
          buttonState(true);
          startContextSync();
          syncContext(true);
          uiToast('GPT Live conectado.',1800);
        }else if(name==='user-speaking'){
          buttonState(true);
        }else if(name==='assistant-speaking'){
          buttonState(true);
        }else if(name==='error'){
          starting=false;
          active=false;
          stopContextSync();
          buttonState(false);
          console.warn('GPT Live:',detail);
          uiToast('GPT Live temporariamente indisponível.',2200);
        }else if(name==='stopped'&&!starting){
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
    uiToast(String(error?.message||'Não foi possível abrir o GPT Live.'),3500);
  }
}

async function toggle(){
  return (active||starting)?stop():start();
}

function installPicker(){
  if(document.getElementById('radarGptVoice'))return;

  const mic=document.getElementById('assistantMicBtn');
  if(!mic?.parentElement)return;

  const select=document.createElement('select');
  select.id='radarGptVoice';
  select.title='Voz do GPT Live';
  select.setAttribute('aria-label','Voz do GPT Live');
  select.innerHTML=VOICES.map(([id,label])=>
    '<option value="'+id+'" '+(id===selectedVoice()?'selected':'')+'>GPT '+label+'</option>'
  ).join('');

  select.onchange=async()=>{
    localStorage.setItem(VOICE_KEY,select.value);
    if(active||starting){
      await stop();
      setTimeout(start,180);
    }
  };

  mic.insertAdjacentElement('afterend',select);

  const style=document.createElement('style');
  style.textContent=`
    #radarGptVoice{
      height:38px;max-width:92px;
      border:1px solid rgba(92,190,255,.5);
      border-radius:11px;background:#0b2437;color:#dff7ff;
      font-size:11px;font-weight:800;padding:0 6px
    }
    .radar-gpt-live-on{
      box-shadow:0 0 0 3px rgba(41,255,163,.22),0 0 20px rgba(41,255,163,.45)!important
    }
  `;
  document.head.appendChild(style);
}

function bindContextTriggers(){
  const dest=document.getElementById('destInput');
  if(dest&&!dest.dataset.gptContextBound){
    dest.dataset.gptContextBound='1';
    const update=()=>setTimeout(()=>syncContext(true),50);
    dest.addEventListener('input',update);
    dest.addEventListener('change',update);
  }
}

function bind(){
  patchLocalAssistant();
  patchOutputGuards();
  installPicker();
  bindContextTriggers();

  ['assistantMicBtn','navAssistantMicBtn'].forEach(id=>{
    const el=document.getElementById(id);
    if(!el||el.dataset.gptLiveBound)return;

    el.dataset.gptLiveBound='1';
    el.addEventListener('click',e=>{
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      toggle();
    },true);
  });

  buttonState(false);
}

if(document.readyState==='loading'){
  document.addEventListener('DOMContentLoaded',()=>setTimeout(bind,500));
}else{
  setTimeout(bind,500);
}

setTimeout(bind,1600);

window.RadarGPTLiveController={
  start,
  stop,
  toggle,
  syncContext,
  isLocalRadarCommand,
  resolveDirectStateQuestion,
  get active(){return active},
  get localCommandInFlight(){return localCommandInFlight},
  voice:selectedVoice
};

})();