from pathlib import Path

p=Path('index.html')
s=p.read_text(encoding='utf-8')

# 1) Reconhecimento por toque, sem sessão contínua/reabertura automática.
s=s.replace("this.recognition.continuous=true;", "this.recognition.continuous=false;", 1)
s=s.replace("if(!this.handsFree) this.recognition.stop();", "this.recognition.stop();", 1)

# 2) No fim do reconhecimento, processa uma única fala e não agenda reinício.
start=s.find("      if(this.handsFree){", s.find("this.recognition.onend=()=>"))
end=s.find("\n\n      if(text && !error)\n        this.handle(text);", start)
if start!=-1 and end!=-1:
    s=s[:start] + "      if(text && !error)\n        this.handle(text);" + s[end+len("\n\n      if(text && !error)\n        this.handle(text);"):]

# 3) Botão principal: toque inicia/para somente a captura atual. Sem tutorial e sem mãos-livres persistente.
toggle_start=s.find("  toggle(){")
toggle_end=s.find("\n\n\n  hasWakeWord(text){", toggle_start)
if toggle_start==-1 or toggle_end==-1:
    raise SystemExit('toggle marker not found')
new_toggle="""  toggle(){

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

  },"""
s=s[:toggle_start]+new_toggle+s[toggle_end:]

# 4) Desativa de verdade o antigo modo persistente. Botão de navegação usa o mesmo toque simples.
thf_start=s.find("  toggleHandsFree(){")
thf_end=s.find("\n\n\n  stopHandsFree(announce=true){", thf_start)
if thf_start==-1 or thf_end==-1:
    raise SystemExit('toggleHandsFree marker not found')
new_thf="""  toggleHandsFree(){
    this.toggle();
  },"""
s=s[:thf_start]+new_thf+s[thf_end:]

# 5) stopHandsFree sempre libera microfone/audio e nunca fala tutorial/aviso comprido.
stop_start=s.find("  stopHandsFree(announce=true){")
stop_end=s.find("\n\n\n  suspendHandsFree(){", stop_start)
if stop_start==-1 or stop_end==-1:
    raise SystemExit('stop marker not found')
new_stop="""  stopHandsFree(announce=true){
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
  },"""
s=s[:stop_start]+new_stop+s[stop_end:]

# 6) Frases naturais de encerramento, independentes do antigo handsFree.
flex=s.find("  async handleFlexibleIntent(command,normalized){")
first_intent=s.find("    const weatherIntent=", flex)
if flex==-1 or first_intent==-1:
    raise SystemExit('flex marker not found')
# remove bloco antigo de encerramento antes do weather, se houver
old_start=s.find("    if(\n      this.handsFree &&", flex, first_intent)
if old_start!=-1:
    old_end=s.find("\n\n\n    const weatherIntent=", old_start)
    if old_end!=-1:
        s=s[:old_start]+s[old_end+2:]
        flex=s.find("  async handleFlexibleIntent(command,normalized){")
        first_intent=s.find("    const weatherIntent=", flex)

stop_block="""    const stopAssistantIntent =
      /^(?:radar\\s+)?(?:pode\\s+)?(?:encerrar|encerra|encerre|parar|para|pare|sair|saia|fechar|fecha|feche|desligar|desliga|desligue)(?:\\s+(?:de\\s+ouvir|o\\s+microfone|a\\s+voz|a\\s+assistente|agora))?$/.test(normalized) ||
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

"""
s=s[:first_intent]+stop_block+s[first_intent:]

# 7) Visual: um único microfone vetorial. Remove pseudo-ícone antigo que estava sobreposto.
style="""
<style id="radar-voice-v37-style">
#assistantMicBtn::before{content:none!important;display:none!important}
#assistantMicBtn{position:relative!important;overflow:hidden!important;border-radius:50%!important;width:54px!important;height:54px!important;min-width:54px!important;padding:0!important;display:inline-grid!important;place-items:center!important;background:radial-gradient(circle at 35% 30%,#8b9bff 0%,#6269e8 34%,#313659 72%,#1d2238 100%)!important;border:1px solid rgba(255,255,255,.32)!important;box-shadow:0 5px 16px rgba(0,0,0,.38),inset 0 1px 0 rgba(255,255,255,.25)!important;color:#fff!important}
#assistantMicBtn .radar-voice-orb{position:absolute!important;inset:5px!important;border-radius:50%!important;background:radial-gradient(circle at 48% 34%,rgba(255,255,255,.26),rgba(119,126,255,.10) 42%,rgba(0,0,0,.08) 75%)!important;opacity:.9!important;transform:scale(.92)!important}
#assistantMicBtn .radar-voice-svg{position:relative!important;z-index:2!important;width:29px!important;height:29px!important;color:#fff!important;filter:drop-shadow(0 2px 3px rgba(0,0,0,.28))!important}
#assistantMicBtn.listening .radar-voice-orb{animation:radarVoicePulse 1.25s ease-in-out infinite!important;background:radial-gradient(circle at 48% 34%,rgba(255,255,255,.42),rgba(99,102,241,.34) 46%,rgba(14,165,233,.22) 72%,rgba(0,0,0,.06) 100%)!important}
#assistantMicBtn.listening{box-shadow:0 5px 16px rgba(0,0,0,.38),0 0 0 3px rgba(96,165,250,.24),0 0 20px rgba(99,102,241,.28)!important}
@keyframes radarVoicePulse{0%,100%{transform:scale(.90);opacity:.72}50%{transform:scale(1.08);opacity:1}}
</style>
"""
if 'radar-voice-v37-style' not in s:
    s=s.replace('</head>',style+'</head>',1)

# Estado visual não usa mais handsFree para o botão principal.
s=s.replace("main.classList.toggle('radar-handsfree',this.handsFree);", "main.classList.remove('radar-handsfree');", 1)

# Marca build.
import re
s=re.sub(r'<meta name="radar-build" content="[^"]+">','<meta name="radar-build" content="37-touch-audio-release">',s,count=1)

p.write_text(s,encoding='utf-8')
print('patch v37 aplicado')
