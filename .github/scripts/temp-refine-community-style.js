const fs = require('fs');

const file = 'index.html';
let html = fs.readFileSync(file, 'utf8');
const before = html;

function requireOnce(text, label) {
  const first = html.indexOf(text);
  if (first < 0 || html.indexOf(text, first + text.length) >= 0) {
    throw new Error(`Trecho inesperado ou duplicado: ${label}`);
  }
  return first;
}

function layerStart(id) {
  const idPos = requireOnce(`id:'${id}'`, `camada ${id}`);
  const start = html.lastIndexOf('      this.map.addLayer({', idPos);
  if (start < 0) throw new Error(`Início da camada não encontrado: ${id}`);
  return start;
}

function replaceRange(start, end, replacement, label) {
  if (start < 0 || end <= start) throw new Error(`Intervalo inválido: ${label}`);
  html = html.slice(0, start) + replacement + '\n\n' + html.slice(end);
}

const removalOld = `        'community-dot',\n        'community-outline',`;
const removalNew = `        'community-dot',\n        'community-inner-shadow',\n        'community-inner-glow',\n        'community-outline',`;
if (!html.includes(removalOld)) throw new Error('Lista de remoção das camadas não encontrada');
html = html.replace(removalOld, removalNew);

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
            : '#94a3b8',
          'line-width':['interpolate',['linear'],['zoom'],11.7,1.5,16,5],
          'line-blur':['interpolate',['linear'],['zoom'],11.7,.4,16,1.2],
          'line-opacity':.08
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
            : '#64748b',
          'line-width':['interpolate',['linear'],['zoom'],11.7,.55,16,1.25],
          'line-dasharray':[1.1,.7],
          'line-opacity':.48
        }
      });`, 'pontes entre áreas da comunidade');

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
              : '#64748b',
              '#ef4444'
            ]
          ],

          'fill-opacity':[
            'case',
            ['==',['get','occurrenceStatus'],'today'],
            ['interpolate',['linear'],['zoom'],8.8,.07,11.7,.13,14,.19,17,.25],
            ['==',['get','occurrenceStatus'],'recent'],
            ['interpolate',['linear'],['zoom'],8.8,.05,11.7,.10,14,.15,17,.20],
            ['case',
              ['get','officialBoundary'],
              ['interpolate',['linear'],['zoom'],8.8,.018,9.8,.025,11.7,.045,14,.075,17,.11],
              ['interpolate',['linear'],['zoom'],8.8,.015,9.8,.022,11.7,.04,14,.07,17,.105]
            ]
          ]

        }

      });


      this.map.addLayer({

        id:'community-inner-shadow',

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
            'today','#f87171',
            'recent','#fdba74',
            [
              'case',
              ['get','officialBoundary'],
              (
                this.appliedTheme==='dark' ||
                this.appliedTheme==='sat'
              )
              ? '#fbbf24'
              : '#94a3b8',
              '#fca5a5'
            ]
          ],

          'line-width':[
            'interpolate',
            ['linear'],
            ['zoom'],
            8.8,1,
            11.7,2.4,
            14,4.5,
            17,7
          ],

          'line-blur':[
            'interpolate',
            ['linear'],
            ['zoom'],
            8.8,.3,
            11.7,.8,
            14,1.4,
            17,2.2
          ],

          'line-opacity':[
            'match',
            ['get','occurrenceStatus'],
            'today',.18,
            'recent',.15,
            [
              'case',
              ['get','officialBoundary'],
              .11,
              .13
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
              : '#64748b',
              '#dc2626'
            ]
          ],

          'line-width':[
            'interpolate',
            ['linear'],
            ['zoom'],
            8.8,.3,
            9.8,.5,
            11.7,.8,
            14,1.15,
            17,1.65
          ],

          'line-dasharray':[1.1,.7],

          'line-opacity':[
            'match',
            ['get','occurrenceStatus'],
            'today',.90,
            'recent',.84,
            [
              'case',
              ['get','officialBoundary'],
              .64,
              .72
            ]
          ]

        }

      });`, 'preenchimento, sombra e limite das comunidades');

const labelStart = layerStart('community-label');
const clickHandler = html.indexOf('      if(this._communityClickHandler){', labelStart);
replaceRange(labelStart, clickHandler, `      this.map.addLayer({

        id:'community-label',

        type:'symbol',

        source:'community-points',

        minzoom:14.2,

        layout:{

          'text-field':
            ['get','displayName'],

          'text-size':[
            'interpolate',
            ['linear'],
            ['zoom'],
            14.2,7.5,
            15.5,8.5,
            17,10
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
            '#f8fafc',
            '#fee2e2'
          ],

          'text-halo-color':[
            'case',
            ['get','officialBoundary'],
            '#475569',
            '#7f1d1d'
          ],

          'text-halo-width':
            1.2,

          'text-opacity':.88

        }

      });`, 'nomes das comunidades por nível de zoom');

const fogoLines = value => value.split(/\r?\n/).filter(line => /fogo/i.test(line)).join('\n');
if (fogoLines(before) !== fogoLines(html)) {
  throw new Error('Proteção acionada: o código do Fogo Cruzado seria alterado');
}

for (const required of [
  "id:'community-inner-shadow'",
  "'line-dasharray':[1.1,.7]",
  'minzoom:14.2',
  "['==',['get','occurrenceStatus'],'today']",
  "['==',['get','occurrenceStatus'],'recent']"
]) {
  if (!html.includes(required)) throw new Error(`Validação ausente: ${required}`);
}

if (html === before) throw new Error('Nenhuma alteração foi produzida');
fs.writeFileSync(file, html);
console.log('Polígonos refinados; ocorrências e regra de dois dias preservadas.');
