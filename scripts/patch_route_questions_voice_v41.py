from pathlib import Path
import re
p=Path('index.html')
s=p.read_text(encoding='utf-8')
s=re.sub(r'<meta name="radar-build" content="[^"]+">','<meta name="radar-build" content="41-route-questions-voices">',s,count=1)

# Perguntas diretas de trânsito usam a consulta TomTom já existente da v40.
anchor="  async check(){\n"
if anchor in s and 'async answerTrafficQuestion()' not in s:
    methods=r'''  async getTrafficSnapshot(){
    if(!App.route || !App.destination || !Array.isArray(App.userPos)) return null;
    const [lon,lat]=App.userPos;
    const [dlon,dlat]=App.destination;
    const locations=lat+','+lon+':'+dlat+','+dlon;
    const path='/routing/1/calculateRoute/'+locations+'/json?traffic=true&routeType=fastest&travelMode=car&language=pt-BR&computeTravelTimeFor=all&maxAlternatives=1';
    const controller=new AbortController();
    const timeout=setTimeout(()=>controller.abort(),12000);
    try{
      const response=await fetch(this.worker+'/v1/tomtom?path='+encodeURIComponent(path),{cache:'no-store',signal:controller.signal});
      if(!response.ok) throw new Error('TomTom traffic '+response.status);
      const data=await response.json();
      const route=data?.routes?.[0];
      if(!route) return null;
      return {
        travelSec:Number(route.summary?.travelTimeInSeconds),
        delaySec:Number(route.summary?.trafficDelayInSeconds||0),
        distanceM:Number(route.summary?.lengthInMeters)
      };
    }finally{ clearTimeout(timeout); }
  },

  async answerTrafficQuestion(){
    if(!App.route || !App.destination){
      VoiceAssistant.reply('Trace uma rota primeiro. Aí eu consigo consultar o trânsito do caminho.');
      return true;
    }
    try{
      const info=await this.getTrafficSnapshot();
      if(!info || !Number.isFinite(info.travelSec)) throw new Error('sem dados');
      const mins=Math.max(1,Math.round(info.travelSec/60));
      const delay=Math.max(0,Math.round(info.delaySec/60));
      if(delay>=3) VoiceAssistant.reply('Sim. O TomTom indica cerca de '+delay+' minutos de atraso por trânsito na rota. O tempo atual estimado é '+mins+' minutos.');
      else if(delay>0) VoiceAssistant.reply('Há uma pequena retenção na rota, com cerca de '+delay+' minuto'+(delay===1?'':'s')+' de atraso. O trajeto está estimado em '+mins+' minutos.');
      else VoiceAssistant.reply('O TomTom não indica retenção relevante nessa rota agora. O trajeto está estimado em '+mins+' minutos.');
    }catch(e){
      VoiceAssistant.reply('Não consegui consultar o trânsito do TomTom agora. A navegação continua normalmente.');
    }
    return true;
  },

  async answerRadarQuestion(){
    if(!App.route){
      VoiceAssistant.reply('Trace uma rota primeiro para eu verificar os radares do caminho.');
      return true;
    }
    const candidates=[];
    for(const key of ['radars','radares','speedCameras','radarData']){
      if(Array.isArray(App[key])) candidates.push(...App[key]);
    }
    if(Array.isArray(window.RADARS)) candidates.push(...window.RADARS);
    if(Array.isArray(window.RADARES)) candidates.push(...window.RADARES);
    const pts=App.route?.geometry?.coordinates || App.route?.coordinates || App.route?.points || [];
    if(!candidates.length || !Array.isArray(pts) || pts.length<2){
      VoiceAssistant.reply('Eu ainda não consegui cruzar os radares cadastrados com essa rota. Vou continuar avisando os radares que o mapa detectar durante a navegação.');
      return true;
    }
    const hav=(a,b)=>{
      const R=6371000, toRad=x=>x*Math.PI/180;
      const dLat=toRad(b[1]-a[1]), dLon=toRad(b[0]-a[0]);
      const q=Math.sin(dLat/2)**2+Math.cos(toRad(a[1]))*Math.cos(toRad(b[1]))*Math.sin(dLon/2)**2;
      return 2*R*Math.asin(Math.sqrt(q));
    };
    const near=candidates.filter(r=>{
      const lon=Number(r.lon??r.lng??r.longitude??r.coordinates?.[0]);
      const lat=Number(r.lat??r.latitude??r.coordinates?.[1]);
      if(!Number.isFinite(lon)||!Number.isFinite(lat)) return false;
      let best=Infinity;
      for(let i=0;i<pts.length;i+=Math.max(1,Math.floor(pts.length/250))){
        const p=pts[i]; if(Array.isArray(p)&&p.length>=2) best=Math.min(best,hav([lon,lat],[Number(p[0]),Number(p[1])]));
      }
      return best<=180;
    });
    const unique=[...new Set(near.map(r=>String(r.id??r.name??r.nome??((r.lat??r.latitude)+','+(r.lon??r.lng??r.longitude)))) )];
    if(unique.length) VoiceAssistant.reply('Encontrei '+unique.length+' radar'+(unique.length===1?'':'es')+' cadastrado'+(unique.length===1?'':'s')+' próximo'+(unique.length===1?'':'s')+' da sua rota. Durante a navegação eu aviso conforme você se aproxima.');
    else VoiceAssistant.reply('Não encontrei radar cadastrado próximo dessa rota. Isso não garante que não existam outros radares no caminho.');
    return true;
  },

'''
    s=s.replace(anchor,methods+anchor,1)

