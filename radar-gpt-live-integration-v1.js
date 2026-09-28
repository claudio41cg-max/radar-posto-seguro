(()=>{
'use strict';
const VOICE_KEY='radar.gptLiveVoice.v1';
const VOICES=[['cove','Cove'],['juniper','Juniper'],['maple','Maple'],['spruce','Spruce'],['ember','Ember'],['vale','Vale'],['breeze','Breeze'],['arbor','Arbor'],['sol','Sol']];
let active=false;
let starting=false;
let patched=false;
let originalReply=null;
let originalAskAI=null;

function getLexical(name){
  try{return (0,eval)('typeof '+name+" !== 'undefined' ? "+name+" : null")}catch{return null}
}
function assistant(){return getLexical('VoiceAssistant')||window.VoiceAssistant||null}
function app(){return getLexical('App')||window.App||window.RadarApp||null}
function voice(){
  const saved=String(localStorage.getItem(VOICE_KEY)||'cove').trim();
  return VOICES.some(v=>v[0]===saved)?saved:'cove';
}
function toast(text,ms=3500){
  try{app()?.toast?.(text,ms)}catch{}
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
function context(){
  const a=app();
  const parts=[
    'Você é a voz inteligente do aplicativo Radar Seguro RJ PRO.',
    'Fale sempre em português brasileiro, de forma curta, natural e útil para um motorista.',
    'Você está dentro de um aplicativo de mapa/navegação. Quando o usuário pedir rota, trocar rota, localizar lugar ou outra ação do mapa, responda com uma confirmação curta. O aplicativo executará a ação localmente.',
    'Nunca invente ocorrência, trânsito, fiscalização, preço de combustível ou notícia atual. Se não tiver dados confiáveis no contexto, diga que precisa consultar os dados do Radar.',
    'Não diga que é Gemini. Você é o assistente GPT Live do Radar Seguro.'
  ];
  try{
    if(Array.isArray(a?.userPos)&&a.userPos.length>=2)parts.push('GPS atual aproximado do app: latitude '+Number(a.userPos[1]).toFixed(5)+', longitude '+Number(a.userPos[0]).toFixed(5)+'.');
    const dest=document.getElementById('destInput')?.value?.trim();
    if(dest)parts.push('Destino exibido no Radar: '+dest+'.');
    if(a?.navActive)parts.push('A navegação do Radar está ativa.');
    if(a?.nearestCommunityName)parts.push('Comunidade mais próxima indicada pelo Radar: '+String(a.nearestCommunityName)+'.');
    if(Number.isFinite(Number(a?.currentSpeed)))parts.push('Velocidade indicada pelo Radar neste instante: '+Math.round(Number(a.currentSpeed))+' km/h.');
  }catch{}
  return parts.join('\n');
}
function patchLocalAssistant(){
  if(patched)return;
  const va=assistant();
  if(!va)return;
  patched=true;
  originalReply=typeof va.reply==='function'?va.reply.bind(va):null;
  originalAskAI=typeof va.askAI==='function'?va.askAI.bind(va):null;

  if(originalReply){
    va.reply=function(text,priority=true){
      if(active||starting){
        const spoken=String(text||'').trim();
        try{app()?.toast?.(spoken,5200)}catch{}
        return true;
      }
      return originalReply(text,priority);
    };
  }
  if(originalAskAI){
    va.askAI=async function(question,...rest){
      if(active||starting){
        // O GPT Live já responde a perguntas gerais; evita duplicar consulta na API antiga.
        return true;
      }
      return originalAskAI(question,...rest);
    };
  }
}
function runLocalAction(text){
  const va=assistant();
  if(!va?.handle)return;
  // O parser local continua cuidando de rotas, localização, velocidade e comandos do mapa.
  Promise.resolve().then(()=>va.handle(String(text||''))).catch(()=>{});
}
async function stop(){
  starting=false;active=false;
  try{await window.RadarGPTLive?.stop?.()}catch{}
  buttonState(false);
  toast('GPT Live desligado.',1800);
}
async function start(){
  if(starting||active)return;
  patchLocalAssistant();
  const live=window.RadarGPTLive;
  if(!live?.start){toast('GPT Live ainda não carregou.',3500);return}
  starting=true;buttonState(true,true);toast('Conectando ao GPT Live...',3500);
  try{
    await live.start({
      voice:voice(),
      instructions:context(),
      onTranscript:event=>{
        if(!event?.final||event.role!=='user'||!event.text)return;
        runLocalAction(event.text);
      },
      onState:(name,detail)=>{
        if(name==='live'){starting=false;active=true;buttonState(true);toast('GPT Live conectado. Pode falar normalmente.',3200)}
        else if(name==='user-speaking'){buttonState(true)}
        else if(name==='assistant-speaking'){buttonState(true)}
        else if(name==='error'){starting=false;active=false;buttonState(false);toast('GPT Live: '+String(detail||'erro de conexão'),5000)}
        else if(name==='stopped'&&!starting){active=false;buttonState(false)}
      }
    });
  }catch(e){
    starting=false;active=false;buttonState(false);
    toast(String(e?.message||'Não foi possível abrir o GPT Live.'),5000);
  }
}
async function toggle(){
  if(active||starting)return stop();
  return start();
}
function installPicker(){
  if(document.getElementById('radarGptVoice'))return;
  const mic=document.getElementById('assistantMicBtn');
  if(!mic?.parentElement)return;
  const select=document.createElement('select');
  select.id='radarGptVoice';
  select.title='Voz do GPT Live';
  select.setAttribute('aria-label','Voz do GPT Live');
  select.innerHTML=VOICES.map(([id,label])=>'<option value="'+id+'" '+(id===voice()?'selected':'')+'>GPT '+label+'</option>').join('');
  select.onchange=async()=>{
    localStorage.setItem(VOICE_KEY,select.value);
    if(active||starting){await stop();setTimeout(start,180)}
  };
  mic.insertAdjacentElement('afterend',select);
  const style=document.createElement('style');
  style.textContent=`
    #radarGptVoice{height:38px;max-width:92px;border:1px solid rgba(92,190,255,.5);border-radius:11px;background:#0b2437;color:#dff7ff;font-size:11px;font-weight:800;padding:0 6px}
    .radar-gpt-live-on{box-shadow:0 0 0 3px rgba(41,255,163,.22),0 0 20px rgba(41,255,163,.45)!important}
  `;
  document.head.appendChild(style);
}
function bind(){
  patchLocalAssistant();
  installPicker();
  ['assistantMicBtn','navAssistantMicBtn'].forEach(id=>{
    const el=document.getElementById(id);
    if(!el||el.dataset.gptLiveBound)return;
    el.dataset.gptLiveBound='1';
    el.addEventListener('click',e=>{
      e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();
      toggle();
    },true);
  });
  buttonState(false);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(bind,500));
else setTimeout(bind,500);
setTimeout(bind,1600);
window.RadarGPTLiveController={start,stop,toggle,get active(){return active},voice};
})();