from pathlib import Path
import re

p=Path('index.html')
s=p.read_text(encoding='utf-8')

s=re.sub(r'<meta name="radar-build" content="[^"]+">','<meta name="radar-build" content="40-traffic-followup">',s,count=1)

# Estado curto de continuação de conversa: uma única janela de 5 segundos.
marker="  lastNewsUpdatedAt:0,\n"
insert="""  lastNewsUpdatedAt:0,
  followUpMode:false,
  followUpTimer:null,
  followUpRequested:false,
"""
if marker in s and 'followUpMode:false' not in s:
    s=s.replace(marker,insert,1)

# Ao terminar de falar, só tenta uma continuação se a resposta realmente terminou com pergunta.
old_voice_end="""    u.onend=
    u.onerror=
      ()=>{

        this.speaking=false;

        setTimeout(
          ()=>this.process(),
          120
        );

      };"""
new_voice_end="""    u.onend=
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
      };"""
if old_voice_end in s:
    s=s.replace(old_voice_end,new_voice_end,1)

# reply marca se vale abrir uma janela curta de resposta.
old_reply="""  reply(text,priority=true){

    App.toast(
      text,
      5200
    );

    Voice.speak(
      text,
      priority
    );

  },"""
new_reply="""  reply(text,priority=true){

    const spoken=String(text||'').trim();
    this.followUpRequested=/\\?\\s*$/.test(spoken) || /\\b(?:quer|deseja|posso)\\b[^.?!]*\\?/.test(this.normalize(spoken));

    App.toast(
      spoken,
      5200
    );

    Voice.speak(
      spoken,
      priority
    );

  },"""
if old_reply in s:
    s=s.replace(old_reply,new_reply,1)

# Métodos da janela curta antes de normalize(). Não existe loop, keepalive ou getUserMedia.
anchor="  normalize(text){"
if anchor in s and 'onAssistantSpeechEnded(spokenText)' not in s:
    methods=r'''  cancelFollowUpWindow(){
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

'''
    s=s.replace(anchor,methods+anchor,1)

# Toque manual cancela qualquer janela automática antes de iniciar uma nova fala.
toggle_marker="""  toggle(){

    if(!this.recognition){"""
toggle_repl="""  toggle(){

    this.cancelFollowUpWindow();

    if(!this.recognition){"""
if toggle_marker in s:
    s=s.replace(toggle_marker,toggle_repl,1)

# Durante a janela curta não mostra tutorial/toast de abertura.
onstart_old="""      if(!this.handsFree)
        App.toast(
          '🎙️ Estou ouvindo. Fale agora...',
          10000
        );"""
onstart_new="""      if(!this.handsFree && !this.followUpMode)
        App.toast(
          '🎙️ Estou ouvindo. Fale agora...',
          10000
        );"""
if onstart_old in s:
    s=s.replace(onstart_old,onstart_new,1)

# No-speech durante a janela de 5s é silencioso; não fica reabrindo o microfone.
err_marker="""      if(
        error===
        'aborted'
      )
        return;"""
err_repl="""      if(
        error===
        'aborted'
      )
        return;

      if(this.followUpMode && error==='no-speech'){
        this.lastError='aborted';
        return;
      }"""
if err_marker in s:
    s=s.replace(err_marker,err_repl,1)

# Limpa a janela ao encerrar o reconhecimento, sem novo ciclo automático.
onend_marker="""      const error=
        this.lastError;


      this.transcript='';

      this.lastError=null;"""
onend_repl="""      const error=
        this.lastError;

      clearTimeout(this.followUpTimer);
      this.followUpTimer=null;
      this.followUpMode=false;

      this.transcript='';

      this.lastError=null;"""
if onend_marker in s:
    s=s.replace(onend_marker,onend_repl,1)

# Respostas da IA: estilo rádio, mas sem cortar informação importante.
needle="ctx.push('Responda em português do Brasil, de forma natural, curta e útil para um motorista. Não invente fatos atuais nem notícias. Se a pergunta depender de notícia atual e não houver dados fornecidos, diga que precisa consultar as fontes do Radar.');"
replacement="ctx.push('Responda em português do Brasil, de forma curta, direta e útil para um motorista em movimento. Prefira uma ou duas frases. Não use introduções desnecessárias. Nunca invente trânsito, acidente, ocorrência, operação, notícia ou risco. Se faltar dado atual, diga isso claramente. Se fizer uma pergunta de continuidade, faça apenas uma pergunta curta no final.');"
if needle in s:
    s=s.replace(needle,replacement,1)

