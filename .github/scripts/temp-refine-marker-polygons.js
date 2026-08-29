const fs = require('fs');

const path = 'index.html';
let html = fs.readFileSync(path, 'utf8');
const original = html;

function replaceOne(source, needle, replacement, label) {
  const at = source.indexOf(needle);
  if (at < 0) throw new Error('Trecho não encontrado: ' + label);
  if (source.indexOf(needle, at + needle.length) >= 0)
    throw new Error('Trecho duplicado: ' + label);
  return source.slice(0, at) + replacement + source.slice(at + needle.length);
}

const cssStart = html.indexOf('.fogo-live-marker{');
const cssEnd = html.indexOf(
  '/* =========================================================\n   RECENTRALIZAR',
  cssStart
);
if (cssStart < 0 || cssEnd < 0)
  throw new Error('CSS dos alvos não localizado.');

const refinedMarkerCss = `.fogo-live-marker{
  --fogo-color:#ef2929;
  --fogo-size:22px;
  width:var(--fogo-size);
  height:var(--fogo-size);
  box-sizing:border-box;
  border-radius:50%;
  border:1.5px solid rgba(255,255,255,.96);
  background:radial-gradient(circle,
    var(--fogo-color) 0 13%,
    #fff 14% 27%,
    var(--fogo-color) 28% 42%,
    #fff 43% 56%,
    var(--fogo-color) 57% 72%,
    #fff 73% 85%,
    var(--fogo-color) 86% 100%);
  box-shadow:
    0 0 0 1px rgba(255,255,255,.45),
    0 3px 9px rgba(0,0,0,.52);
  color:transparent;
  display:block;
  padding:0;
  margin:0;
  font-size:0;
  cursor:pointer;
  appearance:none;
  -webkit-appearance:none;
  overflow:visible;
  transform-origin:center center;
  isolation:isolate
}

.fogo-live-marker::before,
.fogo-live-marker::after{
  content:'';
  position:absolute;
  left:50%;
  top:50%;
  width:42%;
  height:42%;
  box-sizing:border-box;
  border:1.5px solid var(--fogo-color);
  border-radius:50%;
  pointer-events:none;
  opacity:0;
  transform:translate(-50%,-50%) scale(.15);
  animation:fogoRadarPulse 1.65s infinite cubic-bezier(.18,.62,.36,1)
}

.fogo-live-marker::after{
  animation-delay:-.825s
}

.fogo-live-marker.fogo-previous{
  --fogo-color:#f59e0b;
  box-shadow:
    0 0 0 1px rgba(255,255,255,.42),
    0 3px 8px rgba(0,0,0,.48)
}

.fogo-live-marker.fogo-previous::before,
.fogo-live-marker.fogo-previous::after{
  animation-duration:2s
}

.fogo-live-marker.fogo-previous::after{
  animation-delay:-1s
}

@keyframes fogoRadarPulse{
  0%{
    transform:translate(-50%,-50%) scale(.15);
    opacity:.9
  }
  72%{
    opacity:.28
  }
  100%{
    transform:translate(-50%,-50%) scale(3.25);
    opacity:0
  }
}

@media (prefers-reduced-motion:reduce){
  .fogo-live-marker::before,
  .fogo-live-marker::after{
    animation:none;
    display:none
  }
}

`;

html = html.slice(0, cssStart) + refinedMarkerCss + html.slice(cssEnd);

const oldOpacity = `          'fill-opacity':[
            'case',
            ['==',['get','occurrenceStatus'],'today'],
            ['interpolate',['linear'],['zoom'],8.8,.10,11.7,.26,14,.38,17,.46],
            ['==',['get','occurrenceStatus'],'recent'],
            ['interpolate',['linear'],['zoom'],8.8,.07,11.7,.20,14,.30,17,.38],
            ['interpolate',['linear'],['zoom'],
              8.8,.006,9.8,.018,10.5,.04,11.7,.08,14,.16,17,.22]
          ]`;

const restoredOpacity = `          'fill-opacity':[
            'case',
            ['==',['get','occurrenceStatus'],'today'],
            ['interpolate',['linear'],['zoom'],8.8,.13,11.7,.30,14,.42,17,.50],
            ['==',['get','occurrenceStatus'],'recent'],
            ['interpolate',['linear'],['zoom'],8.8,.10,11.7,.24,14,.34,17,.42],
            ['case',
              ['get','officialBoundary'],
              ['interpolate',['linear'],['zoom'],8.8,.035,9.8,.06,10.5,.09,11.7,.13,14,.20,17,.28],
              ['interpolate',['linear'],['zoom'],8.8,.025,9.8,.05,10.5,.08,11.7,.12,14,.19,17,.27]
            ]
          ]`;

html = replaceOne(
  html,
  oldOpacity,
  restoredOpacity,
  'preenchimento dos polígonos'
);

const outlineAnchor = `      this.map.addLayer({

        id:'community-outline',`;

