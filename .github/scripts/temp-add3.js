const fs = require('fs');

const indexPath = 'index.html';
let html = fs.readFileSync(indexPath, 'utf8');
const originalHtml = html;

const normalize = value => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/\s+/g, ' ')
  .trim();

function replaceOne(source, needle, replacement, label) {
  const first = source.indexOf(needle);
  if (first < 0) throw new Error('Trecho não encontrado: ' + label);
  if (source.indexOf(needle, first + needle.length) >= 0)
    throw new Error('Trecho duplicado: ' + label);
  return source.slice(0, first) + replacement + source.slice(first + needle.length);
}

function pointInRing(point, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    const crosses = ((yi > point[1]) !== (yj > point[1])) &&
      (point[0] < (xj - xi) * (point[1] - yi) / ((yj - yi) || 1e-12) + xi);
    if (crosses) inside = !inside;
  }
  return inside;
}

const geometryPolygons = geometry => geometry.type === 'MultiPolygon'
  ? geometry.coordinates
  : [geometry.coordinates];

const pointInGeometry = (point, geometry) => geometryPolygons(geometry)
  .some(polygon => pointInRing(point, polygon[0] || []) &&
    !polygon.slice(1).some(hole => pointInRing(point, hole)));

function ringCentroid(ring) {
  let area = 0, x = 0, y = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    const a = ring[i], b = ring[i + 1];
    const cross = a[0] * b[1] - b[0] * a[1];
    area += cross;
    x += (a[0] + b[0]) * cross;
    y += (a[1] + b[1]) * cross;
  }
  return Math.abs(area) < 1e-12 ? null : [x / (3 * area), y / (3 * area)];
}

function interiorPoint(geometry, preferred) {
  if (pointInGeometry(preferred, geometry)) return preferred;
  for (const polygon of geometryPolygons(geometry)) {
    const ring = polygon[0] || [];
    if (ring.length < 4) continue;
    const xs = ring.map(point => point[0]);
    const ys = ring.map(point => point[1]);
    const candidates = [
      ringCentroid(ring),
      [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2],
      [
        ring.reduce((sum, point) => sum + point[0], 0) / ring.length,
        ring.reduce((sum, point) => sum + point[1], 0) / ring.length
      ]
    ].filter(Boolean);
    for (const candidate of candidates)
      if (pointInGeometry(candidate, geometry)) return candidate;
    const target = candidates[0] || ring[0];
    for (const vertex of ring) {
      for (const amount of [0.15, 0.3, 0.5, 0.7, 0.85]) {
        const candidate = [
          vertex[0] + (target[0] - vertex[0]) * amount,
          vertex[1] + (target[1] - vertex[1]) * amount
        ];
        if (pointInGeometry(candidate, geometry)) return candidate;
      }
    }
  }
  throw new Error('Não foi possível encontrar ponto interno.');
}

function validateGeometry(geometry, name) {
  if (!geometry || !['Polygon', 'MultiPolygon'].includes(geometry.type))
    throw new Error('Geometria inválida: ' + name);
  let vertices = 0;
  for (const polygon of geometryPolygons(geometry)) {
    if (!polygon.length) throw new Error('Polígono vazio: ' + name);
    for (const ring of polygon) {
      if (ring.length < 4) throw new Error('Anel curto: ' + name);
      const first = ring[0], last = ring[ring.length - 1];
      if (first[0] !== last[0] || first[1] !== last[1])
        throw new Error('Anel aberto: ' + name);
      ring.forEach(coordinate => {
        if (!Number.isFinite(coordinate[0]) || !Number.isFinite(coordinate[1]))
          throw new Error('Coordenada inválida: ' + name);
      });
      vertices += ring.length;
    }
  }
  return vertices;
}

