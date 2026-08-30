import test from 'node:test';
import assert from 'node:assert/strict';
import {handleTomTomProxy} from '../src/tomtom-proxy.js';

const ORIGIN='https://claudio41cg-max.github.io';

function req(path){
  return new Request(
    `https://radar.test/v1/tomtom?path=${encodeURIComponent(path)}`,
    {method:'GET',headers:{Origin:ORIGIN,Accept:'application/json'}}
  );
}

test('recusa proxy TomTom sem segredo',async()=>{
  const response=await handleTomTomProxy(req('/routing/1/calculateRoute/x/json'),{},ORIGIN);
  assert.equal(response.status,503);
});

test('recusa caminho fora da lista permitida',async()=>{
  const response=await handleTomTomProxy(
    req('/maps/orbis/maps/basic_main/2/tile/0/0/0.pbf'),
    {TOMTOM_API_KEY:'segredo'},
    ORIGIN
  );
  assert.equal(response.status,403);
});

test('injeta a chave somente no servidor',async()=>{
  const originalFetch=globalThis.fetch;
  let upstream='';

  globalThis.fetch=async url=>{
    upstream=String(url);
    return new Response(JSON.stringify({ok:true}),{
      status:200,
      headers:{'Content-Type':'application/json'}
    });
  };

  try{
    const response=await handleTomTomProxy(
      req('/routing/1/calculateRoute/1,2:3,4/json?traffic=true&key=nao-usar'),
      {TOMTOM_API_KEY:'segredo-real'},
      ORIGIN
    );

    assert.equal(response.status,200);
    assert.match(upstream,/traffic=true/);
    assert.match(upstream,/key=segredo-real/);
    assert.doesNotMatch(upstream,/nao-usar/);
  }finally{
    globalThis.fetch=originalFetch;
  }
});
