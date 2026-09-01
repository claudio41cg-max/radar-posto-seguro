from pathlib import Path

p=Path('index.html')
s=p.read_text(encoding='utf-8')

# ---------- VISUAL DO BOTAO PRINCIPAL ----------
# Mantem um unico botao e troca o emoji por um icone vetorial com orb animado.
old="""    if(main)\n      main.textContent='🎙️';"""
new="""    if(main){\n      main.classList.toggle('radar-handsfree',this.handsFree);\n      main.innerHTML='<span class="radar-voice-orb" aria-hidden="true"></span><svg class="radar-voice-svg" viewBox="0 0 48 48" aria-hidden="true"><rect x="18" y="8" width="12" height="22" rx="6" fill="none" stroke="currentColor" stroke-width="3"/><path d="M13 24c0 6.1 4.9 11 11 11s11-4.9 11-11M24 35v7M18 42h12" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>';\n    }"""
if old in s:
    s=s.replace(old,new,1)

# Remove tutorial/aviso comprido ao ligar.
s=s.replace("App.toast('Mãos livres ativo. Diga Radar antes do pedido.',4200);","App.toast('Radar pronto.',1800);",1)

# ---------- MICROFONE CONTINUO ENQUANTO MAOS LIVRES ----------
# Mantem uma captura de audio aberta para evitar o abre/fecha do microfone do Android.
marker="""  conversationUntil:0,\n\n  conversationOpen(){"""
if marker in s and 'micKeepAliveStream:null' not in s:
    repl="""  conversationUntil:0,\n  micKeepAliveStream:null,\n\n  async holdMicrophone(){\n    if(this.micKeepAliveStream || !navigator.mediaDevices?.getUserMedia) return;\n    try{\n      this.micKeepAliveStream=await navigator.mediaDevices.getUserMedia({audio:true});\n    }catch(e){}\n  },\n\n  releaseMicrophone(){\n    try{\n      this.micKeepAliveStream?.getTracks()?.forEach(t=>t.stop());\n    }catch(e){}\n    this.micKeepAliveStream=null;\n  },\n\n  conversationOpen(){"""
    s=s.replace(marker,repl,1)

# Ao ligar maos livres, segura o microfone aberto antes de iniciar reconhecimento.
old="""    this.handsFree=true;\n\n    this.updateButtons(false);"""
new="""    this.handsFree=true;\n    this.holdMicrophone();\n\n    this.updateButtons(false);"""
if old in s:
    s=s.replace(old,new,1)

# Ao desligar maos livres, solta captura persistente.
old="""    this.handsFree=false;\n    this.conversationUntil=0;"""
new="""    this.handsFree=false;\n    this.conversationUntil=0;\n    this.releaseMicrophone();"""
if old in s:
    s=s.replace(old,new,1)

# Reduz tentativas agressivas de reinicio quando o navegador encerra o reconhecimento.
s=s.replace('  scheduleHandsFree(delay=700){','  scheduleHandsFree(delay=1800){',1)
s=s.replace('              1200\n            );','              4000\n            );',1)

# ---------- LOCALIZACAO / ENDERECO ----------
# Amplia frases que devem usar o GPS atual e nunca cair na IA sem contexto.
needle="""      normalized.includes('nessa longitude');"""
replacement="""      normalized.includes('nessa longitude') ||\n      normalized.includes('qual e a minha rua') ||\n      normalized.includes('qual minha rua') ||\n      normalized.includes('qual bairro eu estou') ||\n      normalized.includes('em que bairro estou') ||\n      normalized.includes('onde eu me encontro');"""
if needle in s:
    s=s.replace(needle,replacement,1)

# ---------- LUGARES PROXIMOS ----------
# Insere metodo local que pesquisa em torno do GPS (ou da casa salva) usando TomTom.
insert_point="""  async routeTo(query){"""
if insert_point in s and 'async findNearbyPlace(' not in s:
    method=r'''  async findNearbyPlace(query,useHome=false){

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


'''
    s=s.replace(insert_point,method+insert_point,1)