const glowLayer = `      this.map.addLayer({

        id:'community-inner-glow',

        type:'line',

        source:'communities',

        minzoom:8.8,

        layout:{
          'line-cap':'round',
          'line-join':'round'
        },

        paint:{

          'line-color':[
            'match',
            ['get','occurrenceStatus'],
            'today','#ef4444',
            'recent','#fb923c',
            [
              'case',
              ['get','officialBoundary'],
              (
                this.appliedTheme==='dark' ||
                this.appliedTheme==='sat'
              )
              ? '#fbbf24'
              : '#334155',
              '#ef4444'
            ]
          ],

          'line-width':[
            'interpolate',
            ['linear'],
            ['zoom'],
            8.8,2,
            10.5,4,
            11.7,7,
            14,13,
            17,22
          ],

          'line-blur':[
            'interpolate',
            ['linear'],
            ['zoom'],
            8.8,1,
            11.7,2.8,
            14,5.5,
            17,9
          ],

          'line-opacity':[
            'match',
            ['get','occurrenceStatus'],
            'today',.48,
            'recent',.38,
            [
              'case',
              ['get','officialBoundary'],
              .24,
              .30
            ]
          ]

        }

      });


`;

html = replaceOne(
  html,
  outlineAnchor,
  glowLayer + outlineAnchor,
  'camada de degradê interno'
);

const markerReset = `        (App.fogoMarkers||[]).forEach(marker=>marker.remove());
        App.fogoMarkers=[];`;

const markerZoomSizing = `        (App.fogoMarkers||[]).forEach(marker=>marker.remove());
        App.fogoMarkers=[];

        if(!App.fogoMarkerZoomHandler){
          App.fogoMarkerZoomHandler=()=>{
            const zoom=App.map?.getZoom?.() ?? 12;
            const size=
              zoom<7 ? 12 :
              zoom<9 ? 15 :
              zoom<11 ? 18 :
              zoom<13 ? 21 :
              24;
            document.documentElement.style.setProperty(
              '--fogo-marker-size',
              size+'px'
            );
            document.querySelectorAll('.fogo-live-marker').forEach(element=>{
              element.style.setProperty('--fogo-size',size+'px');
            });
          };
          App.map.on('zoom',App.fogoMarkerZoomHandler);
        }
        App.fogoMarkerZoomHandler();`;

html = replaceOne(
  html,
  markerReset,
  markerZoomSizing,
  'tamanho adaptativo dos alvos'
);

const markerClassNeedle = `          marker.className=
            'fogo-live-marker'+
            (isToday?' fogo-today':' fogo-previous');`;

const markerClassWithSize = `          marker.className=
            'fogo-live-marker'+
            (isToday?' fogo-today':' fogo-previous');
          const markerZoom=App.map?.getZoom?.() ?? 12;
          const markerSize=
            markerZoom<7 ? 12 :
            markerZoom<9 ? 15 :
            markerZoom<11 ? 18 :
            markerZoom<13 ? 21 :
            24;
          marker.style.setProperty('--fogo-size',markerSize+'px');`;

html = replaceOne(
  html,
  markerClassNeedle,
  markerClassWithSize,
  'tamanho inicial do alvo'
);

const appStartBefore = original.indexOf('const App = {');
const appEndBefore = original.indexOf('\n};\n\n\nwindow.RadarApp={', appStartBefore);
const appStartAfter = html.indexOf('const App = {');
const appEndAfter = html.indexOf('\n};\n\n\nwindow.RadarApp={', appStartAfter);
if ([appStartBefore, appEndBefore, appStartAfter, appEndAfter].some(value => value < 0))
  throw new Error('Bloco protegido da navegação não localizado.');

const protectedBefore = original.slice(appStartBefore, appEndBefore + 4);
const protectedAfter = html.slice(appStartAfter, appEndAfter + 4);
const protectedAuthorized = replaceOne(
  replaceOne(
    protectedBefore,
    oldOpacity,
    restoredOpacity,
    'opacidade autorizada no bloco protegido'
  ),
  outlineAnchor,
  glowLayer + outlineAnchor,
  'degradê autorizado no bloco protegido'
);
if (protectedAuthorized !== protectedAfter)
  throw new Error('Proteção falhou: outra parte da navegação foi alterada.');

const rawStart = html.indexOf('const rawAreas = [');
const rawEnd = html.indexOf('];', rawStart);
const communityCount = (html.slice(rawStart, rawEnd).match(/\{name:'/g) || []).length;
if (communityCount !== 55)
  throw new Error('Quantidade de comunidades alterada: ' + communityCount);
if (html.includes('.fogo-live-marker{\n  position:relative'))
  throw new Error('Posicionamento relativo antigo ainda presente.');
if (!html.includes("anchor:'center'"))
  throw new Error('Âncora central do alvo foi removida.');
if (!html.includes('@keyframes fogoRadarPulse'))
  throw new Error('Pulso central não foi criado.');
if (!html.includes("id:'community-inner-glow'"))
  throw new Error('Camada de degradê não foi criada.');
if (!html.includes('new Set([todayKey,yesterdayKey])'))
  throw new Error('Regra de dois dias foi alterada.');

const scripts = [...html.matchAll(
  /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi
)].map(match => match[1]);
const mainScript = scripts.find(code =>
  code.includes('const rawAreas = [') && code.includes('const App = {'));
if (!mainScript) throw new Error('Script principal não localizado.');
new Function(mainScript);

fs.writeFileSync(path, html);
console.log(JSON.stringify({
  markerPositionFixed:true,
  markerZoomSizes:[12,15,18,21,24],
  pulseFromCenter:true,
  polygonFillRestored:true,
  polygonGlow:true,
  communityCount,
  navigationProtected:true,
  bytesBefore:Buffer.byteLength(original),
  bytesAfter:Buffer.byteLength(html)
}, null, 2));
