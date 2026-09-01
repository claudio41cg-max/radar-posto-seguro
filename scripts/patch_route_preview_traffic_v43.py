from pathlib import Path
import re
p=Path('index.html')
s=p.read_text(encoding='utf-8')
s=re.sub(r'<meta name="radar-build" content="[^"]+">','<meta name="radar-build" content="43-route-preview-traffic">',s,count=1)

# v42 usava parâmetros extras na consulta de trânsito que podem ser rejeitados pelo endpoint.
# Mantém uma consulta TomTom conservadora e pede alternativas no cálculo inicial.
s=s.replace('&maxAlternatives=1&sectionType=traffic&routeRepresentation=polyline','&maxAlternatives=2')
s=s.replace('&maxAlternatives=1','&maxAlternatives=2')

# Não iniciar navegação automaticamente após calcular uma rota: abrir prévia/confirmar primeiro.
# Substituições defensivas para padrões comuns do app.
patterns=[
 (r'(await\s+this\.calculateRoute\([^;]*\);\s*)this\.startNavigation\(\);',r'\1this.showRoutePreviewV43?.();'),
 (r'(await\s+App\.calculateRoute\([^;]*\);\s*)App\.startNavigation\(\);',r'\1App.showRoutePreviewV43?.();'),
]
for pat,repl in patterns:
    s=re.sub(pat,repl,s)

# Acrescenta uma confirmação simples e segura se a UI de prévia ainda não existir.
anchor='window.RadarApp={'
if anchor in s and 'RoutePreviewV43' not in s:
    code=r'''const RoutePreviewV43={
  pending:false,
  alternatives:[],
  routeSummary(route){
    const sum=route?.summary||{};
    const sec=Number(sum.travelTimeInSeconds??route?.duration??0);
    const m=Number(sum.lengthInMeters??route?.distance??0);
    return {minutes:sec?Math.max(1,Math.round(sec/60)):null,km:m?(m/1000).toFixed(1):null};
  },
  present(routes){
    this.alternatives=Array.isArray(routes)?routes.filter(Boolean).slice(0,3):[];
    if(!this.alternatives.length) return false;
    this.pending=true;
    const labels=this.alternatives.map((r,i)=>{const x=this.routeSummary(r);return 'Opção '+(i+1)+(x.minutes?' — '+x.minutes+' min':'')+(x.km?' — '+x.km+' km':'');});
    const msg='Rota calculada. '+labels.join('. ')+'. Confira o destino e escolha a opção antes de iniciar.';
    try{ VoiceAssistant?.reply?.(msg); }catch(e){ try{ App.toast?.(msg); }catch(_){} }
    return true;
  },
  confirm(index=0){
    const r=this.alternatives[index];
    if(!r) return false;
    try{ App.route=r; }catch(e){}
    this.pending=false;
    try{ App.startNavigation?.(); return true; }catch(e){ return false; }
  },
  cancel(){this.pending=false;this.alternatives=[];}
};

'''
    s=s.replace(anchor,code+anchor,1)

# Exponha helper no App sem interferir no núcleo da navegação.
appinit='    App.init();'
if appinit in s and 'showRoutePreviewV43' not in s:
    s=s.replace(appinit,"""    App.showRoutePreviewV43=()=>{
      const routes=Array.isArray(App.routeAlternatives)&&App.routeAlternatives.length?App.routeAlternatives:[App.route];
      return RoutePreviewV43.present(routes);
    };
    App.init();""",1)

# Se o resultado TomTom já guardar routes, preserve alternativas para a tela de prévia.
# Faz apenas em atribuições inequívocas do primeiro route.
s=s.replace("const route=data?.routes?.[0];\n      if(!route)","const route=data?.routes?.[0];\n      if(Array.isArray(data?.routes)) App.routeAlternatives=data.routes.slice(0,3);\n      if(!route)")
s=s.replace("const route=data?.routes?.[0];\n      if(route)","const route=data?.routes?.[0];\n      if(Array.isArray(data?.routes)) App.routeAlternatives=data.routes.slice(0,3);\n      if(route)")

required=['43-route-preview-traffic','const RoutePreviewV43','maxAlternatives=2']
missing=[x for x in required if x not in s]
if missing: raise SystemExit('v43 markers missing: '+', '.join(missing))
p.write_text(s,encoding='utf-8')
print('patch v43 aplicado')
