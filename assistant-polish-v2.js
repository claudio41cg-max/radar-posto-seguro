/* Radar Seguro RJ PRO — mãos livres estável + contexto GPS/ETA v2 */
(() => {
  'use strict';
  if (window.__radarAssistantPolishV2) return;
  window.__radarAssistantPolishV2 = true;

  const WORKER_BASE='https://radar-seguro-ia-rj.claudio41cg.workers.dev';
  const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ').trim();

  function app(){ try{return typeof App!=='undefined'?App:null}catch(_){return null} }
  function assistant(){ try{return typeof VoiceAssistant!=='undefined'?VoiceAssistant:null}catch(_){return null} }

  function gps(){
    const a=app();
    const list=[a?.userPos,a?.filteredPos,a?.rawUserPos];
    for(const p of list){
      if(Array.isArray(p)&&p.length>=2){const lon=Number(p[0]),lat=Number(p[1]);if(Number.isFinite(lat)&&Number.isFinite(lon))return{lat,lon};}
      if(p&&typeof p==='object'){const lat=Number(p.lat??p.latitude??p.coords?.latitude),lon=Number(p.lon??p.lng??p.longitude??p.coords?.longitude);if(Number.isFinite(lat)&&Number.isFinite(lon))return{lat,lon};}
    }
    return null;
  }

  async function address(g){
    if(!g)return'';
    try{
      const path=`/search/2/reverseGeocode/${g.lat},${g.lon}.json?language=pt-BR&radius=100`;
      const r=await fetch(`${WORKER_BASE}/v1/tomtom?path=${encodeURIComponent(path)}`,{cache:'no-store'});
      if(!r.ok)return'';
      const d=await r.json(),a=d?.addresses?.[0]?.address||{};
      return String(a.freeformAddress||[a.streetName,a.municipalitySubdivision,a.municipality].filter(Boolean).join(', ')).trim();
    }catch(_){return'';}
  }

  function isWhere(q){const n=norm(q).replace(/^radar[, ]*/,'');return /^(onde|aonde) (eu )?(estou|to)$/.test(n)||n.includes('minha localizacao')||n.includes('localizacao atual');}
  function isEta(q){const n=norm(q).replace(/^radar[, ]*/,'');return n.includes('quanto tempo falta')||n.includes('falta quanto tempo')||n.includes('quanto falta para chegar')||n.includes('quanto falta pra chegar')||n.includes('tempo ate o destino')||n.includes('hora de chegada');}

  function eta(){
    const a=app(),r=a?.route;
    if(r){
      const total=Number(r.duration??r.summary?.travelTimeInSeconds),dist=Number(r.distance??r.summary?.lengthInMeters),progress=Number(a.routeProgressMeters||0);
      if(Number.isFinite(total)){
        const seconds=Number.isFinite(dist)&&dist>0?Math.max(0,total*(1-Math.min(1,progress/dist))):total;
        return Math.max(1,Math.round(seconds/60));
      }
    }
    const m=String(document.getElementById('sheetTime')?.textContent||'').match(/(\d+)\s*min/i);
    return m?Number(m[1]):null;
  }

  function addHomeHandsFreeButton(){
    const chips=document.querySelector('#mainTopbar .chips');
    if(!chips||document.getElementById('mainHandsFreeBtn'))return;
    const b=document.createElement('button');
    b.className='chip'; b.id='mainHandsFreeBtn'; b.type='button'; b.textContent='🎙️ Mãos livres';
    b.title='Ligar modo mãos livres';
    b.addEventListener('click',()=>assistant()?.toggleHandsFree?.());
    chips.appendChild(b);
  }

  function paintButtons(){
    const va=assistant(); if(!va)return;
    const active=Boolean(va.handsFree);
    const home=document.getElementById('mainHandsFreeBtn');
    const nav=document.getElementById('navAssistantMicBtn');
    if(home){home.classList.toggle('active',active);home.textContent=active?'🟢 Mãos livres':'🎙️ Mãos livres';home.title=active?'Desligar mãos livres':'Ligar mãos livres';}
    if(nav){nav.classList.remove('listening');nav.classList.toggle('hands-free',active);nav.textContent=active?'🟢 Radar':'🎙️ Radar';}
  }

  function install(){
    const va=assistant(); if(!va||va.__polishV2)return Boolean(va?.__polishV2);
    va.__polishV2=true;
    addHomeHandsFreeButton();

    const oldUpdate=va.updateButtons?.bind(va);
    if(oldUpdate) va.updateButtons=function(active){oldUpdate(active);paintButtons();};

    // Mãos livres também funciona na tela inicial; não exige rota ativa.
    const oldToggleHF=va.toggleHandsFree?.bind(va);
    va.toggleHandsFree=function(){
      if(!this.recognition){app()?.toast?.('A voz não está disponível neste navegador.',4000);return;}
      if(this.handsFree){this.stopHandsFree(false);paintButtons();return;}
      try{ if(typeof Voice!=='undefined') Voice.clear(); }catch(_){}
      this.handsFree=true; this.updateButtons(false);
      app()?.toast?.('Mãos livres ativo. Diga Radar antes do pedido.',3500);
      this.scheduleHandsFree?.(700);
    };

    // Não muda vermelho/verde a cada ciclo interno do reconhecimento.
    paintButtons();

    const oldAsk=va.askAI?.bind(va);
    if(oldAsk) va.askAI=async function(question,...rest){
      if(isWhere(question)){
        const g=gps();
        if(g){
          const addr=await address(g);
          this.reply(addr?`Você está em ${addr}.`:`Você está na posição mostrada pelo Radar, latitude ${g.lat.toFixed(5)} e longitude ${g.lon.toFixed(5)}.`);
          return true;
        }
        this.reply('Ainda estou aguardando a primeira posição do GPS do mapa.'); return true;
      }
      if(isEta(question)){
        const m=eta();
        this.reply(Number.isFinite(m)?`Faltam aproximadamente ${m} minutos para chegar ao destino.`:'Ainda não há uma rota ativa com tempo calculado.');
        return true;
      }
      return oldAsk(question,...rest);
    };
    return true;
  }

  addHomeHandsFreeButton();
  if(!install()){
    let n=0;const t=setInterval(()=>{n++;addHomeHandsFreeButton();if(install()||n>80)clearInterval(t);},250);
  }
})();
