const DEFAULT_MODEL = 'openai/gpt-oss-120b';
const LIVE_MODEL = 'gemini-3.1-flash-live-preview';
const DEFAULT_ORIGIN = 'https://claudio41cg-max.github.io';
const TOMTOM_HOST = 'https://api.tomtom.com';
const GROQ_CHAT_URL = 'https://api.groq.com/openai/v1/chat/completions';
const MAX_MESSAGE_LENGTH = 600;
const MAX_HISTORY_ITEMS = 6;
const MAX_REQUEST_LENGTH = 12000;
const aiMemoryLimits = new Map();
const tomtomMemoryLimits = new Map();

const SYSTEM_INSTRUCTION = `Você é Radar, o assistente de voz do Radar Seguro RJ Pro. Responda em português do Brasil, de forma curta e direta. Nunca invente localização, rota, trânsito ou ocorrências.`;

function cleanText(value,max=MAX_MESSAGE_LENGTH){return String(value??'').replace(/[\u0000-\u001f\u007f]/g,' ').replace(/\s+/g,' ').trim().slice(0,max);}
function allowedOrigins(env){return new Set(String(env.ALLOWED_ORIGINS||DEFAULT_ORIGIN).split(',').map(v=>v.trim()).filter(Boolean));}
function corsHeaders(origin,env,contentType='application/json; charset=utf-8'){
  const h={'Content-Type':contentType,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Vary':'Origin'};
  if(origin&&allowedOrigins(env).has(origin)){
    h['Access-Control-Allow-Origin']=origin;
    h['Access-Control-Allow-Methods']='GET, POST, OPTIONS';
    h['Access-Control-Allow-Headers']='Content-Type, X-Radar-Client';
    h['Access-Control-Max-Age']='86400';
  }
  return h;
}
function json(data,status,origin,env){return new Response(JSON.stringify(data),{status,headers:corsHeaders(origin,env)});}
function normalizeHistory(value){if(!Array.isArray(value))return[];return value.slice(-MAX_HISTORY_ITEMS).map(i=>({role:i?.role==='assistant'||i?.role==='model'?'assistant':'user',content:cleanText(i?.content??i?.text,400)})).filter(i=>i.content);}
function clientKey(request){const c=cleanText(request.headers.get('X-Radar-Client'),80);if(/^[a-zA-Z0-9_-]{16,80}$/.test(c))return`client:${c}`;return`ip:${cleanText(request.headers.get('CF-Connecting-IP'),64)||'unknown'}`;}
function memoryRateLimit(store,key,limit,periodMs){const now=Date.now(),cur=store.get(key);if(!cur||now-cur.startedAt>=periodMs){store.set(key,{startedAt:now,count:1});return true;}cur.count++;return cur.count<=limit;}
async function withinAiRateLimit(request,env){const key=clientKey(request);if(env.AI_RATE_LIMITER?.limit){const r=await env.AI_RATE_LIMITER.limit({key});return Boolean(r?.success);}return memoryRateLimit(aiMemoryLimits,key,20,60000);}
function withinTomTomRateLimit(request){return memoryRateLimit(tomtomMemoryLimits,clientKey(request),240,60000);}

async function askGroq(message,history,env){
  const model=cleanText(env.GROQ_MODEL||DEFAULT_MODEL,100);
  const response=await fetch(GROQ_CHAT_URL,{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${env.GROQ_API_KEY}`},body:JSON.stringify({model,messages:[{role:'system',content:SYSTEM_INSTRUCTION},...normalizeHistory(history),{role:'user',content:message}],temperature:.35,max_completion_tokens:220,stream:false})});
  let data={};try{data=await response.json();}catch(_){}
  if(!response.ok){const e=new Error(cleanText(data?.error?.message,500)||`Groq HTTP ${response.status}`);e.status=response.status;throw e;}
  const reply=cleanText(data?.choices?.[0]?.message?.content,900);if(!reply)throw new Error('Resposta vazia');return{reply,model};
}

const ALLOWED_TOMTOM_PREFIXES=['/routing/','/search/','/traffic/','/maps/orbis/'];
function isAllowedTomTomPath(p){return ALLOWED_TOMTOM_PREFIXES.some(x=>p.startsWith(x));}
async function handleTomTomProxy(request,env,origin){
  if(!env.TOMTOM_API_KEY)return json({ok:false,error:'TomTom ainda não configurada no servidor.'},503,origin,env);
  if(request.method!=='GET')return json({ok:false,error:'Método não permitido.'},405,origin,env);
  if(!withinTomTomRateLimit(request))return json({ok:false,error:'Muitas consultas TomTom em pouco tempo.'},429,origin,env);
  const incoming=new URL(request.url),encoded=incoming.searchParams.get('path')||'';
  let path;try{path=decodeURIComponent(encoded);}catch(_){return json({ok:false,error:'Caminho TomTom inválido.'},400,origin,env);}
  if(!path.startsWith('/')||!isAllowedTomTomPath(path))return json({ok:false,error:'Serviço TomTom não autorizado.'},403,origin,env);
  const target=new URL(TOMTOM_HOST+path);target.searchParams.delete('key');target.searchParams.set('key',env.TOMTOM_API_KEY);
  const r=await fetch(target.toString(),{headers:{Accept:request.headers.get('Accept')||'*/*'}});
  return new Response(r.body,{status:r.status,headers:corsHeaders(origin,env,r.headers.get('content-type')||'application/json')});
}

async function handleGeoapify(request,env,origin){
  if(!env.GEOAPIFY_API_KEY)return json({ok:false,error:'Geoapify ainda não configurada no servidor.'},503,origin,env);
  if(request.method!=='GET')return json({ok:false,error:'Método não permitido.'},405,origin,env);
  const u=new URL(request.url),lat=Number(u.searchParams.get('lat')),lon=Number(u.searchParams.get('lon'));
  if(!Number.isFinite(lat)||!Number.isFinite(lon)||lat<-90||lat>90||lon<-180||lon>180)return json({ok:false,error:'Coordenadas inválidas.'},400,origin,env);
  const target=new URL('https://api.geoapify.com/v1/geocode/reverse');
  target.searchParams.set('lat',String(lat));target.searchParams.set('lon',String(lon));target.searchParams.set('format','json');target.searchParams.set('lang','pt');target.searchParams.set('apiKey',env.GEOAPIFY_API_KEY);
  const r=await fetch(target.toString(),{headers:{Accept:'application/json'}});
  let data={};try{data=await r.json();}catch(_){}
  if(!r.ok)return json({ok:false,error:'Geoapify temporariamente indisponível.'},502,origin,env);
  const a=data?.results?.[0]||{};
  return json({ok:true,neighborhood:cleanText(a.suburb||a.district||a.quarter||a.neighbourhood,120),street:cleanText(a.street||a.address_line1,180),city:cleanText(a.city||a.municipality||a.county,120),postcode:cleanText(a.postcode,30),formatted:cleanText(a.formatted,300)},200,origin,env);
}

function liveKeyFor(env,tier='auto'){
  const requested=String(tier||'auto').toLowerCase();
  const free=String(env.GEMINI_LIVE_FREE_API_KEY||'').trim();
  const paid=String(env.GEMINI_LIVE_PAID_API_KEY||'').trim();
  const fallback=String(env.GEMINI_API_KEY||'').trim();
  if(requested==='free') return free?{key:free,source:'free'}:fallback?{key:fallback,source:'default'}:{key:'',source:'none'};
  if(requested==='paid') return paid?{key:paid,source:'paid'}:fallback?{key:fallback,source:'default'}:{key:'',source:'none'};
  if(free) return {key:free,source:'free'};
  if(fallback) return {key:fallback,source:'default'};
  if(paid) return {key:paid,source:'paid'};
  return {key:'',source:'none'};
}

async function createLiveToken(apiKey){
  const now=Date.now();
  const expireTime=new Date(now+30*60*1000).toISOString();
  const newSessionExpireTime=new Date(now+2*60*1000).toISOString();
  const response=await fetch('https://generativelanguage.googleapis.com/v1beta/auth_tokens',{
    method:'POST',
    headers:{'Content-Type':'application/json','x-goog-api-key':apiKey},
    body:JSON.stringify({uses:1,expireTime,newSessionExpireTime})
  });
  let data={};try{data=await response.json();}catch(_){}
  if(!response.ok){const e=new Error(cleanText(data?.error?.message,500)||`Gemini auth token HTTP ${response.status}`);e.status=response.status;throw e;}
  const token=cleanText(data?.name,3000);
  if(!token)throw new Error('O Gemini não retornou o token temporário.');
  return {token,expireTime:data?.expireTime||expireTime,newSessionExpireTime:data?.newSessionExpireTime||newSessionExpireTime};
}

async function liveTokenResponse(request,url,origin,env){
  if(!await withinAiRateLimit(request,env))return json({ok:false,error:'Muitas tentativas em pouco tempo. Aguarde um minuto.'},429,origin,env);
  const tier=String(url.searchParams.get('tier')||'auto').toLowerCase();
  let selected=liveKeyFor(env,tier);
  if(!selected.key)return json({ok:false,error:'Gemini Live ainda não configurado no servidor.'},503,origin,env);
  try{
    const out=await createLiveToken(selected.key);
    return json({ok:true,token:out.token,model:LIVE_MODEL,source:selected.source,expiresAt:out.expireTime,newSessionExpiresAt:out.newSessionExpireTime,paidFallbackAvailable:Boolean(env.GEMINI_LIVE_PAID_API_KEY)},200,origin,env);
  }catch(error){
    const upstreamStatus=Number(error?.status)||0;
    const quotaLike=upstreamStatus===429||/quota|rate|resource|exhaust/i.test(String(error?.message||''));
    if(tier==='auto'&&selected.source==='free'&&quotaLike&&env.GEMINI_LIVE_PAID_API_KEY){
      try{
        selected={key:String(env.GEMINI_LIVE_PAID_API_KEY).trim(),source:'paid'};
        const out=await createLiveToken(selected.key);
        return json({ok:true,token:out.token,model:LIVE_MODEL,source:'paid',fallbackFrom:'free',expiresAt:out.expireTime,newSessionExpiresAt:out.newSessionExpireTime,paidFallbackAvailable:true},200,origin,env);
      }catch(paidError){
        const paidStatus=Number(paidError?.status)||0;
        return json({ok:false,error:'Não foi possível abrir a reserva paga do Gemini Live.',upstreamStatus:paidStatus||undefined},paidStatus===429?429:502,origin,env);
      }
    }
    const status=upstreamStatus===429?429:502;
    return json({ok:false,error:status===429?'O limite do Gemini Live foi atingido.':'Não foi possível iniciar o Gemini Live agora.',upstreamStatus:upstreamStatus||undefined,source:selected.source},status,origin,env);
  }
}

export default{async fetch(request,env){
  const url=new URL(request.url),origin=request.headers.get('Origin')||'',allowed=allowedOrigins(env).has(origin);

  if(request.method==='OPTIONS'){
    if(!allowed)return json({ok:false,error:'Origem não autorizada.'},403,origin,env);
    return new Response(null,{status:204,headers:corsHeaders(origin,env)});
  }

  if(request.method==='GET'&&url.pathname==='/health'){
    return json({ok:true,service:'radar-seguro-rj-ai',provider:'groq',configured:Boolean(env.GROQ_API_KEY),tomtomConfigured:Boolean(env.TOMTOM_API_KEY),geoapifyConfigured:Boolean(env.GEOAPIFY_API_KEY),liveConfigured:Boolean(env.GEMINI_LIVE_FREE_API_KEY||env.GEMINI_LIVE_PAID_API_KEY||env.GEMINI_API_KEY),liveModel:LIVE_MODEL,model:cleanText(env.GROQ_MODEL||DEFAULT_MODEL,100)},200,allowed?origin:'',env);
  }

  if(url.pathname==='/v1/live-token'&&request.method==='POST'){
    if(!allowed)return json({ok:false,error:'Origem não autorizada.'},403,origin,env);
    return liveTokenResponse(request,url,origin,env);
  }

  if(url.pathname==='/v1/geo/reverse'){
    if(!allowed)return json({ok:false,error:'Origem não autorizada.'},403,origin,env);
    try{return await handleGeoapify(request,env,origin);}catch(_){return json({ok:false,error:'Geocodificação temporariamente indisponível.'},502,origin,env);}
  }

  if(url.pathname==='/v1/tomtom'){
    if(!allowed)return json({ok:false,error:'Origem não autorizada.'},403,origin,env);
    try{return await handleTomTomProxy(request,env,origin);}catch(_){return json({ok:false,error:'Serviço TomTom temporariamente indisponível.'},502,origin,env);}
  }

  if(url.pathname!=='/v1/chat'||request.method!=='POST')return json({ok:false,error:'Rota não encontrada.'},404,origin,env);
  if(!allowed)return json({ok:false,error:'Origem não autorizada.'},403,origin,env);
  if(!env.GROQ_API_KEY)return json({ok:false,error:'Inteligência ainda não configurada.'},503,origin,env);
  if(!await withinAiRateLimit(request,env))return json({ok:false,error:'Muitas perguntas em pouco tempo. Aguarde um minuto.'},429,origin,env);

  let payload;
  try{
    const raw=await request.text();
    if(raw.length>MAX_REQUEST_LENGTH)return json({ok:false,error:'Pedido muito grande.'},413,origin,env);
    payload=JSON.parse(raw);
  }catch(_){return json({ok:false,error:'Pedido inválido.'},400,origin,env);}

  const message=cleanText(payload?.message??payload?.pergunta);
  if(message.length<2)return json({ok:false,error:'Faça uma pergunta para o Radar.'},400,origin,env);

  try{
    const r=await askGroq(message,payload?.history,env);
    return json({ok:true,reply:r.reply,sources:[],model:r.model,provider:'groq'},200,origin,env);
  }catch(e){
    return json({ok:false,error:cleanText(e?.message,500)||'A inteligência está temporariamente indisponível.'},Number(e?.status)===429?429:502,origin,env);
  }
}};
