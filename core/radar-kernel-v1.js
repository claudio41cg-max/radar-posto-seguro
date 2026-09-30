/* Radar Seguro RJ PRO — Core Kernel v1
   Arquitetura modular para impedir que subsistemas independentes se sobrescrevam.

   Objetivo:
   - cada capacidade tem UM único dono;
   - módulos declaram dependências e ciclo de vida;
   - timers/listeners podem ser encerrados pelo próprio módulo;
   - comunicação entre módulos ocorre por eventos e contratos, não por monkeypatch aleatório.

   Esta primeira versão NÃO muda o comportamento do Radar sozinha.
   Ela é a fundação para migrarmos GPS, navegação, voz, mapa e UI um por vez.
*/
(()=>{'use strict';

if(window.RadarKernel){
  return;
}

const moduleRegistry=new Map();
const capabilityOwners=new Map();
const eventListeners=new Map();
const domains=new Map();

function clone(value){
  if(value===undefined)return undefined;
  try{return structuredClone(value)}
  catch(_){
    try{return JSON.parse(JSON.stringify(value))}
    catch(__){return value}
  }
}

function on(eventName,handler){
  if(typeof handler!=='function')throw new TypeError('handler deve ser função');
  const name=String(eventName||'').trim();
  if(!name)throw new Error('eventName obrigatório');

  let bucket=eventListeners.get(name);
  if(!bucket){
    bucket=new Set();
    eventListeners.set(name,bucket);
  }

  bucket.add(handler);

  return ()=>{
    bucket.delete(handler);
    if(!bucket.size)eventListeners.delete(name);
  };
}

function emit(eventName,payload){
  const name=String(eventName||'').trim();
  if(!name)return 0;

  const bucket=eventListeners.get(name);
  if(!bucket?.size)return 0;

  let delivered=0;

  for(const handler of [...bucket]){
    try{
      handler(payload);
      delivered++;
    }catch(error){
      console.error('[RadarKernel:event]',name,error);
    }
  }

  return delivered;
}

function createDomain(name,initialState={}){
  const id=String(name||'').trim();
  if(!id)throw new Error('Nome do domínio obrigatório');

  if(domains.has(id))return domains.get(id).api;

  let state=clone(initialState)??{};
  const subscribers=new Set();

  function get(){
    return clone(state);
  }

  function set(next,meta={}){
    const previous=state;
    state=clone(
      typeof next==='function'
        ?next(clone(state))
        :next
    );

    const snapshot=clone(state);
    const info={
      domain:id,
      meta:clone(meta),
      previous:clone(previous),
      current:snapshot
    };

    for(const fn of [...subscribers]){
      try{fn(snapshot,info)}
      catch(error){console.error('[RadarKernel:domain]',id,error)}
    }

    emit('domain:'+id,info);
    return snapshot;
  }

  function update(patch,meta={}){
    const current=
      state&&typeof state==='object'&&!Array.isArray(state)
        ?state
        :{};

    const delta=
      typeof patch==='function'
        ?patch(clone(current))
        :patch;

    return set(
      {
        ...current,
        ...(delta&&typeof delta==='object'?delta:{})
      },
      meta
    );
  }

  function subscribe(fn,{immediate=false}={}){
    if(typeof fn!=='function')throw new TypeError('subscriber deve ser função');

    subscribers.add(fn);

    if(immediate){
      try{fn(clone(state),{domain:id,initial:true,current:clone(state)})}
      catch(error){console.error('[RadarKernel:domain]',id,error)}
    }

    return ()=>subscribers.delete(fn);
  }

  const api=Object.freeze({
    name:id,
    get,
    set,
    update,
    subscribe
  });

  domains.set(id,{api});
  return api;
}

function resourcesFor(moduleName){
  const intervals=new Set();
  const timeouts=new Set();
  const disposers=new Set();

  function interval(fn,ms,...args){
    const id=setInterval(fn,ms,...args);
    intervals.add(id);
    return id;
  }

  function timeout(fn,ms,...args){
    const id=setTimeout(()=>{
      timeouts.delete(id);
      fn(...args);
    },ms);
    timeouts.add(id);
    return id;
  }

  function listen(target,eventName,handler,options){
    if(!target?.addEventListener)return ()=>{};

    target.addEventListener(eventName,handler,options);

    const dispose=()=>{
      try{target.removeEventListener(eventName,handler,options)}catch(_){}
      disposers.delete(dispose);
    };

    disposers.add(dispose);
    return dispose;
  }

  function track(disposer){
    if(typeof disposer!=='function')return ()=>{};

    let active=true;

    const wrapped=()=>{
      if(!active)return;
      active=false;
      disposers.delete(wrapped);
      try{disposer()}catch(error){console.warn('[RadarKernel:dispose]',moduleName,error)}
    };

    disposers.add(wrapped);
    return wrapped;
  }

  function clear(){
    for(const id of intervals){
      try{clearInterval(id)}catch(_){}
    }

    for(const id of timeouts){
      try{clearTimeout(id)}catch(_){}
    }

    for(const dispose of [...disposers]){
      try{dispose()}catch(_){}
    }

    intervals.clear();
    timeouts.clear();
    disposers.clear();
  }

  return {
    interval,
    timeout,
    listen,
    track,
    clear,
    diagnostics:()=>({
      intervals:intervals.size,
      timeouts:timeouts.size,
      disposers:disposers.size
    })
  };
}

function normalizeCapabilities(owns){
  if(!owns)return [];
  const list=Array.isArray(owns)?owns:[owns];
  return [...new Set(
    list
      .map(x=>String(x||'').trim())
      .filter(Boolean)
  )];
}

function registerModule(definition){
  if(!definition||typeof definition!=='object'){
    throw new TypeError('Definição de módulo inválida');
  }

  const name=String(definition.name||'').trim();
  if(!name)throw new Error('Módulo sem nome');

  if(moduleRegistry.has(name)){
    throw new Error('Módulo já registrado: '+name);
  }

  const owns=normalizeCapabilities(definition.owns);

  for(const capability of owns){
    const owner=capabilityOwners.get(capability);

    if(owner){
      throw new Error(
        'Capacidade "'+capability+'" já pertence a "'+owner+'". '+
        'RadarKernel bloqueou um segundo dono.'
      );
    }
  }

  for(const capability of owns){
    capabilityOwners.set(capability,name);
  }

  const resources=resourcesFor(name);

  const record={
    name,
    version:String(definition.version||'1'),
    owns,
    dependencies:normalizeCapabilities(definition.dependencies),
    status:'registered',
    api:definition.api||{},
    start:typeof definition.start==='function'?definition.start:null,
    stop:typeof definition.stop==='function'?definition.stop:null,
    resources,
    error:null,
    startedAt:0
  };

  moduleRegistry.set(name,record);

  emit('module:registered',{
    name,
    version:record.version,
    owns:[...owns]
  });

  return Object.freeze({
    name,
    version:record.version,
    owns:[...owns],
    start:()=>startModule(name),
    stop:()=>stopModule(name),
    api:record.api
  });
}

function dependenciesReady(record){
  for(const dependency of record.dependencies){
    const owner=capabilityOwners.get(dependency);
    if(!owner)return false;

    const depRecord=moduleRegistry.get(owner);
    if(!depRecord||depRecord.status!=='running')return false;
  }

  return true;
}

async function startModule(name){
  const record=moduleRegistry.get(String(name||''));
  if(!record)throw new Error('Módulo não registrado: '+name);

  if(record.status==='running')return record.api;

  if(!dependenciesReady(record)){
    throw new Error(
      'Dependências ainda não prontas para '+record.name+
      ': '+record.dependencies.join(', ')
    );
  }

  record.status='starting';
  record.error=null;

  try{
    if(record.start){
      const result=await record.start({
        kernel:window.RadarKernel,
        resources:record.resources,
        api:record.api
      });

      if(result&&typeof result==='object'){
        record.api=result;
      }
    }

    record.status='running';
    record.startedAt=Date.now();

    emit('module:started',{
      name:record.name,
      version:record.version,
      owns:[...record.owns]
    });

    return record.api;

  }catch(error){
    record.status='error';
    record.error=String(error?.message||error);
    record.resources.clear();

    emit('module:error',{
      name:record.name,
      error:record.error
    });

    throw error;
  }
}

async function stopModule(name){
  const record=moduleRegistry.get(String(name||''));
  if(!record)return false;

  if(record.status==='stopped'||record.status==='registered')return true;

  record.status='stopping';

  try{
    if(record.stop){
      await record.stop({
        kernel:window.RadarKernel,
        resources:record.resources,
        api:record.api
      });
    }
  }catch(error){
    console.warn('[RadarKernel:stop]',record.name,error);
  }

  record.resources.clear();
  record.status='stopped';

  emit('module:stopped',{name:record.name});
  return true;
}

function getModule(name){
  const record=moduleRegistry.get(String(name||''));
  return record?.api||null;
}

function ownerOf(capability){
  return capabilityOwners.get(String(capability||''))||null;
}

function diagnostics(){
  return {
    version:'1.0.0',
    modules:[...moduleRegistry.values()].map(record=>({
      name:record.name,
      version:record.version,
      status:record.status,
      owns:[...record.owns],
      dependencies:[...record.dependencies],
      resources:record.resources.diagnostics(),
      error:record.error,
      startedAt:record.startedAt
    })),
    ownership:Object.fromEntries(capabilityOwners),
    domains:[...domains.keys()],
    events:[...eventListeners.entries()].map(([name,set])=>({
      name,
      listeners:set.size
    }))
  };
}

/*
  Mapa arquitetural dos subsistemas.
  Durante a migração, cada capacidade abaixo terá somente um dono ativo.
*/
const architecture=Object.freeze({
  'gps.position':'gps',
  'gps.continuity':'gps',
  'navigation.route':'navigation',
  'navigation.progress':'navigation',
  'navigation.guidance':'guidance',
  'navigation.persistence':'persistence',
  'navigation.traffic':'traffic',
  'voice.transport':'voice-live',
  'voice.intent':'voice-controller',
  'voice.output':'voice-controller',
  'map.renderer':'map',
  'map.camera':'camera',
  'map.hazards':'hazards',
  'ui.navigation':'ui',
  'ui.toast':'ui'
});

window.RadarKernel=Object.freeze({
  version:'1.0.0',
  architecture,
  on,
  emit,
  createDomain,
  registerModule,
  startModule,
  stopModule,
  getModule,
  ownerOf,
  diagnostics
});

console.info('[RadarKernel] v1 pronto — arquitetura modular habilitada.');

})();