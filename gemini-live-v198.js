(()=>{
'use strict';

const TEST_MARK='GEMINI-LIVE-v198';
if(!String(window.__RADAR_TEST_ENV||'').includes(TEST_MARK)) return;

const MODEL='gemini-3.1-flash-live-preview';
const DEFAULT_WORKER='https://radar-seguro-ia-rj.claudio41cg.workers.dev';
const WORKER=(window.RADAR_CONFIG?.AI_ENDPOINT||window.RADAR_CONFIG_V100?.AI_ENDPOINT||DEFAULT_WORKER).replace(/\/$/,'');
const WS_BASE='wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContentConstrained';
const MAIN_ID='assistantMicBtn';
const NAV_ID='navAssistantMicBtn';

const SYSTEM_PROMPT=`Você é Radar, copiloto de voz do Radar Seguro RJ Pro. Fale sempre em português brasileiro, de forma curta, natural e apropriada para alguém dirigindo. Você pode conversar normalmente, mas qualquer ação no aplicativo, mapa ou navegação deve ser feita chamando executar_comando_radar com a frase do motorista. Para saber posição, destino, rota ativa, distância restante ou próxima manobra, chame ler_contexto_radar. Nunca invente que uma rota foi alterada, um lugar foi encontrado, um posto foi localizado ou uma ação foi concluída: só confirme depois da resposta da ferramenta. Nunca invente trânsito, ocorrências, preços ou fatos atuais. Se não houver dado confiável, diga isso. Não peça senhas, documentos ou outros dados sensíveis. Responda em uma ou duas frases curtas sempre que possível.`;

let ws=null;
let micStream=null;
let inputCtx=null;
let inputSource=null;
let processor=null;
let muteGain=null;
let outputCtx=null;
let outputCursor=0;
let outputSources=new Set();
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

try{
  clientId=localStorage.getItem('radarGeminiLiveClientId')||'';
  if(!/^[a-zA-Z0-9_-]{16,80}$/.test(clientId)){
    clientId='rdr_'+crypto.getRandomValues(new Uint32Array(4)).join('_');
    localStorage.setItem('radarGeminiLiveClientId',clientId);
  }
}catch(e){ clientId='radar_live_'+Date.now()+'_'+Math.random().toString(36).slice(2); }

function appToast(text,ms=3200){
  try{ if(window.App?.toast) return App.toast(text,ms); }catch(e){}
  console.log('[Gemini Live]',text);
}

function ensureStyle(){
  if(document.getElementById('geminiLiveV198Style')) return;
  const style=document.createElement('style');
  style.id='geminiLiveV198Style';
  style.textContent=`
    #${MAIN_ID}.gemini-live-active{box-shadow:0 0 0 3px rgba(62,231,255,.28),0 0 24px rgba(62,231,255,.8)!important;animation:radarLivePulse 1.35s ease-in-out infinite;background:#0b4051!important;color:#8ff4ff!important}
    #${NAV_ID}.gemini-live-active{box-shadow:0 0 0 2px rgba(62,231,255,.28),0 0 18px rgba(62,231,255,.55)!important;background:#0b4051!important;color:#d8fbff!important}
    #geminiLiveStatusV198{position:fixed;right:12px;top:118px;z-index:99999;padding:7px 10px;border-radius:999px;background:rgba(4,18,29,.90);border:1px solid rgba(110,235,255,.38);color:#dffcff;font:700 11px/1.1 Arial,sans-serif;letter-spacing:.2px;box-shadow:0 6px 22px rgba(0,0,0,.32);display:none;max-width:72vw;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    #geminiLiveStatusV198.on{display:block}
    @keyframes radarLivePulse{0%,100%{transform:scale(1)}50%{transform:scale(1.045)}}
  `;
  document.head.appendChild(style);
}

function ensureStatus(){
  ensureStyle();
  if(statusEl?.isConnected) return statusEl;
  statusEl=document.createElement('div');
  statusEl.id='geminiLiveStatusV198';
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
  const chunk=0x8000;
  for(let i=0;i<bytes.length;i+=chunk) out+=String.fromCharCode(...bytes.subarray(i,Math.min(i+chunk,bytes.length)));
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
  const ratio=inputRate/targetRate;
  const length=Math.max(1,Math.round(input.length/ratio));
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

async function ensureOutputContext(){
  if(!outputCtx || outputCtx.state==='closed') outputCtx=new (window.AudioContext||window.webkitAudioContext)({sampleRate:24000});
  if(outputCtx.state==='suspended') await outputCtx.resume();
  if(outputCursor<outputCtx.currentTime) outputCursor=outputCtx.currentTime;
}

function stopOutput(){
  for(const src of [...outputSources]){ try{src.stop();}catch(e){} }
  outputSources.clear();
  if(outputCtx) outputCursor=outputCtx.currentTime;
}

async function playPCMBase64(b64,rate=24000){
  if(!b64) return;
  await ensureOutputContext();
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
  const when=Math.max(outputCtx.currentTime+.025,outputCursor);
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

async function startMicrophone(){
  if(micStream) return;
  if(!navigator.mediaDevices?.getUserMedia) throw new Error('microphone_unsupported');
  micStream=await navigator.mediaDevices.getUserMedia({
    audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true,channelCount:1},
    video:false
  });
  inputCtx=new (window.AudioContext||window.webkitAudioContext)();
  if(inputCtx.state==='suspended') await inputCtx.resume();
  inputSource=inputCtx.createMediaStreamSource(micStream);
  processor=inputCtx.createScriptProcessor(4096,1,1);
  muteGain=inputCtx.createGain();
  muteGain.gain.value=0;
  inputSource.connect(processor);
  processor.connect(muteGain);
  muteGain.connect(inputCtx.destination);
  processor.onaudioprocess=event=>{
    if(!running||!setupReady||ws?.readyState!==WebSocket.OPEN) return;
    const mono=event.inputBuffer.getChannelData(0);
    const pcm=downsampleFloat32ToPCM16(mono,inputCtx.sampleRate,16000);
    if(!pcm.byteLength) return;
    send({realtimeInput:{audio:{data:arrayBufferToBase64(pcm),mimeType:'audio/pcm;rate=16000'}}});
  };
}

async function stopMicrophone(){
  try{ if(processor){processor.onaudioprocess=null;processor.disconnect();} }catch(e){}
  try{ inputSource?.disconnect(); }catch(e){}
  try{ muteGain?.disconnect(); }catch(e){}
  try{ micStream?.getTracks()?.forEach(t=>t.stop()); }catch(e){}
  micStream=null;inputSource=null;processor=null;muteGain=null;
  if(inputCtx){ try{await inputCtx.close();}catch(e){} }
  inputCtx=null;
}

function routeContext(){
  let route=null;
  try{ route=window.VoiceAssistant?.routeContext?.()||null; }catch(e){}
  const pos=Array.isArray(window.App?.userPos)?window.App.userPos:null;
  let currentRoad='';
  try{ currentRoad=document.getElementById('currentRoadPill')?.textContent?.trim()||route?.currentRoad||''; }catch(e){}
  return {
    gps:pos&&pos.length>=2?{longitude:Number(pos[0]),latitude:Number(pos[1])}:null,
    destination:document.getElementById('destInput')?.value?.trim()||route?.destination||'',
    routeActive:Boolean(window.App?.route),
    currentRoad,
    route
  };
}

async function executeRadarCommand(command){
  const text=String(command||'').trim();
  if(!text) return {ok:false,error:'Comando vazio.'};
  if(!window.VoiceAssistant?.handle) return {ok:false,error:'Assistente local do Radar indisponível.'};
  let previousVoice=true;
  try{
    if(window.Voice){ previousVoice=Voice.enabled!==false; Voice.clear?.(); Voice.enabled=false; }
    await Promise.resolve(VoiceAssistant.handle(text));
    return {ok:true,command:text};
  }catch(error){
    console.warn('Gemini Live tool command',error);
    return {ok:false,error:String(error?.message||error).slice(0,180)};
  }finally{
    if(window.Voice) Voice.enabled=previousVoice;
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
  if(message?.setupComplete!==undefined){
    setupReady=true;
    setStatus(currentSource==='paid'?'Gemini Live • reserva paga':'Gemini Live • ouvindo');
    startMicrophone().then(()=>appToast('✨ Gemini Live está ouvindo.',2200)).catch(error=>{
      console.warn('Gemini Live microphone',error);
      appToast('Não consegui abrir o microfone. Confira a permissão do Chrome.',5000);
      stop();
    });
  }
  if(message?.toolCall) handleToolCall(message.toolCall);
  const content=message?.serverContent;
  if(content?.interrupted) stopOutput();
  const parts=content?.modelTurn?.parts||[];
  for(const part of parts){
    const inline=part?.inlineData||part?.inline_data;
    if(!inline?.data) continue;
    const mime=String(inline.mimeType||inline.mime_type||'audio/pcm;rate=24000');
    if(!/^audio\//i.test(mime)) continue;
    const rate=Number((mime.match(/rate=(\d+)/i)||[])[1])||24000;
    playPCMBase64(inline.data,rate).catch(e=>console.warn('Gemini Live audio',e));
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

async function cleanup({closeSocket=false}={}){
  setupReady=false;
  await stopMicrophone();
  stopOutput();
  if(closeSocket&&ws){
    try{ ws.onclose=null;ws.onerror=null;ws.onmessage=null;ws.close(1000,'user_stop'); }catch(e){}
  }
  ws=null;
}

async function start(tier='auto'){
  if(running||starting) return;
  starting=true;manualStop=false;
  setButtons(true);
  setStatus('Gemini Live • conectando…');
  try{
    try{ window.Voice?.clear?.(); }catch(e){}
    try{ window.VoiceAssistant?.stopHandsFree?.(false); }catch(e){}
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
          tools:[{functionDeclarations:[
            {
              name:'ler_contexto_radar',
              description:'Lê o contexto confiável do Radar: GPS, destino, rota ativa, via atual, distância restante e próxima manobra.',
              parameters:{type:'object',properties:{}}
            },
            {
              name:'executar_comando_radar',
              description:'Executa no aplicativo um comando do motorista relacionado a mapa, rota, destino, postos, comunidades, trânsito ou outras funções já suportadas pelo Radar. Use esta ferramenta antes de afirmar que a ação foi realizada.',
              parameters:{type:'object',properties:{comando:{type:'string',description:'Frase objetiva com a ação que o Radar deve executar.'}},required:['comando']}
            }
          ]}]
        }
      };
      send(setup);
    };
    ws.onmessage=event=>{
      try{ handleServerMessage(JSON.parse(event.data)); }
      catch(error){ console.warn('Gemini Live message',error); }
    };
    ws.onerror=error=>console.warn('Gemini Live WebSocket',error);
    ws.onclose=async event=>{
      const wasManual=manualStop;
      const shouldPaidFallback=!wasManual&&currentSource==='free'&&paidFallbackAvailable&&!paidFallbackTried&&quotaLikeClose(event);
      running=false;starting=false;
      await cleanup({closeSocket:false});
      if(shouldPaidFallback){
        paidFallbackTried=true;
        appToast('Cota gratuita encerrada. Mudando para a reserva paga…',4200);
        setTimeout(()=>start('paid'),500);
        return;
      }
      setButtons(false);
      setStatus('',false);
      if(!wasManual) appToast('Gemini Live foi desconectado. Toque no microfone para tentar novamente.',4500);
    };
  }catch(error){
    console.warn('Gemini Live start',error);
    running=false;starting=false;
    await cleanup({closeSocket:true});
    setButtons(false);
    setStatus('',false);
    if(Number(error?.status)===404) appToast('O servidor do Gemini Live ainda precisa ser publicado no Cloudflare.',5200);
    else if(Number(error?.status)===429) appToast('O limite do Gemini Live foi atingido agora.',4500);
    else appToast('Não consegui iniciar o Gemini Live agora.',4500);
  }
}

async function stop(){
  manualStop=true;
  running=false;starting=false;
  await cleanup({closeSocket:true});
  setButtons(false);
  setStatus('',false);
  appToast('Gemini Live encerrado.',1800);
}

function toggle(){
  if(running||starting) return stop();
  paidFallbackTried=false;
  return start('auto');
}

function intercept(event){
  const target=event.target?.closest?.(`#${MAIN_ID},#${NAV_ID}`);
  if(!target) return;
  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();
  toggle();
}

document.addEventListener('click',intercept,true);
window.addEventListener('pagehide',()=>{manualStop=true;cleanup({closeSocket:true});},{once:false});
ensureStyle();
setButtons(false);

window.RadarGeminiLiveV198={
  start,
  stop,
  toggle,
  status:()=>({running,starting,setupReady,source:currentSource,paidFallbackAvailable,model:MODEL,worker:WORKER})
};
})();
