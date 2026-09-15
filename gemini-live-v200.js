(()=>{
'use strict';

const TEST_MARK='GEMINI-LIVE-v200';
if(!String(window.__RADAR_TEST_ENV||'').includes(TEST_MARK)) return;

const MODEL='gemini-3.1-flash-live-preview';
const DEFAULT_WORKER='https://radar-seguro-ia-rj.claudio41cg.workers.dev';
const WORKER=(window.RADAR_CONFIG?.AI_ENDPOINT||window.RADAR_CONFIG_V100?.AI_ENDPOINT||DEFAULT_WORKER).replace(/\/$/,'');
const WS_BASE='wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContentConstrained';
const MAIN_ID='assistantMicBtn';
const NAV_ID='navAssistantMicBtn';
const SYSTEM_PROMPT='Você é Radar, copiloto de voz do Radar Seguro RJ Pro. Fale sempre em português brasileiro, de forma curta, natural e amigável. O motorista pode estar dirigindo, então responda com poucas palavras quando possível. Nesta versão de teste, apenas converse; não diga que alterou rota, mapa ou configurações.';

let ws=null;
let micStream=null;
let inputCtx=null;
let sourceNode=null;
let processor=null;
let sinkGain=null;
let outputCtx=null;
let outputCursor=0;
let running=false;
let starting=false;
let setupReady=false;
let manualStop=false;
let statusEl=null;
let originalNavText='';
let clientId='';
let receivedAudio=false;
let receivedAnyAfterSetup=false;
let watchdog=null;
const outputSources=new Set();

try{
  clientId=localStorage.getItem('radarGeminiLiveClientId')||'';
  if(!/^[a-zA-Z0-9_-]{16,80}$/.test(clientId)){
    clientId='rdr_'+crypto.getRandomValues(new Uint32Array(4)).join('_');
    localStorage.setItem('radarGeminiLiveClientId',clientId);
  }
}catch(e){ clientId='radar_live_'+Date.now()+'_'+Math.random().toString(36).slice(2); }

function appRef(){try{return typeof App!=='undefined'?App:window.App}catch(e){return window.App}}
function assistantRef(){try{return typeof VoiceAssistant!=='undefined'?VoiceAssistant:window.VoiceAssistant}catch(e){return window.VoiceAssistant}}
function voiceRef(){try{return typeof Voice!=='undefined'?Voice:window.Voice}catch(e){return window.Voice}}
function toast(text,ms=3800){try{const a=appRef();if(a?.toast)return a.toast(text,ms)}catch(e){} console.log('[Gemini Live v200]',text)}

function ensureUI(){
  if(!document.getElementById('geminiLiveV200Style')){
    const s=document.createElement('style');
    s.id='geminiLiveV200Style';
    s.textContent=`#${MAIN_ID}.gemini-live-active{box-shadow:0 0 0 3px rgba(77,232,255,.3),0 0 24px rgba(77,232,255,.75)!important;background:#0a4052!important;color:#a9f7ff!important;animation:livePulse200 1.2s ease-in-out infinite}#${NAV_ID}.gemini-live-active{box-shadow:0 0 0 2px rgba(77,232,255,.3),0 0 18px rgba(77,232,255,.6)!important;background:#0a4052!important;color:#efffff!important}#geminiLiveStatusV200{position:fixed;right:12px;top:118px;z-index:99999;padding:8px 11px;border-radius:999px;background:rgba(3,18,30,.94);border:1px solid rgba(100,235,255,.45);color:#e8fdff;font:700 11px/1.2 Arial,sans-serif;box-shadow:0 6px 22px rgba(0,0,0,.35);display:none;max-width:82vw;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}#geminiLiveStatusV200.on{display:block}@keyframes livePulse200{0%,100%{transform:scale(1)}50%{transform:scale(1.045)}}`;
    document.head.appendChild(s);
  }
  if(!statusEl?.isConnected){statusEl=document.createElement('div');statusEl.id='geminiLiveStatusV200';statusEl.setAttribute('role','status');document.body.appendChild(statusEl)}
}
function setStatus(text,on=true){ensureUI();statusEl.textContent=String(text||'');statusEl.classList.toggle('on',Boolean(on&&text))}
function setButtons(active){
  const main=document.getElementById(MAIN_ID),nav=document.getElementById(NAV_ID);
  if(main){main.classList.toggle('gemini-live-active',active);main.setAttribute('aria-pressed',active?'true':'false');main.title=active?'Encerrar Gemini Live':'Falar com Gemini Live'}
  if(nav){if(!originalNavText)originalNavText=nav.textContent||'🎙️ Radar';nav.classList.toggle('gemini-live-active',active);nav.setAttribute('aria-pressed',active?'true':'false');nav.title=active?'Encerrar Gemini Live':'Falar com Gemini Live';nav.textContent=active?'✨ Live':originalNavText}
}

function bytesToBase64(buffer){const b=new Uint8Array(buffer);let out='';for(let i=0;i<b.length;i+=0x8000)out+=String.fromCharCode(...b.subarray(i,Math.min(i+0x8000,b.length)));return btoa(out)}
function base64ToBytes(v){const s=atob(String(v||'')),b=new Uint8Array(s.length);for(let i=0;i<s.length;i++)b[i]=s.charCodeAt(i);return b}
function pcm16(input,inputRate,targetRate=16000){
  if(!input?.length)return new ArrayBuffer(0);
  const ratio=Math.max(1,inputRate/targetRate),len=Math.max(1,Math.floor(input.length/ratio)),out=new Int16Array(len);
  for(let i=0;i<len;i++){
    const a=Math.floor(i*ratio),z=Math.min(input.length,Math.max(a+1,Math.floor((i+1)*ratio)));let sum=0;
    for(let j=a;j<z;j++)sum+=input[j];let x=Math.max(-1,Math.min(1,sum/Math.max(1,z-a)));
    out[i]=x<0?Math.round(x*32768):Math.round(x*32767);
  }
  return out.buffer;
}

async function unlockOutput(){
  const C=window.AudioContext||window.webkitAudioContext;if(!C)throw new Error('audio_context_unsupported');
  if(!outputCtx||outputCtx.state==='closed')outputCtx=new C();
  if(outputCtx.state==='suspended')await outputCtx.resume();
  outputCursor=Math.max(outputCursor,outputCtx.currentTime);
}
function stopOutput(){for(const n of [...outputSources]){try{n.stop()}catch(e){}}outputSources.clear();if(outputCtx)outputCursor=outputCtx.currentTime}
async function playAudio(b64,rate=24000){
  await unlockOutput();const bytes=base64ToBytes(b64),count=Math.floor(bytes.byteLength/2);if(!count)return;
  const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),samples=new Float32Array(count);
  for(let i=0;i<count;i++)samples[i]=view.getInt16(i*2,true)/32768;
  const buf=outputCtx.createBuffer(1,count,rate);buf.copyToChannel(samples,0);
  const n=outputCtx.createBufferSource();n.buffer=buf;n.connect(outputCtx.destination);
  const when=Math.max(outputCtx.currentTime+.025,outputCursor);outputCursor=when+buf.duration;outputSources.add(n);n.onended=()=>outputSources.delete(n);n.start(when);
  receivedAudio=true;setStatus('Radar • falando…');
}

async function prepareMic(){
  if(micStream&&processor)return;
  if(!navigator.mediaDevices?.getUserMedia)throw new Error('microphone_unsupported');
  micStream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true,channelCount:1},video:false});
  const C=window.AudioContext||window.webkitAudioContext;if(!C)throw new Error('audio_context_unsupported');
  inputCtx=new C();if(inputCtx.state==='suspended')await inputCtx.resume();
  sourceNode=inputCtx.createMediaStreamSource(micStream);processor=inputCtx.createScriptProcessor(2048,1,1);sinkGain=inputCtx.createGain();sinkGain.gain.value=0;
  sourceNode.connect(processor);processor.connect(sinkGain);sinkGain.connect(inputCtx.destination);
  processor.onaudioprocess=e=>{
    if(!running||!setupReady||ws?.readyState!==WebSocket.OPEN)return;
    const data=e.inputBuffer.getChannelData(0),chunk=pcm16(data,inputCtx.sampleRate,16000);if(!chunk.byteLength)return;
    send({realtimeInput:{audio:{data:bytesToBase64(chunk),mimeType:'audio/pcm;rate=16000'}}});
  };
}
async function stopMic(){
  try{if(processor){processor.onaudioprocess=null;processor.disconnect()}}catch(e){}
  try{sourceNode?.disconnect()}catch(e){} try{sinkGain?.disconnect()}catch(e){} try{micStream?.getTracks()?.forEach(t=>t.stop())}catch(e){}
  processor=null;sourceNode=null;sinkGain=null;micStream=null;
  if(inputCtx){try{await inputCtx.close()}catch(e){}}inputCtx=null;
}

