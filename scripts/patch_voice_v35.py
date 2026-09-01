from pathlib import Path

p = Path('index.html')
s = p.read_text(encoding='utf-8')

# Visual principal estável.
s = s.replace("""    if(main)\n      main.textContent=\n        active?'⏹️':'🎙️';""", """    if(main)\n      main.textContent='🎙️';""", 1)

# Janela de conversa de 2 minutos após ouvir a palavra Radar.
marker = """  hasWakeWord(text){\n\n    return /^\\s*(?:(?:oi|ol[áa]|ei|por favor)\\s+)?radar\\b/i\n      .test(\n        String(text||'')\n      );\n\n  },"""
repl = """  hasWakeWord(text){\n\n    return /^\\s*(?:(?:oi|ol[áa]|ei|por favor)\\s+)?radar\\b/i\n      .test(String(text||''));\n\n  },\n\n  conversationUntil:0,\n\n  conversationOpen(){\n    return Date.now()<Number(this.conversationUntil||0);\n  },\n\n  keepConversationOpen(){\n    this.conversationUntil=Date.now()+120000;\n  },"""
if marker in s:
    s = s.replace(marker, repl, 1)

old = """        if(\n          text &&\n          !error &&\n          this.hasWakeWord(text)\n        ){\n\n          Promise\n          .resolve(\n            this.handle(text)\n          )"""
new = """        if(text && !error && (this.hasWakeWord(text) || this.conversationOpen())){\n\n          if(this.hasWakeWord(text)) this.keepConversationOpen();\n\n          Promise\n          .resolve(\n            this.handle(text)\n          )"""
if old in s:
    s = s.replace(old, new, 1)

# Fechar a janela junto com o mãos livres.
s = s.replace("""    this.handsFree=false;\n\n    clearTimeout(""", """    this.handsFree=false;\n    this.conversationUntil=0;\n\n    clearTimeout(""", 1)

# Perguntas sobre endereço atual.
start = s.find("    // Respostas de contexto do próprio Radar: não passam pela IA.")
end = s.find("\n\n    if(normalized.includes('quanto tempo falta')", start)
if start != -1 and end != -1:
    block = """    // Contexto do GPS do próprio Radar: não passa pela IA.\n    const asksCurrentPlace =\n      /^(?:onde|aonde)(?: que)? (?:eu )?(?:estou|to)$/.test(normalized) ||\n      normalized.includes('minha localizacao atual') ||\n      normalized.includes('qual e minha localizacao') ||\n      normalized.includes('que rua eu estou') ||\n      normalized.includes('qual rua eu estou') ||\n      normalized.includes('em que rua estou') ||\n      normalized.includes('qual e essa rua') ||\n      normalized.includes('nessa latitude') ||\n      normalized.includes('nessa longitude');\n\n    if(asksCurrentPlace){\n      if(Array.isArray(App.userPos) && App.userPos.length>=2){\n        const lon=Number(App.userPos[0]), lat=Number(App.userPos[1]);\n        let endereco='';\n        try{\n          const path='/search/2/reverseGeocode/'+lat+','+lon+'.json?language=pt-BR&radius=200';\n          const r=await fetch('https://radar-seguro-ia-rj.claudio41cg.workers.dev/v1/tomtom?path='+encodeURIComponent(path),{cache:'no-store'});\n          const d=r.ok?await r.json():null;\n          const a=d?.addresses?.[0]?.address||{};\n          endereco=a.freeformAddress || [a.streetName,a.streetNumber,a.municipalitySubdivision,a.municipality].filter(Boolean).join(', ');\n        }catch(e){}\n        if(endereco){\n          this.lastKnownAddress=endereco;\n          this.reply('Você está em '+endereco+'.');\n        }else if(this.lastKnownAddress){\n          this.reply('Sua localização atual é '+this.lastKnownAddress+'.');\n        }else{\n          this.reply('Estou com sua posição no mapa: latitude '+lat.toFixed(5)+' e longitude '+lon.toFixed(5)+'. O nome da rua ainda não foi confirmado pelo serviço de mapas.');\n        }\n      }else this.reply('O GPS ainda está adquirindo sua posição. Aguarde alguns segundos.');\n      return;\n    }"""
    s = s[:start] + block + s[end:]

