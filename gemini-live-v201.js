(()=>{
'use strict';

const TEST_MARK='GEMINI-LIVE-v201';
if(!String(window.__RADAR_TEST_ENV||'').includes(TEST_MARK)) return;

const MODEL='gemini-3.1-flash-live-preview';
const WORKER=(window.RADAR_CONFIG?.AI_ENDPOINT||window.RADAR_CONFIG_V100?.AI_ENDPOINT||'https://radar-seguro-ia-rj.claudio41cg.workers.dev').replace(/\/$/,'');
const WS_BASE='wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContentConstrained';
const MAIN_ID='assistantMicBtn';
const NAV_ID='navAssistantMicBtn';

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
let micSending=false;
let manualStop=false;
let statusEl=null;
let detailEl=null;
let originalNavText='';
let clientId='';
let introAudioReceived=false;
let introTimer=null;
const outputSources=new Set();

try{
  clientId=localStorage.getItem('radarGeminiLiveClientId')||'';
  if(!/^[a-zA-Z0-9_-]{16,80}$/.test(clientId)){
    clientId='rdr_'+crypto.getRandomValues(new Uint32Array(4)).join('_');
    localStorage.setItem('radarGeminiLiveClientId',clientId);
  }
}catch(e){clientId='rdr_'+Date.now()+'_'+Math.random().toString(36).slice(2)}

function appRef(){try{return typeof App!=='undefined'?App:window.App}catch(e){return window.App}}
function assistantRef(){try{return typeof VoiceAssistant!=='undefined'?VoiceAssistant:window.VoiceAssistant}catch(e){return window.VoiceAssistant}}
function voiceRef(){try{return typeof Voice!=='undefined'?Voice:window.Voice}catch(e){return window.Voice}}
function toast(text,ms=4200){try{const a=appRef();if(a?.toast)return a.toast(text,ms)}catch(e){}console.log('[Gemini Live v201]',text)}

function ensureUI(){
  if(!document.getElementById('geminiLiveV201Style')){
    const s=document.createElement('style');
    s.id='geminiLiveV201Style';
    s.textContent=`#${MAIN_ID}.gemini-live-active{background:#0b5d3b!important;color:#effff6!important;box-shadow:0 0 0 3px rgba(71,255,153,.25),0 0 22px rgba(71,255,153,.55)!important;animation:livePulse201 1.25s ease-in-out infinite}#${NAV_ID}.gemini-live-active{background:#0b5d3b!important;color:#effff6!important;box-shadow:0 0 0 2px rgba(71,255,153,.22),0 0 18px rgba(71,255,153,.45)!important}#geminiLiveStatusV201{position:fixed;right:12px;top:118px;z-index:99999;padding:8px 11px;border-radius:999px;background:rgba(4,24,18,.95);border:1px solid rgba(103,255,178,.45);color:#ecfff4;font:700 11px/1.2 Arial,sans-serif;display:none;max-width:82vw;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;box-shadow:0 6px 22px rgba(0,0,0,.35)}#geminiLiveStatusV201.on{display:block}#geminiLiveDetailV201{position:fixed;left:12px;right:12px;bottom:88px;z-index:99999;padding:10px 12px;border-radius:12px;background:rgba(25,10,10,.95);border:1px solid rgba(255,120,120,.45);color:#fff;font:700 12px/1.35 Arial,sans-serif;display:none;box-shadow:0 8px 28px rgba(0,0,0,.42)}#geminiLiveDetailV201.on{display:block}@keyframes livePulse201{0%,100%{transform:scale(1)}50%{transform:scale(1.045)}}`;
    document.head.appendChild(s);
  }
  if(!statusEl?.isConnected){statusEl=document.createElement('div');statusEl.id='geminiLiveStatusV201';statusEl.setAttribute('role','status');document.body.appendChild(statusEl)}
  if(!detailEl?.isConnected){detailEl=document.createElement('div');detailEl.id='geminiLiveDetailV201';document.body.appendChild(detailEl)}
}
function setStatus(text,on=true){ensureUI();statusEl.textContent=String(text||'');statusEl.classList.toggle('on',Boolean(on&&text))}
function showDetail(text){ensureUI();detailEl.textContent=String(text||'');detailEl.classList.toggle('on',Boolean(text));if(text)setTimeout(()=>{if(detailEl?.textContent===text)detailEl.classList.remove('on')},15000)}
function setButtons(active){
  const main=document.getElementById(MAIN_ID),nav=document.getElementById(NAV_ID);
  if(main){main.classList.toggle('gemini-live-active',active);main.setAttribute('aria-pressed',active?'true':'false');main.title=active?'Encerrar Gemini Live':'Falar com Gemini Live'}
  if(nav){if(!originalNavText)originalNavText=nav.textContent||'🎙️ Radar';nav.classList.toggle('gemini-live-active',active);nav.setAttribute('aria-pressed',active?'true':'false');nav.title=active?'Encerrar Gemini Live':'Falar com Gemini Live';nav.textContent=active?'✨ Live':originalNavText}
}

function bytesToBase64(buffer){const b=new Uint8Array(buffer);let out='';for(let i=0;i<b.length;i+=0x8000)out+=String.fromCharCode(...b.subarray(i,Math.min(i+0x8000,b.length)));return btoa(out)}
function base64ToBytes(v){const s=atob(String(v||'')),b=new Uint8Array(s.length);for(let i=0;i<s.length;i++)b[i]=s.charCodeAt(i);return b}
function toPCM16(input,inputRate,targetRate=16000){
  if(!input?.length)return new ArrayBuffer(0);
  const ratio=Math.max(1,inputRate/targetRate),len=Math.max(1,Math.floor(input.length/ratio)),out=new Int16Array(len);
  for(let i=0;i<len;i++){
    const a=Math.floor(i*ratio),z=Math.min(input.length,Math.max(a+1,Math.floor((i+1)*ratio)));let sum=0;
    for(let j=a;j<z;j++)sum+=input[j];let x=Math.max(-1,Math.min(1,sum/Math.max(1,z-a)));
    out[i]=x<0?Math.round(x*32768):Math.round(x*32767);
  }
  return out.buffer;
}

async function prepareOutput(){
  const C=window.AudioContext||window.webkitAudioContext;if(!C)throw new Error('AudioContext indisponível');
  if(!outputCtx||outputCtx.state==='closed')outputCtx=new C();
  if(outputCtx.state==='suspended')await outputCtx.resume();
  outputCursor=Math.max(outputCursor,outputCtx.currentTime);
}
function stopOutput(){for(const n of [...outputSources]){try{n.stop()}catch(e){}}outputSources.clear();if(outputCtx)outputCursor=outputCtx.currentTime}
async function playAudio(b64,rate=24000){
  await prepareOutput();
  const bytes=base64ToBytes(b64),count=Math.floor(bytes.byteLength/2);if(!count)return;
  const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),samples=new Float32Array(count);
  for(let i=0;i<count;i++)samples[i]=view.getInt16(i*2,true)/32768;
  const buf=outputCtx.createBuffer(1,count,rate);buf.copyToChannel(samples,0);
  const n=outputCtx.createBufferSource();n.buffer=buf;n.connect(outputCtx.destination);
  const when=Math.max(outputCtx.currentTime+.02,outputCursor);outputCursor=when+buf.duration;outputSources.add(n);n.onended=()=>outputSources.delete(n);n.start(when);
  introAudioReceived=true;setStatus('Radar • falando…');
}

async function prepareMic(){
  if(micStream&&processor)return;
  if(!navigator.mediaDevices?.getUserMedia)throw new Error('Microfone não suportado');
  micStream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true,channelCount:1},video:false});
  const C=window.AudioContext||window.webkitAudioContext;if(!C)throw new Error('AudioContext indisponível');
  inputCtx=new C();if(inputCtx.state==='suspended')await inputCtx.resume();
  sourceNode=inputCtx.createMediaStreamSource(micStream);processor=inputCtx.createScriptProcessor(4096,1,1);sinkGain=inputCtx.createGain();sinkGain.gain.value=0;
  sourceNode.connect(processor);processor.connect(sinkGain);sinkGain.connect(inputCtx.destination);
  processor.onaudioprocess=e=>{
    if(!micSending||!running||!setupReady||ws?.readyState!==WebSocket.OPEN)return;
    const raw=e.inputBuffer.getChannelData(0),chunk=toPCM16(raw,inputCtx.sampleRate,16000);if(!chunk.byteLength)return;
    send({realtimeInput:{audio:{data:bytesToBase64(chunk),mimeType:'audio/pcm;rate=16000'}}});
  };
}
async function stopMic(){
  try{if(processor){processor.onaudioprocess=null;processor.disconnect()}}catch(e){}
  try{sourceNode?.disconnect()}catch(e){}try{sinkGain?.disconnect()}catch(e){}try{micStream?.getTracks()?.forEach(t=>t.stop())}catch(e){}
  processor=null;sourceNode=null;sinkGain=null;micStream=null;micSending=false;
  if(inputCtx){try{await inputCtx.close()}catch(e){}}inputCtx=null;
}

