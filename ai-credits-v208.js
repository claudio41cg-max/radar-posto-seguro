(()=>{
'use strict';

if(window.__radarAiCreditsV208)return;
window.__radarAiCreditsV208=true;

const STORAGE_KEY='radar_ai_credit_usage_v208';
const CREDIT_REFERENCE_USD=10;
const LIVE_HOST='radar-gemini-live-a5bf.claudio41cg.workers.dev/v1/live-ws';

// Gemini 3.1 Flash Live Preview — paid tier, USD per 1M tokens.
// Pricing snapshot used by this prototype: 2026-09-15.
const PRICE={
  inputText:0.75/1_000_000,
  inputAudio:3.00/1_000_000,
  inputImageVideo:1.00/1_000_000,
  outputText:4.50/1_000_000,
  outputAudio:12.00/1_000_000
};

const NativeWebSocket=window.WebSocket;
let sessionAgg=emptyAgg();
let currentTurnUsage=null;
let liveSocketCount=0;
let panel=null;
let button=null;
let lastFingerprints=[];

function emptyAgg(){
  return {
    costUsd:0,
    turns:0,
    totalTokens:0,
    inText:0,
    inAudio:0,
    inImageVideo:0,
    inUnknown:0,
    outText:0,
    outAudio:0,
    outUnknown:0,
    thoughts:0,
    usageEvents:0
  };
}

function num(v){const n=Number(v);return Number.isFinite(n)&&n>0?n:0;}
function localDay(d=new Date()){
  const y=d.getFullYear(),m=String(d.getMonth()+1).padStart(2,'0'),day=String(d.getDate()).padStart(2,'0');
  return `${y}-${m}-${day}`;
}
function monthKey(d=new Date()){return localDay(d).slice(0,7);}

function loadStore(){
  try{
    const parsed=JSON.parse(localStorage.getItem(STORAGE_KEY)||'null');
    if(parsed&&parsed.version===1&&parsed.days)return parsed;
  }catch(_){}
  return {version:1,createdAt:Date.now(),days:{},creditReferenceUsd:CREDIT_REFERENCE_USD};
}
function saveStore(s){try{localStorage.setItem(STORAGE_KEY,JSON.stringify(s));}catch(_){} }

function modalityMap(details){
  const out={TEXT:0,AUDIO:0,IMAGE:0,VIDEO:0,OTHER:0};
  for(const item of Array.isArray(details)?details:[]){
    const mod=String(item?.modality||'OTHER').toUpperCase();
    const c=num(item?.tokenCount);
    if(mod==='TEXT')out.TEXT+=c;
    else if(mod==='AUDIO')out.AUDIO+=c;
    else if(mod==='IMAGE')out.IMAGE+=c;
    else if(mod==='VIDEO')out.VIDEO+=c;
    else out.OTHER+=c;
  }
  return out;
}

function usageToAgg(u){
  const a=emptyAgg();
  const pin=modalityMap(u?.promptTokensDetails);
  const pout=modalityMap(u?.responseTokensDetails);
  const promptTotal=num(u?.promptTokenCount);
  const responseTotal=num(u?.responseTokenCount??u?.candidatesTokenCount);
  const detailsIn=pin.TEXT+pin.AUDIO+pin.IMAGE+pin.VIDEO+pin.OTHER;
  const detailsOut=pout.TEXT+pout.AUDIO+pout.IMAGE+pout.VIDEO+pout.OTHER;

  a.inText=pin.TEXT;
  a.inAudio=pin.AUDIO;
  a.inImageVideo=pin.IMAGE+pin.VIDEO;
  a.inUnknown=Math.max(pin.OTHER,promptTotal-detailsIn,0);
  a.outText=pout.TEXT;
  a.outAudio=pout.AUDIO;
  a.outUnknown=Math.max(pout.OTHER,responseTotal-detailsOut,0);
  a.thoughts=num(u?.thoughtsTokenCount);
  a.totalTokens=num(u?.totalTokenCount)||promptTotal+responseTotal+a.thoughts;
  a.turns=1;
  a.usageEvents=1;

  // Unknown input/output is priced conservatively as audio because this prototype is audio-first.
  a.costUsd=
    a.inText*PRICE.inputText+
    a.inAudio*PRICE.inputAudio+
    a.inImageVideo*PRICE.inputImageVideo+
    a.inUnknown*PRICE.inputAudio+
    a.outText*PRICE.outputText+
    a.outAudio*PRICE.outputAudio+
    a.outUnknown*PRICE.outputAudio+
    a.thoughts*PRICE.outputText;

  return a;
}

function addAgg(target,src){
  for(const k of Object.keys(emptyAgg()))target[k]=num(target[k])+num(src[k]);
  return target;
}
function sumAgg(list){const out=emptyAgg();for(const a of list)addAgg(out,a||{});return out;}

function usageFingerprint(u){
  return JSON.stringify({
    p:u?.promptTokenCount||0,
    r:u?.responseTokenCount??u?.candidatesTokenCount??0,
    t:u?.thoughtsTokenCount||0,
    z:u?.totalTokenCount||0,
    pd:u?.promptTokensDetails||[],
    rd:u?.responseTokensDetails||[]
  });
}

function commitUsage(u){
  if(!u)return;
  const fp=usageFingerprint(u);
  if(lastFingerprints.includes(fp))return;
  lastFingerprints.push(fp);
  if(lastFingerprints.length>30)lastFingerprints.shift();

  const a=usageToAgg(u);
  addAgg(sessionAgg,a);
  const s=loadStore();
  const day=localDay();
  if(!s.days[day])s.days[day]=emptyAgg();
  addAgg(s.days[day],a);
  saveStore(s);
  currentTurnUsage=null;
  renderPanel();
  renderButtonBadge();
}

async function dataToText(data){
  if(typeof data==='string')return data;
  if(data instanceof Blob)return await data.text();
  if(data instanceof ArrayBuffer)return new TextDecoder().decode(data);
  if(ArrayBuffer.isView(data))return new TextDecoder().decode(data.buffer,data.byteOffset,data.byteLength);
  return String(data??'');
}

function instrumentSocket(ws,url){
  if(!String(url).includes(LIVE_HOST))return ws;
  liveSocketCount++;
  ws.addEventListener('message',async ev=>{
    try{
      const text=await dataToText(ev.data);
      const msg=JSON.parse(text);
      if(msg?.__radarProxy)return;
      if(msg?.usageMetadata)currentTurnUsage=msg.usageMetadata;
      if(msg?.serverContent?.turnComplete&&currentTurnUsage)commitUsage(currentTurnUsage);
    }catch(_){}
  },true);
  ws.addEventListener('close',()=>{
    if(currentTurnUsage)commitUsage(currentTurnUsage);
    liveSocketCount=Math.max(0,liveSocketCount-1);
    renderPanel();
  });
  return ws;
}

function CostWebSocket(url,protocols){
  const ws=protocols===undefined?new NativeWebSocket(url):new NativeWebSocket(url,protocols);
  return instrumentSocket(ws,url);
}
CostWebSocket.prototype=NativeWebSocket.prototype;
for(const key of ['CONNECTING','OPEN','CLOSING','CLOSED']){
  try{Object.defineProperty(CostWebSocket,key,{value:NativeWebSocket[key],enumerable:true});}catch(_){}
}
window.WebSocket=CostWebSocket;

function fmtUsd(v,digits=4){
  const n=num(v);
  return `US$ ${n.toLocaleString('pt-BR',{minimumFractionDigits:digits,maximumFractionDigits:digits})}`;
}
function fmtInt(v){return Math.round(num(v)).toLocaleString('pt-BR');}
function fmtMin(v){return `${num(v).toLocaleString('pt-BR',{minimumFractionDigits:1,maximumFractionDigits:1})} min`;}

function aggregateForDays(count){
  const s=loadStore();
  const days=[];
  const now=new Date();
  for(let i=0;i<count;i++){const d=new Date(now);d.setDate(now.getDate()-i);days.push(s.days[localDay(d)]||emptyAgg());}
  return sumAgg(days);
}
function aggregateMonth(){
  const s=loadStore(),mk=monthKey();
  return sumAgg(Object.entries(s.days).filter(([k])=>k.startsWith(mk)).map(([,v])=>v));
}
function monthProjection(monthAgg){
  const now=new Date();
  const elapsed=Math.max(1,now.getDate());
  return num(monthAgg.costUsd)/elapsed*30;
}

function injectStyle(){
  if(document.getElementById('aiCreditsV208Style'))return;
  const style=document.createElement('style');
  style.id='aiCreditsV208Style';
  style.textContent=`
#aiCreditsBtn{position:relative;font-size:20px!important;border-color:#a78bfa!important;color:#f5f3ff!important;background:rgba(17,10,35,.88)!important}
#aiCreditsBtn .ai-cost-dot{position:absolute;right:-4px;top:-4px;min-width:20px;height:18px;padding:0 4px;border-radius:999px;background:#7c3aed;color:#fff;border:1px solid #c4b5fd;font:800 8px/16px Arial,sans-serif;text-align:center;box-shadow:0 2px 7px rgba(0,0,0,.55)}
#aiCreditsOverlay{position:fixed;inset:0;z-index:2147483000;background:rgba(0,0,0,.55);display:none;align-items:flex-end;justify-content:center;padding:12px;backdrop-filter:blur(3px)}
#aiCreditsOverlay.show{display:flex}
#aiCreditsPanel{width:min(560px,100%);max-height:88vh;overflow:auto;border-radius:22px;background:linear-gradient(180deg,#101827,#07111d);border:1px solid rgba(167,139,250,.55);box-shadow:0 18px 55px rgba(0,0,0,.72);color:#fff;padding:16px;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif}
.ai-cr-head{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:12px}.ai-cr-title{font-size:18px;font-weight:900}.ai-cr-sub{font-size:10px;color:#94a3b8;margin-top:3px}.ai-cr-close{width:36px;height:36px;border-radius:50%;border:1px solid #334155;background:#111827;color:#fff;font-size:18px}
.ai-cr-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}.ai-cr-card{background:rgba(15,23,42,.82);border:1px solid #273449;border-radius:14px;padding:11px}.ai-cr-card span{display:block;font-size:10px;color:#94a3b8;font-weight:800}.ai-cr-card b{display:block;margin-top:4px;font-size:16px;color:#f8fafc}.ai-cr-card small{display:block;margin-top:3px;color:#a7f3d0;font-size:9px}
.ai-cr-section{margin-top:12px;padding-top:11px;border-top:1px solid #223047}.ai-cr-section h4{font-size:12px;margin-bottom:8px;color:#ddd6fe}.ai-cr-row{display:flex;justify-content:space-between;gap:10px;padding:5px 0;font-size:11px;color:#cbd5e1}.ai-cr-row b{color:#fff;text-align:right}.ai-cr-note{margin-top:10px;padding:9px 10px;border-radius:12px;background:rgba(124,58,237,.12);border:1px solid rgba(167,139,250,.28);font-size:9px;line-height:1.4;color:#cbd5e1}.ai-cr-actions{display:flex;gap:8px;margin-top:12px}.ai-cr-actions button{flex:1;padding:11px;border-radius:12px;border:1px solid #334155;background:#172033;color:#fff;font-weight:900;font-size:11px}.ai-cr-actions .danger{border-color:#7f1d1d;background:#3f0d12;color:#fecaca}
@media(max-height:680px){#aiCreditsPanel{max-height:94vh;padding:12px}.ai-cr-card{padding:8px}}
`;
  document.head.appendChild(style);
}

function createButton(){
  injectStyle();
  const side=document.querySelector('.side');
  const layers=document.getElementById('layersBtn');
  if(!side||!layers)return false;
  button=document.getElementById('aiCreditsBtn');
  if(!button){
    button=document.createElement('button');
    button.id='aiCreditsBtn';
    button.type='button';
    button.title='Créditos IA';
    button.setAttribute('aria-label','Créditos IA');
    button.innerHTML='💳<span class="ai-cost-dot">0</span>';
    layers.insertAdjacentElement('afterend',button);
    button.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();openPanel();});
  }
  renderButtonBadge();
  return true;
}

