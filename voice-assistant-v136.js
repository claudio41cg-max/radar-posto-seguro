/* Radar Seguro RJ PRO v136 — voz e assistente extraídos do index.html */
/* =========================================================
   VOZ
========================================================= */

const Voice = {

  enabled:true,

  queue:[],

  speaking:false,


  clear(){

    if(
      'speechSynthesis'
      in window
    ){

      speechSynthesis.cancel();

    }

    this.queue=[];

    this.speaking=false;

  },


  speak(text,priority=false){

    if(
      !this.enabled ||
      !('speechSynthesis' in window)
    )
      return;


    if(
      typeof VoiceAssistant!==
      'undefined'
    )
      VoiceAssistant.pauseForSpeech();


    if(priority){

      this.clear();

    }


    if(
      this.queue.includes(text)
    )
      return;


    this.queue.push(text);

    this.process();

  },


  process(){

    if(
      this.speaking ||
      !this.queue.length
    )
      return;


    const text=
      this.queue.shift();


    const u=
      new SpeechSynthesisUtterance(text);


    u.lang='pt-BR';

    u.rate=1.04;

    this.speaking=true;


    u.onend=
      ()=>{
        this.speaking=false;
        const noMoreSpeech=!this.queue.length;
        if(noMoreSpeech && typeof VoiceAssistant!=='undefined'){
          VoiceAssistant.onAssistantSpeechEnded(text);
        }
        setTimeout(()=>this.process(),120);
      };

    u.onerror=
      ()=>{
        this.speaking=false;
        if(typeof VoiceAssistant!=='undefined') VoiceAssistant.cancelFollowUpWindow();
        setTimeout(()=>this.process(),120);
      };


    speechSynthesis.speak(u);

  }

};


/* =========================================================
   ASSISTENTE DE VOZ LOCAL E GRATUITA
========================================================= */