# Assistente de trânsito: consulta TomTom periodicamente durante navegação e sugere recálculo apenas quando a economia for relevante.
traffic_anchor="window.RadarApp={"
if traffic_anchor in s and 'const TrafficAssistantV40' not in s:
    traffic=r'''const TrafficAssistantV40={
  timer:null,
  checking:false,
  pending:null,
  lastAnnouncedAt:0,
  worker:'https://radar-seguro-ia-rj.claudio41cg.workers.dev',

  remainingSeconds(){
    if(!App.route) return NaN;
    const totalM=Number(App.route.distance ?? App.route.summary?.lengthInMeters);
    const progressM=Math.max(0,Number(App.routeProgressMeters||0));
    const remainingM=Number.isFinite(totalM)?Math.max(0,totalM-progressM):NaN;
    const totalSec=Number(App.route.duration ?? App.route.summary?.travelTimeInSeconds);
    if(!Number.isFinite(totalSec)) return NaN;
    if(Number.isFinite(totalM) && totalM>0 && Number.isFinite(remainingM)) return totalSec*(remainingM/totalM);
    return totalSec;
  },

  schedule(delay=60000){
    clearTimeout(this.timer);
    this.timer=setTimeout(()=>this.check(),delay);
  },

  async check(){
    clearTimeout(this.timer);
    this.timer=null;
    if(this.checking || !App.navActive || !App.route || !App.destination || !Array.isArray(App.userPos)){
      if(App.navActive) this.schedule(90000);
      return;
    }
    if(document.visibilityState!=='visible'){
      this.schedule(90000);
      return;
    }

    this.checking=true;
    try{
      const [lon,lat]=App.userPos;
      const [dlon,dlat]=App.destination;
      const locations=lat+','+lon+':'+dlat+','+dlon;
      const path='/routing/1/calculateRoute/'+locations+'/json?traffic=true&routeType=fastest&travelMode=car&language=pt-BR&computeTravelTimeFor=all&maxAlternatives=1';
      const controller=new AbortController();
      const timeout=setTimeout(()=>controller.abort(),12000);
      let response;
      try{
        response=await fetch(this.worker+'/v1/tomtom?path='+encodeURIComponent(path),{cache:'no-store',signal:controller.signal});
      }finally{ clearTimeout(timeout); }
      if(!response.ok) throw new Error('TomTom traffic '+response.status);
      const data=await response.json();
      const route=data?.routes?.[0];
      const freshSec=Number(route?.summary?.travelTimeInSeconds);
      const trafficDelay=Number(route?.summary?.trafficDelayInSeconds||0);
      const currentSec=this.remainingSeconds();
      if(!Number.isFinite(freshSec) || !Number.isFinite(currentSec) || currentSec<180) return;

      const saving=currentSec-freshSec;
      const minimum=Math.max(120,currentSec*.10);
      const now=Date.now();
      if(saving>=minimum && now-this.lastAnnouncedAt>5*60*1000){
        this.pending={createdAt:now,savingSec:saving,trafficDelay};
        this.lastAnnouncedAt=now;
        const minutes=Math.max(2,Math.round(saving/60));
        const congestion=trafficDelay>=180 ? 'Há retenção no trajeto atual. ' : '';
        Voice.speak(congestion+'Encontrei uma rota cerca de '+minutes+' minutos mais rápida. Toque no Radar e diga sim para recalcular.',true);
        App.toast('🚦 Rota mais rápida disponível: cerca de '+minutes+' min de economia.',7000);
      }
    }catch(e){
      console.warn('Radar tráfego:',e);
    }finally{
      this.checking=false;
      if(App.navActive) this.schedule(90000);
    }
  },

  hasPending(){
    return Boolean(this.pending && Date.now()-this.pending.createdAt<60000);
  },

  decline(){
    this.pending=null;
  },

  async accept(){
    if(!this.hasPending()) return false;
    this.pending=null;
    VoiceAssistant.reply('Recalculando pela opção mais rápida.');
    try{
      if(typeof App.recalculateRoute==='function') await App.recalculateRoute();
      else await App.calculateRoute();
      return true;
    }catch(e){
      VoiceAssistant.reply('Não consegui trocar a rota agora. Vou manter o trajeto atual.');
      return true;
    }
  },

  init(){
    const originalStart=App.startNavigation;
    if(typeof originalStart==='function' && !originalStart.__trafficV40){
      const wrapped=function(...args){
        const result=originalStart.apply(this,args);
        TrafficAssistantV40.schedule(35000);
        return result;
      };
      wrapped.__trafficV40=true;
      App.startNavigation=wrapped;
    }
    const originalClear=App.clearRoute;
    if(typeof originalClear==='function' && !originalClear.__trafficV40){
      const wrappedClear=function(...args){
        clearTimeout(TrafficAssistantV40.timer);
        TrafficAssistantV40.timer=null;
        TrafficAssistantV40.pending=null;
        return originalClear.apply(this,args);
      };
      wrappedClear.__trafficV40=true;
      App.clearRoute=wrappedClear;
    }
    if(App.navActive) this.schedule(35000);
  }
};

'''
    s=s.replace(traffic_anchor,traffic+traffic_anchor,1)

# Sim/não para sugestão de trânsito só vale por 60 segundos e exige fala explícita.
handle_point="""    const normalized=
      this.normalize(
        command
      );


    if(!normalized){"""
handle_repl="""    const normalized=
      this.normalize(
        command
      );

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

    if(!normalized){"""
if handle_point in s:
    s=s.replace(handle_point,handle_repl,1)

# Inicializa monitoramento depois do App.init, sem mexer no GPS/navegação principal.
init_point="""    App.init();

    const escapeFogoText=value=>"""
init_repl="""    App.init();
    setTimeout(()=>TrafficAssistantV40.init(),1200);

    const escapeFogoText=value=>"""
if init_point in s:
    s=s.replace(init_point,init_repl,1)

# Validações mínimas do patch para evitar publicar pela metade.
required=[
  '40-traffic-followup',
  'onAssistantSpeechEnded(spokenText)',
  'const TrafficAssistantV40',
  'TrafficAssistantV40.init()'
]
missing=[x for x in required if x not in s]
if missing:
    raise SystemExit('v40 markers missing: '+', '.join(missing))

p.write_text(s,encoding='utf-8')
print('patch v40 aplicado')