# Tempo e distância restantes.
start = s.find("    if(normalized.includes('quanto tempo falta')")
end = s.find("\n\n\n    if(\n      await this.handleFlexibleIntent", start)
if start != -1 and end != -1:
    block = """    const asksRouteTime = normalized.includes('quanto tempo falta') || normalized.includes('falta quanto tempo') || normalized.includes('quanto falta para chegar') || normalized.includes('quanto falta pra chegar') || normalized.includes('hora de chegada');\n    const asksRouteDistance = normalized.includes('qual a distancia') || normalized.includes('qual e a distancia') || normalized.includes('quanto falta de distancia') || normalized.includes('quantos quilometros faltam') || normalized.includes('quantos km faltam') || normalized.includes('distancia da rota');\n\n    if(asksRouteTime || asksRouteDistance){\n      if(!App.route){\n        this.reply('Não há uma rota ativa no momento.');\n        return;\n      }\n      const totalM=Number(App.route.distance ?? App.route.summary?.lengthInMeters);\n      const progressM=Math.max(0,Number(App.routeProgressMeters||0));\n      const remainM=Number.isFinite(totalM) ? Math.max(0,totalM-progressM) : NaN;\n      const totalSec=Number(App.route.duration ?? App.route.summary?.travelTimeInSeconds);\n      const ratio=Number.isFinite(totalM) && totalM>0 && Number.isFinite(remainM) ? remainM/totalM : 1;\n      const remainSec=Number.isFinite(totalSec) ? Math.max(0,totalSec*ratio) : NaN;\n      const km=Number.isFinite(remainM) ? remainM/1000 : NaN;\n      const min=Number.isFinite(remainSec) ? Math.max(1,Math.round(remainSec/60)) : NaN;\n      if(asksRouteDistance && Number.isFinite(km)){\n        this.reply(km<1 ? 'Faltam aproximadamente '+Math.max(10,Math.round(remainM/10)*10)+' metros para o destino.' : 'Faltam aproximadamente '+km.toFixed(km<10?1:0).replace('.',',')+' quilômetros para o destino.');\n      }else if(asksRouteTime && Number.isFinite(min)){\n        this.reply('Faltam aproximadamente '+min+' minutos para chegar ao destino.');\n      }else{\n        this.reply('A rota está ativa, mas ainda estou atualizando a distância e o tempo restantes.');\n      }\n      return;\n    }"""
    s = s[:start] + block + s[end:]

# Estilo do botão existente; não cria botão novo.
if 'radar-voice-v35-style' not in s:
    style = """\n<style id=\"radar-voice-v35-style\">\n#assistantMicBtn{border-radius:50%!important;width:42px!important;height:42px!important;min-width:42px!important;padding:0!important;font-size:0!important;display:inline-grid!important;place-items:center!important;background:linear-gradient(145deg,#0f172a,#24324a)!important;border:1px solid rgba(255,255,255,.22)!important;box-shadow:0 4px 12px rgba(0,0,0,.28),inset 0 1px 0 rgba(255,255,255,.16)!important;transition:transform .18s ease,box-shadow .18s ease!important}\n#assistantMicBtn::before{content:'🎙';font-size:21px;line-height:1;filter:drop-shadow(0 1px 2px rgba(0,0,0,.35))}\n#assistantMicBtn.listening,#assistantMicBtn[aria-pressed=\"true\"]{background:linear-gradient(145deg,#0f172a,#24324a)!important;box-shadow:0 4px 12px rgba(0,0,0,.28),0 0 0 2px rgba(56,189,248,.24)!important}\n#navAssistantMicBtn.listening{animation:none!important}\n</style>\n"""
    s = s.replace('</head>', style + '</head>', 1)

s = s.replace('<meta name="radar-build" content="34-direct">','<meta name="radar-build" content="35-voice-session">',1)

p.write_text(s, encoding='utf-8')
print('patch v35 aplicado')
