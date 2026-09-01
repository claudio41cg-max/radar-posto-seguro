from pathlib import Path
import re
p=Path('index.html')
s=p.read_text(encoding='utf-8')
s=re.sub(r'<meta name="radar-build" content="[^"]+">','<meta name="radar-build" content="47-recenter-tomtom-diagnostic">',s,count=1)
s += r'''
<style id="v47-recenter-pin">
/* Pin preto vetorial no botão de recentralizar; sem imagem externa. */
#recenterBtn,#recenter,#btnRecenter,.recenter-btn,.recenterButton,[aria-label*="ecentralizar"]{position:relative!important;border:2px solid #18bdf2!important;box-shadow:0 5px 18px rgba(0,0,0,.38),inset 0 0 0 2px rgba(255,255,255,.08)!important}
#recenterBtn::after,#recenter::after,#btnRecenter::after,.recenter-btn::after,.recenterButton::after,[aria-label*="ecentralizar"]::after{content:''!important;position:absolute!important;left:50%!important;top:50%!important;width:18px!important;height:23px!important;transform:translate(-50%,-55%)!important;background:#111!important;border-radius:50% 50% 50% 0!important;rotate:-45deg!important;box-shadow:0 1px 2px rgba(255,255,255,.25)!important;pointer-events:none!important;z-index:5!important}
#recenterBtn::before,#recenter::before,#btnRecenter::before,.recenter-btn::before,.recenterButton::before,[aria-label*="ecentralizar"]::before{content:''!important;position:absolute!important;left:50%!important;top:50%!important;width:7px!important;height:7px!important;transform:translate(-50%,-78%)!important;background:#fff!important;border-radius:50%!important;pointer-events:none!important;z-index:6!important}
#recenterBtn>*,#recenter>*,#btnRecenter>*,.recenter-btn>*,.recenterButton>*{opacity:0!important}
</style>
'''
if '47-recenter-tomtom-diagnostic' not in s or 'v47-recenter-pin' not in s: raise SystemExit('v47 markers missing')
p.write_text(s,encoding='utf-8')
print('patch v47 aplicado')
