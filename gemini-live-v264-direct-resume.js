(()=>{
'use strict';

const TEST_MARK='GEMINI-DIRECT-v264';
if(!String(window.__RADAR_TEST_ENV||'').includes(TEST_MARK)) return;

const MODEL='models/gemini-3.1-flash-live-preview';
const TOKEN_ENDPOINT='https://radar-gemini-token-test.claudio41cg.workers.dev/v1/ephemeral-token';
const MAIN_ID='assistantMicBtn';
const NAV_ID='navAssistantMicBtn';
const RESUME_KEY='radarGeminiDirectV264ResumeHandle';
const ACTIVE_KEY='radarGeminiDirectV264ShouldResume';
const SYSTEM_TEXT='Você é Radar, o copiloto de voz do Radar Seguro RJ Pro. Responda em português do Brasil, de forma curta, natural e direta. O usuário pode estar dirigindo. Para qualquer pedido ligado ao aplicativo — criar rota, dizer onde o motorista está, informar quanto falta, procurar lugar perto do destino ou cancelar a rota — chame sempre executar_comando_radar passando a frase completa do motorista em comando. Nunca diga que uma ação aconteceu antes da resposta da ferramenta. Nunca invente localização, rota, distância, tempo, estabelecimentos, trânsito, ocorrências ou fatos atuais.';

let ws=null,micStream=null,inputCtx=null,sourceNode=null,processor=null,sinkGain=null,outputCtx=null,outputCursor=0;
let running=false,starting=false,reconnecting=false,setupReady=false,micSending=false,manualStop=false,userStarted=false,resumedConnection=false;
let resumeHandle='',statusEl=null,detailEl=null,originalNavText='',hiddenAt=0,introAudioReceived=false,introTimer=null;
const outputSources=new Set();

try{
  resumeHandle=localStorage.getItem(RESUME_KEY)||'';
  userStarted=localStorage.getItem(ACTIVE_KEY)==='1';
}catch(_){}

function appRef(){try{return window.RadarApp||window.App||(typeof App!=='undefined'?App:null)}catch(_){return window.RadarApp||window.App||null}}
function assistantRef(){try{return typeof VoiceAssistant!=='undefined'?VoiceAssistant:window.VoiceAssistant}catch(_){return window.VoiceAssistant}}
function voiceRef(){try{return typeof Voice!=='undefined'?Voice:window.Voice}catch(_){return window.Voice}}
function toast(text,ms=3500){try{const a=appRef();if(a?.toast)return a.toast(text,ms)}catch(_){}console.log('[Gemini Direct v264]',text)}

function ensureUI(){
  if(!document.getElementById('geminiDirectV264Style')){
    const s=document.createElement('style');s.id='geminiDirectV264Style';
    s.textContent=`#${MAIN_ID}.gemini-live-active{background:#0b5d3b!important;color:#effff6!important;box-shadow:0 0 0 3px rgba(71,255,153,.25),0 0 22px rgba(71,255,153,.55)!important;animation:livePulse264 1.25s ease-in-out infinite}#${NAV_ID}.gemini-live-active{background:#0b5d3b!important;color:#effff6!important}#geminiDirectStatusV264{position:fixed;right:12px;top:118px;z-index:99999;padding:8px 11px;border-radius:999px;background:rgba(4,24,18,.95);border:1px solid rgba(103,255,178,.45);color:#ecfff4;font:700 11px/1.2 Arial,sans-serif;display:none;max-width:86vw;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;box-shadow:0 6px 22px rgba(0,0,0,.35)}#geminiDirectStatusV264.on{display:block}#geminiDirectDetailV264{position:fixed;left:12px;right:12px;bottom:88px;z-index:99999;padding:11px 12px;border-radius:12px;background:rgba(8,29,23,.97);border:1px solid rgba(103,255,178,.4);color:#fff;font:700 12px/1.4 Arial,sans-serif;display:none;box-shadow:0 8px 28px rgba(0,0,0,.42);white-space:pre-wrap;word-break:break-word;max-height:34vh;overflow:auto}@keyframes livePulse264{0%,100%{transform:scale(1)}50%{transform:scale(1.045)}}`;
    document.head.appendChild(s);
  }
  if(!statusEl?.isConnected){statusEl=document.createElement('div');statusEl.id='geminiDirectStatusV264';statusEl.setAttribute('role','status');document.body.appendChild(statusEl)}
  if(!detailEl?.isConnected){detailEl=document.createElement('div');detailEl.id='geminiDirectDetailV264';document.body.appendChild(detailEl)}
}
function setStatus(text,on=true){ensureUI();statusEl.textContent=String(text||'');statusEl.classList.toggle('on',Boolean(on&&text))}
function showDetail(text,timeout=7000){ensureUI();detailEl.textContent=String(text||'');detailEl.style.display=text?'block':'none';if(text&&timeout>0)setTimeout(()=>{if(detailEl?.textContent===text)detailEl.style.display='none'},timeout)}
function setButtons(active){const main=document.getElementById(MAIN_ID),nav=document.getElementById(NAV_ID);if(main){main.classList.toggle('gemini-live-active',active);main.setAttribute('aria-pressed',active?'true':'false')}if(nav){if(!originalNavText)originalNavText=nav.textContent||'🎙️ Radar';nav.classList.toggle('gemini-live-active',active);nav.textContent=active?'✨ Live':originalNavText}}

function saveResumeHandle(handle){if(!handle)return;resumeHandle=String(handle);try{localStorage.setItem(RESUME_KEY,resumeHandle)}catch(_){}}
function saveActive(active){userStarted=Boolean(active);try{active?localStorage.setItem(ACTIVE_KEY,'1'):localStorage.removeItem(ACTIVE_KEY)}catch(_){}}

function bytesToBase64(buffer){const b=new Uint8Array(buffer);let out='';for(let i=0;i<b.length;i+=0x8000)out+=String.fromCharCode(...b.subarray(i,Math.min(i+0x8000,b.length)));return btoa(out)}
function base64ToBytes(v){const s=atob(String(v||'')),b=new Uint8Array(s.length);for(let i=0;i<s.length;i++)b[i]=s.charCodeAt(i);return b}
function toPCM16(input,inputRate,targetRate=16000){if(!input?.length)return new ArrayBuffer(0);const ratio=Math.max(1,inputRate/targetRate),len=Math.max(1,Math.floor(input.length/ratio)),out=new Int16Array(len);for(let i=0;i<len;i++){const a=Math.floor(i*ratio),z=Math.min(input.length,Math.max(a+1,Math.floor((i+1)*ratio)));let sum=0;for(let j=a;j<z;j++)sum+=input[j];let x=Math.max(-1,Math.min(1,sum/Math.max(1,z-a)));out[i]=x<0?Math.round(x*32768):Math.round(x*32767)}return out.buffer}

async function prepareOutput(){const C=window.AudioContext||window.webkitAudioContext;if(!C)throw new Error('AudioContext indisponível');if(!outputCtx||outputCtx.state==='closed')outputCtx=new C();if(outputCtx.state==='suspended')await outputCtx.resume();outputCursor=Math.max(outputCursor,outputCtx.currentTime)}
function stopOutput(){for(const n of [...outputSources]){try{n.stop()}catch(_){}}outputSources.clear();if(outputCtx)outputCursor=outputCtx.currentTime}
async function playAudio(b64,rate=24000){await prepareOutput();const bytes=base64ToBytes(b64),count=Math.floor(bytes.byteLength/2);if(!count)return;const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),samples=new Float32Array(count);for(let i=0;i<count;i++)samples[i]=view.getInt16(i*2,true)/32768;const buf=outputCtx.createBuffer(1,count,rate);buf.copyToChannel(samples,0);const n=outputCtx.createBufferSource();n.buffer=buf;n.connect(outputCtx.destination);const when=Math.max(outputCtx.currentTime+.02,outputCursor);outputCursor=when+buf.duration;outputSources.add(n);n.onended=()=>outputSources.delete(n);n.start(when);introAudioReceived=true;setStatus('Radar • falando…')}

async function prepareMic(){if(micStream&&processor)return;if(!navigator.mediaDevices?.getUserMedia)throw new Error('Microfone não suportado');micStream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true,channelCount:1},video:false});const C=window.AudioContext||window.webkitAudioContext;if(!C)throw new Error('AudioContext indisponível');inputCtx=new C();if(inputCtx.state==='suspended')await inputCtx.resume();sourceNode=inputCtx.createMediaStreamSource(micStream);processor=inputCtx.createScriptProcessor(4096,1,1);sinkGain=inputCtx.createGain();sinkGain.gain.value=0;sourceNode.connect(processor);processor.connect(sinkGain);sinkGain.connect(inputCtx.destination);processor.onaudioprocess=e=>{if(!micSending||!running||!setupReady||ws?.readyState!==WebSocket.OPEN)return;const raw=e.inputBuffer.getChannelData(0),chunk=toPCM16(raw,inputCtx.sampleRate,16000);if(!chunk.byteLength)return;send({realtimeInput:{audio:{data:bytesToBase64(chunk),mimeType:'audio/pcm;rate=16000'}}})}}
async function stopMic(){try{if(processor){processor.onaudioprocess=null;processor.disconnect()}}catch(_){}try{sourceNode?.disconnect()}catch(_){}try{sinkGain?.disconnect()}catch(_){}try{micStream?.getTracks()?.forEach(t=>t.stop())}catch(_){}processor=null;sourceNode=null;sinkGain=null;micStream=null;micSending=false;if(inputCtx){try{await inputCtx.close()}catch(_){}}inputCtx=null}