function send(obj){if(ws?.readyState===WebSocket.OPEN){ws.send(JSON.stringify(obj));return true}return false}
async function requestToken(){
  const r=await fetch(`${WORKER}/v1/live-token?tier=auto`,{method:'POST',headers:{'Content-Type':'application/json','X-Radar-Client':clientId},body:'{}',cache:'no-store'});
  let d={};try{d=await r.json()}catch(e){}
  if(!r.ok){const er=new Error(d?.error||`live_token_${r.status}`);er.status=r.status;throw er}return d;
}

function serverMessage(m){
  if(m?.setupComplete!==undefined){
    setupReady=true;receivedAnyAfterSetup=false;receivedAudio=false;
    setStatus('Gemini Live • conectado');toast('✨ Gemini Live conectado.',1800);
    send({realtimeInput:{text:'Diga apenas: Radar conectado e ouvindo.'}});
    clearTimeout(watchdog);watchdog=setTimeout(()=>{if(running&&!receivedAnyAfterSetup)setStatus('Gemini Live • conectado, aguardando áudio…')},4500);
    return;
  }
  receivedAnyAfterSetup=true;
  if(m?.serverContent?.interrupted)stopOutput();
  const parts=m?.serverContent?.modelTurn?.parts||[];
  for(const p of parts){const inline=p?.inlineData||p?.inline_data;if(!inline?.data)continue;const mime=String(inline.mimeType||inline.mime_type||'audio/pcm;rate=24000');if(!mime.startsWith('audio/'))continue;const rate=Number((mime.match(/rate=(\d+)/i)||[])[1])||24000;playAudio(inline.data,rate).catch(e=>console.warn('Gemini Live v200 output',e))}
  if(m?.serverContent?.turnComplete)setStatus('Gemini Live • ouvindo');
}

