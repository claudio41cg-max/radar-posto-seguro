from pathlib import Path
import re

p = Path('index.html')
html = p.read_text(encoding='utf-8')

# Remove versões antigas dos módulos que vinham sendo injetadas apenas pelo service worker.
patterns = [
    r'\s*<script src="\./route-via-v115\.js\?v=\d+"></script>',
    r'\s*<script src="\./route-traffic-v74\.js(?:\?v=\d+)?"></script>',
    r'\s*<script src="\./route-alternatives-v116\.js(?:\?v=\d+)?"></script>',
    r'\s*<script src="\./hazard-declutter-v119\.js(?:\?v=\d+)?"></script>',
]
for pat in patterns:
    html = re.sub(pat, '', html)

block = '''\n<!-- Radar runtime v121: carregamento direto, independente do service worker -->\n<script>window.RADAR_RUNTIME_BUILD='121';</script>\n<script src="./route-via-v115.js?v=116"></script>\n<script src="./route-traffic-v74.js?v=120"></script>\n<script src="./route-alternatives-v116.js?v=118"></script>\n<script src="./hazard-declutter-v119.js?v=119"></script>\n'''

if '</body>' not in html:
    raise SystemExit('index.html sem </body>')
html = html.replace('</body>', block + '</body>', 1)

# Force a nova checagem do SW; o app não depende mais dele para carregar estes módulos.
html = re.sub(
    r"navigator\.serviceWorker\.register\((['\"])(?:\./)?service-worker\.js(?:\?v=\d+)?\1\)",
    "navigator.serviceWorker.register('./service-worker.js?v=121')",
    html,
)

p.write_text(html, encoding='utf-8')
print('index.html atualizado: runtime v121 carregado diretamente')