function send(obj){if(ws?.readyState===WebSocket.OPEN){ws.send(JSON.stringify(obj));return true}return false}
async function readMessageData(data){if(typeof data==='string')return data;if(data instanceof Blob)return await data.text();if(data instanceof ArrayBuffer)return new TextDecoder().decode(data);if(ArrayBuffer.isView(data))return new TextDecoder().decode(data.buffer,data.byteOffset,data.byteLength);return String(data??'')}

async function getToken(){const r=await fetch(TOKEN_ENDPOINT,{method:'POST',headers:{'Content-Type':'application/json'},body:'{}',cache:'no-store'});let d=null;try{d=await r.json()}catch(_){}if(!r.ok||!d?.ok||!d?.token||!d?.websocket)throw new Error('Falha ao obter token temporário'+(d?.detail?' • '+d.detail:''));return d}


async function searchNearPoint(query,lon,lat,label){
  const q=String(query||'').trim();
  if(!q)return {ok:false,error:'Categoria vazia'};
  if(!Number.isFinite(+lon)||!Number.isFinite(+lat))return {ok:false,error:'Coordenadas indisponíveis'};
  const va=assistantRef();
  const base=String(va?.aiEndpoint||'https://radar-seguro-ia-rj.claudio41cg.workers.dev').replace(/\/$/,'');
  const path='/search/2/search/'+encodeURIComponent(q)+'.json?limit=5&language=pt-BR&lat='+Number(lat)+'&lon='+Number(lon)+'&radius=12000';
  const r=await fetch(base+'/v1/tomtom?path='+encodeURIComponent(path),{cache:'no-store'});
  const d=r.ok?await r.json():null;
  const items=Array.isArray(d?.results)?d.results.slice(0,3):[];
  if(!items.length)return {ok:false,error:'Nenhum resultado encontrado',query:q,near:label};
  return {ok:true,query:q,near:label,results:items.map(item=>({
    name:item?.poi?.name||q,
    address:item?.address?.freeformAddress||[item?.address?.streetName,item?.address?.municipalitySubdivision,item?.address?.municipality].filter(Boolean).join(', '),
    lat:Number(item?.position?.lat),
    lon:Number(item?.position?.lon)
  }))};
}

