from pathlib import Path
import re
p=Path('index.html')
s=p.read_text(encoding='utf-8')
s=re.sub(r'<meta name="radar-build" content="[^"]+">','<meta name="radar-build" content="50-icon-final">',s,count=1)
# Remove apenas o estilo adicionado pela v49.
s=re.sub(r'\n?<style id="v49-icon-swap">.*?</style>\s*','\n',s,flags=re.S)
# Restaura o botão superior direito ao símbolo original.
s=s.replace('<button class="locate" id="locateBtn" title="Onde estou" aria-label="Recentralizar">📍</button>', '<button class="locate" id="locateBtn" title="Onde estou">◎</button>',1)
# Coloca o pin vermelho no botão circular acima do velocímetro.
s=s.replace('<button class="nav-recenter-left" id="navRecenterLeft" title="Recentralizar">\n  <span class="recenter-crosshair" aria-hidden="true"></span>\n</button>', '<button class="nav-recenter-left" id="navRecenterLeft" title="Recentralizar" aria-label="Recentralizar">📍</button>',1)
# Mantém o corredor no painel, mas espelha para correr para a direita.
s=s.replace('<div class="recenter-icon runner-icon" aria-hidden="true">🏃</div>', '<div class="recenter-icon runner-icon runner-right" aria-hidden="true">🏃</div>',1)
if 'id="v50-icon-final"' not in s:
    s += r'''
<style id="v50-icon-final">
#navRecenterLeft{
  font-size:25px!important;
  line-height:1!important;
  color:#fff!important;
}
#navRecenterLeft .recenter-crosshair{display:none!important}
.recenter-icon.runner-right{
  font-size:25px!important;
  line-height:1!important;
  transform:scaleX(-1)!important;
}
</style>
'''
required=['50-icon-final','v50-icon-final','id="navRecenterLeft" title="Recentralizar" aria-label="Recentralizar">📍','runner-right','id="locateBtn" title="Onde estou">◎</button>']
missing=[x for x in required if x not in s]
if missing: raise SystemExit('v50 markers missing: '+', '.join(missing))
p.write_text(s,encoding='utf-8')
print('patch v50 aplicado')
