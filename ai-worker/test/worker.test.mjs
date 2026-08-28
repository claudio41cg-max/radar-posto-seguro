import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/index.js';

const ORIGIN='https://claudio41cg-max.github.io';

function request(path='/v1/chat',options={}){
  return new Request(`https://radar.test${path}`,{
    method:options.method||'POST',
    headers:{
      Origin:options.origin??ORIGIN,
      'Content-Type':'application/json',
      'X-Radar-Client':'radar_test_client_123456',
      ...options.headers
    },
    body:options.body===undefined
      ? JSON.stringify({message:'Quem foi Zico?'})
      : options.body
  });
}

function environment(extra={}){
  return {
    GEMINI_API_KEY:'segredo-de-teste',
    GEMINI_MODEL:'gemini-2.5-flash-lite',
    ALLOWED_ORIGINS:ORIGIN,
    AI_RATE_LIMITER:{
      async limit(){
        return {success:true};
      }
    },
    ...extra
  };
}

test('bloqueia origem diferente',async()=>{
  const response=await worker.fetch(
    request('/v1/chat',{origin:'https://site-invalido.example'}),
    environment()
  );

  assert.equal(response.status,403);
  assert.equal(response.headers.get('access-control-allow-origin'),null);
});

test('responde ao preflight autorizado',async()=>{
  const response=await worker.fetch(
    request('/v1/chat',{method:'OPTIONS',body:null}),
    environment()
  );

  assert.equal(response.status,204);
  assert.equal(response.headers.get('access-control-allow-origin'),ORIGIN);
});

test('não funciona sem segredo configurado',async()=>{
  const response=await worker.fetch(
    request(),
    environment({GEMINI_API_KEY:''})
  );

  assert.equal(response.status,503);
  assert.match((await response.json()).error,/não configurada/i);
});

test('respeita o limite de perguntas',async()=>{
  const response=await worker.fetch(
    request(),
    environment({
      AI_RATE_LIMITER:{
        async limit(){
          return {success:false};
        }
      }
    })
  );

  assert.equal(response.status,429);
});

test('recusa pedidos grandes antes de consultar a IA',async()=>{
  const response=await worker.fetch(
    request('/v1/chat',{
      body:JSON.stringify({message:'a'.repeat(13000)})
    }),
    environment()
  );

  assert.equal(response.status,413);
});

test('envia a pergunta ao Gemini sem revelar a chave',async()=>{
  const originalFetch=globalThis.fetch;
  let upstreamRequest;

  globalThis.fetch=async(url,options)=>{
    upstreamRequest={url,options};

    return new Response(
      JSON.stringify({
        candidates:[{
          content:{parts:[{text:'Zico foi um dos maiores jogadores da história do Flamengo.'}]},
          groundingMetadata:{
            groundingChunks:[{
              web:{title:'Fonte esportiva',uri:'https://example.com/zico'}
            }]
          }
        }]
      }),
      {status:200,headers:{'Content-Type':'application/json'}}
    );
  };

  try{
    const response=await worker.fetch(request(),environment());
    const data=await response.json();

    assert.equal(response.status,200);
    assert.equal(data.ok,true);
    assert.match(data.reply,/Zico/);
    assert.equal(data.sources.length,1);
    assert.match(upstreamRequest.url,/gemini-2\.5-flash-lite/);
    assert.equal(upstreamRequest.options.headers['x-goog-api-key'],'segredo-de-teste');
    assert.doesNotMatch(JSON.stringify(data),/segredo-de-teste/);
  }finally{
    globalThis.fetch=originalFetch;
  }
});

test('ativa pesquisa para uma pergunta atual',async()=>{
  const originalFetch=globalThis.fetch;
  let sentBody;

  globalThis.fetch=async(url,options)=>{
    sentBody=JSON.parse(options.body);
    return new Response(
      JSON.stringify({
        candidates:[{content:{parts:[{text:'Não consegui confirmar o placar.'}]}}]
      }),
      {status:200,headers:{'Content-Type':'application/json'}}
    );
  };

  try{
    const response=await worker.fetch(
      request('/v1/chat',{
        body:JSON.stringify({message:'O Flamengo ganhou hoje?'})
      }),
      environment()
    );

    assert.equal(response.status,200);
    assert.deepEqual(sentBody.tools,[{google_search:{}}]);
  }finally{
    globalThis.fetch=originalFetch;
  }
});
