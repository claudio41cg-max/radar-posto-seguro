from pathlib import Path
import re
p=Path('index.html')
s=p.read_text(encoding='utf-8')
s=re.sub(r'<meta name="radar-build" content="[^"]+">','<meta name="radar-build" content="48-recenter-panel-fix">',s,count=1)

# Remove completamente o CSS v47, que usou seletores amplos e atingiu o painel inferior.
s=re.sub(r'\n?<style id="v47-recenter-pin">.*?</style>\s*','\n',s,flags=re.S)

# Aplica o novo desenho SOMENTE ao botão real de localização/recentralização da lateral direita.
if 'id="v48-recenter-pin"' not in s:
    s += r'''
<style id="v48-recenter-pin">
.side button.locate{
  position:relative!important;
  border:2px solid #38bdf8!important;
  background:rgba(0,0,0,.84)!important;
  box-shadow:0 7px 18px rgba(0,0,0,.62),inset 0 0 0 1px rgba(255,255,255,.08)!important;
  overflow:hidden!important;
}
.side button.locate>*{
  opacity:0!important;
}
.side button.locate::after{
  content:''!important;
  position:absolute!important;
  left:50%!important;
  top:50%!important;
  width:18px!important;
  height:22px!important;
  background:#111!important;
  border:2px solid #f8fafc!important;
  border-radius:50% 50% 50% 0!important;
  transform:translate(-50%,-56%) rotate(-45deg)!important;
  box-sizing:border-box!important;
  pointer-events:none!important;
  z-index:2!important;
}
.side button.locate::before{
  content:''!important;
  position:absolute!important;
  left:50%!important;
  top:46%!important;
  width:6px!important;
  height:6px!important;
  background:#111!important;
  border:2px solid #f8fafc!important;
  border-radius:50%!important;
  transform:translate(-50%,-50%)!important;
  box-sizing:border-box!important;
  pointer-events:none!important;
  z-index:3!important;
}
</style>
'''

required=['48-recenter-panel-fix','v48-recenter-pin','.side button.locate']
missing=[x for x in required if x not in s]
if missing: raise SystemExit('v48 markers missing: '+', '.join(missing))
p.write_text(s,encoding='utf-8')
print('patch v48 aplicado')