async function handleToolCall(tc){
  const calls=tc?.functionCalls||tc?.function_calls||[];
  if(!calls.length)return;
  const responses=[];

  const normalize=text=>String(text||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();

  for(const call of calls){
    const name=String(call?.name||''),id=call?.id||call?.callId;
    try{
      let args=call?.args??call?.arguments??{};
      if(typeof args==='string'){try{args=JSON.parse(args)}catch(_){args={comando:args}}}
      let result;

      if(name==='executar_comando_radar'){
        const command=String(args?.comando??args?.command??'').trim();
        const n=normalize(command);
        const app=appRef();
        const va=assistantRef();

        const wantsLocation=
          /\b(onde eu estou|onde estou|minha localizacao|minha localização|que rua|qual rua|que bairro|qual bairro|em que lugar eu estou)\b/i.test(command);

        const wantsCancel=
          /\b(cancela|cancelar|cancele|encerra|encerrar|encerre|para a rota|parar a rota|pare a rota|sair da rota|finaliza a rota|finalizar a rota)\b/i.test(command);

        const wantsRouteStatus=
          /\b(quanto falta|falta quanto|quantos km faltam|quantos quilometros faltam|quantos quilômetros faltam|quanto tempo falta|falta quanto tempo|hora de chegada|chega que horas|distancia restante|distância restante)\b/i.test(command);

        const nearDestinationMatch=command.match(/(?:tem|existe|ache|encontre|procure|quero)\s+(?:um|uma|algum|alguma)?\s*(mercado|padaria|posto(?: de combust[ií]vel)?|farm[aá]cia|restaurante|hospital|shopping|supermercado|banco|caixa eletr[oô]nico)\s+(?:perto|pr[oó]ximo|pr[oó]xima)\s+(?:do|da|ao|a)\s+(?:meu\s+)?destino/i);

        if(wantsLocation){
          let pos=null;
          if(typeof va?.getCurrentAddress==='function'){
            try{pos=await va.getCurrentAddress(true)}catch(_){}
          }
          if(pos&&Number.isFinite(Number(pos.lat))&&Number.isFinite(Number(pos.lon))){
            result={
              ok:true,
              type:'location',
              address:String(pos.label||''),
              lat:Number(pos.lat),
              lon:Number(pos.lon),
              message:pos.label?'Você está em '+pos.label+'.':'GPS localizado; endereço ainda não identificado.'
            };
          }else{
            const p=Array.isArray(app?.userPos)?app.userPos:null;
            result=p&&p.length>=2&&Number.isFinite(Number(p[0]))&&Number.isFinite(Number(p[1]))
              ? {ok:true,type:'location',address:'',lat:Number(p[1]),lon:Number(p[0]),message:'GPS localizado; endereço ainda não identificado.'}
              : {ok:false,type:'location',error:'GPS ainda sem posição'};
          }

        }else if(wantsCancel){
          if(!app?.route&&!app?.navActive){
            result={ok:false,type:'cancel',error:'Não existe rota ativa'};
          }else if(typeof app?.clearRoute!=='function'){
            result={ok:false,type:'cancel',error:'Função de cancelamento indisponível'};
          }else{
            app.clearRoute();
            await new Promise(r=>setTimeout(r,180));
            const cancelled=!app.navActive&&!app.route;
            result=cancelled
              ? {ok:true,type:'cancel',cancelled:true,message:'Rota cancelada.'}
              : {ok:false,type:'cancel',cancelled:false,error:'A rota não foi totalmente limpa'};
          }

        }else if(wantsRouteStatus){
          if(!app?.route){
            result={ok:false,type:'route_status',error:'Não existe rota ativa'};
          }else if(typeof va?.routeContext!=='function'){
            result={ok:false,type:'route_status',error:'Contexto de rota indisponível'};
          }else{
            const ctx=va.routeContext()||{};
            result={ok:true,type:'route_status',...ctx};
          }

        }else if(nearDestinationMatch){
          const q=nearDestinationMatch[1];
          if(!Array.isArray(app?.destination)||app.destination.length<2){
            result={ok:false,type:'poi_destination',error:'Destino da rota indisponível'};
          }else{
            result=await searchNearPoint(q,Number(app.destination[0]),Number(app.destination[1]),'destino da rota');
            result.type='poi_destination';
          }

        }else{
          const m=command.match(/(?:me\s+leve|me\s+leva|leve(?:-|\s)?me|navegue|quero\s+ir|ir|vá|va|bora|vamos|vamo|trace(?:\s+uma)?\s+rota)(?:\s+(?:para|pra|pro|até|ate|em))?\s+(.+)/i);
          const destination=String(m?.[1]||command).replace(/[.!?]+$/,'').trim();

          if(!destination){
            result={ok:false,type:'route',error:'Destino vazio'};
          }else if(typeof va?.routeTo!=='function'){
            result={ok:false,type:'route',error:'Fluxo original de rota indisponível'};
          }else{
            const originalShowRoutePanel=app?.showRoutePanel;
            try{
              if(app&&typeof originalShowRoutePanel==='function')app.showRoutePanel=()=>{};
              try{if(typeof RouteChoiceGuardV44!=='undefined')RouteChoiceGuardV44.allowStartUntil=Date.now()+8000}catch(_){}
              result=await va.routeTo(destination,{fromGemini:true});
            }finally{
              if(app&&typeof originalShowRoutePanel==='function')app.showRoutePanel=originalShowRoutePanel;
            }
          }
        }
      }else{
        result={ok:false,error:'Ferramenta não suportada nesta versão'};
      }

      responses.push({id,name,response:{result:result??null}});
    }catch(e){
      responses.push({id,name,response:{error:String(e?.message||e)}});
    }
  }

  if(responses.length)send({toolResponse:{functionResponses:responses}});
}

function handleServerMessage(m){
  if(m?.setupComplete!==undefined){
    setupReady=true;
    if(resumedConnection){
      micSending=true;
      resumedConnection=false;
      setStatus('Gemini Live • sessão retomada');
      toast('✨ Sessão do Radar retomada.',1800);
    }else{
      setStatus('Gemini Live • conectado');
      send({clientContent:{turns:[{role:'user',parts:[{text:'Diga apenas em português: Radar conectado e ouvindo.'}]}],turnComplete:true}});
      clearTimeout(introTimer);
      introTimer=setTimeout(()=>{if(running&&!micSending){micSending=true;setStatus('Gemini Live • ouvindo')}},5000);
    }
    return;
  }
  if(m?.sessionResumptionUpdate){const u=m.sessionResumptionUpdate;if(u?.resumable&&u?.newHandle)saveResumeHandle(u.newHandle);return}
  if(m?.goAway){setStatus('Gemini Live • preparando retomada');return}
  if(m?.toolCall){handleToolCall(m.toolCall).catch(e=>console.warn('Gemini Direct tool',e));return}
  if(m?.serverContent?.interrupted)stopOutput();
  const parts=m?.serverContent?.modelTurn?.parts||[];for(const p of parts){const inline=p?.inlineData||p?.inline_data;if(!inline?.data)continue;const mime=String(inline.mimeType||inline.mime_type||'audio/pcm;rate=24000');if(!/^audio\//i.test(mime))continue;const rate=Number((mime.match(/rate=(\d+)/i)||[])[1])||24000;playAudio(inline.data,rate).catch(e=>console.warn('Gemini Direct audio',e))}
  if(m?.serverContent?.turnComplete){if(!micSending){micSending=true;setStatus('Gemini Live • ouvindo');toast('Pode falar com o Radar.',1400)}else setStatus('Gemini Live • ouvindo')}
}

async function softCleanup(){running=false;starting=false;setupReady=false;micSending=false;reconnecting=false;ws=null;await stopMic();stopOutput()}
async function closeSession(){if(ws){try{ws.onclose=null;ws.onerror=null;ws.onmessage=null;ws.close(1000,'user_stop')}catch(_){}}await softCleanup()}

async function openSession({resume=false,auto=false}={}){
  if(running||starting||reconnecting)return;
  starting=!resume;reconnecting=resume;resumedConnection=Boolean(resume&&resumeHandle);
  window.__RADAR_GEMINI_LIVE_OWNS_MIC=true;
  setButtons(true);showDetail('');
  setStatus(resumedConnection?'Gemini Live • retomando sessão…':'Gemini Live • preparando áudio…');
  try{
    try{voiceRef()?.clear?.()}catch(_){}
    try{assistantRef()?.stopHandsFree?.(false)}catch(_){}
    await Promise.all([prepareOutput(),prepareMic()]);
    const auth=await getToken();
    const url=auth.websocket+'?access_token='+encodeURIComponent(auth.token);
    ws=new WebSocket(url);
    ws.onopen=()=>{
      running=true;starting=false;reconnecting=false;
      setStatus(resumedConnection?'Gemini Live • enviando retomada…':'Gemini Live • conectando…');
      const toolDecl=[{
        name:'executar_comando_radar',
        description:'Executa qualquer comando do motorista ligado ao Radar Seguro: criar rota, informar localização GPS atual, dizer quanto falta, procurar estabelecimento perto do destino ou cancelar a rota.',
        parameters:{
          type:'object',
          properties:{
            comando:{type:'string',description:'Frase completa do motorista, sem resumir. Exemplos: onde eu estou; quanto falta para chegar; tem uma padaria perto do meu destino; cancela a rota; me leva para o Maracanã.'}
          },
          required:['comando']
        }
      }];
      send({setup:{model:MODEL,generationConfig:{responseModalities:['AUDIO']},systemInstruction:{parts:[{text:SYSTEM_TEXT}]},tools:[{functionDeclarations:toolDecl}],sessionResumption:resumedConnection?{handle:resumeHandle}:{}}});
    };
    ws.onmessage=async e=>{try{handleServerMessage(JSON.parse(await readMessageData(e.data)))}catch(err){console.warn('Gemini Direct message',err)}};
    ws.onerror=()=>{};
    ws.onclose=async e=>{
      const wasManual=manualStop,code=Number(e?.code)||0;
      await softCleanup();
      if(wasManual)return;
      if(userStarted&&resumeHandle){
        if(document.visibilityState==='visible'){
          setStatus('Gemini Live • retomando…');
          setTimeout(()=>openSession({resume:true,auto:true}),500);
        }else{
          setStatus('Gemini Live • aguardando retorno');
        }
      }else{
        setStatus('',false);setButtons(false);
        if(code&&code!==1000)showDetail('Gemini Live desconectou. Toque no microfone para iniciar novamente.');
      }
    };
  }catch(e){
    await softCleanup();
    if(userStarted&&resumeHandle&&document.visibilityState==='visible'&&auto){
      setTimeout(()=>openSession({resume:true,auto:true}),1200);
    }else{
      setStatus('',false);setButtons(false);showDetail('Não foi possível iniciar o Gemini Live agora.');
    }
  }
}

async function start(){
  if(running||starting||reconnecting)return;
  manualStop=false;saveActive(true);introAudioReceived=false;
  await openSession({resume:false});
}
async function stop(){
  manualStop=true;saveActive(false);window.__RADAR_GEMINI_LIVE_OWNS_MIC=false;
  try{localStorage.removeItem(RESUME_KEY)}catch(_){}
  resumeHandle='';
  setStatus('Gemini Live • encerrando…');
  await closeSession();setButtons(false);setStatus('',false);
}
function toggle(){if(running||starting||reconnecting||userStarted)stop();else start()}
function intercept(e){const t=e.target?.closest?.(`#${MAIN_ID},#${NAV_ID}`);if(!t)return;e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();toggle()}

document.addEventListener('click',intercept,true);

document.addEventListener('visibilitychange',async()=>{
  if(!userStarted||manualStop)return;
  if(document.visibilityState==='hidden'){
    hiddenAt=Date.now();micSending=false;await stopMic();return;
  }
  const away=Math.round((Date.now()-hiddenAt)/1000);
  if(ws?.readyState===WebSocket.OPEN&&setupReady){
    try{await prepareMic();micSending=true;setStatus('Gemini Live • ouvindo')}catch(_){}
    return;
  }
  if(resumeHandle){setStatus('Gemini Live • retomando…');await openSession({resume:true,auto:true})}
  else if(away>0){setStatus('Gemini Live • reconectando…');await openSession({resume:false,auto:true})}
});

window.addEventListener('pageshow',()=>{
  if(userStarted&&!manualStop&&document.visibilityState==='visible'&&!running&&!starting&&!reconnecting){
    setTimeout(()=>openSession({resume:Boolean(resumeHandle),auto:true}),250);
  }
});

ensureUI();setButtons(Boolean(userStarted));
if(userStarted&&resumeHandle&&document.visibilityState==='visible')setTimeout(()=>openSession({resume:true,auto:true}),350);
window.RadarGeminiDirectV264={start,stop,toggle,get state(){return{running,starting,reconnecting,setupReady,micSending,userStarted,hasResumeHandle:Boolean(resumeHandle),model:MODEL,wsState:ws?.readyState??-1}}};
})();