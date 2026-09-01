from pathlib import Path
import re
p=Path('index.html')
s=p.read_text(encoding='utf-8')

# Localizacao robusta: coordenadas -> endereco legivel, com TomTom proxy e fallback Nominatim.
marker="  async askAI(question){"
if marker not in s: raise SystemExit('askAI marker missing')
helper=r'''  lastKnownAddress:'',
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

'''
s=s.replace(marker,helper+marker,1)

# Enriquece IA com contexto local, rota e pequena memoria conversacional, sem manter microfone aberto.
old="""body:JSON.stringify({\n              pergunta:(()=>{\n                const n=this.normalize(text);\n                const needsLocation=['perto','proximo','proxima','aqui','onde estou','minha localizacao','tempo','clima'].some(k=>n.includes(k));\n                if(needsLocation && Array.isArray(App.userPos) && App.userPos.length>=2){\n                  return text+'\\n\\nContexto do Radar: localização GPS atual latitude '+Number(App.userPos[1]).toFixed(5)+', longitude '+Number(App.userPos[0]).toFixed(5)+'. Use esse contexto apenas se for relevante.';\n                }\n                return text;\n              })()\n            }),"""
new="""body:JSON.stringify({\n              pergunta:(()=>{\n                const context=[];\n                if(Array.isArray(App.userPos) && App.userPos.length>=2)\n                  context.push('GPS atual: latitude '+Number(App.userPos[1]).toFixed(5)+', longitude '+Number(App.userPos[0]).toFixed(5)+(this.lastKnownAddress?' — '+this.lastKnownAddress:''));\n                const route=this.routeContext();\n                if(route) context.push('Rota ativa: '+JSON.stringify(route));\n                if(this.conversationHistory.length) context.push('Conversa recente: '+this.conversationHistory.slice(-6).join(' | '));\n                return text+(context.length?'\\n\\nContexto confiável fornecido pelo Radar:\\n'+context.join('\\n'):'');\n              })()\n            }),"""
if old in s: s=s.replace(old,new,1)

# Guarda pergunta/resposta recentes para referencias como 'essa segunda noticia'.
s=s.replace("      this.reply(answer);\n\n      return true;","      this.conversationHistory.push('Motorista: '+text,'Radar: '+answer);\n      this.conversationHistory=this.conversationHistory.slice(-8);\n      this.reply(answer);\n\n      return true;",1)

# Troca bloco de localizacao por helper robusto.
start=s.find("    if(asksCurrentPlace){")
end=s.find("\n\n    const nearbyMatch",start)
if start<0 or end<0: raise SystemExit('location block missing')
loc=r'''    if(asksCurrentPlace){
      if(!Array.isArray(App.userPos) || App.userPos.length<2){
        App.startGPS?.();
        this.reply('O GPS ainda está adquirindo sua posição. Aguarde alguns segundos e tente novamente.');
        return;
      }
      const pos=await this.getCurrentAddress(true);
      if(pos?.label) this.reply('Você está em '+pos.label+'.');
      else this.reply('Estou com sua posição no GPS: latitude '+pos.lat.toFixed(5)+' e longitude '+pos.lon.toFixed(5)+'. Ainda não consegui converter essas coordenadas para o nome da rua.');
      return;
    }'''
s=s[:start]+loc+s[end:]

# Antes de clima local, atualiza nome do local para respostas mais naturais.
needle="    }else if(\n      Array.isArray(\n        App.userPos"
pos=s.find(needle)
if pos>=0:
    # apenas mantém comportamento; reportWeather usa GPS real. Nome será resolvido quando possível.
    pass

# Relatorio do dia: ocorrencias + contexto de rota/local, sem inventar noticias externas.
flex=s.find("  async handleFlexibleIntent(command,normalized){")
insert=s.find("    const stopAssistantIntent",flex)
if insert<0: raise SystemExit('flex insertion missing')
daily=r'''    const dailyBriefIntent=this.containsAny(normalized,[
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

'''
s=s[:insert]+daily+s[insert:]

# Remove texto antigo que prometia maos livres persistente no tutorial/ajuda.
s=s.replace(" Durante a navegação, toque uma vez no botão Radar para ligar o modo mãos livres e comece cada pedido dizendo Radar."," Toque no microfone quando quiser conversar comigo; durante a navegação eu também posso usar o contexto da rota.",1)

s=re.sub(r'<meta name="radar-build" content="[^"]+">','<meta name="radar-build" content="38-context-location">',s,count=1)
p.write_text(s,encoding='utf-8')
print('patch v38 aplicado')