function pointToSegmentDistance(point, start, end) {
  const latitudeScale = Math.cos(point[1] * Math.PI / 180);
  const px = point[0] * latitudeScale, py = point[1];
  const ax = start[0] * latitudeScale, ay = start[1];
  const bx = end[0] * latitudeScale, by = end[1];
  const dx = bx - ax, dy = by - ay;
  const lengthSquared = dx * dx + dy * dy;
  const amount = lengthSquared
    ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lengthSquared))
    : 0;
  const x = ax + amount * dx, y = ay + amount * dy;
  return Math.hypot(px - x, py - y) * 111.32;
}

function distanceToGeometryKm(point, geometry) {
  if (pointInGeometry(point, geometry)) return 0;
  let minimum = Infinity;
  for (const polygon of geometryPolygons(geometry)) {
    for (const ring of polygon) {
      for (let index = 1; index < ring.length; index++)
        minimum = Math.min(minimum,
          pointToSegmentDistance(point, ring[index - 1], ring[index]));
    }
  }
  return minimum;
}

async function main() {
  const service = 'https://pgeo3.rio.rj.gov.br/arcgis/rest/services/' +
    'SABREN/Limites_de_Favelas/FeatureServer/13/query';
  const params = new URLSearchParams({
    where: '1=1',
    outFields: 'objectid,nome,complexo,bairro',
    returnGeometry: 'true',
    outSR: '4326',
    geometryPrecision: '6',
    maxAllowableOffset: '0.000012',
    f: 'geojson'
  });
  const response = await fetch(service + '?' + params);
  if (!response.ok) throw new Error('SABREN indisponível: HTTP ' + response.status);
  const sabren = await response.json();
  if (!Array.isArray(sabren.features) || !sabren.features.length)
    throw new Error('SABREN não retornou feições.');

  const definitions = [
    {
      appName: 'Vidigal', preferred: [-43.2356, -22.9939],
      match(p) {
        const name = normalize(p.nome), complex = normalize(p.complexo);
        return complex === 'vidigal' || complex === 'complexo do vidigal' ||
          name === 'vidigal';
      }
    },
    {
      appName: 'Complexo da Maré', preferred: [-43.2415, -22.8555],
      match(p) {
        const name = normalize(p.nome), complex = normalize(p.complexo);
        return complex === 'mare' || complex === 'complexo da mare' ||
          name === 'complexo da mare';
      }
    },
    {
      appName: 'Rocinha', preferred: [-43.2471, -22.9881],
      match(p) {
        const name = normalize(p.nome), complex = normalize(p.complexo);
        return complex === 'rocinha' || complex === 'complexo da rocinha' ||
          name === 'rocinha';
      }
    }
  ];

  const sourceFeatures = [], officialGeometries = {}, centers = {}, audit = [];
  for (const definition of definitions) {
    let matches = sabren.features.filter(feature =>
      feature.geometry && definition.match(feature.properties || {}));
    let seed = null;
    if (!matches.length) {
      const nearest = sabren.features
        .filter(feature => feature.geometry)
        .map(feature => ({
          feature,
          distance: distanceToGeometryKm(definition.preferred, feature.geometry)
        }))
        .sort((a, b) => a.distance - b.distance)[0];
      if (!nearest || nearest.distance > 1.5)
        throw new Error('Nenhuma feição SABREN próxima de ' + definition.appName);
      seed = nearest.feature;
      const seedComplex = normalize((seed.properties || {}).complexo);
      const seedName = normalize((seed.properties || {}).nome);
      if (!seedName)
        throw new Error('Feição oficial sem nome próxima de ' + definition.appName);
      matches = sabren.features.filter(feature => {
        if (!feature.geometry) return false;
        const properties = feature.properties || {};
        return seedComplex && seedComplex !== 'isolada'
          ? normalize(properties.complexo) === seedComplex
          : normalize(properties.nome) === seedName;
      });
    }
    if (!matches.length)
      throw new Error('Agrupamento SABREN vazio para ' + definition.appName);
    if (matches.length > 80)
      throw new Error('Agrupamento SABREN amplo demais para ' + definition.appName);
    const polygons = [];
    for (const feature of matches) {
      if (feature.geometry.type === 'Polygon')
        polygons.push(feature.geometry.coordinates);
      else if (feature.geometry.type === 'MultiPolygon')
        polygons.push(...feature.geometry.coordinates);
      else throw new Error('Tipo inesperado para ' + definition.appName);
      sourceFeatures.push({
        type: 'Feature',
        properties: { ...(feature.properties || {}), appCommunity: definition.appName },
        geometry: feature.geometry
      });
    }
    const geometry = polygons.length === 1
      ? { type: 'Polygon', coordinates: polygons[0] }
      : { type: 'MultiPolygon', coordinates: polygons };
    const vertices = validateGeometry(geometry, definition.appName);
    const center = interiorPoint(geometry, definition.preferred)
      .map(value => Number(value.toFixed(6)));
    if (!pointInGeometry(center, geometry))
      throw new Error('Centro fora do limite: ' + definition.appName);
    officialGeometries[definition.appName] = geometry;
    centers[definition.appName] = center;
    audit.push({
      appName: definition.appName,
      sourceFeatures: matches.length,
      polygons: polygons.length,
      vertices,
      center,
      sourceNames: [...new Set(matches.map(feature =>
        (feature.properties || {}).nome).filter(Boolean))],
      detectedComplex: seed ? (seed.properties || {}).complexo || null : null,
      detectedSeedName: seed ? (seed.properties || {}).nome || null : null
    });
  }

  fs.mkdirSync('data', { recursive: true });
  fs.writeFileSync('data/sabren-mare-rocinha-vidigal.geojson', JSON.stringify({
    type: 'FeatureCollection',
    source: 'SABREN 2022 - Instituto Pereira Passos / Prefeitura do Rio',
    sourceUrl: service,
    generatedAt: new Date().toISOString(),
    audit,
    features: sourceFeatures
  }, null, 2) + '\n');

  const appStartBefore = originalHtml.indexOf('const App = {');
  const appEndBefore = originalHtml.indexOf('\n};\n\n\nwindow.RadarApp={', appStartBefore);
  if (appStartBefore < 0 || appEndBefore < 0)
    throw new Error('Bloco protegido da navegação não localizado.');
  const protectedAppBefore = originalHtml.slice(appStartBefore, appEndBefore + 4);

  const setAnchor = 'const official2022CommunityNames=new Set([';
  if (definitions.some(definition => originalHtml.includes('"' + definition.appName + '":{')))
    throw new Error('Uma das três comunidades já possui geometria oficial.');
  const officialBlock = `/*
  Limites oficiais SABREN 2022 — Complexo da Maré, Rocinha e Vidigal.
  Instituto Pereira Passos / Prefeitura do Rio. Geometrias generalizadas em cerca de 1,3 m.
*/
Object.assign(officialCommunityGeometries,${JSON.stringify(officialGeometries)});

`;
  html = replaceOne(html, setAnchor, officialBlock + setAnchor, 'geometrias oficiais');
  html = replaceOne(html, setAnchor, setAnchor + `
  'Vidigal',
  'Complexo da Maré',
  'Rocinha',`, 'nomes oficiais');

  const escapeRegExp = value => value.replace(/[.*+?^$()|[\]\\{}]/g, '\\$&');
  for (const definition of definitions) {
    const pattern = new RegExp(
      "(\\{name:'" + escapeRegExp(definition.appName) + "',c:)\\[[^\\]]+\\](,r:)");
    const matches = html.match(new RegExp(pattern.source, 'g')) || [];
    if (matches.length !== 1)
      throw new Error('Centro não localizado uma única vez: ' + definition.appName);
    html = html.replace(pattern,
      '$1[' + centers[definition.appName].join(',') + ']$2');
  }

  const cssStart = html.indexOf('.fogo-live-marker{');
  const cssEnd = html.indexOf(
    '/* =========================================================\n   RECENTRALIZAR', cssStart);
  if (cssStart < 0 || cssEnd < 0)
    throw new Error('CSS das ocorrências não localizado.');
  const targetCss = `.fogo-live-marker{
  position:relative;
  width:38px;
  height:38px;
  border-radius:50%;
  border:3px solid #fff;
  background:radial-gradient(circle,#ef2929 0 3px,#fff 3.5px 6px,#ef2929 6.5px 9px,#fff 9.5px 12px,#ef2929 12.5px 15px,#fff 15.5px 17px,#ef2929 17.5px 19px);
  box-shadow:0 0 0 4px rgba(239,41,41,.2),0 5px 14px rgba(0,0,0,.62);
  color:transparent;
  display:grid;
  place-items:center;
  padding:0;
  margin:0;
  font-size:0;
  cursor:pointer;
  appearance:none;
  -webkit-appearance:none;
  overflow:visible
}

.fogo-live-marker::after{
  content:'';
  position:absolute;
  inset:-8px;
  border:3px solid rgba(239,41,41,.62);
  border-radius:50%;
  pointer-events:none;
  animation:fogoLivePulse 1.15s infinite ease-out
}

.fogo-live-marker.fogo-previous{
  background:radial-gradient(circle,#f59e0b 0 3px,#fff 3.5px 6px,#f59e0b 6.5px 9px,#fff 9.5px 12px,#f59e0b 12.5px 15px,#fff 15.5px 17px,#f59e0b 17.5px 19px);
  box-shadow:0 0 0 4px rgba(245,158,11,.2),0 5px 14px rgba(0,0,0,.58)
}

.fogo-live-marker.fogo-previous::after{
  border-color:rgba(245,158,11,.5);
  animation:fogoRecentPulse 1.8s infinite ease-out
}

@keyframes fogoLivePulse{
  from{transform:scale(.72);opacity:.9}
  to{transform:scale(1.35);opacity:0}
}

@keyframes fogoRecentPulse{
  from{transform:scale(.82);opacity:.58}
  to{transform:scale(1.2);opacity:0}
}

`;
  html = html.slice(0, cssStart) + targetCss + html.slice(cssEnd);

  const statusStart = html.indexOf('        const todayKey=rioDateKey(new Date());');
  const statusEndNeedle = '        App.communityOccurrenceInfo=communityOccurrenceInfo;';
  const statusEndAt = html.indexOf(statusEndNeedle, statusStart);
  if (statusStart < 0 || statusEndAt < 0)
    throw new Error('Bloco de status das ocorrências não localizado.');
  const twoDayStatusBlock = `        const todayKey=rioDateKey(new Date());
        const monthKey=todayKey?.slice(0,7);
        const yearKey=todayKey?.slice(0,4);
        const todayStart=new Date(todayKey+'T00:00:00-03:00').getTime();
        const yesterdayKey=rioDateKey(new Date(todayStart-60000));
        const occurrenceStatusByName={};
        const communityOccurrenceInfo={};

        const matchOccurrenceCommunity=point=>{
          let best=null;
          rawAreas.forEach(area=>{
            const distance=distanceToCommunityKm(point,area);
            if(distance>.18) return;
            const candidate={
              area,
              distance,
              official:Boolean(officialCommunityGeometries[area.name]),
              centerDistance:Utils.distanceKm(point,area.c)
            };
            if(
              !best ||
              candidate.distance<best.distance-1e-6 ||
              (
                Math.abs(candidate.distance-best.distance)<=1e-6 &&
                (
                  Number(candidate.official)>Number(best.official) ||
                  (
                    candidate.official===best.official &&
                    candidate.centerDistance<best.centerDistance
                  )
                )
              )
            ) best=candidate;
          });
          return best?.area || null;
        };

        const communityMarkerPoint=(point,area)=>{
          if(!area || distanceToCommunityKm(point,area)===0) return point;
          if(distanceToCommunityKm(area.c,area)===0) return [...area.c];
          const geometry=officialCommunityGeometries[area.name];
          const polygons=geometry
            ? (geometry.type==='MultiPolygon' ? geometry.coordinates : [geometry.coordinates])
            : [];
          for(const polygon of polygons){
            const ring=polygon[0] || [];
            if(!ring.length) continue;
            const candidate=[
              ring.reduce((sum,value)=>sum+value[0],0)/ring.length,
              ring.reduce((sum,value)=>sum+value[1],0)/ring.length
            ];
            if(distanceToCommunityKm(candidate,area)===0) return candidate;
          }
          return [...area.c];
        };

        rawAreas.forEach(area=>{
          communityOccurrenceInfo[area.name]={
            status:'normal',
            last7:0,
            month:0,
            year:0,
            recent:[],
            visibleDays:new Set()
          };
        });

        allOccurrences.forEach(item=>{
          const date=new Date(item.date);
          const longitude=Number(item.longitude);
          const latitude=Number(item.latitude);
          if(
            Number.isNaN(date.getTime()) ||
            !Number.isFinite(longitude) ||
            !Number.isFinite(latitude)
          ) return;
          const dateKey=rioDateKey(item.date);
          if(!dateKey) return;
          const itemDayStart=new Date(dateKey+'T00:00:00-03:00').getTime();
          const ageDays=Math.round((todayStart-itemDayStart)/86400000);
          const area=matchOccurrenceCommunity([longitude,latitude]);
          if(!area) return;
          const info=communityOccurrenceInfo[area.name];
          if(ageDays>=0 && ageDays<7){
            info.last7++;
            info.recent.push(item);
          }
          if(dateKey.slice(0,7)===monthKey) info.month++;
          if(dateKey.slice(0,4)===yearKey) info.year++;
          if(dateKey===todayKey || dateKey===yesterdayKey)
            info.visibleDays.add(dateKey);
        });

        Object.entries(communityOccurrenceInfo).forEach(([name,info])=>{
          info.recent.sort((a,b)=>new Date(b.date)-new Date(a.date));
          const hasToday=info.visibleDays.has(todayKey);
          const hasYesterday=info.visibleDays.has(yesterdayKey);
          info.status=hasToday
            ? 'today'
            : hasYesterday
              ? 'recent'
              : 'normal';
          occurrenceStatusByName[name]=info.status;
          delete info.visibleDays;
        });

        App.communityOccurrenceInfo=communityOccurrenceInfo;`;
  html = html.slice(0, statusStart) + twoDayStatusBlock +
    html.slice(statusEndAt + statusEndNeedle.length);

  const oldDateWindow = `        const occurrenceDateKeys=new Set();
        for(let dayOffset=0;dayOffset<7;dayOffset++){
          occurrenceDateKeys.add(
            rioDateKey(
              new Date(nowMs-dayOffset*86400000)
            )
          );
        }`;
  html = replaceOne(html, oldDateWindow,
    '        const occurrenceDateKeys=new Set([todayKey,yesterdayKey]);',
    'janela de dois dias');

  const oldPush = `            visibleOccurrences.push({
              ...item,
              longitude,
              latitude,
              _time:time,
              _dateKey:dateKey
            });`;
  const newPush = `            const community=matchOccurrenceCommunity([longitude,latitude]);
            const markerCoordinates=communityMarkerPoint(
              [longitude,latitude],
              community
            );
            visibleOccurrences.push({
              ...item,
              longitude,
              latitude,
              _time:time,
              _dateKey:dateKey,
              _communityName:community?.name || null,
              _markerCoordinates:markerCoordinates
            });`;
  html = replaceOne(html, oldPush, newPush, 'marcador dentro da comunidade');

  html = replaceOne(html, '            delete cleanItem._dateKey;',
    `            delete cleanItem._dateKey;
            delete cleanItem._communityName;
            delete cleanItem._markerCoordinates;`, 'campos internos');
  html = replaceOne(html,
    "              : 'Ocorrência dos últimos sete dias informada pelo Fogo Cruzado'",
    "              : 'Ocorrência de ontem informada pelo Fogo Cruzado'", 'aria ontem');
  html = replaceOne(html, "              : 'Ocorrência recente • Fogo Cruzado';",
    "              : 'Ocorrência de ontem • Fogo Cruzado';", 'título ontem');
  html = replaceOne(html, "          marker.textContent=isToday?'!':'•';",
    "          marker.textContent='';", 'símbolo alvo');
  html = replaceOne(html, "              : '🟠 Ocorrência dos últimos 7 dias';",
    "              : '🟠 Ocorrência de ontem';", 'popup ontem');
  html = replaceOne(html,
    "                'Vermelho: hoje • Laranja: dias anteriores<br>'+",
    "                'Vermelho: hoje • Laranja: ontem • exibição por 2 dias<br>'+",
    'legenda dois dias');
  html = replaceOne(html, '            .setLngLat([item.longitude,item.latitude])',
    '            .setLngLat(item._markerCoordinates || [item.longitude,item.latitude])',
    'posição do marcador');
  html = replaceOne(html, "            ? 'Ocorrência recente'",
    "            ? 'Ocorrência de ontem'", 'status da comunidade ontem');

  const oldOpacity = `          'fill-opacity':[
            'interpolate',
            ['linear'],
            ['zoom'],
            8.8,.006,
            9.8,.018,
            10.5,.04,
            11.7,.08,
            14,.16,
            17,.22
          ]`;
  const newOpacity = `          'fill-opacity':[
            'case',
            ['==',['get','occurrenceStatus'],'today'],
            ['interpolate',['linear'],['zoom'],8.8,.10,11.7,.26,14,.38,17,.46],
            ['==',['get','occurrenceStatus'],'recent'],
            ['interpolate',['linear'],['zoom'],8.8,.07,11.7,.20,14,.30,17,.38],
            ['interpolate',['linear'],['zoom'],
              8.8,.006,9.8,.018,10.5,.04,11.7,.08,14,.16,17,.22]
          ]`;
  html = replaceOne(html, oldOpacity, newOpacity, 'cor forte dos polígonos');

  const appStartAfter = html.indexOf('const App = {');
  const appEndAfter = html.indexOf('\n};\n\n\nwindow.RadarApp={', appStartAfter);
  const protectedAppAfter = html.slice(appStartAfter, appEndAfter + 4);
  const protectedAppWithAuthorizedChanges = protectedAppBefore
    .replace(
      "            ? 'Ocorrência recente'",
      "            ? 'Ocorrência de ontem'"
    )
    .replace(oldOpacity, newOpacity);
  if (protectedAppWithAuthorizedChanges !== protectedAppAfter)
    throw new Error('Proteção falhou: a navegação foi alterada.');

  const rawStart = html.indexOf('const rawAreas = [');
  const rawEnd = html.indexOf('];', rawStart);
  const communityCount = (html.slice(rawStart, rawEnd).match(/\{name:'/g) || []).length;
  if (communityCount !== 55)
    throw new Error('Quantidade de comunidades mudou: ' + communityCount);
  for (const definition of definitions) {
    if (!html.includes('"' + definition.appName + '":{'))
      throw new Error('Geometria não inserida: ' + definition.appName);
    if (!html.includes("  '" + definition.appName + "',"))
      throw new Error('Nome oficial não inserido: ' + definition.appName);
  }
  if (html.includes('for(let dayOffset=0;dayOffset<7;dayOffset++)'))
    throw new Error('A janela antiga de sete dias ainda existe.');
  if (!html.includes('new Set([todayKey,yesterdayKey])'))
    throw new Error('A janela de dois dias não foi aplicada.');
  if (!html.includes('background:radial-gradient(circle,'))
    throw new Error('O símbolo de alvo não foi aplicado.');

  const scripts = [...html.matchAll(
    /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi
  )].map(match => match[1]);
  const mainScript = scripts.find(code =>
    code.includes('const rawAreas = [') && code.includes('const App = {'));
  if (!mainScript) throw new Error('Script principal não localizado.');
  new Function(mainScript);

  fs.writeFileSync(indexPath, html);
  console.log(JSON.stringify({
    communities: audit,
    communityCount,
    indexBytesBefore: Buffer.byteLength(originalHtml),
    indexBytesAfter: Buffer.byteLength(html),
    twoDayWindow: true,
    targetMarker: true,
    navigationProtected: true
  }, null, 2));
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