function send(obj){if(ws?.readyState===WebSocket.OPEN){ws.send(JSON.stringify(obj));return true}return false}
async function requestToken(){
  const r=await fetch(`${WORKER}/v1/live-token?tier=auto`,{method:'POST',headers:{'Content-Type':'application/json','X-Radar-Client':clientId},body:'{}',cache:'no-store'});
  let d={};try{d=await r.json()}catch(e){}
  if(!r.ok){const er=new Error(d?.error||`live_token_${r.status}`);er.status=r.status;throw er}
  return d;
}

function handleServerMessage(m){
  if(m?.setupComplete!==undefined){
    setupReady=true;
    setStatus('Gemini Live • conectado');
    toast('✨ Gemini Live conectado.',1800);
    send({realtimeInput:{text:'Diga apenas em português: Radar conectado e ouvindo.'}});
    clearTimeout(introTimer);
    introTimer=setTimeout(()=>{
      if(running&&!introAudioReceived){micSending=true;setStatus('Gemini Live • pode falar');showDetail('A conexão ficou aberta, mas a fala inicial não chegou. O microfone foi liberado para teste.');}
    },5000);
    return;
  }
  if(m?.goAway){setStatus('Gemini Live • servidor vai reconectar');return}
  if(m?.serverContent?.interrupted)stopOutput();
  const parts=m?.serverContent?.modelTurn?.parts||[];
  for(const p of parts){
    const inline=p?.inlineData||p?.inline_data;if(!inline?.data)continue;
    const mime=String(inline.mimeType||inline.mime_type||'audio/pcm;rate=24000');if(!/^audio\//i.test(mime))continue;
    const rate=Number((mime.match(/rate=(\d+)/i)||[])[1])||24000;
    playAudio(inline.data,rate).catch(e=>console.warn('Gemini Live v201 output',e));
  }
  if(m?.serverContent?.turnComplete){
    if(introAudioReceived&&!micSending){micSending=true;setStatus('Gemini Live • ouvindo');toast('Pode falar com o Radar.',1800)}
    else if(micSending)setStatus('Gemini Live • ouvindo');
  }
}

async function cleanup(closeSocket=false){
  clearTimeout(introTimer);introTimer=null;setupReady=false;running=false;starting=false;micSending=false;
  if(closeSocket&&ws){try{ws.onclose=null;ws.onerror=null;ws.onmessage=null;ws.close(1000,'user_stop')}catch(e){}}
  ws=null;await stopMic();stopOutput();setButtons(false);
}

async function start(){
  if(running||starting)return;
  starting=true;manualStop=false;introAudioReceived=false;setButtons(true);showDetail('');setStatus('Gemini Live • preparando áudio…');
  try{
    try{voiceRef()?.clear?.()}catch(e){}try{assistantRef()?.stopHandsFree?.(false)}catch(e){}
    await Promise.all([prepareOutput(),prepareMic()]);
    setStatus('Gemini Live • conectando…');
    const auth=await requestToken();if(!auth?.token)throw new Error('Token temporário não recebido');
    ws=new WebSocket(`${WS_BASE}?access_token=${encodeURIComponent(auth.token)}`);
    ws.onopen=()=>{
      running=true;starting=false;setStatus('Gemini Live • configurando…');
      send({setup:{model:`models/${MODEL}`,responseModalities:['AUDIO']}});
    };
    ws.onmessage=e=>{try{handleServerMessage(JSON.parse(e.data))}catch(err){console.warn('Gemini Live v201 message',err)}};
    ws.onerror=e=>console.warn('Gemini Live v201 WebSocket',e);
    ws.onclose=async e=>{
      const manual=manualStop,code=Number(e?.code)||0,reason=String(e?.reason||'').trim();
      console.warn('Gemini Live v201 closed',{code,reason,setupReady,introAudioReceived,micSending});
      await cleanup(false);
      if(!manual){
        const detail=`Gemini Live encerrou • código ${code||'sem código'}${reason?' • '+reason:''}`;
        setStatus('Gemini Live • desconectado');showDetail(detail);toast(detail,7000);
      }else setStatus('',false);
    };
  }catch(e){
    console.warn('Gemini Live v201 start',e);await cleanup(true);
    const denied=String(e?.name||'').toLowerCase().includes('notallowed');
    setStatus('',false);const msg=denied?'Permita o microfone no Chrome e tente novamente.':'Não consegui abrir o Gemini Live: '+String(e?.message||e).slice(0,150);showDetail(msg);toast(msg,7000);
  }
}
async function stop(){manualStop=true;setStatus('Gemini Live • encerrando…');await cleanup(true);setStatus('',false)}
function toggle(){if(running||starting)stop();else start()}
function intercept(e){const t=e.target?.closest?.(`#${MAIN_ID},#${NAV_ID}`);if(!t)return;e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();toggle()}

document.addEventListener('click',intercept,true);
window.addEventListener('pagehide',()=>{manualStop=true;cleanup(true)});
ensureUI();setButtons(false);
window.RadarGeminiLiveV201={start,stop,toggle,get state(){return{running,starting,setupReady,micSending,introAudioReceived,wsState:ws?.readyState??-1}}};
})();
