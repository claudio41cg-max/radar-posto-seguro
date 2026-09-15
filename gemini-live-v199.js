(()=>{
'use strict';

const TEST_MARK='GEMINI-LIVE-v199';
if(!String(window.__RADAR_TEST_ENV||'').includes(TEST_MARK)) return;

const MODEL='gemini-3.1-flash-live-preview';
const DEFAULT_WORKER='https://radar-seguro-ia-rj.claudio41cg.workers.dev';
const WORKER=(window.RADAR_CONFIG?.AI_ENDPOINT||window.RADAR_CONFIG_V100?.AI_ENDPOINT||DEFAULT_WORKER).replace(/\/$/,'');
const WS_BASE='wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContentConstrained';
const MAIN_ID='assistantMicBtn';
const NAV_ID='navAssistantMicBtn';

const SYSTEM_PROMPT=`Você é Radar, copiloto de voz do Radar Seguro RJ Pro. Fale sempre em português brasileiro, de forma curta, natural e apropriada para alguém dirigindo. Converse normalmente. Para qualquer ação no aplicativo, mapa ou navegação, use executar_comando_radar com a frase do motorista. Para consultar GPS, destino, rota ativa, distância restante, via atual ou próxima manobra, use ler_contexto_radar. Nunca invente que uma ação foi concluída: confirme somente depois da resposta da ferramenta. Nunca invente trânsito, ocorrências, preços ou fatos atuais. Se não houver dado confiável, diga isso. Não peça senhas, documentos ou dados sensíveis. Responda em uma ou duas frases curtas sempre que possível.`;

let ws=null;
let micStream=null;
let micPromise=null;
let inputCtx=null;
let inputSource=null;
let processor=null;
let silentGain=null;
let outputCtx=null;
let outputCursor=0;
const outputSources=new Set();
let running=false;
let starting=false;
let setupReady=false;
let manualStop=false;
let currentSource='';
let paidFallbackAvailable=false;
let paidFallbackTried=false;
let statusEl=null;
let originalNavText='';
let clientId='';
let micChunks=0;
let lastVoiceAt=0;
let lastServerAt=0;
let handshakeSent=false;

try{
  clientId=localStorage.getItem('radarGeminiLiveClientId')||'';
  if(!/^[a-zA-Z0-9_-]{16,80}$/.test(clientId)){
    clientId='rdr_'+crypto.getRandomValues(new Uint32Array(4)).join('_');
    localStorage.setItem('radarGeminiLiveClientId',clientId);
  }
}catch(e){ clientId='radar_live_'+Date.now()+'_'+Math.random().toString(36).slice(2); }

function appRef(){ try{return typeof App!=='undefined'?App:window.App;}catch(e){return window.App;} }
function voiceRef(){ try{return typeof Voice!=='undefined'?Voice:window.Voice;}catch(e){return window.Voice;} }
function assistantRef(){ try{return typeof VoiceAssistant!=='undefined'?VoiceAssistant:window.VoiceAssistant;}catch(e){return window.VoiceAssistant;} }

function appToast(text,ms=3200){
  try{ const app=appRef(); if(app?.toast) return app.toast(text,ms); }catch(e){}
  console.log('[Gemini Live v199]',text);
}

function ensureStyle(){
  if(document.getElementById('geminiLiveV199Style')) return;
  const style=document.createElement('style');
  style.id='geminiLiveV199Style';
  style.textContent=`
    #${MAIN_ID}.gemini-live-active{box-shadow:0 0 0 3px rgba(62,231,255,.28),0 0 24px rgba(62,231,255,.8)!important;animation:radarLivePulse199 1.35s ease-in-out infinite;background:#0b4051!important;color:#8ff4ff!important}
    #${NAV_ID}.gemini-live-active{box-shadow:0 0 0 2px rgba(62,231,255,.28),0 0 18px rgba(62,231,255,.55)!important;background:#0b4051!important;color:#d8fbff!important}
    #geminiLiveStatusV199{position:fixed;right:12px;top:118px;z-index:99999;padding:8px 11px;border-radius:999px;background:rgba(4,18,29,.93);border:1px solid rgba(110,235,255,.42);color:#e7fdff;font:700 11px/1.2 Arial,sans-serif;letter-spacing:.2px;box-shadow:0 6px 22px rgba(0,0,0,.34);display:none;max-width:78vw;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    #geminiLiveStatusV199.on{display:block}
    @keyframes radarLivePulse199{0%,100%{transform:scale(1)}50%{transform:scale(1.045)}}
  `;
  document.head.appendChild(style);
}

function ensureStatus(){
  ensureStyle();
  if(statusEl?.isConnected) return statusEl;
  statusEl=document.createElement('div');
  statusEl.id='geminiLiveStatusV199';
  statusEl.setAttribute('role','status');
  document.body.appendChild(statusEl);
  return statusEl;
}

function setStatus(text,on=true){
  const el=ensureStatus();
  el.textContent=String(text||'');
  el.classList.toggle('on',Boolean(on&&text));
}

function setButtons(active){
  const main=document.getElementById(MAIN_ID);
  const nav=document.getElementById(NAV_ID);
  if(main){
    main.classList.toggle('gemini-live-active',active);
    main.setAttribute('aria-pressed',active?'true':'false');
    main.title=active?'Encerrar Gemini Live':'Falar com Gemini Live';
  }
  if(nav){
    if(!originalNavText) originalNavText=nav.textContent||'🎙️ Radar';
    nav.classList.toggle('gemini-live-active',active);
    nav.setAttribute('aria-pressed',active?'true':'false');
    nav.title=active?'Encerrar Gemini Live':'Falar com Gemini Live';
    nav.textContent=active?'✨ Live':originalNavText;
  }
}

function arrayBufferToBase64(buffer){
  const bytes=new Uint8Array(buffer);
  let out='';
  const step=0x8000;
  for(let i=0;i<bytes.length;i+=step) out+=String.fromCharCode(...bytes.subarray(i,Math.min(i+step,bytes.length)));
  return btoa(out);
}

function base64ToBytes(b64){
  const binary=atob(String(b64||''));
  const bytes=new Uint8Array(binary.length);
  for(let i=0;i<binary.length;i++) bytes[i]=binary.charCodeAt(i);
  return bytes;
}

function downsampleFloat32ToPCM16(input,inputRate,targetRate=16000){
  if(!input?.length) return new ArrayBuffer(0);
  if(!Number.isFinite(inputRate)||inputRate<=0) inputRate=48000;
  const ratio=inputRate/targetRate;
  if(ratio<=1.01){
    const out=new Int16Array(input.length);
    for(let i=0;i<input.length;i++){
      const sample=Math.max(-1,Math.min(1,input[i]||0));
      out[i]=sample<0?sample*0x8000:sample*0x7fff;
    }
    return out.buffer;
  }
  const length=Math.max(1,Math.floor(input.length/ratio));
  const out=new Int16Array(length);
  for(let i=0;i<length;i++){
    const start=Math.floor(i*ratio);
    const end=Math.min(input.length,Math.max(start+1,Math.floor((i+1)*ratio)));
    let sum=0;
    for(let j=start;j<end;j++) sum+=input[j];
    let sample=sum/Math.max(1,end-start);
    sample=Math.max(-1,Math.min(1,sample));
    out[i]=sample<0?sample*0x8000:sample*0x7fff;
  }
  return out.buffer;
}

function rms(input){
  if(!input?.length) return 0;
  let sum=0;
  for(let i=0;i<input.length;i++){ const v=input[i]||0; sum+=v*v; }
  return Math.sqrt(sum/input.length);
}

async function primeOutput(){
  const Ctx=window.AudioContext||window.webkitAudioContext;
  if(!Ctx) throw new Error('audio_context_unsupported');
  if(!outputCtx||outputCtx.state==='closed') outputCtx=new Ctx({sampleRate:24000});
  if(outputCtx.state==='suspended') await outputCtx.resume();
  outputCursor=Math.max(outputCursor,outputCtx.currentTime);
}

function requestMicrophoneEarly(){
  if(micStream) return Promise.resolve(micStream);
  if(micPromise) return micPromise;
  if(!navigator.mediaDevices?.getUserMedia) return Promise.reject(new Error('microphone_unsupported'));
  micPromise=navigator.mediaDevices.getUserMedia({
    audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true,channelCount:1},
    video:false
  }).then(stream=>{
    micStream=stream;
    return stream;
  }).catch(error=>{
    micPromise=null;
    throw error;
  });
  return micPromise;
}

async function prepareMicGraph(){
  const stream=await requestMicrophoneEarly();
  if(processor&&inputCtx&&inputCtx.state!=='closed') return;
  const Ctx=window.AudioContext||window.webkitAudioContext;
  if(!Ctx) throw new Error('audio_context_unsupported');
  inputCtx=new Ctx();
  if(inputCtx.state==='suspended') await inputCtx.resume();
  inputSource=inputCtx.createMediaStreamSource(stream);
  processor=inputCtx.createScriptProcessor(4096,1,1);
  silentGain=inputCtx.createGain();
  silentGain.gain.value=0;
  inputSource.connect(processor);
  processor.connect(silentGain);
  silentGain.connect(inputCtx.destination);
  processor.onaudioprocess=event=>{
    if(!running||!setupReady||ws?.readyState!==WebSocket.OPEN) return;
    const mono=event.inputBuffer.getChannelData(0);
    const level=rms(mono);
    if(level>0.008){
      lastVoiceAt=Date.now();
      if(micChunks%5===0) setStatus('Gemini Live • ouvindo você…');
    }
    const pcm=downsampleFloat32ToPCM16(mono,inputCtx.sampleRate,16000);
    if(!pcm.byteLength) return;
    micChunks++;
    send({realtimeInput:{audio:{data:arrayBufferToBase64(pcm),mimeType:'audio/pcm;rate=16000'}}});
  };
}

async function stopMicrophone(){
  try{ if(processor){processor.onaudioprocess=null;processor.disconnect();} }catch(e){}
  try{ inputSource?.disconnect(); }catch(e){}
  try{ silentGain?.disconnect(); }catch(e){}
  try{ micStream?.getTracks()?.forEach(t=>t.stop()); }catch(e){}
  processor=null;inputSource=null;silentGain=null;micStream=null;micPromise=null;
  if(inputCtx){ try{await inputCtx.close();}catch(e){} }
  inputCtx=null;
}

function stopOutput(){
  for(const src of [...outputSources]){ try{src.stop();}catch(e){} }
  outputSources.clear();
  if(outputCtx) outputCursor=outputCtx.currentTime;
}

async function playPCMBase64(b64,rate=24000){
  if(!b64) return;
  await primeOutput();
  const bytes=base64ToBytes(b64);
  const sampleCount=Math.floor(bytes.byteLength/2);
  if(!sampleCount) return;
  const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  const floats=new Float32Array(sampleCount);
  for(let i=0;i<sampleCount;i++) floats[i]=Math.max(-1,Math.min(1,view.getInt16(i*2,true)/32768));
  const buffer=outputCtx.createBuffer(1,sampleCount,rate);
  buffer.copyToChannel(floats,0);
  const src=outputCtx.createBufferSource();
  src.buffer=buffer;
  src.connect(outputCtx.destination);
  const when=Math.max(outputCtx.currentTime+.02,outputCursor);
  outputCursor=when+buffer.duration;
  outputSources.add(src);
  src.onended=()=>outputSources.delete(src);
  src.start(when);
}

function send(message){
  if(ws?.readyState===WebSocket.OPEN){
    ws.send(JSON.stringify(message));
    return true;
  }
  return false;
}

function routeContext(){
  const assistant=assistantRef();
  const app=appRef();
  let route=null;
  try{ route=assistant?.routeContext?.()||null; }catch(e){}
  const pos=Array.isArray(app?.userPos)?app.userPos:null;
  let currentRoad='';
  try{ currentRoad=document.getElementById('currentRoadPill')?.textContent?.trim()||route?.currentRoad||''; }catch(e){}
  return {
    gps:pos&&pos.length>=2?{longitude:Number(pos[0]),latitude:Number(pos[1])}:null,
    destination:document.getElementById('destInput')?.value?.trim()||route?.destination||'',
    routeActive:Boolean(app?.route),
    currentRoad,
    route
  };
}

async function executeRadarCommand(command){
  const text=String(command||'').trim();
  if(!text) return {ok:false,error:'Comando vazio.'};
  const assistant=assistantRef();
  const voice=voiceRef();
  if(!assistant?.handle) return {ok:false,error:'Assistente local do Radar indisponível.'};
  let previousVoice=true;
  try{
    if(voice){ previousVoice=voice.enabled!==false; voice.clear?.(); voice.enabled=false; }
    await Promise.resolve(assistant.handle(text));
    return {ok:true,command:text};
  }catch(error){
    console.warn('Gemini Live v199 tool command',error);
    return {ok:false,error:String(error?.message||error).slice(0,180)};
  }finally{
    if(voice) voice.enabled=previousVoice;
  }
}

async function handleToolCall(toolCall){
  const calls=Array.isArray(toolCall?.functionCalls)?toolCall.functionCalls:[];
  const responses=[];
  for(const call of calls){
    let response;
    if(call?.name==='ler_contexto_radar') response={ok:true,context:routeContext()};
    else if(call?.name==='executar_comando_radar') response=await executeRadarCommand(call?.args?.comando||call?.args?.command||'');
    else response={ok:false,error:'Ferramenta não reconhecida.'};
    responses.push({id:call?.id,name:call?.name,response});
  }
  if(responses.length) send({toolResponse:{functionResponses:responses}});
}

function handleServerMessage(message){
  lastServerAt=Date.now();
  if(message?.setupComplete!==undefined){
    setupReady=true;
    setStatus(currentSource==='paid'?'Gemini Live • reserva paga':'Gemini Live • microfone ativo');
    prepareMicGraph().then(()=>{
      appToast('✨ Gemini Live conectado. Pode falar.',2600);
      if(!handshakeSent){
        handshakeSent=true;
        send({realtimeInput:{text:'Responda em português brasileiro dizendo apenas: Radar conectado e ouvindo.'}});
      }
    }).catch(error=>{
      console.warn('Gemini Live v199 microphone',error);
      const denied=String(error?.name||'').toLowerCase().includes('notallowed');
      appToast(denied?'Permita o microfone no Chrome e tente novamente.':'Não consegui iniciar o microfone neste aparelho.',5200);
      stop();
    });
  }

  if(message?.toolCall) handleToolCall(message.toolCall);
  if(message?.goAway) setStatus('Gemini Live • reconectando…');

  const content=message?.serverContent;
  if(!content) return;
  if(content.interrupted) stopOutput();

  const inputText=String(content?.inputTranscription?.text||'').trim();
  if(inputText) setStatus('Você: '+inputText.slice(0,90));

  const outputText=String(content?.outputTranscription?.text||'').trim();
  if(outputText) setStatus('Radar: '+outputText.slice(0,90));

  const parts=content?.modelTurn?.parts||[];
  for(const part of parts){
    const inline=part?.inlineData||part?.inline_data;
    if(!inline?.data) continue;
    const mime=String(inline.mimeType||inline.mime_type||'audio/pcm;rate=24000');
    if(!/^audio\//i.test(mime)) continue;
    const rate=Number((mime.match(/rate=(\d+)/i)||[])[1])||24000;
    playPCMBase64(inline.data,rate).catch(error=>console.warn('Gemini Live v199 audio output',error));
  }

  if(content.turnComplete){
    setTimeout(()=>{
      if(running&&Date.now()-lastServerAt>350) setStatus('Gemini Live • ouvindo');
    },500);
  }
}

async function requestToken(tier='auto'){
  const response=await fetch(`${WORKER}/v1/live-token?tier=${encodeURIComponent(tier)}`,{
    method:'POST',
    headers:{'Content-Type':'application/json','X-Radar-Client':clientId},
    body:'{}',
    cache:'no-store'
  });
  let data={};try{data=await response.json();}catch(e){}
  if(!response.ok){
    const error=new Error(data?.error||`live_token_${response.status}`);
    error.status=response.status;
    error.data=data;
    throw error;
  }
  return data;
}

function quotaLikeClose(event){
  const text=`${event?.code||''} ${event?.reason||''}`.toLowerCase();
  return /429|quota|rate|resource|exhaust|limit/.test(text);
}

async function cleanup({closeSocket=false,keepOutputContext=true}={}){
  setupReady=false;
  handshakeSent=false;
  if(closeSocket&&ws){
    try{ send({realtimeInput:{audioStreamEnd:true}}); }catch(e){}
    try{ ws.onclose=null;ws.onerror=null;ws.onmessage=null;ws.close(1000,'user_stop'); }catch(e){}
  }
  ws=null;
  await stopMicrophone();
  stopOutput();
  if(!keepOutputContext&&outputCtx){
    try{await outputCtx.close();}catch(e){}
    outputCtx=null;outputCursor=0;
  }
}

async function start(tier='auto'){
  if(running||starting) return;
  starting=true;manualStop=false;micChunks=0;lastVoiceAt=0;lastServerAt=0;handshakeSent=false;
  setButtons(true);
  setStatus('Gemini Live • abrindo microfone…');

  try{
    try{ voiceRef()?.clear?.(); }catch(e){}
    try{ assistantRef()?.stopHandsFree?.(false); }catch(e){}

    const outputReady=primeOutput();
    const micReady=requestMicrophoneEarly();
    await Promise.all([outputReady,micReady]);

    setStatus('Gemini Live • conectando…');
    const auth=await requestToken(tier);
    currentSource=String(auth?.source||'default');
    paidFallbackAvailable=Boolean(auth?.paidFallbackAvailable);
    if(currentSource==='paid') paidFallbackTried=true;
    if(!auth?.token) throw new Error('Token temporário não recebido.');

    const url=`${WS_BASE}?access_token=${encodeURIComponent(auth.token)}`;
    ws=new WebSocket(url);

    ws.onopen=()=>{
      running=true;starting=false;
      const setup={
        setup:{
          model:`models/${MODEL}`,
          generationConfig:{responseModalities:['AUDIO']},
          systemInstruction:{parts:[{text:SYSTEM_PROMPT}]},
          inputAudioTranscription:{languageCodes:['pt-BR']},
          outputAudioTranscription:{},
          tools:[{functionDeclarations:[
            {
              name:'ler_contexto_radar',
              description:'Lê o contexto confiável do Radar: GPS, destino, rota ativa, via atual, distância restante e próxima manobra.',
              parameters:{type:'object',properties:{}}
            },
            {
              name:'executar_comando_radar',
              description:'Executa no Radar uma ação pedida pelo motorista, como iniciar/trocar rota, pesquisar um local ou usar comandos já entendidos pelo assistente local.',
              parameters:{type:'object',properties:{comando:{type:'string',description:'Frase completa do motorista que representa a ação a executar.'}},required:['comando']}
            }
          ]}]
        }
      };
      send(setup);
    };

    ws.onmessage=event=>{
      try{ handleServerMessage(JSON.parse(event.data)); }
      catch(error){ console.warn('Gemini Live v199 message',error); }
    };

    ws.onerror=error=>console.warn('Gemini Live v199 WebSocket',error);

    ws.onclose=async event=>{
      const wasManual=manualStop;
      const shouldPaid=!wasManual&&currentSource!=='paid'&&!paidFallbackTried&&paidFallbackAvailable&&quotaLikeClose(event);
      running=false;starting=false;setupReady=false;
      await cleanup({closeSocket:false,keepOutputContext:true});
      if(shouldPaid){
        paidFallbackTried=true;
        setStatus('Gemini Live • usando reserva…');
        setTimeout(()=>start('paid'),350);
        return;
      }
      setButtons(false);
      if(!wasManual){
        setStatus('Gemini Live • conexão encerrada');
        appToast('A conversa ao vivo foi encerrada. Toque no microfone para tentar novamente.',4200);
      }else setStatus('',false);
    };
  }catch(error){
    console.warn('Gemini Live v199 start',error);
    running=false;starting=false;setupReady=false;
    await cleanup({closeSocket:true,keepOutputContext:true});
    setButtons(false);
    const name=String(error?.name||'');
    const msg=String(error?.message||'');
    if(/NotAllowedError/i.test(name)) appToast('Permita o uso do microfone no Chrome e tente novamente.',5200);
    else if(/live_token_429|limite|quota|rate/i.test(msg)) appToast('O limite do Gemini Live foi atingido. Tente novamente em alguns minutos.',5200);
    else appToast('Não consegui iniciar o Gemini Live agora. Tente novamente.',4800);
    setStatus('',false);
  }
}

async function stop(){
  manualStop=true;
  running=false;starting=false;setupReady=false;
  setButtons(false);
  setStatus('',false);
  await cleanup({closeSocket:true,keepOutputContext:true});
}

function toggleFromGesture(){
  if(running||starting){ stop(); return; }
  start('auto');
}

function intercept(event){
  const target=event.target?.closest?.(`#${MAIN_ID},#${NAV_ID}`);
  if(!target) return;
  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();
  toggleFromGesture();
}

document.addEventListener('click',intercept,true);
window.addEventListener('pagehide',()=>{manualStop=true;cleanup({closeSocket:true,keepOutputContext:false});},{once:false});
ensureStyle();
setButtons(false);

window.RadarGeminiLiveV199={start,stop,toggle:toggleFromGesture,state:()=>({running,starting,setupReady,micChunks,lastVoiceAt,lastServerAt,currentSource})};
})();