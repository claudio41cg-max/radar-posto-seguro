from pathlib import Path
import re
p=Path('index.html')
s=p.read_text(encoding='utf-8')
s=re.sub(r'<meta name="radar-build" content="[^"]+">','<meta name="radar-build" content="51-tomtom-worker-unified">',s,count=1)

# 1) Busca TomTom sempre via Worker; chave nunca vai para o navegador.
old=r'''    const params=
      new URLSearchParams({
        key:TOMTOM_KEY,
        limit:'8',
        countrySet:'BR',
        language:'pt-BR',
        lat:center[1],
        lon:center[0]
      });

    const r=
      await fetch(
        'https://api.tomtom.com/search/2/search/'+
        encodeURIComponent(q)+
        '.json?'+params,
        {signal}
      );'''
new=r'''    const params=
      new URLSearchParams({
        limit:'8',
        countrySet:'BR',
        language:'pt-BR',
        lat:center[1],
        lon:center[0]
      });
    const path='/search/2/search/'+encodeURIComponent(q)+'.json?'+params.toString();
    const r=await fetch(
      'https://radar-seguro-ia-rj.claudio41cg.workers.dev/v1/tomtom?path='+encodeURIComponent(path),
      {signal,cache:'no-store'}
    );'''
if old not in s: raise SystemExit('geocodeTomTom alvo nao encontrado')
s=s.replace(old,new,1)

# 2) Rota principal TomTom via Worker, com tráfego real e até 2 alternativas.
old2=r'''    const url=
`https://api.tomtom.com/routing/1/calculateRoute/${a[1]},${a[0]}:${b[1]},${b[0]}/json?key=${TOMTOM_KEY}&traffic=true&travelMode=${mode}&instructionsType=text&language=pt-BR&routeType=fastest&avoid=unpavedRoads`;'''
new2=r'''    const path=
`/routing/1/calculateRoute/${a[1]},${a[0]}:${b[1]},${b[0]}/json?traffic=true&travelMode=${mode}&instructionsType=text&language=pt-BR&routeType=fastest&avoid=unpavedRoads&computeTravelTimeFor=all&maxAlternatives=2`;
    const url='https://radar-seguro-ia-rj.claudio41cg.workers.dev/v1/tomtom?path='+encodeURIComponent(path);'''
if old2 not in s: raise SystemExit('fetchTomTomRoute alvo nao encontrado')
s=s.replace(old2,new2,1)

# Preserva resumo de trânsito real na rota principal.
old3="""        duration:\n          rt.summary\n          .travelTimeInSeconds,\n\n        engine:'tomtom'"""
new3="""        duration:\n          rt.summary\n          .travelTimeInSeconds,\n\n        trafficDelaySeconds:Number(rt.summary?.trafficDelayInSeconds||0),\n        liveTraffic:true,\n        engine:'tomtom'"""
if old3 in s: s=s.replace(old3,new3,1)

# 3) Consulta de trânsito: com rota consulta caminho; sem rota consulta fluxo da via atual.
pat=r"  async answerTrafficQuestion\(\)\{.*?\n  \},\n\n  async answerRadarQuestion"
repl=r'''  async answerTrafficQuestion(){
    if(App.route && App.destination){
      try{
        const info=await this.getTrafficSnapshot();
        if(!info || !Number.isFinite(info.travelSec)) throw new Error('sem dados');
        const mins=Math.max(1,Math.round(info.travelSec/60));
        const delay=Math.max(0,Math.round(info.delaySec/60));
        if(delay>=3) VoiceAssistant.reply('Sim. O TomTom indica cerca de '+delay+' minutos de atraso por trânsito na rota. O tempo atual estimado é '+mins+' minutos.');
        else if(delay>0) VoiceAssistant.reply('Há uma pequena retenção na rota, com cerca de '+delay+' minuto'+(delay===1?'':'s')+' de atraso. O trajeto está estimado em '+mins+' minutos.');
        else VoiceAssistant.reply('O TomTom não indica retenção relevante nessa rota agora. O trajeto está estimado em '+mins+' minutos.');
        return true;
      }catch(e){
        console.warn('TomTom rota/voz:',e);
        VoiceAssistant.reply('Não consegui consultar o trânsito real do TomTom agora. Tente novamente em instantes.');
        return true;
      }
    }
    if(Array.isArray(App.userPos) && App.userPos.length>=2){
      try{
        const [lon,lat]=App.userPos;
        const path='/traffic/services/4/flowSegmentData/absolute/10/json?point='+lat+','+lon+'&unit=KMPH';
        const r=await fetch(this.worker+'/v1/tomtom?path='+encodeURIComponent(path),{cache:'no-store'});
        if(!r.ok) throw new Error('TomTom flow '+r.status);
        const d=await r.json();
        const f=d?.flowSegmentData;
        const current=Number(f?.currentSpeed), free=Number(f?.freeFlowSpeed);
        if(!Number.isFinite(current)||!Number.isFinite(free)||free<=0) throw new Error('fluxo incompleto');
        const ratio=current/free;
        if(f.roadClosure || ratio<=0.32) VoiceAssistant.reply('Na via em que você está agora, o TomTom indica trânsito bem lento ou parado.');
        else if(ratio<0.70) VoiceAssistant.reply('Há trânsito moderado na via atual, segundo o TomTom.');
        else VoiceAssistant.reply('O TomTom indica fluxo livre na via em que você está agora.');
      }catch(e){
        console.warn('TomTom via atual:',e);
        VoiceAssistant.reply('Não consegui consultar o trânsito real do TomTom agora.');
      }
      return true;
    }
    VoiceAssistant.reply('Ainda não tenho sua localização. Aguarde o GPS e tente de novo.');
    return true;
  },

  async answerRadarQuestion'''