# Intercepta perguntas naturais antes de cair na IA geral.
needle="""    if(typeof TrafficAssistantV40!=='undefined' && TrafficAssistantV40.hasPending()){\n"""
if needle in s and 'answerTrafficQuestion' in s and 'trafficQuestionV41' not in s:
    repl=r'''    const trafficQuestionV41=/\b(?:transito|trânsito|engarrafamento|engarrafado|retencao|retenção|congestionamento|congestionado)\b/.test(normalized) && /\b(?:rota|caminho|trajeto|ate|até|frente|indo|viagem|transito|trânsito|engarrafamento|retencao|retenção)\b/.test(normalized);
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
'''
    s=s.replace(needle,repl,1)

# Seletor leve de vozes: usa somente speechSynthesis do aparelho, sem baixar áudio/modelos.
voice_anchor="window.RadarApp={"
if voice_anchor in s and 'const RadarVoicePickerV41' not in s:
    picker=r'''const RadarVoicePickerV41={
  storageKey:'radarVoiceURI',
  voices(){
    return (window.speechSynthesis?.getVoices?.()||[]).filter(v=>/^pt(?:-|_)/i.test(v.lang||''));
  },
  selected(){
    const uri=localStorage.getItem(this.storageKey)||'';
    return this.voices().find(v=>v.voiceURI===uri)||this.voices().find(v=>/pt-BR/i.test(v.lang||''))||null;
  },
  choose(uri){ localStorage.setItem(this.storageKey,String(uri||'')); },
  sample(uri){
    const v=this.voices().find(x=>x.voiceURI===uri)||this.selected();
    if(!v) return false;
    const u=new SpeechSynthesisUtterance('Olá. Esta é uma opção de voz do Radar Seguro.');
    u.lang='pt-BR'; u.voice=v;
    speechSynthesis.cancel(); speechSynthesis.speak(u); return true;
  },
  init(){
    if(!window.speechSynthesis) return;
    const apply=()=>{
      const original=window.SpeechSynthesisUtterance;
      if(!original || original.__radarVoiceWrapped) return;
      const picker=this;
      function Wrapped(text){ const u=new original(text); const v=picker.selected(); if(v) u.voice=v; return u; }
      Wrapped.prototype=original.prototype;
      Wrapped.__radarVoiceWrapped=true;
      try{ window.SpeechSynthesisUtterance=Wrapped; }catch(e){}
    };
    speechSynthesis.getVoices();
    if('onvoiceschanged' in speechSynthesis) speechSynthesis.addEventListener('voiceschanged',apply,{once:true});
    apply();
  }
};

'''
    s=s.replace(voice_anchor,picker+voice_anchor,1)

initneedle="""    App.init();\n    setTimeout(()=>TrafficAssistantV40.init(),1200);"""
if initneedle in s and 'RadarVoicePickerV41.init()' not in s:
    s=s.replace(initneedle,"""    App.init();
    setTimeout(()=>TrafficAssistantV40.init(),1200);
    setTimeout(()=>RadarVoicePickerV41.init(),500);""",1)

required=['41-route-questions-voices','answerTrafficQuestion()','answerRadarQuestion()','const RadarVoicePickerV41','RadarVoicePickerV41.init()']
missing=[x for x in required if x not in s]
if missing: raise SystemExit('v41 markers missing: '+', '.join(missing))
p.write_text(s,encoding='utf-8')
print('patch v41 aplicado')
