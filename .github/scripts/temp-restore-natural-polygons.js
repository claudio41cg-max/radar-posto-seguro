const fs = require('fs');

const file = 'index.html';
let html = fs.readFileSync(file, 'utf8');
const before = html;

function requireOnce(text, label) {
  const first = html.indexOf(text);
  if (first < 0 || html.indexOf(text, first + text.length) >= 0) {
    throw new Error(`Trecho ausente ou duplicado: ${label}`);
  }
  return first;
}

function layerStart(id) {
  const idPos = requireOnce(`id:'${id}'`, `camada ${id}`);
  const start = html.lastIndexOf('      this.map.addLayer({', idPos);
  if (start < 0) throw new Error(`Início não encontrado: ${id}`);
  return start;
}

function replaceRange(start, end, replacement, label) {
  if (start < 0 || end <= start) throw new Error(`Intervalo inválido: ${label}`);
  html = html.slice(0, start) + replacement + '\n\n' + html.slice(end);
}

const bridgeStart = layerStart('community-bridge');
const communitiesSource = html.indexOf("      this.map.addSource(\n        'communities'", bridgeStart);
replaceRange(bridgeStart, communitiesSource, `      this.map.addLayer({
        id:'community-bridge',
        type:'line',
        source:'community-bridges',
        minzoom:8.8,
        layout:{'line-cap':'round','line-join':'round'},
        paint:{
          'line-color':
            (this.appliedTheme==='dark'||this.appliedTheme==='sat')
            ? '#fbbf24'
            : '#475569',
          'line-width':['interpolate',['linear'],['zoom'],11.7,1.5,16,5],
          'line-blur':['interpolate',['linear'],['zoom'],11.7,.2,16,.65],
          'line-opacity':.07
        }
      });

      this.map.addLayer({
        id:'community-bridge-outline',
        type:'line',
        source:'community-bridges',
        minzoom:8.8,
        layout:{'line-cap':'round','line-join':'round'},
        paint:{
          'line-color':
            (this.appliedTheme==='dark'||this.appliedTheme==='sat')
            ? '#fbbf24'
            : '#111827',
          'line-width':['interpolate',['linear'],['zoom'],11.7,.45,16,1.35],
          'line-opacity':.70
        }
      });`, 'ligações naturais entre áreas');

const fillStart = layerStart('community-fill');
const pointsSource = html.indexOf("      this.map.addSource(\n        'community-points'", fillStart);
replaceRange(fillStart, pointsSource, `      this.map.addLayer({

        id:'community-fill',

        type:'fill',

        source:'communities',

        minzoom:8.8,

        paint:{

          'fill-color':[
            'match',
            ['get','occurrenceStatus'],
            'today','#dc2626',
            'recent','#f97316',
            [
              'case',
              ['get','officialBoundary'],
              (
                this.appliedTheme==='dark' ||
                this.appliedTheme==='sat'
              )
              ? '#fbbf24'
              : '#475569',
              '#ef4444'
            ]
          ],

          'fill-opacity':[
            'case',
            ['==',['get','occurrenceStatus'],'today'],
            ['interpolate',['linear'],['zoom'],8.8,.10,11.7,.18,14,.24,17,.30],
            ['==',['get','occurrenceStatus'],'recent'],
            ['interpolate',['linear'],['zoom'],8.8,.08,11.7,.14,14,.20,17,.25],
            ['case',
              ['get','officialBoundary'],
              ['interpolate',['linear'],['zoom'],8.8,.035,9.8,.055,11.7,.09,14,.13,17,.17],
              ['interpolate',['linear'],['zoom'],8.8,.025,9.8,.045,11.7,.075,14,.115,17,.155]
            ]
          ]

        }

      });


      this.map.addLayer({

        id:'community-outline',

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
            'today','#dc2626',
            'recent','#f97316',
            [
              'case',
              ['get','officialBoundary'],
              (
                this.appliedTheme==='dark' ||
                this.appliedTheme==='sat'
              )
              ? '#fbbf24'
              : '#111827',
              '#b91c1c'
            ]
          ],

          'line-width':[
            'interpolate',
            ['linear'],
            ['zoom'],
            8.8,.25,
            9.8,.45,
            11.7,.75,
            14,1.15,
            17,1.65
          ],

          'line-opacity':[
            'match',
            ['get','occurrenceStatus'],
            'today',.92,
            'recent',.88,
            [
              'case',
              ['get','officialBoundary'],
              .82,
              .78
            ]
          ]

        }

      });`, 'preenchimento e contorno natural');

const labelStart = layerStart('community-label');
const clickHandler = html.indexOf('      if(this._communityClickHandler){', labelStart);
replaceRange(labelStart, clickHandler, `      this.map.addLayer({

        id:'community-label',

        type:'symbol',

        source:'community-points',

        minzoom:12.8,

        layout:{

          'text-field':
            ['get','displayName'],

          'text-size':[
            'interpolate',
            ['linear'],
            ['zoom'],
            12.8,8.5,
            14.2,10.5,
            17,12.5
          ],

          'text-anchor':'top',

          'text-offset':[0,.9],

          'text-max-width':12,

          'text-letter-spacing':.01,

          'text-allow-overlap':
            false

        },

        paint:{

          'text-color':[
            'case',
            ['get','officialBoundary'],
            '#ffffff',
            '#fee2e2'
          ],

          'text-halo-color':[
            'case',
            ['get','officialBoundary'],
            '#111827',
            '#7f1d1d'
          ],

          'text-halo-width':
            1.7,

          'text-opacity':.96

        }

      });`, 'nomes no nível de aproximação correto');

const preservedLines = (value, pattern) => value
  .split(/\r?\n/)
  .filter(line => pattern.test(line))
  .join('\n');

if (preservedLines(before, /fogo/i) !== preservedLines(html, /fogo/i)) {
  throw new Error('Proteção acionada: Fogo Cruzado seria alterado');
}

if (
  preservedLines(before, /suspendIdleGPS|runAdaptiveGPSTasks/) !==
  preservedLines(html, /suspendIdleGPS|runAdaptiveGPSTasks/)
) {
  throw new Error('Proteção acionada: economia de bateria seria alterada');
}

for (const required of [
  "id:'community-fill'",
  "id:'community-outline'",
  'minzoom:12.8',
  "['==',['get','occurrenceStatus'],'today']",
  "['==',['get','occurrenceStatus'],'recent']",
  'enableHighAccuracy:true'
]) {
  if (!html.includes(required)) throw new Error(`Validação ausente: ${required}`);
}

if (html.includes("id:'community-inner-shadow'")) {
  throw new Error('A sombra borrada antiga ainda está ativa');
}

if (html === before) throw new Error('Nenhuma alteração produzida');

fs.writeFileSync(file, html);
console.log('Visual natural dos polígonos restaurado com segurança.');
