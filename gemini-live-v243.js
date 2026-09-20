(()=>{
'use strict';

const TEST_MARK='GEMINI-LIVE-v205';
if(!String(window.__RADAR_TEST_ENV||'').includes(TEST_MARK)) return;

const MODEL='gemini-3.1-flash-live-preview';
const LIVE_WS='wss://radar-gemini-live-a5bf.claudio41cg.workers.dev/v1/live-ws';
const MAIN_ID='assistantMicBtn';
const NAV_ID='navAssistantMicBtn';
const SYSTEM_TEXT='Você é Radar, o copiloto de voz do Radar Seguro RJ Pro. Responda em português do Brasil, de forma curta, natural e direta. O usuário pode estar dirigindo. Para QUALQUER ação no aplicativo, mapa ou navegação — inclusive pedidos como me leva para, traça rota, iniciar rota, ir para casa ou trabalho — chame executar_comando_radar com a frase objetiva do motorista. Para consultar posição ou contexto da rota, chame ler_contexto_radar. Nunca diga que uma ação foi executada antes da resposta da ferramenta. Nunca invente localização, rota, trânsito, ocorrências ou fatos atuais.';

let ws=null,micStream=null,inputCtx=null,sourceNode=null,processor=null,sinkGain=null,outputCtx=null,outputCursor=0;
let running=false,starting=false,setupReady=false,micSending=false,manualStop=false,statusEl=null,detailEl=null,originalNavText='';
let clientId='',introAudioReceived=false,introTimer=null,setupTimer=null,stage='idle';
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
function toast(text,ms=4200){try{const a=appRef();if(a?.toast)return a.toast(text,ms)}catch(e){}console.log('[Gemini Live v205]',text)}
function safeText(v,max=900){const s=String(v??'').replace(/\s+/g,' ').trim();return s.length>max?s.slice(0,max)+'…':s}

function diag(step,data=''){try{if(step==='RAW GEMINI')return;let el=document.getElementById('geminiLiveDiagV233');if(!el){el=document.createElement('pre');el.id='geminiLiveDiagV233';Object.assign(el.style,{position:'fixed',left:'10px',right:'10px',bottom:'12px',zIndex:100000,maxHeight:'38vh',overflow:'auto',margin:'0',padding:'10px',borderRadius:'12px',background:'rgba(0,0,0,.88)',color:'#fff',font:'12px/1.35 monospace',whiteSpace:'pre-wrap',pointerEvents:'none'});document.body.appendChild(el)}const line=new Date().toLocaleTimeString('pt-BR')+' '+step+(data?' • '+safeText(typeof data==='string'?data:JSON.stringify(data),600):'');el.textContent=(el.textContent+'\n'+line).trim().split('\n').slice(-18).join('\n')}catch(e){}}

const toolDiagV238={messages:0,toolCall:false,functionCall:false,lastTool:'nenhuma',audioAfterCommand:false,lastCommandAt:0,command:'—',destination:'—',search:'AGUARDANDO',gps:'AGUARDANDO',route:'AGUARDANDO',navigation:'AGUARDANDO',toolResponse:'AGUARDANDO',error:'—'};
function stickyDiagV238(){
  try{
    let el=document.getElementById('geminiStickyDiagV238');
    if(!el){
      el=document.createElement('pre');el.id='geminiStickyDiagV238';
      Object.assign(el.style,{position:'fixed',left:'10px',right:'10px',bottom:'12px',zIndex:100001,margin:'0',padding:'12px',borderRadius:'12px',background:'rgba(0,0,0,.9)',color:'#fff',font:'700 13px/1.45 monospace',whiteSpace:'pre-wrap',pointerEvents:'none'});
      document.body.appendChild(el);
    }
    el.textContent='DIAGNÓSTICO ROTA GEMINI V243\nTOOL CALL: '+(toolDiagV238.toolCall?'OK':'AGUARDANDO')+'\nCOMANDO: '+toolDiagV238.command+'\nDESTINO EXTRAÍDO: '+toolDiagV238.destination+'\nBUSCA TOMTOM: '+toolDiagV238.search+'\nGPS: '+toolDiagV238.gps+'\nROTA: '+toolDiagV238.route+'\nNAVEGAÇÃO: '+toolDiagV238.navigation+'\nTOOL RESPONSE: '+toolDiagV238.toolResponse+'\nERRO: '+toolDiagV238.error;
  }catch(e){}
}

function ensureUI(){
  if(!document.getElementById('geminiLiveV205Style')){
    const s=document.createElement('style');s.id='geminiLiveV205Style';
    s.textContent=`#${MAIN_ID}.gemini-live-active{background:#0b5d3b!important;color:#effff6!important;box-shadow:0 0 0 3px rgba(71,255,153,.25),0 0 22px rgba(71,255,153,.55)!important;animation:livePulse205 1.25s ease-in-out infinite}#${NAV_ID}.gemini-live-active{background:#0b5d3b!important;color:#effff6!important}#geminiLiveStatusV205{position:fixed;right:12px;top:118px;z-index:99999;padding:8px 11px;border-radius:999px;background:rgba(4,24,18,.95);border:1px solid rgba(103,255,178,.45);color:#ecfff4;font:700 11px/1.2 Arial,sans-serif;display:none;max-width:86vw;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;box-shadow:0 6px 22px rgba(0,0,0,.35)}#geminiLiveStatusV205.on{display:block}#geminiLiveDetailV205{position:fixed;left:12px;right:12px;bottom:88px;z-index:99999;padding:11px 12px;border-radius:12px;background:rgba(25,10,10,.97);border:1px solid rgba(255,120,120,.55);color:#fff;font:700 12px/1.4 Arial,sans-serif;display:none;box-shadow:0 8px 28px rgba(0,0,0,.42);white-space:pre-wrap;word-break:break-word;max-height:34vh;overflow:auto}#geminiLiveDetailV205.on{display:block}@keyframes livePulse205{0%,100%{transform:scale(1)}50%{transform:scale(1.045)}}`;
    document.head.appendChild(s);
  }
  if(!statusEl?.isConnected){statusEl=document.createElement('div');statusEl.id='geminiLiveStatusV205';statusEl.setAttribute('role','status');document.body.appendChild(statusEl)}
  if(!detailEl?.isConnected){detailEl=document.createElement('div');detailEl.id='geminiLiveDetailV205';document.body.appendChild(detailEl)}
}
function setStatus(text,on=true){ensureUI();statusEl.textContent=String(text||'');statusEl.classList.toggle('on',Boolean(on&&text))}
function showDetail(text,timeout=60000){ensureUI();detailEl.textContent=String(text||'');detailEl.classList.toggle('on',Boolean(text));if(text&&timeout>0)setTimeout(()=>{if(detailEl?.textContent===text)detailEl.classList.remove('on')},timeout)}
function setButtons(active){const main=document.getElementById(MAIN_ID),nav=document.getElementById(NAV_ID);if(main){main.classList.toggle('gemini-live-active',active);main.setAttribute('aria-pressed',active?'true':'false')}if(nav){if(!originalNavText)originalNavText=nav.textContent||'🎙️ Radar';nav.classList.toggle('gemini-live-active',active);nav.textContent=active?'✨ Live':originalNavText}}

function bytesToBase64(buffer){const b=new Uint8Array(buffer);let out='';for(let i=0;i<b.length;i+=0x8000)out+=String.fromCharCode(...b.subarray(i,Math.min(i+0x8000,b.length)));return btoa(out)}
function base64ToBytes(v){const s=atob(String(v||'')),b=new Uint8Array(s.length);for(let i=0;i<s.length;i++)b[i]=s.charCodeAt(i);return b}
function toPCM16(input,inputRate,targetRate=16000){if(!input?.length)return new ArrayBuffer(0);const ratio=Math.max(1,inputRate/targetRate),len=Math.max(1,Math.floor(input.length/ratio)),out=new Int16Array(len);for(let i=0;i<len;i++){const a=Math.floor(i*ratio),z=Math.min(input.length,Math.max(a+1,Math.floor((i+1)*ratio)));let sum=0;for(let j=a;j<z;j++)sum+=input[j];let x=Math.max(-1,Math.min(1,sum/Math.max(1,z-a)));out[i]=x<0?Math.round(x*32768):Math.round(x*32767)}return out.buffer}

async function prepareOutput(){const C=window.AudioContext||window.webkitAudioContext;if(!C)throw new Error('AudioContext indisponível');if(!outputCtx||outputCtx.state==='closed')outputCtx=new C();if(outputCtx.state==='suspended')await outputCtx.resume();outputCursor=Math.max(outputCursor,outputCtx.currentTime)}
function stopOutput(){for(const n of [...outputSources]){try{n.stop()}catch(e){}}outputSources.clear();if(outputCtx)outputCursor=outputCtx.currentTime}
async function playAudio(b64,rate=24000){await prepareOutput();const bytes=base64ToBytes(b64),count=Math.floor(bytes.byteLength/2);if(!count)return;const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),samples=new Float32Array(count);for(let i=0;i<count;i++)samples[i]=view.getInt16(i*2,true)/32768;const buf=outputCtx.createBuffer(1,count,rate);buf.copyToChannel(samples,0);const n=outputCtx.createBufferSource();n.buffer=buf;n.connect(outputCtx.destination);const when=Math.max(outputCtx.currentTime+.02,outputCursor);outputCursor=when+buf.duration;outputSources.add(n);n.onended=()=>outputSources.delete(n);n.start(when);introAudioReceived=true;setStatus('Radar • falando…')}

async function prepareMic(){if(micStream&&processor)return;if(!navigator.mediaDevices?.getUserMedia)throw new Error('Microfone não suportado');micStream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true,channelCount:1},video:false});const C=window.AudioContext||window.webkitAudioContext;if(!C)throw new Error('AudioContext indisponível');inputCtx=new C();if(inputCtx.state==='suspended')await inputCtx.resume();sourceNode=inputCtx.createMediaStreamSource(micStream);processor=inputCtx.createScriptProcessor(4096,1,1);sinkGain=inputCtx.createGain();sinkGain.gain.value=0;sourceNode.connect(processor);processor.connect(sinkGain);sinkGain.connect(inputCtx.destination);processor.onaudioprocess=e=>{if(!micSending||!running||!setupReady||ws?.readyState!==WebSocket.OPEN)return;const raw=e.inputBuffer.getChannelData(0),chunk=toPCM16(raw,inputCtx.sampleRate,16000);if(!chunk.byteLength)return;send({realtimeInput:{audio:{data:bytesToBase64(chunk),mimeType:'audio/pcm;rate=16000'}}})}}
async function stopMic(){try{if(processor){processor.onaudioprocess=null;processor.disconnect()}}catch(e){}try{sourceNode?.disconnect()}catch(e){}try{sinkGain?.disconnect()}catch(e){}try{micStream?.getTracks()?.forEach(t=>t.stop())}catch(e){}processor=null;sourceNode=null;sinkGain=null;micStream=null;micSending=false;if(inputCtx){try{await inputCtx.close()}catch(e){}}inputCtx=null}