const VoiceAssistant = {

  recognition:null,

  listening:false,

  transcript:'',

  lastError:null,

  handsFree:false,

  restartTimer:null,

  homeKey:'radarSeguroRJ_homeAddress',

  occurrenceOffset:0,

  weatherCache:{},

  aiEndpoint:RADAR_CONFIG.AI_ENDPOINT || 'https://radar-seguro-ia-rj.claudio41cg.workers.dev',

  aiBusy:false,
  conversationHistory:[],
  lastNewsItems:[],
  lastNewsIndex:0,
  lastNewsUpdatedAt:0,
  followUpMode:false,
  followUpTimer:null,
  followUpRequested:false,


  init(){

    const Recognition=
      window.SpeechRecognition ||
      window.webkitSpeechRecognition;


    if(!Recognition){

      this.updateButtons(false);

      return;

    }


    this.recognition=
      new Recognition();


    this.recognition.lang='pt-BR';

    this.recognition.continuous=false;

    this.recognition.interimResults=true;

    this.recognition.maxAlternatives=1;


    this.recognition.onstart=()=>{

      this.listening=true;

      this.transcript='';

      this.lastError=null;

      this.updateButtons(true);

      if(!this.handsFree && !this.followUpMode)
        App.toast(
          '🎙️ Estou ouvindo. Fale agora...',
          10000
        );

    };


    this.recognition.onresult=event=>{

      let finalText='';

      let interimText='';


      for(
        let i=event.resultIndex;
        i<event.results.length;
        i++
      ){

        const text=
          event.results[i][0]
          ?.transcript||'';


        if(event.results[i].isFinal)
          finalText+=text;
        else
          interimText+=text;

      }


      if(finalText.trim()){

        this.transcript=
          finalText.trim();

        App.toast(
          'Você disse: '+
          this.transcript,
          2600
        );

        this.recognition.stop();

      }else if(interimText.trim()){

        App.toast(
          'Ouvindo: '+
          interimText.trim(),
          2400
        );

      }

    };


    this.recognition.onerror=event=>{

      const error=
        event.error||
        'unknown';


      this.lastError=error;


      if(
        error===
        'aborted'
      )
        return;

      if(this.followUpMode && error==='no-speech'){
        this.lastError='aborted';
        return;
      }


      if(
        this.handsFree &&
        error===
        'no-speech'
      ){

        this.lastError=null;

        return;

      }


      const messages={
        'not-allowed':'Permita o uso do microfone no Chrome.',
        'service-not-allowed':'O reconhecimento de voz está bloqueado no navegador.',
        'audio-capture':'Microfone não encontrado.',
        'network':'A voz precisa de internet neste aparelho.',
        'no-speech':'Não consegui ouvir. Toque no microfone e tente novamente.'
      };


      if(
        [
          'not-allowed',
          'service-not-allowed',
          'audio-capture'
        ]
        .includes(
          error
        )
      )
        this.stopHandsFree(false);


      App.toast(
        messages[error]||
        'Não consegui entender. Tente novamente.',
        5000
      );

    };


    this.recognition.onend=()=>{

      this.listening=false;

      this.updateButtons(false);


      const text=
        this.transcript.trim();


      const error=
        this.lastError;

      clearTimeout(this.followUpTimer);
      this.followUpTimer=null;
      this.followUpMode=false;

      this.transcript='';

      this.lastError=null;


      if(text && !error)
        this.handle(text);

    };


    this.updateButtons(false);

  },


  updateButtons(active){

    const supported=
      Boolean(
        this.recognition
      );


    const main=
      document.getElementById(
        'assistantMicBtn'
      );


    const nav=
      document.getElementById(
        'navAssistantMicBtn'
      );


    if(main){

      main.classList.toggle(
        'listening',
        Boolean(
          active &&
          !this.handsFree
        )
      );

      main.setAttribute(
        'aria-pressed',
        active &&
        !this.handsFree
        ? 'true'
        : 'false'
      );

      main.title=
        supported
        ? active &&
          !this.handsFree
          ? 'Parar de ouvir'
          : 'Falar com o Radar'
        : 'Voz não disponível neste navegador';

    }


    if(nav){

      nav.classList.remove('listening');

      nav.classList.toggle(
        'hands-free',
        this.handsFree
      );

      nav.setAttribute(
        'aria-pressed',
        this.handsFree
        ? 'true'
        : 'false'
      );

      nav.title=
        supported
        ? this.handsFree
          ? 'Desligar modo mãos livres'
          : 'Ligar modo mãos livres'
        : 'Voz não disponível neste navegador';

    }


    if(main){
      main.classList.remove('radar-handsfree');
      main.innerHTML='<span class="radar-voice-orb" aria-hidden="true"></span><svg class="radar-voice-svg" viewBox="0 0 48 48" aria-hidden="true"><rect x="18" y="8" width="12" height="22" rx="6" fill="none" stroke="currentColor" stroke-width="3"/><path d="M13 24c0 6.1 4.9 11 11 11s11-4.9 11-11M24 35v7M18 42h12" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>';
    }


    if(nav)
      nav.textContent=this.handsFree ? '🎙️ Mãos livres' : '🎙️ Radar';

  },


  toggle(){

    this.cancelFollowUpWindow();

    if(!this.recognition){
      App.toast('A voz não está disponível neste navegador. Abra o app no Chrome.',5000);
      return;
    }

    // Sempre libera qualquer sessão persistente anterior antes de iniciar.
    this.handsFree=false;
    this.conversationUntil=0;
    clearTimeout(this.restartTimer);
    this.restartTimer=null;
    this.releaseMicrophone();

    if(this.listening){
      this.transcript='';
      this.lastError='aborted';
      try{ this.recognition.abort(); }catch(e){}
      this.listening=false;
      this.updateButtons(false);
      return;
    }

    Voice.clear();
    this.transcript='';
    this.lastError=null;
    try{
      this.recognition.start();
    }catch(e){
      App.toast('Aguarde um instante e tente falar novamente.');
    }

  },


  hasWakeWord(text){

    return /^\s*(?:(?:oi|ol[áa]|ei|por favor)\s+)?radar\b/i
      .test(String(text||''));

  },

  conversationUntil:0,
  micKeepAliveStream:null,

  async holdMicrophone(){
    if(this.micKeepAliveStream || !navigator.mediaDevices?.getUserMedia) return;
    try{
      this.micKeepAliveStream=await navigator.mediaDevices.getUserMedia({audio:true});
    }catch(e){}
  },

  releaseMicrophone(){
    try{
      this.micKeepAliveStream?.getTracks()?.forEach(t=>t.stop());
    }catch(e){}
    this.micKeepAliveStream=null;
  },

  conversationOpen(){
    return Date.now()<Number(this.conversationUntil||0);
  },

  keepConversationOpen(){
    this.conversationUntil=Date.now()+120000;
  },


  pauseForSpeech(){

    if(
      !this.handsFree ||
      !this.listening ||
      !this.recognition
    )
      return;


    this.transcript='';

    this.lastError='aborted';

    this.listening=false;

    this.updateButtons(false);


    try{

      this.recognition.abort();

    }catch(e){}

  },


  scheduleHandsFree(delay=1800){

    clearTimeout(
      this.restartTimer
    );


    this.restartTimer=null;


    if(
      !this.handsFree ||
      !this.recognition
    )
      return;


    this.restartTimer=
      setTimeout(
        ()=>{

          this.restartTimer=null;


          if(
            !this.handsFree ||
            document.visibilityState===
            'hidden'
          )
            return;


          if(
            Voice.speaking ||
            Voice.queue.length
          ){

            this.scheduleHandsFree(
              450
            );

            return;

          }


          if(this.listening)
            return;


          this.transcript='';

          this.lastError=null;


          try{

            this.recognition.start();

          }catch(e){

            this.scheduleHandsFree(
              4000
            );

          }

        },
        delay
      );

  },


  toggleHandsFree(){
    this.toggle();
  },


  stopHandsFree(announce=true){
    this.handsFree=false;
    this.conversationUntil=0;
    clearTimeout(this.restartTimer);
    this.restartTimer=null;
    this.releaseMicrophone();
    this.transcript='';
    this.lastError='aborted';
    if(this.listening && this.recognition){
      try{ this.recognition.abort(); }catch(e){}
    }
    this.listening=false;
    this.updateButtons(false);
    if(announce) App.toast('Assistente encerrado.',2200);
  },


  suspendHandsFree(){

    if(!this.handsFree)
      return;


    clearTimeout(
      this.restartTimer
    );

    this.restartTimer=null;


    const wasListening=
      this.listening;


    this.listening=false;


    if(
      wasListening &&
      this.recognition
    ){

      this.transcript='';

      this.lastError='aborted';


      try{

        this.recognition.abort();

      }catch(e){}

    }

  },


  resumeHandsFree(){

    if(this.handsFree)
      this.scheduleHandsFree(
        350
      );

  },


  cancelFollowUpWindow(){
    clearTimeout(this.followUpTimer);
    this.followUpTimer=null;
    if(this.followUpMode && this.listening && this.recognition){
      this.transcript='';
      this.lastError='aborted';
      try{ this.recognition.abort(); }catch(e){}
    }
    this.followUpMode=false;
  },

  onAssistantSpeechEnded(spokenText){
    if(!this.followUpRequested) return;
    this.followUpRequested=false;
    if(!this.recognition || this.listening || document.visibilityState!=='visible') return;
    if(!/\?\s*$/.test(String(spokenText||'').trim())) return;

    // Janela única de resposta: máximo 5 segundos e depois o microfone encerra.
    this.followUpMode=true;
    this.transcript='';
    this.lastError=null;
    setTimeout(()=>{
      if(!this.followUpMode || this.listening || document.visibilityState!=='visible') return;
      try{
        this.recognition.start();
        clearTimeout(this.followUpTimer);
        this.followUpTimer=setTimeout(()=>{
          if(!this.followUpMode) return;
          this.transcript='';
          this.lastError='aborted';
          try{ this.recognition.abort(); }catch(e){}
          this.followUpMode=false;
          this.updateButtons(false);
        },5000);
      }catch(e){
        this.followUpMode=false;
      }
    },280);
  },

  normalize(text){

    return String(text||'')
      .toLocaleLowerCase('pt-BR')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g,'')
      .replace(/[^a-z0-9\s]/g,' ')
      .replace(/\s+/g,' ')
      .trim();

  },


  wordDistance(a,b){

    a=this.normalize(a);

    b=this.normalize(b);


    if(a===b)
      return 0;


    if(!a.length)
      return b.length;


    if(!b.length)
      return a.length;


    let previous=
      Array.from(
        {
          length:b.length+1
        },
        (_,index)=>index
      );


    for(
      let i=1;
      i<=a.length;
      i++
    ){

      const current=[i];


      for(
        let j=1;
        j<=b.length;
        j++
      ){

        current[j]=
          Math.min(
            current[j-1]+1,
            previous[j]+1,
            previous[j-1]+
            (
              a[i-1]===b[j-1]
              ? 0
              : 1
            )
          );

      }


      previous=current;

    }


    return previous[b.length];

  },


  hasNearWord(text,targets,maxDistance=1){

    const words=
      this.normalize(text)
      .split(' ')
      .filter(Boolean);


    return (
      targets||[]
    )
    .map(target=>
      this.normalize(target)
    )
    .some(target=>
      words.some(word=>{

        if(word===target)
          return true;


        if(
          word.length<4 ||
          target.length<4 ||
          Math.abs(
            word.length-
            target.length
          )>maxDistance
        )
          return false;


        return this.wordDistance(
          word,
          target
        )<=maxDistance;

      })
    );

  },


  containsAny(text,phrases){

    const normalized=
      this.normalize(text);


    return (
      phrases||[]
    )
    .some(phrase=>
      normalized.includes(
        this.normalize(phrase)
      )
    );

  },


  trimPoliteWords(text){

    return String(text||'')
      .replace(
        /\b(?:por favor|pra mim|para mim|se puder|se possível|se possivel)\b/gi,
        ' '
      )
      .replace(
        /\s+/g,
        ' '
      )
      .replace(
        /^[\s,.:;?!-]+|[\s,.:;?!-]+$/g,
        ''
      )
      .trim();

  },


  extractRouteDestination(text){

    const command=
      this.trimPoliteWords(
        text
      );


    const patterns=[
      /(?:^|\b)(?:(?:você|voce)\s+)?(?:(?:pode|poderia|consegue)\s+)?(?:me\s+)?(?:levar|leve|leva|navegar|navegue)(?:\s+agora)?\s+(?:para|pra|pro|até|ate|na|no|ao|à|a|em)\s+(.+)$/i,
      /(?:^|\b)(?:eu\s+)?(?:quero|queria|gostaria|preciso)(?:\s+de)?\s+(?:ir|chegar)(?:\s+lá|\s+la)?(?:\s+(?:para|pra|pro|até|ate|na|no|ao|à|a|em))?\s+(.+)$/i,
      /(?:^|\b)(?:troque|trocar|mude|mudar|altere|alterar)(?:\s+(?:a|o|minha|meu))?\s+(?:rota|destino)(?:\s+(?:para|pra|pro|até|ate|na|no|ao|à|a|em))?\s+(.+)$/i,
      /(?:^|\b)(?:faça|faca|calcule|trace|abra)(?:\s+uma)?\s+(?:rota|caminho)(?:\s+(?:para|pra|pro|até|ate|na|no|ao|à|a|em))?\s+(.+)$/i,
      /(?:^|\b)(?:vá|va|vai)(?:\s+(?:para|pra|pro|até|ate|na|no|ao|à|a|em))\s+(.+)$/i,
      /(?:^|\b)(?:rota|caminho|destino)\s+(?:para|pra|pro|até|ate|na|no|ao|à|a|em)\s+(.+)$/i
    ];


    for(const pattern of patterns){

      const match=
        command.match(
          pattern
        );


      if(!match)
        continue;


      let destination=
        this.trimPoliteWords(
          match[1]
        )
        .replace(
          /^(?:lá|la)\s+(?:para|pra|em)\s+/i,
          ''
        )
        .trim();


      if(
        /^(?:casa|minha casa)$/i.test(
          destination
        )
      )
        destination='minha casa';


      if(destination)
        return destination;

    }


    return '';

  },


  extractPlaceQuery(text){

    const command=
      this.trimPoliteWords(
        text
      );


    const patterns=[
      /(?:^|\b)(?:(?:me\s+)?(?:diga|fala|fale|informe)\s+)?(?:onde|aonde)\s+(?:é|e|fica|está|esta)\s+(?:(?:o|a)\s+)?(.+)$/i,
      /(?:^|\b)(?:qual|mostre|mostrar)\s+(?:é|e)?\s*(?:a\s+)?localização\s+(?:do|da|de)\s+(.+)$/i,
      /(?:^|\b)(?:cadê|cade|procure|encontre)\s+(?:(?:o|a)\s+)?(.+)$/i
    ];


    for(const pattern of patterns){

      const match=
        command.match(
          pattern
        );


      if(match?.[1])
        return this.trimPoliteWords(
          match[1]
        );

    }


    return '';

  },


  removeWakeWord(text){

    return String(text||'')
      .replace(
        /^\s*(?:(?:oi|ol[áa]|ei|por favor)\s+)?radar[\s,.:;!-]*/i,
        ''
      )
      .trim();

  },


  reply(text,priority=true){

    const spoken=String(text||'').trim();
    this.followUpRequested=/\?\s*$/.test(spoken) || /\b(?:quer|deseja|posso)\b[^.?!]*\?/.test(this.normalize(spoken));

    App.toast(
      spoken,
      5200
    );

    Voice.speak(
      spoken,
      priority
    );

  },


  lastKnownAddress:'',
  lastKnownAddressAt:0,
  conversationHistory:[],

  async getCurrentAddress(force=false){
    if(!Array.isArray(App.userPos) || App.userPos.length<2) return null;
    const lon=Number(App.userPos[0]), lat=Number(App.userPos[1]);
    if(!Number.isFinite(lat)||!Number.isFinite(lon)) return null;
    if(!force && this.lastKnownAddress && Date.now()-this.lastKnownAddressAt<120000)
      return {label:this.lastKnownAddress,lat,lon};
    let label='';
    try{
      const path='/search/2/reverseGeocode/'+lat+','+lon+'.json?language=pt-BR&radius=200';
      const r=await fetch(this.aiEndpoint+'/v1/tomtom?path='+encodeURIComponent(path),{cache:'no-store'});
      const d=r.ok?await r.json():null;
      const a=d?.addresses?.[0]?.address||{};
      label=a.freeformAddress || [a.streetName,a.streetNumber,a.municipalitySubdivision,a.municipality].filter(Boolean).join(', ');
    }catch(e){}
    if(!label){
      try{
        const u='https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat='+encodeURIComponent(lat)+'&lon='+encodeURIComponent(lon)+'&zoom=18&addressdetails=1&accept-language=pt-BR';
        const r=await fetch(u,{headers:{'Accept-Language':'pt-BR,pt;q=.9'},cache:'no-store'});
        const d=r.ok?await r.json():null;
        label=d?.display_name||'';
      }catch(e){}
    }
    if(label){ this.lastKnownAddress=label; this.lastKnownAddressAt=Date.now(); }
    return {label,lat,lon};
  },

  routeContext(){
    if(!App.route) return null;
    const totalM=Number(App.route.distance ?? App.route.summary?.lengthInMeters);
    const progressM=Math.max(0,Number(App.routeProgressMeters||0));
    const remainM=Number.isFinite(totalM)?Math.max(0,totalM-progressM):null;
    const totalSec=Number(App.route.duration ?? App.route.summary?.travelTimeInSeconds);
    const remainSec=Number.isFinite(totalSec)&&Number.isFinite(remainM)&&totalM>0?Math.max(0,totalSec*(remainM/totalM)):null;
    const g=App.getUpcomingGuidance?.();
    return {destination:document.getElementById('destInput')?.value||'',remainingMeters:remainM,remainingMinutes:Number.isFinite(remainSec)?Math.round(remainSec/60):null,currentRoad:g?.step?.name||'',nextInstruction:g?.step?App.maneuverText(g.step):''};
  },

  async askAI(question){

    const text=
      String(question||'')
      .trim();


    if(!text)
      return false;


    if(this.aiBusy){

      this.reply(
        'Ainda estou concluindo a pergunta anterior.'
      );

      return true;

    }


    this.aiBusy=true;


    App.toast(
      'Consultando a inteligência...',
      4500
    );

    let trafficInfo=null;
    if(App.route && App.destination && typeof TrafficAssistantV40!=='undefined'){
      try{ trafficInfo=await TrafficAssistantV40.getTrafficSnapshot(); }catch(e){ trafficInfo=null; }
    }

    const controller=
      new AbortController();


    const timeout=
      setTimeout(
        ()=>controller.abort(),
        25000
      );


    try{

      const response=
        await fetch(
          this.aiEndpoint,
          {
            method:'POST',
            headers:{
              'Content-Type':'application/json'
            },
            body:JSON.stringify({
              pergunta:(()=>{
                const context=[];
                if(Array.isArray(App.userPos) && App.userPos.length>=2)
                  context.push('GPS atual: latitude '+Number(App.userPos[1]).toFixed(5)+', longitude '+Number(App.userPos[0]).toFixed(5)+(this.lastKnownAddress?' — '+this.lastKnownAddress:''));
                const route=this.routeContext();
                if(route) context.push('Rota ativa: '+JSON.stringify(route));
                if(trafficInfo && Number.isFinite(trafficInfo.travelSec)){
                  const delayMin=Math.max(0,Math.round((trafficInfo.delaySec||0)/60));
                  const totalMin=Math.max(1,Math.round(trafficInfo.travelSec/60));
                  context.push('Trânsito real TomTom: atraso '+delayMin+' minuto(s), tempo total '+totalMin+' minuto(s). Use somente estes dados para trânsito; nunca invente números.');
                }else if(App.route){
                  context.push('Trânsito TomTom indisponível nesta consulta. Se perguntarem sobre trânsito, diga que não foi possível consultar dados reais agora; nunca invente.');
                }
                if(this.conversationHistory.length) context.push('Conversa recente: '+this.conversationHistory.slice(-6).join(' | '));
                return text+(context.length?'\n\nContexto confiável fornecido pelo Radar:\n'+context.join('\n'):'');
              })()
            }),
            signal:controller.signal
          }
        );


      let data={};


      try{

        data=await response.json();

      }catch(e){}


      if(!response.ok)
        throw new Error(
          data.erro||
          'Falha na consulta da inteligência.'
        );


      const answer=
        String(
          data.resposta||''
        )
        .trim();


      if(!answer)
        throw new Error(
          'A inteligência não enviou uma resposta.'
        );


      this.conversationHistory.push('Motorista: '+text,'Radar: '+answer);
      this.conversationHistory=this.conversationHistory.slice(-8);
      this.conversationHistory.push({role:'motorista',text});
      this.conversationHistory.push({role:'radar',text:answer});
      if(this.conversationHistory.length>12) this.conversationHistory=this.conversationHistory.slice(-12);
      this.reply(answer);

      return true;

    }catch(error){

      console.warn(
        'Radar Seguro IA:',
        error
      );


      this.reply(
        navigator.onLine
        ? 'A inteligência está temporariamente indisponível. Tente novamente em instantes.'
        : 'Estou sem conexão com a internet. Tente novamente quando o sinal voltar.'
      );

      return true;

    }finally{

      clearTimeout(timeout);

      this.aiBusy=false;

    }

  },


  stripNewsHtml(value){
    return String(value||'')
      .replace(/<script[\s\S]*?<\/script>/gi,' ')
      .replace(/<style[\s\S]*?<\/style>/gi,' ')
      .replace(/<[^>]+>/g,' ')
      .replace(/&nbsp;/gi,' ')
      .replace(/&amp;/gi,'&')
      .replace(/&quot;/gi,'"')
      .replace(/&#39;/gi,"'")
      .replace(/\s+/g,' ')
      .trim();
  },

  parseRss(xmlText,source){
    try{
      const doc=new DOMParser().parseFromString(xmlText,'text/xml');
      const nodes=[...doc.querySelectorAll('item')];
      return nodes.map(item=>({
        title:this.stripNewsHtml(item.querySelector('title')?.textContent||''),
        description:this.stripNewsHtml(item.querySelector('description')?.textContent||''),
        link:String(item.querySelector('link')?.textContent||'').trim(),
        published:String(item.querySelector('pubDate')?.textContent||'').trim(),
        source
      })).filter(x=>x.title);
    }catch(e){ return []; }
  },

  async fetchFeed(url,source){
    const controller=new AbortController();
    const timeout=setTimeout(()=>controller.abort(),9000);
    try{
      const r=await fetch(url,{cache:'no-store',signal:controller.signal});
      if(!r.ok) throw new Error('feed '+source);
      return this.parseRss(await r.text(),source);
    }finally{ clearTimeout(timeout); }
  },

  async fetchCurrentNews(){
    const now=Date.now();
    if(this.lastNewsItems.length && now-this.lastNewsUpdatedAt<10*60*1000) return this.lastNewsItems;

    const feeds=[
      ['https://agenciabrasil.ebc.com.br/rss/ultimasnoticias/feed.xml','Agência Brasil'],
      ['https://agenciabrasil.ebc.com.br/rss/geral/feed.xml','Agência Brasil']
    ];

    const settled=await Promise.allSettled(feeds.map(([url,source])=>this.fetchFeed(url,source)));
    let items=[];
    settled.forEach(x=>{ if(x.status==='fulfilled') items.push(...x.value); });

    const seen=new Set();
    items=items.filter(x=>{
      const k=this.normalize(x.title);
      if(!k || seen.has(k)) return false;
      seen.add(k); return true;
    }).sort((a,b)=>new Date(b.published||0)-new Date(a.published||0));

    this.lastNewsItems=items.slice(0,30);
    this.lastNewsUpdatedAt=now;
    this.lastNewsIndex=0;
    return this.lastNewsItems;
  },

  newsSummaryText(item){
    const title=String(item?.title||'').trim();
    let desc=String(item?.description||'').trim();
    if(desc.length>220) desc=desc.slice(0,217).replace(/\s+\S*$/,'')+'...';
    return desc && this.normalize(desc)!==this.normalize(title)
      ? title+'. '+desc
      : title+'.';
  },

  async reportNews(more=false,onlyRio=false){
    App.toast('Atualizando notícias...',4500);
    try{
      let items=await this.fetchCurrentNews();
      if(onlyRio){
        const rioWords=['rio de janeiro','rj','carioca','baixada fluminense','niteroi','petropolis','duque de caxias','nova iguacu'];
        const filtered=items.filter(x=>rioWords.some(w=>this.normalize((x.title||'')+' '+(x.description||'')).includes(this.normalize(w))));
        if(filtered.length) items=filtered;
      }
      if(!items.length){
        this.reply('Não consegui obter notícias atualizadas das fontes do Radar agora.');
        return;
      }

      if(!more) this.lastNewsIndex=0;
      const start=this.lastNewsIndex||0;
      const page=items.slice(start,start+4);
      if(!page.length){
        this.lastNewsIndex=0;
        this.reply('Essas foram as notícias disponíveis nesta consulta.');
        return;
      }
      this.lastNewsIndex=start+page.length;

      const stamp=new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});
      const intro=onlyRio
        ? 'Estas são algumas notícias recentes relacionadas ao Rio, consultadas às '+stamp+'.'
        : 'Estas são algumas das notícias mais recentes, consultadas às '+stamp+'.';
      const parts=[intro,...page.map((x,i)=>(i+1)+'. '+this.newsSummaryText(x))];
      if(this.lastNewsIndex<items.length) parts.push('Se quiser, diga: mais notícias.');
      else parts.push('Essas são as notícias disponíveis nesta consulta.');
      parts.push('Fonte: Agência Brasil.');
      this.speakSequence(parts);
    }catch(e){
      console.warn('Radar notícias:',e);
      this.reply('Não consegui atualizar as notícias agora. A navegação continua funcionando normalmente.');
    }
  },

  speakSequence(parts,visibleText=''){

    const messages=
      (parts||[])
      .filter(Boolean);


    if(!messages.length)
      return;


    App.toast(
      visibleText||
      messages.join(' '),
      12000
    );


    if(!Voice.enabled)
      return;


    Voice.clear();


    messages.forEach(
      (message,index)=>
        Voice.speak(
          message,
          index===0
        )
    );

  },


  getHome(){

    try{

      return localStorage
        .getItem(
          this.homeKey
        )||'';

    }catch(e){

      return '';

    }

  },


  saveHome(address){

    try{

      localStorage.setItem(
        this.homeKey,
        address
      );

      return true;

    }catch(e){

      return false;

    }

  },


  cleanDestination(text){

    return String(text||'')
      .replace(
        /^\s*(?:me\s+leve|leve(?:-|\s)?me)\s+(?:para|at[ée])\s+/i,
        ''
      )
      .replace(
        /^\s*(?:para|at[ée]|em)\s+/i,
        ''
      )
      .trim();

  },


  setCommunities(visible){

    App.communityVisible=
      visible;


    [
      'communityChip',
      'navCommunityChip'
    ].forEach(id=>
      document
      .getElementById(id)
      ?.classList.toggle(
        'active',
        visible
      )
    );


    App.setCommunityVisibility(
      visible
    );


    this.reply(
      visible
      ? 'Comunidades exibidas no mapa.'
      : 'Comunidades ocultadas do mapa.'
    );

  },


  setFuel(filter){

    const visible=
      filter!=='none';


    FuelModule.visible=
      visible;

    FuelModule.filter=
      filter;

    FuelModule.render(
      App.map
    );


    [
      'fuelChip',
      'navFuelChip'
    ].forEach(id=>
      document
      .getElementById(id)
      ?.classList.toggle(
        'active',
        visible
      )
    );


    const text={
      all:'Mostrando todos os postos.',
      gnv:'Mostrando postos que também oferecem GNV.',
      official:'Mostrando postos com registro oficial de irregularidade.',
      none:'Postos ocultados do mapa.'
    }[filter];


    this.reply(
      text||
      'Filtro de postos atualizado.'
    );

  },


  repeatGuidance(){

    if(!App.route){

      this.reply(
        'Não existe uma rota ativa.'
      );

      return;

    }


    const guidance=
      App.getUpcomingGuidance();


    if(!guidance?.step){

      this.reply(
        'A próxima orientação ainda não está disponível.'
      );

      return;

    }


    const street=
      guidance.step.name
      ? ' na '+guidance.step.name
      : '';


    const phrase=
      App.maneuverText(
        guidance.step
      )+
      street;


    if(
      guidance.distance>180 &&
      !App.isComplexManeuverArea(
        guidance
      )
    ){

      this.reply(
        'Em '+
        Math.round(
          guidance.distance/10
        )*10+
        ' metros, '+
        phrase.toLocaleLowerCase('pt-BR')+'.'
      );

    }else{

      this.reply(
        phrase+'.'
      );

    }

  },


  async findPlace(query){

    const place=
      this.cleanDestination(
        query
      );


    if(!place){

      this.reply(
        'Diga o nome do lugar que você procura.'
      );

      return;

    }


    App.toast(
      'Procurando '+place+'...'
    );


    try{

      const results=
        await App.searchAddress(
          place
        );


      if(!results.length){

        this.reply(
          'Não encontrei esse lugar com segurança.'
        );

        return;

      }


      const result=
        results[0];


      document
      .getElementById(
        'destInput'
      )
      .value=
        result.display;


      App.map.easeTo({
        center:[
          result.lon,
          result.lat
        ],
        zoom:16,
        duration:700
      });


      this.reply(
        (result.name||place)+
        ' fica em '+
        result.display+
        '. Para navegar, diga: me leve para '+
        (result.name||place)+'.'
      );

    }catch(e){

      if(e.name!=='AbortError')
        this.reply(
          'A busca de lugares está temporariamente indisponível.'
        );

    }

  },


  async findNearbyPlace(query,useHome=false){

    let lon;
    let lat;
    let originLabel='sua localização atual';

    if(useHome && this.getHome()){
      try{
        const h=await App.searchAddress(this.getHome());
        if(h?.length){
          lon=Number(h[0].lon);
          lat=Number(h[0].lat);
          originLabel='sua casa';
        }
      }catch(e){}
    }

    if(!Number.isFinite(lon) || !Number.isFinite(lat)){
      if(Array.isArray(App.userPos) && App.userPos.length>=2){
        lon=Number(App.userPos[0]);
        lat=Number(App.userPos[1]);
      }
    }

    if(!Number.isFinite(lon) || !Number.isFinite(lat)){
      this.reply('O GPS ainda não informou sua posição. Aguarde alguns segundos e tente novamente.');
      return true;
    }

    const q=String(query||'').trim();
    if(!q){
      this.reply('Diga o nome do lugar que você quer procurar.');
      return true;
    }

    try{
      const path='/search/2/search/'+encodeURIComponent(q)+'.json?limit=5&language=pt-BR&lat='+lat+'&lon='+lon+'&radius=30000';
      const r=await fetch('https://radar-seguro-ia-rj.claudio41cg.workers.dev/v1/tomtom?path='+encodeURIComponent(path),{cache:'no-store'});
      const d=r.ok?await r.json():null;
      const item=d?.results?.[0];
      if(!item){
        this.reply('Não encontrei '+q+' perto de '+originLabel+'.');
        return true;
      }
      const name=item.poi?.name || q;
      const address=item.address?.freeformAddress || [item.address?.streetName,item.address?.municipalitySubdivision,item.address?.municipality].filter(Boolean).join(', ');
      const plat=Number(item.position?.lat), plon=Number(item.position?.lon);
      let dist='';
      if(Number.isFinite(plat) && Number.isFinite(plon)){
        const toRad=x=>x*Math.PI/180;
        const a1=toRad(lat), a2=toRad(plat), dp=toRad(plat-lat), dl=toRad(plon-lon);
        const h=Math.sin(dp/2)**2+Math.cos(a1)*Math.cos(a2)*Math.sin(dl/2)**2;
        const meters=6371000*2*Math.atan2(Math.sqrt(h),Math.sqrt(1-h));
        dist=meters<1000 ? Math.round(meters/10)*10+' metros' : (meters/1000).toFixed(meters<10000?1:0).replace('.',',')+' quilômetros';
      }
      this.reply(name+' é uma das opções mais próximas de '+originLabel+(dist?' a aproximadamente '+dist:'')+(address?'. Endereço: '+address+'.':'.'));
      return true;
    }catch(e){
      this.reply('Não consegui pesquisar lugares próximos agora.');
      return true;
    }

  },


  async routeTo(query){

    let destination=
      this.cleanDestination(
        query
      );


    if(
      this.normalize(destination)===
      'minha casa'
    ){

      destination=
        this.getHome();


      if(!destination){

        this.reply(
          'Sua casa ainda não foi salva. Pesquise o endereço e diga: Radar, salve como minha casa.'
        );

        return;

      }

    }


    if(!destination){

      this.reply(
        'Diga para onde você quer ir.'
      );

      return;

    }


    App.toast(
      'Procurando rota para '+
      destination+'...',
      6000
    );


    try{

      const results=
        await App.searchAddress(
          destination
        );


      if(!results.length){

        this.reply(
          'Não encontrei esse destino com segurança.'
        );

        return;

      }


      const result=
        results[0];


      App.destination=[
        result.lon,
        result.lat
      ];


      document
      .getElementById(
        'destInput'
      )
      .value=
        result.display;


      document
      .getElementById(
        'suggest'
      )
      .classList.remove(
        'show'
      );


      if(!App.userPos){

        App.startGPS();

        this.reply(
          'Destino encontrado. Estou aguardando o GPS para calcular a rota.'
        );

        return;

      }


      App.showRoutePanel();

      await App.calculateRoute();


      if(App.route){

        App.startNavigation();

        this.reply(
          'Rota para '+
          (result.name||destination)+
          ' iniciada.'
        );

      }

    }catch(e){

      if(e.name!=='AbortError')
        this.reply(
          'Não foi possível calcular essa rota agora.'
        );

    }

  },


  weatherCodeText(code){

    const value=
      Number(code);


    if(value===0)
      return 'céu limpo';

    if(value===1)
      return 'tempo predominantemente aberto';

    if(value===2)
      return 'céu parcialmente nublado';

    if(value===3)
      return 'céu encoberto';

    if(
      value===45 ||
      value===48
    )
      return 'nevoeiro';

    if(
      value>=51 &&
      value<=57
    )
      return 'garoa';

    if(
      value>=61 &&
      value<=67
    )
      return 'chuva';

    if(
      value>=71 &&
      value<=77
    )
      return 'neve';

    if(
      value>=80 &&
      value<=82
    )
      return 'pancadas de chuva';

    if(
      value===85 ||
      value===86
    )
      return 'pancadas de neve';

    if(
      value===95 ||
      value===96 ||
      value===99
    )
      return 'trovoadas';


    return 'condição variável';

  },


  weatherDayOffset(text){

    const normalized=
      this.normalize(text);


    if(
      normalized.includes(
        'depois de amanha'
      )
    )
      return 2;


    if(
      normalized.includes(
        'amanha'
      )
    )
      return 1;


    return 0;

  },


  extractWeatherPlace(text){

    const command=
      this.trimPoliteWords(
        text
      );


    const match=
      command.match(
        /\b(?:em|no|na)\s+(.+)$/i
      );


    if(!match?.[1])
      return '';


    const place=
      match[1]
      .replace(
        /\b(?:hoje|amanh[ãa]|depois\s+de\s+amanh[ãa])\b.*$/i,
        ''
      )
      .replace(
        /[?.!,;:]+$/g,
        ''
      )
      .trim();


    if(
      this.containsAny(
        place,
        [
          'minha localização',
          'minha localizacao',
          'localização atual',
          'localizacao atual',
          'onde estou'
        ]
      ) ||
      /^(?:aqui|agora)$/.test(
        this.normalize(place)
      )
    )
      return '';


    return place;

  },


  async fetchWeather(lat,lon){

    const key=
      Number(lat).toFixed(2)+
      ','+
      Number(lon).toFixed(2);


    const cached=
      this.weatherCache[key];


    if(
      cached &&
      Date.now()-cached.savedAt<
      10*60*1000
    )
      return cached.data;


    const params=
      new URLSearchParams({
        latitude:String(lat),
        longitude:String(lon),
        current:[
          'temperature_2m',
          'apparent_temperature',
          'weather_code',
          'precipitation',
          'rain',
          'wind_speed_10m'
        ].join(','),
        daily:[
          'weather_code',
          'temperature_2m_max',
          'temperature_2m_min',
          'precipitation_probability_max'
        ].join(','),
        timezone:'America/Sao_Paulo',
        forecast_days:'3'
      });


    const response=
      await fetch(
        'https://api.open-meteo.com/v1/forecast?'+
        params.toString(),
        {
          cache:'no-store'
        }
      );


    if(!response.ok)
      throw new Error(
        'Previsão indisponível'
      );


    const data=
      await response.json();


    if(
      !data?.daily?.time?.length
    )
      throw new Error(
        'Previsão incompleta'
      );


    this.weatherCache[key]={
      data,
      savedAt:Date.now()
    };


    return data;

  },


  async reportWeather(command){

    const offset=
      this.weatherDayOffset(
        command
      );


    const placeQuery=
      this.extractWeatherPlace(
        command
      );


    let lon;

    let lat;

    let placeLabel;


    if(placeQuery){

      App.toast(
        'Consultando o clima em '+
        placeQuery+'...',
        5000
      );


      const results=
        await App.searchAddress(
          placeQuery
        );


      if(!results.length){

        this.reply(
          'Não encontrei esse lugar para consultar o clima.'
        );

        return;

      }


      lon=Number(
        results[0].lon
      );

      lat=Number(
        results[0].lat
      );

      placeLabel=
        results[0].name||
        placeQuery;

    }else if(
      Array.isArray(
        App.userPos
      ) &&
      App.userPos.length>=2
    ){

      lon=Number(
        App.userPos[0]
      );

      lat=Number(
        App.userPos[1]
      );

      placeLabel=
        'sua localização atual';

    }else{

      lon=-43.1729;

      lat=-22.9068;

      placeLabel=
        'Rio de Janeiro, usado porque o GPS ainda não informou sua posição';

    }


    App.toast(
      'Atualizando a previsão do tempo...',
      5000
    );


    try{

      const data=
        await this.fetchWeather(
          lat,
          lon
        );


      const daily=
        data.daily||{};


      const maximum=
        Number(
          daily
          .temperature_2m_max
          ?.[offset]
        );


      const minimum=
        Number(
          daily
          .temperature_2m_min
          ?.[offset]
        );


      const rainChance=
        Number(
          daily
          .precipitation_probability_max
          ?.[offset]
        );


      const description=
        this.weatherCodeText(
          daily
          .weather_code
          ?.[offset]
        );


      const dayText=
        offset===2
        ? 'depois de amanhã'
        : offset===1
          ? 'amanhã'
          : 'hoje';


      const parts=[];


      if(
        offset===0 &&
        Number.isFinite(
          Number(
            data.current
            ?.temperature_2m
          )
        )
      ){

        const current=
          Math.round(
            Number(
              data.current
              .temperature_2m
            )
          );


        const apparent=
          Number(
            data.current
            ?.apparent_temperature
          );


        parts.push(
          'Em '+
          placeLabel+
          ', agora faz '+
          current+
          ' graus'+
          (
            Number.isFinite(
              apparent
            )
            ? ', com sensação de '+
              Math.round(apparent)+
              ' graus'
            : ''
          )+
          '.'
        );

      }


      parts.push(
        'A previsão para '+
        dayText+
        ' é de '+
        description+
        (
          Number.isFinite(minimum) &&
          Number.isFinite(maximum)
          ? ', mínima de '+
            Math.round(minimum)+
            ' e máxima de '+
            Math.round(maximum)+
            ' graus'
          : ''
        )+
        (
          Number.isFinite(
            rainChance
          )
          ? ', com até '+
            Math.round(
              rainChance
            )+
            ' por cento de chance de chuva'
          : ''
        )+
        '.'
      );


      parts.push(
        'Fonte: Open Meteo.'
      );


      this.reply(
        parts.join(' ')
      );

    }catch(e){

      this.reply(
        'Não consegui atualizar o clima agora. Verifique a internet e tente novamente.'
      );

    }

  },


  async reportRioOccurrences(more=false){

    if(!more){

      this.occurrenceOffset=0;

      App.toast(
        'Atualizando ocorrências do Rio de Janeiro...',
        5000
      );


      try{

        const refresh=
          window.RadarApp
          ?.refreshFogoCruzado;


        if(typeof refresh==='function')
          await refresh();

      }catch(e){}

    }


    const items=
      (
        App.fogoRecentOccurrences||[]
      )
      .slice()
      .sort(
        (a,b)=>
          new Date(b.date)-
          new Date(a.date)
      );


    if(
      !App.fogoFeedLoaded &&
      !items.length
    ){

      this.reply(
        'Não consegui consultar o Instituto Fogo Cruzado agora. Verifique sua internet e tente novamente.'
      );

      return;

    }


    const updatedDate=
      App.fogoFeedUpdatedAt
      ? new Date(
          App.fogoFeedUpdatedAt
        )
      : null;


    const updatedText=
      updatedDate &&
      !Number.isNaN(
        updatedDate.getTime()
      )
      ? updatedDate.toLocaleString(
          'pt-BR',
          {
            timeZone:'America/Sao_Paulo',
            day:'2-digit',
            month:'2-digit',
            hour:'2-digit',
            minute:'2-digit'
          }
        )
      : 'horário não informado';


    if(!items.length){

      this.reply(
        'Na consulta atualizada em '+
        updatedText+
        ', o Instituto Fogo Cruzado não apresenta registros das últimas 24 horas no estado do Rio de Janeiro. Isso não garante ausência de risco.'
      );

      return;

    }


    if(
      more &&
      this.occurrenceOffset>=
      items.length
    ){

      this.occurrenceOffset=0;

      this.reply(
        'Não há mais ocorrências nessa consulta. Para ouvir novamente, peça as ocorrências do Rio de Janeiro.'
      );

      return;

    }


    const start=
      more
      ? this.occurrenceOffset
      : 0;


    const page=
      items.slice(
        start,
        start+5
      );


    this.occurrenceOffset=
      start+
      page.length;


    const details=
      page.map(item=>{

        const neighborhood=
          String(
            item.neighborhood||''
          )
          .trim();


        const locality=
          String(
            item.locality||''
          )
          .trim();


        const differentPlaces=
          locality &&
          neighborhood &&
          this.normalize(locality)!==
          this.normalize(neighborhood);


        const place=
          differentPlaces
          ? locality+
            ', no bairro '+
            neighborhood
          : locality ||
            neighborhood ||
            'local não informado';


        const date=
          new Date(
            item.date
          );


        const when=
          Number.isNaN(
            date.getTime()
          )
          ? 'horário não informado'
          : date.toLocaleString(
              'pt-BR',
              {
                timeZone:'America/Sao_Paulo',
                day:'2-digit',
                month:'2-digit',
                hour:'2-digit',
                minute:'2-digit'
              }
            );


        const reason=
          String(
            item.reason||''
          )
          .trim();


        const reasonText=
          !reason ||
          this.normalize(reason)===
          'nao identificado'
          ? 'motivo ainda não identificado'
          : 'motivo informado: '+
            reason;


        const policeText=
          item.policeAction &&
          !this.normalize(reason)
          .includes('policial')
          ? ', com registro de ação policial'
          : '';


        return (
          'Em '+
          place+
          ', no dia e horário '+
          when+
          ', '+
          reasonText+
          policeText+
          '.'
        );

      });


    const remaining=
      Math.max(
        0,
        items.length-
        this.occurrenceOffset
      );


    const intro=
      more
      ? 'Continuando as ocorrências das últimas 24 horas.'
      : 'Segundo os dados do Instituto Fogo Cruzado, atualizados em '+
        updatedText+
        ', existem '+
        items.length+
        ' ocorrências registradas nas últimas 24 horas no estado do Rio de Janeiro. Vou informar até cinco por vez.';


    const ending=
      remaining>0
      ? 'Ainda existem '+
        remaining+
        '. Para continuar, diga: Radar, mais ocorrências.'
      : 'Esses são todos os registros disponíveis das últimas 24 horas. Use as informações apenas como orientação.';


    this.speakSequence(
      [
        intro,
        ...details,
        ending
      ]
    );

  },


  async handleFlexibleIntent(command,normalized){

    const compact=
      normalized.replace(
        /\s+/g,
        ''
      );



    const dailyBriefIntent=this.containsAny(normalized,[
      'relatorio do dia','resumo do dia','me atualiza','me atualize','o que aconteceu hoje','novidades de hoje','como esta o rio hoje'
    ]);
    if(dailyBriefIntent){
      const pos=await this.getCurrentAddress(false);
      const route=this.routeContext();
      const parts=[];
      if(pos?.label) parts.push('Você está em '+pos.label+'.');
      if(route?.remainingMinutes!=null) parts.push('Na sua rota, faltam aproximadamente '+route.remainingMinutes+' minutos para o destino.');
      const count=(App.fogoRecentOccurrences||[]).length;
      parts.push(count?('O Radar tem '+count+' ocorrências registradas pelo Instituto Fogo Cruzado nas últimas 24 horas.'): 'Não há ocorrências das últimas 24 horas carregadas no Radar neste momento.');
      parts.push('Posso detalhar as ocorrências, o clima, sua rota ou responder outra pergunta.');
      this.reply(parts.join(' '));
      return true;
    }

    const stopAssistantIntent =
      /^(?:radar\s+)?(?:pode\s+)?(?:encerrar|encerra|encerre|parar|para|pare|sair|saia|fechar|fecha|feche|desligar|desliga|desligue)(?:\s+(?:de\s+ouvir|o\s+microfone|a\s+voz|a\s+assistente|agora))?$/.test(normalized) ||
      this.containsAny(normalized,[
        'pode encerrar','pode parar','pode sair','pode fechar','pode desligar',
        'para de ouvir','pare de ouvir','parar de ouvir','nao precisa ouvir mais',
        'fica quieto','fique quieto','cala a boca','cale a boca','chega por agora',
        'encerra ai','encerre ai','desliga o microfone','desligue o microfone',
        'desliga a assistente','desligue a assistente','radar encerra','radar pode parar'
      ]);

    if(stopAssistantIntent){
      Voice.clear();
      this.stopHandsFree(false);
      App.toast('Assistente encerrado.',2200);
      return true;
    }

    const weatherIntent=
      this.hasNearWord(
        normalized,
        [
          'clima',
          'chuva',
          'chover',
          'chovendo',
          'temperatura'
        ],
        2
      ) ||
      this.containsAny(
        normalized,
        [
          'previsao do tempo',
          'previsao para hoje',
          'previsao para amanha',
          'como esta o tempo',
          'como vai ficar o tempo',
          'tempo hoje',
          'tempo amanha',
          'tempo depois de amanha'
        ]
      );


    if(weatherIntent){

      await this.reportWeather(
        command
      );

      return true;

    }


    if(
      this.containsAny(
        normalized,
        [
          'que horas sao',
          'qual e a hora',
          'qual a hora',
          'me diga a hora',
          'informe a hora'
        ]
      )
    ){

      this.reply(
        'Agora são '+
        new Date()
        .toLocaleTimeString(
          'pt-BR',
          {
            timeZone:'America/Sao_Paulo',
            hour:'2-digit',
            minute:'2-digit'
          }
        )+
        '.'
      );

      return true;

    }


    if(
      this.containsAny(
        normalized,
        [
          'que dia e hoje',
          'qual a data de hoje',
          'qual e a data',
          'me diga a data'
        ]
      )
    ){

      this.reply(
        'Hoje é '+
        new Date()
        .toLocaleDateString(
          'pt-BR',
          {
            timeZone:'America/Sao_Paulo',
            weekday:'long',
            day:'numeric',
            month:'long',
            year:'numeric'
          }
        )+
        '.'
      );

      return true;

    }


    if(
      this.containsAny(
        normalized,
        [
          'quem e voce',
          'qual e o seu nome',
          'qual seu nome',
          'quem e o radar'
        ]
      )
    ){

      this.reply(
        'Eu sou o assistente do Radar Seguro RJ Pro. Posso ajudar com clima, rotas, lugares, ocorrências e camadas do mapa.'
      );

      return true;

    }


    if(
      this.containsAny(
        normalized,
        [
          'esta me ouvindo',
          'voce me ouve',
          'consegue me ouvir'
        ]
      )
    ){

      this.reply(
        'Sim, estou ouvindo.'
      );

      return true;

    }


    if(
      /^(?:obrigado|obrigada|valeu|muito obrigado|muito obrigada)$/.test(
        normalized
      )
    ){

      this.reply(
        'Por nada. Dirija com atenção.'
      );

      return true;

    }


    const occurrenceIntent=
      this.hasNearWord(
        normalized,
        [
          'ocorrencia',
          'ocorrencias'
        ],
        2
      ) ||
      this.containsAny(
        normalized,
        [
          'tiroteio',
          'tiroteios',
          'confronto',
          'confrontos',
          'violencia',
          'aconteceu hoje',
          'acontecendo no rio',
          'problemas de seguranca'
        ]
      );


    if(occurrenceIntent){

      const wantsMore=
        this.hasNearWord(
          normalized,
          [
            'mais',
            'proximas',
            'restantes',
            'outras'
          ],
          1
        ) ||
        this.containsAny(
          normalized,
          [
            'continue',
            'continuar'
          ]
        );


      await this.reportRioOccurrences(
        wantsMore
      );

      return true;

    }


    const routeContext=
      this.hasNearWord(
        normalized,
        [
          'rota',
          'navegacao',
          'viagem',
          'trajeto',
          'caminho'
        ],
        2
      );


    const stopIntent=
      this.hasNearWord(
        normalized,
        [
          'parar',
          'pare',
          'cancelar',
          'cancele',
          'encerrar',
          'encerre',
          'terminar',
          'finalizar',
          'sair'
        ],
        1
      ) ||
      this.containsAny(
        normalized,
        [
          'nao quero mais',
          'pode parar'
        ]
      );


    if(
      routeContext &&
      stopIntent
    ){

      App.clearRoute();

      this.reply(
        'Navegação encerrada.'
      );

      return true;

    }


    const startIntent=
      this.hasNearWord(
        normalized,
        [
          'iniciar',
          'inicie',
          'comecar',
          'comece',
          'continuar',
          'continue'
        ],
        1
      );


    if(
      routeContext &&
      startIntent
    ){

      if(App.route){

        App.startNavigation();

        this.reply(
          'Navegação iniciada.'
        );

      }else{

        this.reply(
          'Escolha primeiro um destino.'
        );

      }


      return true;

    }


    const repeatIntent=
      this.hasNearWord(
        normalized,
        [
          'repetir',
          'repita'
        ],
        1
      ) ||
      this.containsAny(
        normalized,
        [
          'fale de novo',
          'fala de novo',
          'diga de novo',
          'novamente a orientacao',
          'nao entendi a orientacao'
        ]
      );


    if(repeatIntent){

      this.repeatGuidance();

      return true;

    }


    const speedIntent=
      this.hasNearWord(
        normalized,
        [
          'velocidade'
        ],
        2
      ) ||
      this.containsAny(
        normalized,
        [
          'quantos por hora',
          'quilometros por hora',
          'km por hora'
        ]
      );


    if(speedIntent){

      this.reply(
        'Velocidade atual: '+
        Math.max(
          0,
          Math.round(
            App.currentSpeed
          )
        )+
        ' quilômetros por hora.'
      );

      return true;

    }


    const hideIntent=
      this.hasNearWord(
        normalized,
        [
          'ocultar',
          'esconder',
          'esconda',
          'desligar',
          'desligue',
          'tirar',
          'tire',
          'retirar',
          'remover'
        ],
        1
      ) ||
      this.containsAny(
        normalized,
        [
          'nao quero ver',
          'nao mostrar',
          'tira do mapa'
        ]
      );


    const showIntent=
      this.hasNearWord(
        normalized,
        [
          'mostrar',
          'mostre',
          'mostra',
          'exibir',
          'exiba',
          'exibe',
          'ligar',
          'ligue',
          'colocar',
          'coloque',
          'aparecer'
        ],
        1
      ) ||
      this.containsAny(
        normalized,
        [
          'quero ver',
          'deixar visivel',
          'deixe visivel',
          'mostra no mapa'
        ]
      );


    const fuelIntent=
      this.hasNearWord(
        normalized,
        [
          'posto',
          'postos'
        ],
        1
      );


    const gnvIntent=
      compact.includes('gnv') ||
      normalized.includes('g n v') ||
      normalized.includes('gas natural');


    const irregularIntent=
      this.hasNearWord(
        normalized,
        [
          'irregular',
          'irregularidade',
          'irregularidades',
          'problema',
          'problemas'
        ],
        2
      );


    if(
      gnvIntent &&
      (
        fuelIntent ||
        showIntent ||
        normalized.includes('so gnv')
      )
    ){

      this.setFuel('gnv');

      return true;

    }


    if(
      fuelIntent &&
      irregularIntent
    ){

      this.setFuel('official');

      return true;

    }


    if(
      fuelIntent &&
      hideIntent
    ){

      this.setFuel('none');

      return true;

    }


    if(
      fuelIntent &&
      showIntent
    ){

      this.setFuel('all');

      return true;

    }


    const communityIntent=
      this.hasNearWord(
        normalized,
        [
          'comunidade',
          'comunidades'
        ],
        2
      );


    if(
      communityIntent &&
      hideIntent
    ){

      this.setCommunities(
        false
      );

      return true;

    }


    if(
      communityIntent &&
      showIntent
    ){

      this.setCommunities(
        true
      );

      return true;

    }


    const place=
      this.extractPlaceQuery(
        command
      );


    if(place){

      await this.findPlace(
        place
      );

      return true;

    }


    const destination=
      this.extractRouteDestination(
        command
      );


    if(destination){

      await this.routeTo(
        destination
      );

      return true;

    }


    return false;

  },


  async handle(rawText){

    const command=
      this.removeWakeWord(
        rawText
      );


    const normalized=
      this.normalize(
        command
      );

    const trafficQuestionV41=/\b(?:transito|engarrafamento|engarrafado|retencao|congestionamento|congestionado|travado|travada|lento|lenta|fluxo)\b/.test(normalized);
    if(trafficQuestionV41 && typeof TrafficAssistantV40!=='undefined'){
      await TrafficAssistantV40.answerTrafficQuestion();
      return;
    }
    const radarQuestionV41=/\b(?:radar|radares)\b/.test(normalized) && /\b(?:rota|caminho|trajeto|ate|até|frente|indo|viagem|tem|algum|alguma)\b/.test(normalized);
    if(radarQuestionV41 && typeof TrafficAssistantV40!=='undefined'){
      await TrafficAssistantV40.answerRadarQuestion();
      return;
    }

    if(typeof TrafficAssistantV40!=='undefined' && TrafficAssistantV40.hasPending()){
      if(/^(?:sim|pode|pode sim|troca|trocar|troque|muda|mudar|mude)(?: a rota)?$/.test(normalized)){
        await TrafficAssistantV40.accept();
        return;
      }
      if(/^(?:nao|não|deixa|deixe|mantem|mantenha|continua|continue)$/.test(normalized)){
        TrafficAssistantV40.decline();
        this.reply('Mantendo a rota atual.');
        return;
      }
    }

    if(!normalized){

      this.reply(
        'Não consegui entender. Tente novamente.'
      );

      return;

    }

    const asksMoreNews=/^(?:mais|continue|continuar|proximas|próximas)\s+(?:as\s+)?noticias$/.test(normalized) || normalized==='mais noticias';
    if(asksMoreNews){
      await this.reportNews(true,false);
      return;
    }

    const asksNews =
      normalized.includes('noticias de hoje') ||
      normalized.includes('noticia de hoje') ||
      normalized.includes('noticias do dia') ||
      normalized.includes('noticia do dia') ||
      normalized.includes('principais noticias') ||
      normalized.includes('ultimas noticias') ||
      normalized.includes('o que aconteceu hoje') ||
      normalized.includes('me fale as noticias') ||
      normalized.includes('me diga as noticias') ||
      normalized==='noticias';

    if(asksNews){
      const onlyRio=normalized.includes('rio de janeiro') || normalized.includes('no rio') || normalized.includes('do rio');
      await this.reportNews(false,onlyRio);
      return;
    }

    // Contexto do GPS do próprio Radar: não passa pela IA.
    const asksCurrentPlace =
      /^(?:onde|aonde)(?: que)? (?:eu )?(?:estou|to)$/.test(normalized) ||
      normalized.includes('minha localizacao atual') ||
      normalized.includes('qual e minha localizacao') ||
      normalized.includes('que rua eu estou') ||
      normalized.includes('qual rua eu estou') ||
      normalized.includes('em que rua estou') ||
      normalized.includes('qual e essa rua') ||
      normalized.includes('nessa latitude') ||
      normalized.includes('nessa longitude') ||
      normalized.includes('qual e a minha rua') ||
      normalized.includes('qual minha rua') ||
      normalized.includes('qual bairro eu estou') ||
      normalized.includes('em que bairro estou') ||
      normalized.includes('onde eu me encontro');

    if(asksCurrentPlace){
      if(!Array.isArray(App.userPos) || App.userPos.length<2){
        App.startGPS?.();
        this.reply('O GPS ainda está adquirindo sua posição. Aguarde alguns segundos e tente novamente.');
        return;
      }
      const pos=await this.getCurrentAddress(true);
      if(pos?.label) this.reply('Você está em '+pos.label+'.');
      else this.reply('Estou com sua posição no GPS: latitude '+pos.lat.toFixed(5)+' e longitude '+pos.lon.toFixed(5)+'. Ainda não consegui converter essas coordenadas para o nome da rua.');
      return;
    }

    const nearbyMatch = command.match(/(?:qual(?: e)?|onde(?: fica| tem)?|ache|encontre|procure)?\s*(?:o|a|um|uma)?\s*(.+?)\s+(?:mais\s+)?(?:perto|proximo|proxima)(?:\s+(?:de|da|do))?\s*(mim|minha localizacao|onde estou|minha casa|aqui)?$/i);
    if(nearbyMatch && nearbyMatch[1]){
      let q=this.trimPoliteWords(nearbyMatch[1]).replace(/^(?:qual(?: e)?|onde(?: fica| tem)?|ache|encontre|procure)\s+/i,'').trim();
      if(q && !/^(?:tempo|distancia|rota)$/i.test(q)){
        await this.findNearbyPlace(q, /minha casa/i.test(command));
        return;
      }
    }

    const asksRouteTime = normalized.includes('quanto tempo falta') || normalized.includes('falta quanto tempo') || normalized.includes('quanto falta para chegar') || normalized.includes('quanto falta pra chegar') || normalized.includes('hora de chegada');
    const asksRouteDistance = normalized.includes('qual a distancia') || normalized.includes('qual e a distancia') || normalized.includes('quanto falta de distancia') || normalized.includes('quantos quilometros faltam') || normalized.includes('quantos km faltam') || normalized.includes('distancia da rota');

    if(asksRouteTime || asksRouteDistance){
      if(!App.route){
        this.reply('Não há uma rota ativa no momento.');
        return;
      }
      const totalM=Number(App.route.distance ?? App.route.summary?.lengthInMeters);
      const progressM=Math.max(0,Number(App.routeProgressMeters||0));
      const remainM=Number.isFinite(totalM) ? Math.max(0,totalM-progressM) : NaN;
      const totalSec=Number(App.route.duration ?? App.route.summary?.travelTimeInSeconds);
      const ratio=Number.isFinite(totalM) && totalM>0 && Number.isFinite(remainM) ? remainM/totalM : 1;
      const remainSec=Number.isFinite(totalSec) ? Math.max(0,totalSec*ratio) : NaN;
      const km=Number.isFinite(remainM) ? remainM/1000 : NaN;
      const min=Number.isFinite(remainSec) ? Math.max(1,Math.round(remainSec/60)) : NaN;
      if(asksRouteDistance && Number.isFinite(km)){
        this.reply(km<1 ? 'Faltam aproximadamente '+Math.max(10,Math.round(remainM/10)*10)+' metros para o destino.' : 'Faltam aproximadamente '+km.toFixed(km<10?1:0).replace('.',',')+' quilômetros para o destino.');
      }else if(asksRouteTime && Number.isFinite(min)){
        this.reply('Faltam aproximadamente '+min+' minutos para chegar ao destino.');
      }else{
        this.reply('A rota está ativa, mas ainda estou atualizando a distância e o tempo restantes.');
      }
      return;
    }


    if(
      await this.handleFlexibleIntent(
        command,
        normalized
      )
    )
      return;


    if(
      /^(oi|ola|bom dia|boa tarde|boa noite)$/.test(
        normalized
      )
    ){

      this.reply(
        'Olá. Estou pronta para ajudar na sua viagem.'
      );

      return;

    }


    if(
      normalized.includes('o que voce faz') ||
      normalized==='ajuda' ||
      normalized==='comandos'
    ){

      this.reply(
        'Você pode pedir o clima de hoje ou amanhã, uma rota, a localização de um lugar, as ocorrências do Rio de Janeiro, repetir a orientação, consultar hora e data, mostrar ou ocultar postos e comunidades, salvar sua casa neste aparelho ou fazer perguntas gerais. Toque no microfone quando quiser conversar comigo; durante a navegação eu também posso usar o contexto da rota.'
      );

      return;

    }


    if(
      /^(?:mais|próximas|proximas|continue(?:\s+as)?)\s+ocorrências?$/.test(
        command.toLocaleLowerCase('pt-BR')
      )
    ){

      await this.reportRioOccurrences(
        true
      );

      return;

    }


    if(
      normalized.includes('ocorrencias') &&
      (
        normalized.includes('me informe') ||
        normalized.includes('informe') ||
        normalized.includes('quais') ||
        normalized.includes('de hoje') ||
        normalized.includes('rio de janeiro')
      )
    ){

      await this.reportRioOccurrences(
        false
      );

      return;

    }


    const homeWithAddress=
      command.match(
        /^(?:minha casa\s+(?:é|e|fica\s+em)|(?:salve|guarde|cadastre|defina|coloque)\s+(?:o\s+endereço\s+da\s+)?minha casa(?:\s+(?:como|em))?)\s*[:,-]?\s+(.{5,})$/i
      );


    if(homeWithAddress){

      const address=
        homeWithAddress[1]
        .trim();


      if(this.saveHome(address)){

        this.reply(
          'Endereço de casa salvo somente neste aparelho.'
        );

      }else{

        this.reply(
          'Não consegui salvar o endereço neste aparelho.'
        );

      }


      if(
        /^(?:defina|coloque)/i.test(
          command
        )
      )
        await this.routeTo(address);


      return;

    }


    if(
      /^(?:salve|salvar|guarde|guardar|cadastre|cadastrar)(?:\s+(?:este|esse|o))?(?:\s+(?:destino|endereço))?(?:\s+como)?\s+minha casa$/i.test(
        command
      )
    ){

      const address=
        document
        .getElementById(
          'destInput'
        )
        .value
        .trim();


      if(!address){

        this.reply(
          'Pesquise primeiro o endereço da sua casa.'
        );

      }else if(this.saveHome(address)){

        this.reply(
          'Endereço de casa salvo somente neste aparelho.'
        );

      }else{

        this.reply(
          'Não consegui salvar o endereço neste aparelho.'
        );

      }


      return;

    }


    if(
      /^(?:cancelar|cancele|parar|pare|encerrar|encerre)(?:\s+(?:a|esta))?\s+(?:rota|navegação|navegacao)$/.test(
        normalized
      )
    ){

      App.clearRoute();

      this.reply(
        'Navegação encerrada.'
      );

      return;

    }


    if(
      /^(?:iniciar|inicie|comecar|comece)(?:\s+a)?\s+(?:rota|navegacao)$/.test(
        normalized
      )
    ){

      if(App.route){

        App.startNavigation();

        this.reply(
          'Navegação iniciada.'
        );

      }else{

        this.reply(
          'Escolha primeiro um destino.'
        );

      }


      return;

    }


    if(
      /^(?:repita|repetir|qual e a proxima orientacao|proxima orientacao)$/.test(
        normalized
      )
    ){

      this.repeatGuidance();

      return;

    }


    if(
      /^(?:ocultar|esconder|desligar)\s+(?:os\s+)?postos$/.test(
        normalized
      )
    ){

      this.setFuel('none');

      return;

    }


    if(
      /^(?:mostrar|exibir|ligar)\s+(?:os\s+)?postos(?:\s+normais)?$/.test(
        normalized
      )
    ){

      this.setFuel('all');

      return;

    }


    if(
      normalized.includes('postos com gnv') ||
      normalized.includes('posto com gnv')
    ){

      this.setFuel('gnv');

      return;

    }


    if(
      normalized.includes('postos com irregularidades') ||
      normalized.includes('postos com irregularidade')
    ){

      this.setFuel('official');

      return;

    }


    if(
      /^(?:ocultar|esconder|desligar)\s+(?:as\s+)?comunidades$/.test(
        normalized
      )
    ){

      this.setCommunities(false);

      return;

    }


    if(
      /^(?:mostrar|exibir|ligar)\s+(?:as\s+)?comunidades$/.test(
        normalized
      )
    ){

      this.setCommunities(true);

      return;

    }


    if(
      normalized.includes('qual a velocidade') ||
      normalized.includes('minha velocidade')
    ){

      this.reply(
        'Velocidade atual: '+
        Math.max(
          0,
          Math.round(
            App.currentSpeed
          )
        )+
        ' quilômetros por hora.'
      );

      return;

    }


    const whereMatch=
      command.match(
        /^onde\s+fica\s+(.+)$/i
      );


    if(whereMatch){

      await this.findPlace(
        whereMatch[1]
      );

      return;

    }


    const routeMatch=
      command.match(
        /^(?:(?:agora\s+)?(?:me\s+leve|leve(?:-|\s)?me|navegue|quero\s+ir|ir|vá|va|trace(?:\s+uma)?\s+rota|troque(?:\s+a)?\s+rota|mude(?:\s+a)?\s+rota))(?:\s+me\s+leve)?(?:\s+(?:para|até|ate|em))?\s+(.+)$/i
      );


    if(routeMatch){

      await this.routeTo(
        routeMatch[1]
      );

      return;

    }


    await this.askAI(command);

    return;

  }

};
