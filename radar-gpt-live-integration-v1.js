(()=>{
'use strict';

/*
  Radar GPT Live integration — Stage 2
  Objetivos:
  1) manter o contexto do GPT sincronizado com posição/rua/destino durante a sessão;
  2) impedir que a mesma frase seja processada ao mesmo tempo pelo GPT e pelo parser local;
  3) preservar respostas locais úteis ao motorista, sem silenciá-las.
*/

const VOICE_KEY='radar.gptLiveVoice.v1';

const VOICES=[
  ['cove','Cove'],
  ['juniper','Juniper'],
  ['maple','Maple'],
  ['spruce','Spruce'],
  ['ember','Ember'],
  ['vale','Vale'],
  ['breeze','Breeze'],
  ['arbor','Arbor'],
  ['sol','Sol']
];

let active=false;
let starting=false;
let patched=false;

let originalReply=null;
let originalAskAI=null;
let originalGetCurrentAddress=null;

let syncTimer=null;
let lastContextSignature='';
let lastResolvedAddress='';
let lastLocalFact='';
let localCommandInFlight=false;

function getLexical(name){
  try{
    return (0,eval)(
      'typeof '+name+' !== "undefined" ? '+name+' : null'
    );
  }catch{
    return null;
  }
}

function assistant(){
  return (
    getLexical('VoiceAssistant')||
    window.VoiceAssistant||
    null
  );
}

function app(){
  return (
    getLexical('App')||
    window.App||
    window.RadarApp||
    null
  );
}

function voice(){
  const saved=
    String(
      localStorage.getItem(VOICE_KEY)||
      'cove'
    ).trim();

  return VOICES.some(v=>v[0]===saved)
    ?saved
    :'cove';
}

function toast(text,ms=3500){
  try{
    app()?.toast?.(text,ms);
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

  // Não perpetua respostas de espera/latência no contexto do GPT.
  if(
    /calma ai|aguarde|um momento|estou verificando|vou verificar|estou pesquisando|ainda estou aqui/.test(s)
  ){
    return false;
  }

  return true;
}

function isLocalRadarCommand(text){
  const s=normalizeText(text);

  if(!s)return false;

  /*
    Somente comandos que dependem do estado local do Radar entram no parser local.
    Perguntas gerais, conversa, notícias, clima etc. ficam exclusivamente com o GPT.
  */
  return (
    /\b(onde estou|onde eu estou|qual rua|que rua|rua estou|minha localizacao|meu local)\b/.test(s)||
    /\b(para onde estou indo|pra onde estou indo|qual destino|meu destino|destino atual)\b/.test(s)||
    /\b(rota|navegar|navegacao|iniciar navegacao|cancelar navegacao|cancelar rota|sair da rota|encerrar rota|trocar rota|recalcular rota)\b/.test(s)||
    /\b(me leve|me leva|levar para|ir para|vamos para|quero ir|navegue para)\b/.test(s)||
    /\b(onde fica)\b/.test(s)||
    /\b(zoom|satelite|street view|mapa|comunidade|comunidades|postos|posto|radar proximo|radares proximos)\b/.test(s)||
    /\b(qual minha velocidade|que velocidade|velocidade atual)\b/.test(s)
  );
}

function streetFromUI(){
  const candidates=[
    document.getElementById('hudStreet')?.textContent,
    document.getElementById('currentStreet')?.textContent,
    document.getElementById('streetName')?.textContent,
    app()?.currentStreet,
    app()?.streetName
  ];

  for(const value of candidates){
    const text=String(value||'').trim();

    if(
      text&&
      !/^siga pela via$/i.test(text)&&
      !/^pr[oó]ximo acesso$/i.test(text)&&
      text!=='--'
    ){
      return text;
    }
  }

  return '';
}

function destinationFromUI(){
  return String(
    document.getElementById('destInput')
    ?.value||
    ''
  ).trim();
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

  // 4 casas: contexto útil sem mandar update a cada metro.
  return {
    lat:Number(lat.toFixed(4)),
    lon:Number(lon.toFixed(4))
  };
}

function contextData(){
  const a=app();
  const gps=roundedGps(a);
  const destination=destinationFromUI();
  const street=
    lastResolvedAddress||
    streetFromUI();

  const speed=
    Number.isFinite(Number(a?.currentSpeed))
    ?Math.round(Number(a.currentSpeed)/5)*5
    :null;

  const hudDistance=
    String(
      document.getElementById('hudDist')
      ?.textContent||
      ''
    ).trim();

  const eta=
    String(
      document.getElementById('sheetTime')
      ?.textContent||
      ''
    ).trim();

  return {
    gps,
    street,
    destination,
    navActive:!!a?.navActive,
    speed,
    hudDistance,
    eta,
    localFact:lastLocalFact
  };
}

function context(){
  const d=contextData();

  const parts=[
    'Você é a voz inteligente do aplicativo Radar Seguro RJ PRO.',
    'Fale sempre em português brasileiro, de forma curta, natural e útil para um motorista.',
    'Os dados abaixo vêm do próprio aplicativo e devem ser tratados como o estado atual do Radar.',
    'Quando o usuário fizer um comando operacional do mapa, localização ou rota, NÃO tente executar nem inventar a ação. O Radar local executará e responderá.',
    'Não diga "aguarde", "estou verificando" ou "estou pesquisando" se o estado local já contém a resposta.',
    'Nunca invente ocorrência, trânsito, fiscalização, preço de combustível ou notícia atual.',
    'Não diga que é Gemini. Você é o assistente GPT Live do Radar Seguro.'
  ];

  if(d.gps){
    parts.push(
      'GPS atual do app: latitude '+
      d.gps.lat+
      ', longitude '+
      d.gps.lon+
      '.'
    );
  }

  if(d.street){
    parts.push(
      'Localização/endereço atual confirmado pelo Radar: '+
      d.street+
      '.'
    );
  }

  if(d.destination){
    parts.push(
      'Destino atual exibido no Radar: '+
      d.destination+
      '.'
    );
  }else{
    parts.push(
      'O Radar não tem destino ativo neste momento.'
    );
  }

  parts.push(
    d.navActive
    ?'A navegação do Radar está ativa.'
    :'A navegação do Radar não está ativa.'
  );

  if(Number.isFinite(d.speed)){
    parts.push(
      'Velocidade aproximada indicada pelo Radar: '+
      d.speed+
      ' km/h.'
    );
  }

  if(
    d.navActive&&
    d.hudDistance&&
    d.hudDistance!=='-- m'
  ){
    parts.push(
      'Distância indicada para a próxima manobra: '+
      d.hudDistance+
      '.'
    );
  }

  if(
    d.navActive&&
    d.eta&&
    !/^--/.test(d.eta)
  ){
    parts.push(
      'Tempo/ETA exibido pelo Radar: '+
      d.eta+
      '.'
    );
  }

  if(d.localFact){
    parts.push(
      'Última informação confirmada pelo módulo local do Radar: '+
      d.localFact+
      '.'
    );
  }

  return parts.join('\n');
}

function contextSignature(){
  const d=contextData();

  return JSON.stringify(d);
}

function syncContext(force=false){
  if(!active&&!starting)return false;

  const live=window.RadarGPTLive;

  if(!live?.updateContext)return false;

  const sig=contextSignature();

  if(!force&&sig===lastContextSignature){
    return false;
  }

  lastContextSignature=sig;

  return live.updateContext(
    context()
  );
}

function startContextSync(){
  stopContextSync();

  syncTimer=setInterval(
    ()=>syncContext(false),
    1500
  );
}

function stopContextSync(){
  if(syncTimer){
    clearInterval(syncTimer);
    syncTimer=null;
  }
}

function buttonState(on,thinking=false){
  const main=
    document.getElementById('assistantMicBtn');

  const nav=
    document.getElementById('navAssistantMicBtn');

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

  /*
    Stage 2:
    NÃO silenciamos mais reply().
    Se o módulo local sabe a resposta (rua, destino, comando etc.),
    o usuário precisa ouvi-la normalmente.
  */
  if(originalReply){
    va.reply=function(text,priority=true){
      const spoken=
        String(text||'').trim();

      if(isUsefulLocalFact(spoken)){
        lastLocalFact=spoken;
      }

      const result=
        originalReply(
          text,
          priority
        );

      if(active||starting){
        setTimeout(
          ()=>syncContext(true),
          40
        );
      }

      return result;
    };
  }

  /*
    A IA antiga continua bloqueada enquanto GPT Live está ativo,
    evitando duas IAs responderem à mesma pergunta.
  */
  if(originalAskAI){
    va.askAI=async function(question,...rest){
      if(active||starting){
        return true;
      }

      return originalAskAI(
        question,
        ...rest
      );
    };
  }

  /*
    Captura o endereço resolvido pelo próprio Radar.
    Assim a mesma informação que aparece na tarja local passa a fazer
    parte do contexto vivo do GPT.
  */
  if(originalGetCurrentAddress){
    va.getCurrentAddress=async function(...args){
      const result=
        await originalGetCurrentAddress(...args);

      const text=
        typeof result==='string'
        ?result.trim()
        :String(
          result?.address||
          result?.display_name||
          result?.label||
          ''
        ).trim();

      if(text){
        lastResolvedAddress=text;

        if(active||starting){
          setTimeout(
            ()=>syncContext(true),
            20
          );
        }
      }

      return result;
    };
  }
}

async function runLocalAction(text){
  const va=assistant();

  if(!va?.handle)return false;

  localCommandInFlight=true;

  try{
    /*
      Cancela a resposta que o GPT poderia começar a gerar para a mesma fala.
      A partir daqui, apenas o parser local assume este comando.
    */
    try{
      window.RadarGPTLive
      ?.cancelResponse
      ?.();
    }catch{}

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
      60
    );
  }
}

async function handleFinalUserTranscript(text){
  const phrase=String(text||'').trim();

  if(!phrase)return;

  /*
    Regra central da Etapa 2:
    - comando do Radar -> parser local apenas;
    - conversa/pergunta geral -> GPT apenas.
    Nunca os dois para a mesma fala.
  */
  if(isLocalRadarCommand(phrase)){
    await runLocalAction(phrase);
    return;
  }

  // Pergunta geral: não chama VoiceAssistant.handle().
  // O GPT Live já recebeu o áudio e é o único responsável pela resposta.
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

  toast(
    'GPT Live desligado.',
    1800
  );
}

async function start(){
  if(starting||active)return;

  patchLocalAssistant();

  const live=
    window.RadarGPTLive;

  if(!live?.start){
    toast(
      'GPT Live ainda não carregou.',
      3500
    );

    return;
  }

  starting=true;

  buttonState(
    true,
    true
  );

  toast(
    'Conectando ao GPT Live...',
    3500
  );

  try{
    lastContextSignature='';

    await live.start({
      voice:voice(),
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

          buttonState(true);

          startContextSync();
          syncContext(true);

          toast(
            'GPT Live conectado. Pode falar normalmente.',
            3200
          );
        }

        else if(name==='user-speaking'){
          buttonState(true);
        }

        else if(name==='assistant-speaking'){
          buttonState(true);
        }

        else if(name==='context-updated'){
          // Atualização silenciosa do estado do Radar.
        }

        else if(name==='error'){
          starting=false;
          active=false;

          stopContextSync();

          buttonState(false);

          toast(
            'GPT Live: '+
            String(
              detail||
              'erro de conexão'
            ),
            5000
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

    toast(
      String(
        error?.message||
        'Não foi possível abrir o GPT Live.'
      ),
      5000
    );
  }
}

async function toggle(){
  if(active||starting){
    return stop();
  }

  return start();
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

  select.id=
    'radarGptVoice';

  select.title=
    'Voz do GPT Live';

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
        (id===voice()?'selected':'')+
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
    document.getElementById('destInput');

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
      e=>{
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();

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
  isLocalRadarCommand,
  get active(){
    return active;
  },
  get localCommandInFlight(){
    return localCommandInFlight;
  },
  voice
};

})();