s,n=re.subn(pat,repl,s,count=1,flags=re.S)
if n!=1: raise SystemExit('answerTrafficQuestion alvo nao encontrado')

# 4) Intenção de trânsito mais natural, sem transformar toda menção a estrada em trânsito.
old4=r'''    const trafficQuestionV41=/\b(?:transito|trânsito|engarrafamento|engarrafado|retencao|retenção|congestionamento|congestionado)\b/.test(normalized) && /\b(?:rota|caminho|trajeto|ate|até|frente|indo|viagem|transito|trânsito|engarrafamento|retencao|retenção)\b/.test(normalized);'''
new4=r'''    const trafficQuestionV41=/\b(?:transito|engarrafamento|engarrafado|retencao|congestionamento|congestionado|travado|travada|lento|lenta|fluxo)\b/.test(normalized);'''
if old4 not in s: raise SystemExit('regex transito alvo nao encontrado')
s=s.replace(old4,new4,1)

# 5) IA recebe snapshot TomTom real quando houver rota e nunca precisa inventar trânsito.
needle="""    App.toast(\n      'Consultando a inteligência...',\n      4500\n    );\n\n\n    const controller="""
insert="""    App.toast(\n      'Consultando a inteligência...',\n      4500\n    );\n\n    let trafficInfo=null;\n    if(App.route && App.destination && typeof TrafficAssistantV40!=='undefined'){\n      try{ trafficInfo=await TrafficAssistantV40.getTrafficSnapshot(); }catch(e){ trafficInfo=null; }\n    }\n\n    const controller="""
if needle not in s: raise SystemExit('askAI controller alvo nao encontrado')
s=s.replace(needle,insert,1)
ctx="""                const route=this.routeContext();\n                if(route) context.push('Rota ativa: '+JSON.stringify(route));\n                if(this.conversationHistory.length) context.push('Conversa recente: '+this.conversationHistory.slice(-6).join(' | '));"""
ctx2="""                const route=this.routeContext();\n                if(route) context.push('Rota ativa: '+JSON.stringify(route));\n                if(trafficInfo && Number.isFinite(trafficInfo.travelSec)){\n                  const delayMin=Math.max(0,Math.round((trafficInfo.delaySec||0)/60));\n                  const totalMin=Math.max(1,Math.round(trafficInfo.travelSec/60));\n                  context.push('Trânsito real TomTom: atraso '+delayMin+' minuto(s), tempo total '+totalMin+' minuto(s). Use somente estes dados para trânsito; nunca invente números.');\n                }else if(App.route){\n                  context.push('Trânsito TomTom indisponível nesta consulta. Se perguntarem sobre trânsito, diga que não foi possível consultar dados reais agora; nunca invente.');\n                }\n                if(this.conversationHistory.length) context.push('Conversa recente: '+this.conversationHistory.slice(-6).join(' | '));"""
if ctx not in s: raise SystemExit('contexto askAI alvo nao encontrado')
s=s.replace(ctx,ctx2,1)

required=['51-tomtom-worker-unified','/v1/tomtom?path=','trafficDelaySeconds','TomTom indica fluxo livre','trafficInfo=await TrafficAssistantV40.getTrafficSnapshot']
missing=[x for x in required if x not in s]
if missing: raise SystemExit('v51 markers missing: '+', '.join(missing))
p.write_text(s,encoding='utf-8')
print('patch v51 aplicado')
