from pathlib import Path
import re
p=Path('index.html')
s=p.read_text(encoding='utf-8')
s=re.sub(r'<meta name="radar-build" content="[^"]+">','<meta name="radar-build" content="44-route-choice-guard">',s,count=1)

anchor='window.RadarApp={'
if anchor in s and 'const RouteChoiceGuardV44' not in s:
    code=r'''const RouteChoiceGuardV44={
  allowStartUntil:0,
  allowExternalUntil:0,
  originalStart:null,
  originalOpen:null,
  isExternalUrl(url){
    const x=String(url||'').toLowerCase();
    return x.includes('waze.com') || x.includes('google.com/maps') || x.includes('maps.google') || x.startsWith('geo:') || x.startsWith('google.navigation:') || x.startsWith('waze:');
  },
  userIntentFromTarget(target){
    const el=target?.closest?.('button,a,[role="button"]');
    if(!el) return;
    const txt=String(el.innerText||el.textContent||el.getAttribute?.('aria-label')||'').toLowerCase();
    if(/\b(waze|maps|google maps)\b/.test(txt)) this.allowExternalUntil=Date.now()+2500;
    if(/iniciar|navegar|começar|comecar|ir com radar|iniciar no radar/.test(txt)) this.allowStartUntil=Date.now()+2500;
  },
  routeSummary(route){
    const sum=route?.summary||{};
    const sec=Number(sum.travelTimeInSeconds??route?.duration??route?.totalDuration??0);
    const m=Number(sum.lengthInMeters??route?.distance??route?.totalDistance??0);
    return {min:sec?Math.max(1,Math.round(sec/60)):null,km:m?(m/1000).toFixed(1):null};
  },
  ensureModal(){
    let el=document.getElementById('routeChoiceV44');
    if(el) return el;
    el=document.createElement('div');
    el.id='routeChoiceV44';
    el.style.cssText='display:none;position:fixed;inset:0;z-index:999999;background:rgba(0,0,0,.55);align-items:flex-end;justify-content:center;padding:14px;box-sizing:border-box';
    el.innerHTML='<div style="width:min(620px,100%);max-height:76vh;overflow:auto;background:#07131f;color:white;border-radius:24px;padding:18px;box-shadow:0 14px 50px #000"><div style="font-size:22px;font-weight:800;margin-bottom:6px">Escolha a rota</div><div style="font-size:14px;opacity:.82;margin-bottom:14px">Confira o destino antes de iniciar. O Radar não abrirá Waze ou Maps sozinho.</div><div id="routeChoiceV44List"></div><div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:14px"><button id="routeChoiceV44Close" style="flex:1;min-width:100px;padding:13px;border-radius:16px;border:0;font-weight:800">Cancelar</button></div></div>';
    document.body.appendChild(el);
    el.querySelector('#routeChoiceV44Close').onclick=()=>this.hide();
    return el;
  },
  show(){
    const routes=(Array.isArray(App.routeAlternatives)&&App.routeAlternatives.length?App.routeAlternatives:[App.route]).filter(Boolean).slice(0,3);
    if(!routes.length) return false;
    const el=this.ensureModal(), list=el.querySelector('#routeChoiceV44List');
    list.innerHTML='';
    routes.forEach((r,i)=>{
      const x=this.routeSummary(r);
      const b=document.createElement('button');
      b.style.cssText='width:100%;text-align:left;margin:7px 0;padding:15px;border-radius:18px;border:1px solid #2b85a7;background:#0d2333;color:white;font-size:17px;font-weight:750';
      b.textContent='Opção '+(i+1)+(x.min?' • '+x.min+' min':'')+(x.km?' • '+x.km+' km':'')+(i===0?' • recomendada':'');
      b.onclick=()=>{
        App.route=r;
        this.allowStartUntil=Date.now()+3000;
        this.hide();
        if(this.originalStart) this.originalStart();
      };
      list.appendChild(b);
    });
    el.style.display='flex';
    return true;
  },
  hide(){const el=document.getElementById('routeChoiceV44');if(el) el.style.display='none';},
  init(){
    document.addEventListener('click',e=>this.userIntentFromTarget(e.target),true);
    if(!this.originalOpen){
      this.originalOpen=window.open.bind(window);
      window.open=(url,...args)=>{
        if(this.isExternalUrl(url) && Date.now()>this.allowExternalUntil){
          try{App.toast?.('Escolha Waze ou Maps somente se quiser sair do Radar.');}catch(e){}
          return null;
        }
        return this.originalOpen(url,...args);
      };
    }
    if(App?.startNavigation && !App.startNavigation.__routeChoiceV44){
      const original=App.startNavigation.bind(App);
      this.originalStart=original;
      const guard=this;
      const wrapped=function(...args){
        if(Date.now()<=guard.allowStartUntil) return original(...args);
        guard.show();
        return false;
      };
      wrapped.__routeChoiceV44=true;
      App.startNavigation=wrapped;
    }
    if(App?.calculateRoute && !App.calculateRoute.__routeChoiceV44){
      const originalCalc=App.calculateRoute.bind(App), guard=this;
      const wrappedCalc=async function(...args){
        const result=await originalCalc(...args);
        setTimeout(()=>{ if(!App.navActive) guard.show(); },120);
        return result;
      };
      wrappedCalc.__routeChoiceV44=true;
      App.calculateRoute=wrappedCalc;
    }
  }
};

'''
    s=s.replace(anchor,code+anchor,1)

init='    App.init();'
if init in s and 'RouteChoiceGuardV44.init()' not in s:
    s=s.replace(init,"""    App.init();
    setTimeout(()=>RouteChoiceGuardV44.init(),700);""",1)

required=['44-route-choice-guard','const RouteChoiceGuardV44','RouteChoiceGuardV44.init()']
missing=[x for x in required if x not in s]
if missing: raise SystemExit('v44 markers missing: '+', '.join(missing))
p.write_text(s,encoding='utf-8')
print('patch v44 aplicado')