function createPanel(){
  injectStyle();
  if(document.getElementById('aiCreditsOverlay'))return;
  const overlay=document.createElement('div');
  overlay.id='aiCreditsOverlay';
  overlay.innerHTML='<div id="aiCreditsPanel" role="dialog" aria-modal="true" aria-label="Gerenciamento de créditos IA"></div>';
  document.body.appendChild(overlay);
  overlay.addEventListener('click',e=>{if(e.target===overlay)closePanel();});
  panel=overlay.querySelector('#aiCreditsPanel');
}

function renderButtonBadge(){
  if(!button)return;
  const today=aggregateForDays(1);
  const dot=button.querySelector('.ai-cost-dot');
  if(dot)dot.textContent=num(today.costUsd)<0.01?'<1¢':`$${num(today.costUsd).toFixed(2)}`;
}

function renderPanel(){
  panel=document.getElementById('aiCreditsPanel')||panel;
  if(!panel)return;
  const today=aggregateForDays(1);
  const week=aggregateForDays(7);
  const month=aggregateMonth();
  const projected=monthProjection(month);
  const ref=loadStore().creditReferenceUsd||CREDIT_REFERENCE_USD;
  const remaining=Math.max(0,ref-num(month.costUsd));
  const inAudioMin=today.inAudio/600;
  const outAudioMin=today.outAudio/1500;
  const active=liveSocketCount>0?'Sessão Live ativa':'Sem sessão Live ativa';

  panel.innerHTML=`
    <div class="ai-cr-head">
      <div><div class="ai-cr-title">💳 Créditos IA</div><div class="ai-cr-sub">Gemini 3.1 Flash Live • medição local por usageMetadata</div></div>
      <button class="ai-cr-close" id="aiCreditsClose">✕</button>
    </div>
    <div class="ai-cr-grid">
      <div class="ai-cr-card"><span>Sessão atual</span><b>${fmtUsd(sessionAgg.costUsd)}</b><small>${fmtInt(sessionAgg.totalTokens)} tokens • ${active}</small></div>
      <div class="ai-cr-card"><span>Hoje</span><b>${fmtUsd(today.costUsd)}</b><small>${today.turns||0} turnos medidos</small></div>
      <div class="ai-cr-card"><span>Últimos 7 dias</span><b>${fmtUsd(week.costUsd,3)}</b><small>${fmtInt(week.totalTokens)} tokens</small></div>
      <div class="ai-cr-card"><span>Mês atual</span><b>${fmtUsd(month.costUsd,3)}</b><small>projeção: ${fmtUsd(projected,2)}/mês</small></div>
    </div>

    <div class="ai-cr-section">
      <h4>Consumo de hoje</h4>
      <div class="ai-cr-row"><span>Áudio enviado</span><b>${fmtInt(today.inAudio)} tokens • ≈ ${fmtMin(inAudioMin)}</b></div>
      <div class="ai-cr-row"><span>Áudio recebido</span><b>${fmtInt(today.outAudio)} tokens • ≈ ${fmtMin(outAudioMin)}</b></div>
      <div class="ai-cr-row"><span>Texto de entrada</span><b>${fmtInt(today.inText)} tokens</b></div>
      <div class="ai-cr-row"><span>Texto de saída</span><b>${fmtInt(today.outText)} tokens</b></div>
      <div class="ai-cr-row"><span>Pensamento</span><b>${fmtInt(today.thoughts)} tokens</b></div>
      <div class="ai-cr-row"><span>Total registrado</span><b>${fmtInt(today.totalTokens)} tokens</b></div>
    </div>

    <div class="ai-cr-section">
      <h4>Crédito de referência</h4>
      <div class="ai-cr-row"><span>Benefício mensal configurado</span><b>${fmtUsd(ref,2)}</b></div>
      <div class="ai-cr-row"><span>Consumido neste mês</span><b>${fmtUsd(month.costUsd,3)}</b></div>
      <div class="ai-cr-row"><span>Saldo estimado do benefício</span><b>${fmtUsd(remaining,2)}</b></div>
    </div>

    <div class="ai-cr-section">
      <h4>Projeção mensal se o uso continuar igual</h4>
      <div class="ai-cr-row"><span>1 motorista</span><b>${fmtUsd(projected,2)}</b></div>
      <div class="ai-cr-row"><span>10 motoristas</span><b>${fmtUsd(projected*10,2)}</b></div>
      <div class="ai-cr-row"><span>50 motoristas</span><b>${fmtUsd(projected*50,2)}</b></div>
      <div class="ai-cr-row"><span>100 motoristas</span><b>${fmtUsd(projected*100,2)}</b></div>
    </div>

    <div class="ai-cr-note">Estimativa do protótipo, não é a fatura oficial do Google. O Radar usa os tokens informados pelo próprio Gemini e a tabela de preços configurada nesta versão. O benefício de US$ 10 é mostrado como referência e só será realmente abatido se estiver resgatado e elegível na mesma conta de faturamento.</div>

    <div class="ai-cr-actions">
      <button id="aiCreditsCloseBottom">Fechar</button>
      <button class="danger" id="aiCreditsReset">Zerar teste</button>
    </div>`;

  document.getElementById('aiCreditsClose')?.addEventListener('click',closePanel);
  document.getElementById('aiCreditsCloseBottom')?.addEventListener('click',closePanel);
  document.getElementById('aiCreditsReset')?.addEventListener('click',()=>{
    if(!confirm('Zerar todo o histórico local de medição de créditos deste protótipo?'))return;
    try{localStorage.removeItem(STORAGE_KEY);}catch(_){}
    sessionAgg=emptyAgg();currentTurnUsage=null;lastFingerprints=[];renderPanel();renderButtonBadge();
  });
}

function openPanel(){createPanel();renderPanel();document.getElementById('aiCreditsOverlay')?.classList.add('show');}
function closePanel(){document.getElementById('aiCreditsOverlay')?.classList.remove('show');}

let tries=0;
const timer=setInterval(()=>{
  tries++;
  if(createButton()||tries>200)clearInterval(timer);
},80);
createPanel();

window.RadarAiCreditsV208={
  open:openPanel,
  close:closePanel,
  reset(){try{localStorage.removeItem(STORAGE_KEY);}catch(_){}sessionAgg=emptyAgg();renderPanel();renderButtonBadge();},
  get snapshot(){return{session:sessionAgg,today:aggregateForDays(1),week:aggregateForDays(7),month:aggregateMonth(),pricing:PRICE};}
};
})();