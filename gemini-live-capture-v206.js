(()=>{
'use strict';
const NativeWebSocket=window.WebSocket;
const LIVE_HOST='radar-gemini-live-a5bf.claudio41cg.workers.dev/v1/live-ws';

function ensurePanel(){
  let el=document.getElementById('geminiLiveRawV206');
  if(el)return el;
  el=document.createElement('div');
  el.id='geminiLiveRawV206';
  el.style.cssText='position:fixed;left:12px;right:12px;bottom:190px;z-index:100000;padding:12px;border-radius:12px;background:rgba(8,20,32,.97);border:1px solid rgba(66,190,255,.7);color:#fff;font:700 12px/1.4 Arial,sans-serif;display:none;white-space:pre-wrap;word-break:break-word;max-height:32vh;overflow:auto;box-shadow:0 8px 28px rgba(0,0,0,.45)';
  document.body.appendChild(el);
  return el;
}

function show(title,body){
  const el=ensurePanel();
  el.textContent=`DIAGNÓSTICO RAW GEMINI v206\n${title}\n${String(body||'').slice(0,1800)}`;
  el.style.display='block';
}

async function asText(data){
  if(typeof data==='string')return data;
  if(data instanceof Blob)return await data.text();
  if(data instanceof ArrayBuffer)return new TextDecoder().decode(data);
  if(ArrayBuffer.isView(data))return new TextDecoder().decode(data.buffer,data.byteOffset,data.byteLength);
  return String(data??'');
}

function RadarWebSocket(url,protocols){
  const ws=protocols===undefined?new NativeWebSocket(url):new NativeWebSocket(url,protocols);
  try{
    if(String(url).includes(LIVE_HOST)){
      ws.addEventListener('message',async event=>{
        try{
          const text=await asText(event.data);
          const msg=JSON.parse(text);
          if(msg?.__radarProxy)return;
          if(msg?.error){
            const code=msg.error.code??'';
            const status=msg.error.status??'';
            const message=msg.error.message??JSON.stringify(msg.error);
            show(`Gemini respondeu erro${code?` ${code}`:''}${status?` • ${status}`:''}`,message);
            return;
          }
          const known=msg?.setupComplete!==undefined||msg?.serverContent||msg?.toolCall||msg?.toolCallCancellation||msg?.goAway||msg?.sessionResumptionUpdate||msg?.usageMetadata;
          if(!known)show('Primeira resposta não reconhecida',JSON.stringify(msg,null,2));
        }catch(error){
          show('Não consegui interpretar a resposta',`${error?.message||error}\n\nTipo recebido: ${Object.prototype.toString.call(event.data)}`);
        }
      },true);
    }
  }catch(_){}
  return ws;
}

RadarWebSocket.prototype=NativeWebSocket.prototype;
for(const key of ['CONNECTING','OPEN','CLOSING','CLOSED']){
  try{Object.defineProperty(RadarWebSocket,key,{value:NativeWebSocket[key],enumerable:true})}catch(_){}
}
window.WebSocket=RadarWebSocket;
})();
