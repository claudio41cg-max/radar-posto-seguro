from pathlib import Path
import re
p=Path('index.html')
s=p.read_text(encoding='utf-8')
s=re.sub(r'<meta name="radar-build" content="[^"]+">','<meta name="radar-build" content="45-route-ui-tomtom">',s,count=1)

# Esconde somente o cartão superior esquerdo de análise do semáforo.
# Mantém os ícones de semáforos desenhados no mapa.
s += r'''
<style id="v45-ui-tweaks">
/* Apenas o painel/cartão flutuante de semáforo; marcadores do mapa permanecem. */
#trafficLightPanel,#traffic-light-panel,#semaforoPanel,#semaforo-panel,.traffic-light-panel,.semaforo-panel,.traffic-light-card,.semaforo-card{display:none!important}
/* Prévia não bloqueia o mapa inteiro. */
#routeChoiceV44{pointer-events:none!important;background:transparent!important;align-items:flex-end!important;padding:0 10px 12px!important}
#routeChoiceV44>div{pointer-events:auto!important;max-height:42vh!important;border-radius:22px!important;padding:14px!important;background:rgba(7,19,31,.96)!important}
/* Recentrar: borda mais limpa e pin vermelho pequeno. */
#recenterBtn,#recenter,#btnRecenter,.recenter-btn,.recenterButton,[aria-label*="ecentralizar"]{border:2px solid rgba(25,185,255,.92)!important;box-shadow:0 5px 18px rgba(0,0,0,.42),inset 0 0 0 2px rgba(255,255,255,.06)!important}
#recenterBtn::after,#recenter::after,#btnRecenter::after,.recenter-btn::after,.recenterButton::after,[aria-label*="ecentralizar"]::after{content:'📍';font-size:25px;line-height:1;position:absolute;inset:0;display:flex;align-items:center;justify-content:center;pointer-events:none}
#recenterBtn>*,#recenter>*,#btnRecenter>*,.recenter-btn>*,.recenterButton>*{opacity:0!important}
</style>
'''

# Evolui a modal v44: botão de rota seleciona/previsualiza; Iniciar fica separado.
old="""      b.onclick=()=>{
        App.route=r;
        this.allowStartUntil=Date.now()+3000;
        this.hide();
        if(this.originalStart) this.originalStart();
      };
      list.appendChild(b);"""
new="""      b.onclick=()=>{
        App.route=r;
        this.selectedIndex=i;
        list.querySelectorAll('button').forEach((x,j)=>{x.style.outline=j===i?'3px solid #22c7ff':'none';});
        try{ App.drawRoute?.(r); }catch(e){}
        try{ App.fitRoute?.(r); }catch(e){}
        try{ App.fitRouteBounds?.(r); }catch(e){}
        const start=el.querySelector('#routeChoiceV45Start'); if(start) start.disabled=false;
      };
      list.appendChild(b);"""
if old in s: s=s.replace(old,new,1)

old2="""<button id=\"routeChoiceV44Close\" style=\"flex:1;min-width:100px;padding:13px;border-radius:16px;border:0;font-weight:800\">Cancelar</button>"""
new2="""<button id=\"routeChoiceV45Start\" disabled style=\"flex:1;min-width:150px;padding:13px;border-radius:16px;border:0;background:#10a8df;color:white;font-weight:800\">Iniciar no Radar</button><button id=\"routeChoiceV44Close\" style=\"flex:1;min-width:100px;padding:13px;border-radius:16px;border:0;font-weight:800\">Cancelar</button>"""
if old2 in s: s=s.replace(old2,new2,1)

bind="""    el.querySelector('#routeChoiceV44Close').onclick=()=>this.hide();
    return el;"""
if bind in s:
    s=s.replace(bind,"""    el.querySelector('#routeChoiceV44Close').onclick=()=>this.hide();
    el.querySelector('#routeChoiceV45Start').onclick=()=>{
      const routes=(Array.isArray(App.routeAlternatives)&&App.routeAlternatives.length?App.routeAlternatives:[App.route]).filter(Boolean).slice(0,3);
      const r=routes[Number.isInteger(this.selectedIndex)?this.selectedIndex:0];
      if(!r) return;
      App.route=r; this.allowStartUntil=Date.now()+3000; this.hide();
      if(this.originalStart) this.originalStart();
    };
    return el;""",1)

# Na abertura, desenha todas as alternativas que o mapa suportar e enquadra a rota.
showmark="""    const el=this.ensureModal(), list=el.querySelector('#routeChoiceV44List');
    list.innerHTML='';"""
if showmark in s:
    s=s.replace(showmark,"""    const el=this.ensureModal(), list=el.querySelector('#routeChoiceV44List');
    list.innerHTML=''; this.selectedIndex=null;
    try{ App.drawRouteAlternatives?.(routes); }catch(e){}
    try{ App.showRouteAlternatives?.(routes); }catch(e){}
    try{ App.fitRoute?.(routes[0]); }catch(e){}
    try{ App.fitRouteBounds?.(routes[0]); }catch(e){}""",1)

# TomTom: tenta o proxy novo e o legado; sem inventar dados se ambos falharem.
# Substitui somente URLs exatas usadas pelas versões recentes.
s=s.replace("fetch(this.worker+'/v1/tomtom?path='+encodeURIComponent(path),{cache:'no-store',signal:controller.signal})", "fetch(this.worker+'/v1/tomtom?path='+encodeURIComponent(path),{cache:'no-store',signal:controller.signal}).then(async r=>{if(r.ok)return r;const r2=await fetch(this.worker+'/tomtom?path='+encodeURIComponent(path),{cache:'no-store',signal:controller.signal});return r2})")
s=s.replace("fetch(this.worker+'/v1/tomtom?path='+encodeURIComponent(path),{signal:controller.signal,cache:'no-store'})", "fetch(this.worker+'/v1/tomtom?path='+encodeURIComponent(path),{signal:controller.signal,cache:'no-store'}).then(async r=>{if(r.ok)return r;return fetch(this.worker+'/tomtom?path='+encodeURIComponent(path),{signal:controller.signal,cache:'no-store'})})")

required=['45-route-ui-tomtom','v45-ui-tweaks','routeChoiceV45Start']
missing=[x for x in required if x not in s]
if missing: raise SystemExit('v45 markers missing: '+', '.join(missing))
p.write_text(s,encoding='utf-8')
print('patch v45 aplicado')
