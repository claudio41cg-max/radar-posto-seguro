(()=>{
'use strict';

/*
  Radar GPT Live transport — Stage 2
  Responsabilidade deste módulo:
  - abrir/fechar WebRTC;
  - enviar eventos para a sessão Live;
  - atualizar contexto sem reiniciar a sessão;
  - permitir cancelamento explícito de uma resposta quando o comando
    foi assumido pelo parser local do Radar.
  Este arquivo NÃO decide rotas, mapa, GPS ou comandos.
*/

const DEFAULT_BACKEND='https://turbo-engine-production.up.railway.app';
const VOICES=new Set(['cove','juniper','maple','spruce','ember','vale','breeze','arbor','sol']);

const state={
  pc:null,
  stream:null,
  channel:null,
  audio:null,
  running:false,
  starting:false,
  muted:false,
  voice:'cove',
  onTranscript:null,
  onState:null,
  lastInstructions:'',
  queuedSessionUpdate:null
};

function emit(name,detail){
  try{state.onState?.(name,detail)}catch{}
}

function waitIce(peer){
  if(peer.iceGatheringState==='complete')return Promise.resolve();

  return new Promise(resolve=>{
    const timer=setTimeout(resolve,5000);

    const on=()=>{
      if(peer.iceGatheringState!=='complete')return;
      clearTimeout(timer);
      peer.removeEventListener('icegatheringstatechange',on);
      resolve();
    };

    peer.addEventListener('icegatheringstatechange',on);
  });
}

function channelReady(){
  return state.channel?.readyState==='open';
}

function sendEvent(event){
  if(!event||typeof event!=='object')return false;

  if(!channelReady())return false;

  try{
    state.channel.send(JSON.stringify(event));
    return true;
  }catch(error){
    emit('event-error',String(error?.message||error));
    return false;
  }
}

function flushQueuedSessionUpdate(){
  if(!state.queuedSessionUpdate||!channelReady())return false;

  const queued=state.queuedSessionUpdate;
  state.queuedSessionUpdate=null;
  return sendEvent(queued);
}

function updateContext(instructions){
  const next=String(instructions||'').trim().slice(0,12000);
  if(!next||next===state.lastInstructions)return false;

  state.lastInstructions=next;

  /*
    OpenAI Realtime/Live: atualiza as instruções da sessão existente.
    Não reinicia WebRTC e não abre uma segunda sessão.
  */
  const event={
    type:'session.update',
    session:{
      instructions:next
    }
  };

  if(!channelReady()){
    state.queuedSessionUpdate=event;
    return false;
  }

  return sendEvent(event);
}

function appendContext(content){
  const text=String(content||'').trim().slice(0,4000);
  if(!text)return false;
  return sendEvent({
    type:'session.context.append',
    content:text
  });
}

function requestResponse(){
  return sendEvent({
    type:'response.create'
  });
}

function speakContext(content){
  if(!appendContext(content))return false;
  return requestResponse();
}

async function stop(){
  const pc=state.pc;
  const stream=state.stream;
  const channel=state.channel;
  const audio=state.audio;

  state.pc=null;
  state.stream=null;
  state.channel=null;
  state.audio=null;
  state.running=false;
  state.starting=false;
  state.muted=false;
  state.queuedSessionUpdate=null;

  try{channel?.close()}catch{}
  try{pc?.close()}catch{}
  try{stream?.getTracks()?.forEach(t=>t.stop())}catch{}

  try{
    if(audio){
      audio.pause();
      audio.srcObject=null;
      audio.remove();
    }
  }catch{}

  emit('stopped');
}

function parseEvent(raw){
  let event;

  try{
    event=JSON.parse(String(raw||''));
  }catch{
    return;
  }

  const type=String(event?.type||'');

  if(type==='input_audio_buffer.speech_started'){
    emit('user-speaking');
    return;
  }

  if(type==='input_audio_buffer.speech_stopped'){
    emit('user-stopped');
    return;
  }

  if(type==='response.output_audio.delta'||type==='response.audio.delta'){
    emit('assistant-speaking');
  }

  if(type==='response.output_audio.done'||type==='response.audio.done'){
    emit('assistant-done');
  }

  if(
    type==='session.output_transcript.delta'||
    type==='response.output_audio_transcript.delta'
  ){
    const text=String(event?.delta||'');

    if(text){
      try{
        state.onTranscript?.({
          role:'assistant',
          text,
          final:false,
          delta:true
        });
      }catch{}
    }

    return;
  }

  if(type==='session.input_transcript.delta'){
    const text=String(event?.delta||'');

    if(text){
      try{
        state.onTranscript?.({
          role:'user',
          text,
          final:false,
          delta:true
        });
      }catch{}
    }

    return;
  }

  if(type==='turn.done'){
    const role=event?.turn?.role;
    const text=String(event?.turn?.transcript||'').trim();

    if(text&&(role==='user'||role==='assistant')){
      try{
        state.onTranscript?.({
          role,
          text,
          final:true
        });
      }catch{}
    }

    emit(
      role==='assistant'
      ?'assistant-done'
      :'user-stopped'
    );

    return;
  }

  if(
    type==='input_transcript.added'||
    type==='output_transcript.added'
  ){
    const text=String(event?.item?.text||'').trim();

    if(text){
      try{
        state.onTranscript?.({
          role:type.startsWith('input')?'user':'assistant',
          text,
          final:false
        });
      }catch{}
    }

    return;
  }

  if(type==='session.updated'){
    emit('context-updated');
    return;
  }

  if(type==='error'){
    emit(
      'error',
      String(
        event?.error?.message||
        event?.message||
        'Erro no GPT Live.'
      )
    );
  }
}

async function start(options={}){
  if(state.starting)return false;

  await stop();

  state.starting=true;
  emit('connecting');

  try{
    const auth=
      typeof window.radarTurboAuth==='function'
      ?await window.radarTurboAuth()
      :'';

    if(!auth){
      throw new Error('Faça login no GPT do Radar.');
    }

    const chosen=String(options.voice||'cove').trim();

    state.voice=
      VOICES.has(chosen)
      ?chosen
      :'cove';

    state.onTranscript=
      typeof options.onTranscript==='function'
      ?options.onTranscript
      :null;

    state.onState=
      typeof options.onState==='function'
      ?options.onState
      :null;

    state.lastInstructions=
      String(options.instructions||'')
      .trim()
      .slice(0,12000);

    const stream=
      await navigator.mediaDevices.getUserMedia({
        audio:{
          echoCancellation:true,
          noiseSuppression:true,
          autoGainControl:true
        },
        video:false
      });

    const pc=
      new RTCPeerConnection();

    const channel=
      pc.createDataChannel('oai-events');

    const audio=
      document.createElement('audio');

    audio.autoplay=true;
    audio.playsInline=true;
    audio.style.display='none';

    document.body.appendChild(audio);

    state.stream=stream;
    state.pc=pc;
    state.channel=channel;
    state.audio=audio;

    for(const track of stream.getAudioTracks()){
      pc.addTrack(track,stream);
    }

    pc.ontrack=e=>{
      const media=
        e.streams?.[0]||
        new MediaStream([e.track]);

      audio.srcObject=media;

      audio.onplaying=
        ()=>emit('assistant-speaking');

      audio.onpause=
        ()=>emit('assistant-done');

      audio.onended=
        ()=>emit('assistant-done');

      const p=audio.play();

      if(p&&typeof p.then==='function'){
        p.then(
          ()=>emit('assistant-speaking')
        ).catch(()=>{});
      }

      emit('audio');
    };

    pc.onconnectionstatechange=()=>{
      emit('connection',pc.connectionState);

      if(
        pc.connectionState==='failed'||
        pc.connectionState==='closed'
      ){
        state.running=false;
      }

      if(pc.connectionState==='disconnected'){
        emit('connection-warning','disconnected');
      }
    };

    channel.onopen=()=>{
      emit('channel-open');
      flushQueuedSessionUpdate();
    };

    channel.onmessage=
      e=>parseEvent(e.data);

    const offer=
      await pc.createOffer();

    await pc.setLocalDescription(offer);
    await waitIce(pc);

    const backend=
      String(
        window.radarTurboBase||
        DEFAULT_BACKEND
      );

    const response=
      await fetch(
        backend+'/__turbo/voice/start',
        {
          method:'POST',
          headers:{
            'content-type':'application/json',
            'authorization':'Bearer '+auth
          },
          body:JSON.stringify({
            sdp:pc.localDescription?.sdp||'',
            voice:state.voice,
            instructions:state.lastInstructions
          })
        }
      );

    const data=
      await response
      .json()
      .catch(()=>({}));

    if(response.status===401){
      try{window.radarGptLogout?.()}catch{}
      throw new Error(
        'Login do GPT expirou. Entre novamente.'
      );
    }

    if(
      !response.ok||
      !data?.ok||
      !data?.sdp
    ){
      throw new Error(
        data?.error||
        'Não foi possível abrir o GPT Live.'
      );
    }

    await pc.setRemoteDescription({
      type:'answer',
      sdp:data.sdp
    });

    state.running=true;
    state.starting=false;

    emit('live',{
      voice:data.voice||state.voice,
      model:data.model||'GPT Live'
    });

    return true;

  }catch(error){
    const message=
      String(error?.message||error);

    await stop();
    emit('error',message);

    throw error;
  }
}

function setMuted(value){
  const muted=!!value;

  state.muted=muted;

  for(
    const track
    of state.stream?.getAudioTracks?.()||[]
  ){
    track.enabled=!muted;
  }

  emit(
    muted
    ?'muted'
    :'unmuted'
  );

  return muted;
}

function toggleMute(){
  return setMuted(!state.muted);
}

window.RadarGPTLive={
  state,
  start,
  stop,
  setMuted,
  toggleMute,
  sendEvent,
  updateContext,
  appendContext,
  requestResponse,
  speakContext
};

})();