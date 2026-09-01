from pathlib import Path
import re
p=Path('index.html')
s=p.read_text(encoding='utf-8')
s=re.sub(r'<meta name="radar-build" content="[^"]+">','<meta name="radar-build" content="46-bottom-panel-tomtom">',s,count=1)

s=re.sub(r'\n?<style id="v45-ui-tweaks">.*?</style>\s*','\n',s,flags=re.S)

if 'id="v46-ui-fix"' not in s:
    s += r'''
<style id="v46-ui-fix">
#trafficLightPanel,#traffic-light-panel,#semaforoPanel,#semaforo-panel,.traffic-light-panel,.semaforo-panel,.traffic-light-card,.semaforo-card{display:none!important}
#routeChoiceV44{display:none!important}
</style>
'''

start=s.find('const RouteChoiceGuardV44={')
if start!=-1:
    end=s.find('\n};',start)
    block=s[start:end+3] if end!=-1 else ''
    pat=r"  show\(\)\{.*?\n  \},\n  hide\(\)"
    repl=r'''  show(){
    const routes=(Array.isArray(App.routeAlternatives)&&App.routeAlternatives.length?App.routeAlternatives:[App.route]).filter(Boolean).slice(0,3);
    if(!routes.length) return false;
    App.route=routes[0];
    try{
      const all=[...document.querySelectorAll('button,a,[role="button"]')];
      const recolher=all.find(el=>/^\s*recolher\b/i.test(String(el.innerText||el.textContent||'')));
      if(!recolher){
        const opcoes=all.find(el=>/^\s*op[cç][oõ]es\b/i.test(String(el.innerText||el.textContent||'')));
        opcoes?.click?.();
      }
      App.toast?.('Rota pronta. Confira tempo e distância e escolha Radar, Waze ou Maps.');
    }catch(e){}
    return true;
  },
  hide()'''
    newblock,n=re.subn(pat,lambda m: repl,block,count=1,flags=re.S)
    if n:
        s=s[:start]+newblock+s[end+3:]

s=re.sub(r"\.then\(async r=>\{if\(r\.ok\)return r;const r2=await fetch\(this\.worker\+'/tomtom\?path='\+encodeURIComponent\(path\),\{cache:'no-store',signal:controller\.signal\}\);return r2\}\)","",s)
s=re.sub(r"\.then\(async r=>\{if\(r\.ok\)return r;return fetch\(this\.worker\+'/tomtom\?path='\+encodeURIComponent\(path\),\{signal:controller\.signal,cache:'no-store'\}\)\}\)","",s)

required=['46-bottom-panel-tomtom','v46-ui-fix','Rota pronta. Confira tempo e distância']
missing=[x for x in required if x not in s]
if missing: raise SystemExit('v46 markers missing: '+', '.join(missing))
p.write_text(s,encoding='utf-8')
print('patch v46 aplicado')
