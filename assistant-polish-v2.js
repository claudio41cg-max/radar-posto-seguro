/* Radar Seguro RJ PRO — mãos livres estável + contexto GPS/ETA v3 */
(() => {
  'use strict';
  if (window.__radarAssistantPolishV3) return;
  window.__radarAssistantPolishV3 = true;

  const WORKER_BASE='https://radar-seguro-ia-rj.claudio41cg.workers.dev';
  const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ').trim();
  function app(){ try{return typeof App!=='undefined'?App:null}catch(_){return null} }
  function assistant(){ try{return typeof VoiceAssistant!=='undefined'?VoiceAssistant:null}catch(_){return null} }

  function gps(){
    const a=app();
    for(const p of [a?.userPos,a?.filteredPos,a?.rawUserPos]){
      if(Array.isArray(p)&&p.length>=2){const lon=Number(p[0]),lat=Number(p[1]);if(Number.isFinite(lat)&&Number.isFinite(lon))return{lat,lon};}
      if(p&&typeof p==='object'){const lat=Number(p.lat??p.latitude??p.coords?.latitude),lon=Number(p.lon??p.lng??p.longitude??p.coords?.longitude);if(Number.isFinite(lat)&&Number.isFinite(lon))return{lat,lon};}
    }
    return null;
  }

  async function address(g){
    if(!g)return'';
    try{
      const path=`/search/2/reverseGeocode/${g.lat},${g.lon}.json?language=pt-BR&radius=120`;
      const r=await fetch(`${WORKER_BASE}/v1/tomtom?path=${encodeURIComponent(path)}`,{cache:'no-store'});
      if(!r.ok)return'';
      const d=await r.json(),a=d?.addresses?.[0]?.address||{};
      return String(a.freeformAddress||[a.streetName,a.streetNumber,a.municipalitySubdivision,a.municipality].filter(Boolean).join(', ')).trim();
    }catch(_){return'';}
  }

  const isWhere=q=>{const n=norm(q).replace(/^radar[, ]*/,'');return /^(onde|aonde) (eu )?(estou|to)$/.test(n)||n.includes('minha localizacao')||n.includes('localizacao atual')||n.includes('onde que eu estou');};
  const isEta=q=>{const n=norm(q).replace(/^radar[, ]*/,'');return n.includes('quanto tempo falta')||n.includes('falta quanto tempo')||n.includes('quanto falta para chegar')||n.includes('quanto falta pra chegar')||n.includes('tempo ate o destino')||n.includes('hora de chegada');};

  async function directAnswer(q){
    const va=assistant(); if(!va)return false;
    if(isWhere(q)){
      const g=gps();
      if(!g){va.reply('Ainda estou aguardando a posição do GPS do mapa.');return true;}
      const a=await address(g);
      va.reply(a?`Você está em ${a}.`:`Você está na posição mostrada pelo Radar: latitude ${g.lat.toFixed(5)} e longitude ${g.lon.toFixed(5)}.`);
      return true;
    }
    if(isEta(q)){
      const A=app(),r=A?.route;
      let m=null;
      if(r){const total=Number(r.duration??r.summary?.travelTimeInSeconds),dist=Number(r.distance??r.summary?.lengthInMeters),p=Number(A.routeProgressMeters||0);if(Number.isFinite(total)){const s=Number.isFinite(dist)&&dist>0?Math.max(0,total*(1-Math.min(1,p/dist))):total;m=Math.max(1,Math.round(s/60));}}
      if(m==null){const x=String(document.getElementById('sheetTime')?.textContent||'').match(/(\d+)\s*min/i);if(x)m=Number(x[1]);}
      va.reply(Number.isFinite(m)?`Faltam aproximadamente ${m} minutos para chegar ao destino.`:'Ainda não há uma rota ativa com tempo calculado.');
      return true;
    }
    return false;
  }

  function addButton(){
    const chips=document.querySelector('#mainTopbar .chips')||document.querySelector('.topbar .chips');
    if(!chips||document.getElementById('mainHandsFreeBtn'))return;
    const b=document.createElement('button'); b.className='chip'; b.id='mainHandsFreeBtn'; b.type='button'; b.textContent='🎙️ Mãos livres';
    b.onclick=()=>assistant()?.toggleHandsFree?.(); chips.appendChild(b);
  }

  function repaint(){
    const va=assistant(),on=Boolean(va?.handsFree);
    const h=document.getElementById('mainHandsFreeBtn'),n=document.getElementById('navAssistantMicBtn');
    if(h){h.classList.toggle('active',on);h.textContent=on?'🟢 Mãos livres':'🎙️ Mãos livres';}
    if(n){n.classList.remove('listening');n.classList.toggle('hands-free',on);n.textContent=on?'🟢 Radar':'🎙️ Radar';}
  }

  function install(){
    const va=assistant(); if(!va||va.__polishV3)return Boolean(va?.__polishV3); va.__polishV3=true; addButton();

    const oldHandle=typeof va.handle==='function'?va.handle.bind(va):null;
    if(oldHandle) va.handle=async function(text,...rest){ if(await directAnswer(text))return true; return oldHandle(text,...rest); };

    const oldAsk=typeof va.askAI==='function'?va.askAI.bind(va):null;
    if(oldAsk) va.askAI=async function(text,...rest){ if(await directAnswer(text))return true; return oldAsk(text,...rest); };

    const oldUpdate=va.updateButtons?.bind(va);
    if(oldUpdate) va.updateButtons=function(active){ oldUpdate(active); repaint(); };

    va.toggleHandsFree=function(){
      if(!this.recognition){app()?.toast?.('A voz não está disponível neste navegador.',4000);return;}
      if(this.handsFree){this.stopHandsFree(false);repaint();return;}
      this.handsFree=true;
      try{this.recognition.continuous=true;}catch(_){}
      this.updateButtons(false);
      app()?.toast?.('Mãos livres ativo. Diga Radar antes do pedido.',3200);
      clearTimeout(this.restartTimer); this.restartTimer=null;
      if(!this.listening){try{this.recognition.start();}catch(_){}}
    };

    // Evita o ciclo vermelho/verde e reduz reinícios do reconhecimento, que causavam o som repetitivo.
    const rec=va.recognition;
    if(rec){
      try{rec.continuous=true;}catch(_){}
      const originalOnResult=rec.onresult;
      rec.onresult=function(event){
        if(!va.handsFree){return originalOnResult?.call(this,event);}
        if(typeof Voice!=='undefined'&&Voice.speaking)return;
        let final='';
        for(let i=event.resultIndex;i<event.results.length;i++) if(event.results[i].isFinal) final+=(event.results[i][0]?.transcript||'');
        final=final.trim(); if(!final)return;
        va.transcript='';
        if(va.hasWakeWord?.(final)) Promise.resolve(va.handle(final)).catch(()=>{});
      };
      va.pauseForSpeech=function(){ /* mantém o microfone aberto; resultados são ignorados enquanto a voz fala */ };
      const oldEnd=rec.onend;
      rec.onend=function(){
        va.listening=false; repaint();
        if(va.handsFree){ setTimeout(()=>{if(va.handsFree&&!va.listening){try{rec.start();}catch(_){}}},1200); return; }
        return oldEnd?.call(this);
      };
    }

    repaint(); return true;
  }

  addButton();
  let tries=0;const t=setInterval(()=>{tries++;addButton();if(install()||tries>100)clearInterval(t);},200);
})();
