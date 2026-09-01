from pathlib import Path
import re
p=Path('index.html')
s=p.read_text(encoding='utf-8')
s=re.sub(r'<meta name="radar-build" content="[^"]+">','<meta name="radar-build" content="49-icon-swap">',s,count=1)
# Remove desenho CSS experimental v48; o botão real receberá o mesmo pin vermelho do painel.
s=re.sub(r'\n?<style id="v48-recenter-pin">.*?</style>\s*','\n',s,flags=re.S)
# Botão lateral real de localização/recentralização: usa o pin vermelho já conhecido no painel.
s=s.replace('<button class="locate" id="locateBtn" title="Onde estou">◎</button>', '<button class="locate" id="locateBtn" title="Onde estou" aria-label="Recentralizar">📍</button>',1)
# Painel de tempo/distância: troca o pin por corredor, sem alterar IDs, tempo, distância ou comportamento do painel.
s=s.replace('<div class="recenter-icon">\n        📍\n      </div>', '<div class="recenter-icon runner-icon" aria-hidden="true">🏃</div>',1)
# Ajuste visual restrito aos dois ícones.
if 'id="v49-icon-swap"' not in s:
    s += r'''
<style id="v49-icon-swap">
#locateBtn{
  border:2px solid #38bdf8!important;
  background:rgba(0,0,0,.84)!important;
  box-shadow:0 7px 18px rgba(0,0,0,.62),inset 0 0 0 1px rgba(255,255,255,.08)!important;
  font-size:25px!important;
  line-height:1!important;
}
#locateBtn:active{transform:scale(.94)}
.recenter-icon.runner-icon{
  font-size:25px!important;
  line-height:1!important;
  color:#fff!important;
}
</style>
'''
required=['49-icon-swap','v49-icon-swap','aria-label="Recentralizar">📍','runner-icon']
missing=[x for x in required if x not in s]
if missing: raise SystemExit('v49 markers missing: '+', '.join(missing))
p.write_text(s,encoding='utf-8')
print('patch v49 aplicado')