async function cleanup(closeSocket=false){
  clearTimeout(watchdog);watchdog=null;setupReady=false;running=false;starting=false;
  if(closeSocket&&ws){try{send({realtimeInput:{audioStreamEnd:true}})}catch(e){}try{ws.onclose=null;ws.onerror=null;ws.onmessage=null;ws.close(1000,'user_stop')}catch(e){}}
  ws=null;await stopMic();stopOutput();setButtons(false);
}

async function start(){
  if(running||starting)return;starting=true;manualStop=false;setButtons(true);setStatus('Gemini Live • abrindo microfone…');
  try{
    try{voiceRef()?.clear?.()}catch(e){} try{assistantRef()?.stopHandsFree?.(false)}catch(e){}
    await Promise.all([unlockOutput(),prepareMic()]);
    setStatus('Gemini Live • conectando…');
    const auth=await requestToken();if(!auth?.token)throw new Error('Token temporário não recebido.');
    ws=new WebSocket(`${WS_BASE}?access_token=${encodeURIComponent(auth.token)}`);
    ws.onopen=()=>{
      running=true;starting=false;setStatus('Gemini Live • configurando…');
      send({setup:{model:`models/${MODEL}`,generationConfig:{responseModalities:['AUDIO']},systemInstruction:{parts:[{text:SYSTEM_PROMPT}]}}});
    };
    ws.onmessage=e=>{try{serverMessage(JSON.parse(e.data))}catch(err){console.warn('Gemini Live v200 message',err)}};
    ws.onerror=e=>console.warn('Gemini Live v200 WebSocket',e);
    ws.onclose=async e=>{
      const manual=manualStop,code=Number(e?.code)||0,reason=String(e?.reason||'').trim();
      console.warn('Gemini Live v200 closed',{code,reason,wasClean:e?.wasClean,setupReady,receivedAnyAfterSetup,receivedAudio});
      await cleanup(false);
      if(!manual){const detail=`código ${code||'sem código'}${reason?' • '+reason:''}`;setStatus('Gemini Live • encerrou • '+detail);toast('Gemini Live encerrou: '+detail,6500)}else setStatus('',false);
    };
  }catch(e){
    console.warn('Gemini Live v200 start',e);await cleanup(true);const denied=String(e?.name||'').toLowerCase().includes('notallowed');
    setStatus('',false);toast(denied?'Permita o microfone no Chrome e tente novamente.':'Não consegui abrir o Gemini Live: '+String(e?.message||e).slice(0,130),6500);
  }
}
async function stop(){manualStop=true;setStatus('Gemini Live • encerrando…');await cleanup(true);setStatus('',false)}
function toggle(){if(running||starting)stop();else start()}
function intercept(e){const t=e.target?.closest?.(`#${MAIN_ID},#${NAV_ID}`);if(!t)return;e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();toggle()}

document.addEventListener('click',intercept,true);
window.addEventListener('pagehide',()=>{manualStop=true;cleanup(true)});
ensureUI();setButtons(false);
window.RadarGeminiLiveV200={start,stop,toggle,get state(){return{running,starting,setupReady,receivedAnyAfterSetup,receivedAudio,wsState:ws?.readyState??-1}}};
})();