function send(obj){if(ws?.readyState===WebSocket.OPEN){ws.send(JSON.stringify(obj));return true}return false}
async function readMessageData(data){if(typeof data==='string')return data;if(data instanceof Blob)return await data.text();if(data instanceof ArrayBuffer)return new TextDecoder().decode(data);if(ArrayBuffer.isView(data))return new TextDecoder().decode(data);return String(data??'')}

function proxyDiag(d){const s=String(d?.stage||'');if(!s)return;stage='proxy-'+s;if(s==='gemini-websocket-open')setStatus('Ponte • Gemini abriu…');else if(s==='setup-received-by-worker')setStatus('Ponte • configuração recebida…');else if(s==='client-message-queued')setStatus('Ponte • aguardando Gemini abrir…');else if(s==='client-message-forwarded')setStatus('Ponte • configuração enviada ao Gemini…');else if(s==='first-gemini-message-received')setStatus('Ponte • Gemini respondeu…');else if(s==='gemini-websocket-error')showDetail('DIAGNÓSTICO GEMINI LIVE v205\nA conexão Worker → Gemini disparou erro de WebSocket.',30000);else if(s==='gemini-websocket-close')showDetail(`DIAGNÓSTICO GEMINI LIVE v205\nGemini fechou a ponte • código ${d?.code||'sem código'}${d?.reason?' • '+d.reason:''}`,60000)}