# Detecta perguntas de lugar proximo antes do fluxo generico/IA.
handle_marker="""    const asksRouteTime = normalized.includes('quanto tempo falta')"""
if handle_marker in s and 'nearbyMatch' not in s:
    nearby=r'''    const nearbyMatch = command.match(/(?:qual(?: e)?|onde(?: fica| tem)?|ache|encontre|procure)?\s*(?:o|a|um|uma)?\s*(.+?)\s+(?:mais\s+)?(?:perto|proximo|proxima)(?:\s+(?:de|da|do))?\s*(mim|minha localizacao|onde estou|minha casa|aqui)?$/i);
    if(nearbyMatch && nearbyMatch[1]){
      let q=this.trimPoliteWords(nearbyMatch[1]).replace(/^(?:qual(?: e)?|onde(?: fica| tem)?|ache|encontre|procure)\s+/i,'').trim();
      if(q && !/^(?:tempo|distancia|rota)$/i.test(q)){
        await this.findNearbyPlace(q, /minha casa/i.test(command));
        return;
      }
    }

'''
    s=s.replace(handle_marker,nearby+handle_marker,1)

# ---------- CONTEXTO DE GPS PARA IA QUANDO NECESSARIO ----------
# So acrescenta coordenadas em perguntas claramente dependentes de local.
old="""            body:JSON.stringify({\n              pergunta:text\n            }),"""
new="""            body:JSON.stringify({\n              pergunta:(()=>{\n                const n=this.normalize(text);\n                const needsLocation=['perto','proximo','proxima','aqui','onde estou','minha localizacao','tempo','clima'].some(k=>n.includes(k));\n                if(needsLocation && Array.isArray(App.userPos) && App.userPos.length>=2){\n                  return text+'\\n\\nContexto do Radar: localização GPS atual latitude '+Number(App.userPos[1]).toFixed(5)+', longitude '+Number(App.userPos[0]).toFixed(5)+'. Use esse contexto apenas se for relevante.';\n                }\n                return text;\n              })()\n            }),"""
if old in s:
    s=s.replace(old,new,1)

# ---------- ESTILO MODERNO / ORB ----------
if 'radar-voice-v36-style' not in s:
    style=r'''
<style id="radar-voice-v36-style">
#assistantMicBtn{position:relative!important;overflow:hidden!important;border-radius:50%!important;width:46px!important;height:46px!important;min-width:46px!important;padding:0!important;display:inline-grid!important;place-items:center!important;color:#fff!important;background:radial-gradient(circle at 50% 38%,#7d86ff 0%,#6776ff 28%,#22273f 72%,#11131c 100%)!important;border:1px solid rgba(255,255,255,.22)!important;box-shadow:0 6px 18px rgba(0,0,0,.34),inset 0 1px 0 rgba(255,255,255,.22)!important;transition:transform .18s ease,box-shadow .25s ease!important}
#assistantMicBtn .radar-voice-svg{position:relative;z-index:2;width:25px;height:25px;filter:drop-shadow(0 1px 2px rgba(0,0,0,.35))}
#assistantMicBtn .radar-voice-orb{position:absolute;inset:-16%;border-radius:50%;background:radial-gradient(circle at 55% 35%,rgba(255,255,255,.72),rgba(164,178,255,.5) 22%,rgba(95,111,255,.55) 50%,rgba(18,22,42,.2) 73%,transparent 74%);opacity:.34;transform:scale(.8);transition:opacity .25s ease}
#assistantMicBtn.radar-handsfree .radar-voice-orb{opacity:.72;animation:radarVoiceBreath 3.6s ease-in-out infinite}
#assistantMicBtn.listening .radar-voice-orb{opacity:.95;animation:radarVoiceListen 1.15s ease-in-out infinite}
#assistantMicBtn.listening,#assistantMicBtn[aria-pressed="true"]{background:radial-gradient(circle at 50% 38%,#8b95ff 0%,#6776ff 34%,#22273f 76%,#11131c 100%)!important;box-shadow:0 6px 18px rgba(0,0,0,.34),0 0 0 3px rgba(106,125,255,.18)!important}
#assistantMicBtn:active{transform:scale(.94)}
#navAssistantMicBtn.listening{animation:none!important}
@keyframes radarVoiceBreath{0%,100%{transform:scale(.78) rotate(0deg)}50%{transform:scale(1.04) rotate(4deg)}}
@keyframes radarVoiceListen{0%,100%{transform:scale(.82)}50%{transform:scale(1.16)}}
@media (prefers-reduced-motion:reduce){#assistantMicBtn .radar-voice-orb{animation:none!important}}
</style>
'''
    s=s.replace('</head>',style+'</head>',1)

# Build marker.
s=s.replace('<meta name="radar-build" content="35-voice-session">','<meta name="radar-build" content="36-voice-ui-location">',1)

p.write_text(s,encoding='utf-8')
print('patch v36 aplicado')
