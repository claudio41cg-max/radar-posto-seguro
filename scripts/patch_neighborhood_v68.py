from pathlib import Path
import re

# --- tomtom-proxy-client.js ---
p = Path('tomtom-proxy-client.js')
s = p.read_text(encoding='utf-8')

s = s.replace(
    "  let locationCache = { at: 0, lat: null, lon: null, text: '' };",
    "  let locationCache = { at: 0, lat: null, lon: null, text: '' };\n  let neighborhoodCache = { at: 0, lat: null, lon: null, text: '' };",
    1
)

anchor = """  function firstFinite(...values) {
"""
insert = r'''  async function getNeighborhoodContext() {
    const gps = currentGps();
    if (!gps) return '';

    if (
      neighborhoodCache.text &&
      Date.now() - neighborhoodCache.at <= LOCATION_CACHE_MS &&
      Math.abs(gps.lat - neighborhoodCache.lat) < 0.001 &&
      Math.abs(gps.lon - neighborhoodCache.lon) < 0.001
    ) return neighborhoodCache.text;

    let address = null;
    try {
      const u = `https://api.tomtom.com/search/2/reverseGeocode/${gps.lat},${gps.lon}.json?language=pt-BR&radius=80`;
      const response = await nativeFetch(buildProxyUrl(u), {
        method: 'GET',
        headers: { Accept: 'application/json' },
        cache: 'no-store'
      });
      if (response.ok) address = (await response.json())?.addresses?.[0]?.address || null;
    } catch (_) {}

    // Para bairro no Brasil, o CEP costuma ser uma referência mais estável que o campo
    // municipalitySubdivision da TomTom. O ViaCEP devolve o bairro oficial daquele CEP.
    let postal = String(address?.postalCode || '').replace(/\D/g, '');
    if (postal.length !== 8) {
      const freeform = String(address?.freeformAddress || '');
      const m = freeform.match(/\b(\d{5})-?(\d{3})\b/);
      if (m) postal = `${m[1]}${m[2]}`;
    }

    let neighborhood = '';
    if (postal.length === 8) {
      try {
        const via = await nativeFetch(`https://viacep.com.br/ws/${postal}/json/`, {
          method: 'GET',
          headers: { Accept: 'application/json' },
          cache: 'no-store'
        });
        if (via.ok) {
          const data = await via.json();
          if (!data?.erro) neighborhood = String(data?.bairro || '').trim();
        }
      } catch (_) {}
    }

    if (!neighborhood) {
      neighborhood = String(address?.municipalitySubdivision || address?.localName || '').trim();
    }

    if (neighborhood) {
      neighborhoodCache = { at: Date.now(), lat: gps.lat, lon: gps.lon, text: neighborhood };
    }
    return neighborhood;
  }

'''
if anchor not in s:
    raise SystemExit('anchor firstFinite nao localizado')
s = s.replace(anchor, insert + anchor, 1)

anchor2 = """  function isEtaQuestion(question) {
"""
insert2 = r'''  function isNeighborhoodQuestion(question) {
    const n = norm(question).replace(/^radar[, ]*/, '');
    return /^(qual|qual e|qual eh|que) (e |eh )?(o )?meu bairro\??$/.test(n) ||
      /^(em )?(qual|que) bairro (eu )?(estou|to)\??$/.test(n) ||
      /^(onde|aonde) fica (o )?meu bairro\??$/.test(n) ||
      n.includes('nome do meu bairro');
  }

'''
if anchor2 not in s:
    raise SystemExit('anchor isEtaQuestion nao localizado')
s = s.replace(anchor2, insert2 + anchor2, 1)

old = """    if (isWhereAmI(question)) {
"""
new = """    if (isNeighborhoodQuestion(question)) {
      const neighborhood = await getNeighborhoodContext();
      if (neighborhood) return `Seu bairro é ${neighborhood}.`;
      return 'Ainda não consegui confirmar o seu bairro pelo GPS. Aguarde alguns segundos e tente novamente.';
    }

    if (isWhereAmI(question)) {
"""
if old not in s:
    raise SystemExit('localAnswer isWhereAmI nao localizado')
s = s.replace(old, new, 1)

p.write_text(s, encoding='utf-8')

# --- index.html: build + cache-bust da ponte ---
p = Path('index.html')
s = p.read_text(encoding='utf-8')
s = re.sub(r'<meta name="radar-build" content="[^"]+">', '<meta name="radar-build" content="68-neighborhood-gps">', s, count=1)
s = re.sub(r'<script src="\./tomtom-proxy-client\.js\?v=[^"]+"></script>', '<script src="./tomtom-proxy-client.js?v=68"></script>', s, count=1)
p.write_text(s, encoding='utf-8')

print('v68 aplicado: bairro por GPS + CEP/ViaCEP, com fallback TomTom')