function radarContext(){const a=appRef(),va=assistantRef();let route=null;try{route=va?.routeContext?.()||null}catch(e){}const pos=Array.isArray(a?.userPos)?a.userPos:null;return{gps:pos&&pos.length>=2?{longitude:Number(pos[0]),latitude:Number(pos[1])}:null,destination:document.getElementById('destInput')?.value?.trim()||route?.destination||'',routeActive:Boolean(a?.route),navigationActive:Boolean(a?.navActive),route};}
async function executeRadarCommand(command){
  const text=String(command||'').trim();
  toolDiagV238.lastCommandAt=Date.now();
  toolDiagV238.command=text||'—';
  toolDiagV238.destination='—';
  toolDiagV238.search='FLUXO ORIGINAL';
  toolDiagV238.gps='FLUXO ORIGINAL';
  toolDiagV238.route='AGUARDANDO';
  toolDiagV238.navigation='AGUARDANDO';
  toolDiagV238.toolResponse='AGUARDANDO';
  toolDiagV238.error='—';
  stickyDiagV238();
  if(!text){toolDiagV238.error='Comando vazio';stickyDiagV238();return{ok:false,error:'Comando vazio'}}
  const m=text.match(/(?:me\s+leve|me\s+leva|leve(?:-|\s)?me|navegue|quero\s+ir|ir|vá|va|bora|vamos|vamo|trace(?:\s+uma)?\s+rota)(?:\s+(?:para|pra|pro|até|ate|em))?\s+(.+)/i);
  const destination=String(m?.[1]||text).replace(/[.!?]+$/,'').trim();
  toolDiagV238.destination=destination||'—';stickyDiagV238();
  const va=window.VoiceAssistant;
  const app=appRef();
  if(typeof va?.routeTo!=='function'){toolDiagV238.error='VoiceAssistant.routeTo indisponível';stickyDiagV238();return{ok:false,error:'Fluxo original de rota indisponivel'}}
  try{
    diag('ROUTE TO ORIGINAL',destination);
    await va.routeTo(destination);
    const routeDeadline=Date.now()+12000;
    while(!app?.route && Date.now()<routeDeadline){
      await new Promise(resolve=>setTimeout(resolve,250));
    }
    toolDiagV238.route=app?.route?'OK':'NÃO';
    toolDiagV238.navigation=app?.navActive?'OK':'NÃO';
    if(!app?.route)toolDiagV238.error='Rota não ficou disponível após aguardar o cálculo';
    else if(!app?.navActive)toolDiagV238.error='Rota criada; aguardando início da navegação';
    else toolDiagV238.error='—';
    stickyDiagV238();
    return{ok:Boolean(app?.route),destination,routeActive:Boolean(app?.route),navigationActive:Boolean(app?.navActive)};
  }catch(e){
    toolDiagV238.error=safeText(e?.message||e,180);stickyDiagV238();
    return{ok:false,error:safeText(e?.message||e,180),destination};
  }
}
async function handleToolCall(tc){diag('TOOL CALL RECEBIDO',tc);const calls=tc?.functionCalls||tc?.function_calls||[];if(!calls.length)return;const responses=[];for(const call of calls){const name=String(call?.name||'').trim(),id=call?.id||call?.callId;try{let args=call?.args??call?.arguments??{};if(typeof args==='string'){try{args=JSON.parse(args)}catch(_){args={comando:args}}}const command=String(args?.comando??args?.command??'').trim();toolDiagV238.lastTool=name||'sem nome';toolDiagV238.command=command||'—';stickyDiagV238();let result;if(name==='ler_contexto_radar')result={ok:true,context:radarContext()};else if(name==='executar_comando_radar'){if(!command){toolDiagV238.error='Tool chegou sem argumento comando';stickyDiagV238();result={ok:false,error:'Comando ausente na ferramenta'}}else result=await executeRadarCommand(command)}else{toolDiagV238.error='Ferramenta não reconhecida: '+name;stickyDiagV238();result=await window.RadarAiToolsV224?.execute?.(name,args||{})}responses.push({id,name,response:{result:result??null}})}catch(e){toolDiagV238.error=String(e?.message||e);stickyDiagV238();responses.push({id,name,response:{error:String(e?.message||e)}})}}if(responses.length){diag('FUNCTION RESPONSE',responses);const sent=send({toolResponse:{functionResponses:responses}});toolDiagV238.toolResponse=sent?'OK':'ERRO';if(!sent)toolDiagV238.error='WebSocket não enviou toolResponse';stickyDiagV238();}}
function handleServerMessage(m){
  if(m?.__radarProxy){proxyDiag(m.__radarProxy);return}
  if(m?.setupComplete!==undefined){clearTimeout(setupTimer);stage='ready';setupReady=true;setStatus('Gemini Live • conectado');toast('✨ Gemini Live conectado.',1800);send({clientContent:{turns:[{role:'user',parts:[{text:'Diga apenas em português: Radar conectado e ouvindo.'}]}],turnComplete:true}});clearTimeout(introTimer);introTimer=setTimeout(()=>{if(running&&!introAudioReceived){micSending=true;setStatus('Gemini Live • ouvindo');showDetail('A sessão Live conectou, mas a fala inicial não chegou. O microfone foi liberado.',15000)}},5000);return}
  if(m?.goAway){setStatus('Gemini Live • servidor vai reconectar');return} if(m?.toolCall){diag('GEMINI PEDIU FERRAMENTA',m.toolCall);handleToolCall(m.toolCall).catch(e=>{diag('ERRO TOOL',e?.message||e);console.warn('Gemini Live tool',e)});return}
  if(m?.serverContent?.interrupted)stopOutput();
  const parts=m?.serverContent?.modelTurn?.parts||[];for(const p of parts){const inline=p?.inlineData||p?.inline_data;if(!inline?.data)continue;const mime=String(inline.mimeType||inline.mime_type||'audio/pcm;rate=24000');if(!/^audio\//i.test(mime))continue;const rate=Number((mime.match(/rate=(\d+)/i)||[])[1])||24000;playAudio(inline.data,rate).catch(e=>console.warn('Gemini Live v205 output',e))}
  if(m?.serverContent?.turnComplete){if(introAudioReceived&&!micSending){micSending=true;setStatus('Gemini Live • ouvindo');toast('Pode falar com o Radar.',1800)}else if(micSending)setStatus('Gemini Live • ouvindo')}
}

async function cleanup(closeSocket=false){clearTimeout(introTimer);clearTimeout(setupTimer);introTimer=null;setupTimer=null;setupReady=false;running=false;starting=false;micSending=false;if(closeSocket&&ws){try{ws.onclose=null;ws.onerror=null;ws.onmessage=null;ws.close(1000,'user_stop')}catch(e){}}ws=null;await stopMic();stopOutput();setButtons(false)}

async function start(){if(running||starting)return;stage='start';starting=true;manualStop=false;introAudioReceived=false;setButtons(true);showDetail('');setStatus('Gemini Live • preparando áudio…');try{try{const v=voiceRef();if(v){v.clear?.();v.enabled=false}if('speechSynthesis' in window)speechSynthesis.cancel();diag('VOZ LOCAL BLOQUEADA','Voice.enabled=false + speechSynthesis.cancel')}catch(e){diag('ERRO BLOQUEIO VOZ',e?.message||e)}try{const va=assistantRef();va?.stopHandsFree?.(false);va?.cancelFollowUpWindow?.();va?.releaseMicrophone?.();if(va?.recognition){try{va.recognition.abort()}catch(_){}}diag('ASSISTENTE LOCAL BLOQUEADO','reconhecimento local abortado')}catch(e){diag('ERRO BLOQUEIO ASSISTENTE',e?.message||e)}stage='audio';await Promise.all([prepareOutput(),prepareMic()]);stage='worker-websocket';setStatus('Gemini Live • abrindo ponte segura…');const join=LIVE_WS+'?client='+encodeURIComponent(clientId)+'&v=205';ws=new WebSocket(join);ws.onopen=()=>{stage='browser-websocket-open';running=true;starting=false;setStatus('Gemini Live • enviando configuração…');const toolDecl=[{name:'ler_contexto_radar',description:'Le o contexto atual e confiavel do Radar: GPS, destino e estado da navegacao.',parameters:{type:'object',properties:{}}},{name:'executar_comando_radar',description:'Executa no proprio Radar Seguro um comando do motorista sobre mapa, busca, destino ou navegacao. Use para pedidos de ir ou levar para algum lugar.',parameters:{type:'object',properties:{comando:{type:'string',description:'Frase objetiva que o Radar deve executar, por exemplo: me leva para o Maracana'}},required:['comando']}}];send({setup:{model:`models/${MODEL}`,generationConfig:{responseModalities:['AUDIO']},systemInstruction:{parts:[{text:SYSTEM_TEXT}]},tools:[{functionDeclarations:toolDecl}]}});setupTimer=setTimeout(()=>{if(running&&!setupReady){setStatus('Gemini Live • aguardando confirmação…');showDetail(`DIAGNÓSTICO GEMINI LIVE v205\nEtapa atual: ${stage}\nA ponte do celular está aberta, mas ainda não chegou setupComplete. Veja a etapa mostrada acima para saber até onde a mensagem avançou.`,0)}},7000)};ws.onmessage=async e=>{try{
  const text=await readMessageData(e.data);
  const parsed=JSON.parse(text);
  toolDiagV238.messages++;
  const summary={
    keys:Object.keys(parsed||{}),
    hasToolCall:Boolean(parsed?.toolCall),
    hasServerContent:Boolean(parsed?.serverContent),
    serverKeys:Object.keys(parsed?.serverContent||{}),
    partTypes:(parsed?.serverContent?.modelTurn?.parts||[]).map(p=>Object.keys(p||{}))
  };
  diag('RAW GEMINI',summary);
  if(parsed?.toolCall)diag('TOOLCALL RAIZ',parsed.toolCall);
  if(parsed?.serverContent?.toolCall)diag('TOOLCALL SERVERCONTENT',parsed.serverContent.toolCall);
  const partCalls=(parsed?.serverContent?.modelTurn?.parts||[]).map(p=>p?.functionCall||p?.function_call).filter(Boolean);
  if(parsed?.toolCall){
    toolDiagV238.toolCall=true;
    const calls=parsed.toolCall?.functionCalls||parsed.toolCall?.function_calls||[];
    if(calls.length)toolDiagV238.lastTool=calls[calls.length-1]?.name||'toolCall';
  }
  if(parsed?.serverContent?.toolCall){
    toolDiagV238.toolCall=true;
    const calls=parsed.serverContent.toolCall?.functionCalls||parsed.serverContent.toolCall?.function_calls||[];
    if(calls.length)toolDiagV238.lastTool=calls[calls.length-1]?.name||'toolCall';
  }
  if(partCalls.length){
    toolDiagV238.functionCall=true;
    toolDiagV238.lastTool=partCalls[partCalls.length-1]?.name||'functionCall';
    diag('FUNCTIONCALL PARTS',partCalls);
  }
  const audioParts=(parsed?.serverContent?.modelTurn?.parts||[]).filter(p=>Boolean((p?.inlineData||p?.inline_data)?.data));
  if(audioParts.length&&toolDiagV238.lastCommandAt)toolDiagV238.audioAfterCommand=true;
  stickyDiagV238();
  handleServerMessage(parsed);
}catch(err){console.warn('Gemini Live v237 diagnostic message',err,e.data)}};ws.onerror=e=>console.warn('Gemini Live v205 WebSocket',e);ws.onclose=async e=>{const manual=manualStop,code=Number(e?.code)||0,reason=String(e?.reason||'').trim(),closedAt=stage;await cleanup(false);if(!manual){const detail=`DIAGNÓSTICO GEMINI LIVE v205\nEtapa: ${closedAt}\nPonte WebSocket fechou • código ${code||'sem código'}${reason?' • '+reason:''}`;setStatus('Gemini Live • desconectado');showDetail(detail);toast('Gemini Live desconectou. Veja o diagnóstico.',7000)}else setStatus('',false)}}catch(e){const failedAt=stage;await cleanup(true);const denied=String(e?.name||'').toLowerCase().includes('notallowed');setStatus('',false);showDetail(denied?'DIAGNÓSTICO GEMINI LIVE v205\nPermita o microfone no Chrome e tente novamente.':`DIAGNÓSTICO GEMINI LIVE v205\nEtapa: ${failedAt}\n${safeText(e?.message||e,900)}`)}}

async function stop(){manualStop=true;stage='manual-stop';setStatus('Gemini Live • encerrando…');await cleanup(true);stage='idle';setStatus('',false)}
function toggle(){if(running||starting)stop();else start()}
function intercept(e){const t=e.target?.closest?.(`#${MAIN_ID},#${NAV_ID}`);if(!t)return;e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();toggle()}

document.addEventListener('click',intercept,true);window.addEventListener('pagehide',()=>{manualStop=true;cleanup(true)});ensureUI();setButtons(false);stickyDiagV238();window.RadarGeminiLiveV205={start,stop,toggle,get state(){return{running,starting,setupReady,micSending,introAudioReceived,stage,model:MODEL,wsState:ws?.readyState??-1}}};
})();