from pathlib import Path
p=Path('tomtom-proxy-client.js')
s=p.read_text(encoding='utf-8')
start=s.index('  async function getNeighborhoodContext() {')
end=s.index('\n  function firstFinite(', start)
new=r'''  async function getNeighborhoodContext() {
    const gps = currentGps();
    if (!gps) return '';
    if (neighborhoodCache.text && Date.now()-neighborhoodCache.at<=LOCATION_CACHE_MS && Math.abs(gps.lat-neighborhoodCache.lat)<0.001 && Math.abs(gps.lon-neighborhoodCache.lon)<0.001) return neighborhoodCache.text;

    // v69: bairro vem de uma API de geocodificacao reversa dedicada (Geoapify),
    // usando exatamente o GPS atual. A chave fica somente no Worker.
    let neighborhood = '';
    try {
      const u = `${WORKER_BASE}/v1/geo/reverse?lat=${encodeURIComponent(gps.lat)}&lon=${encodeURIComponent(gps.lon)}`;
      const response = await nativeFetch(u, { method:'GET', headers:{Accept:'application/json'}, cache:'no-store' });
      if (response.ok) {
        const data = await response.json();
        neighborhood = String(data?.neighborhood || '').trim();
      }
    } catch (_) {}

    if (neighborhood) neighborhoodCache = { at:Date.now(), lat:gps.lat, lon:gps.lon, text:neighborhood };
    return neighborhood;
  }
'''
s=s[:start]+new+s[end:]
p.write_text(s,encoding='utf-8')

p=Path('index.html')
s=p.read_text(encoding='utf-8')
s=s.replace('content="68-neighborhood-gps"','content="69-geoapify-neighborhood"',1)
s=s.replace('./tomtom-proxy-client.js?v=68','./tomtom-proxy-client.js?v=69',1)
p.write_text(s,encoding='utf-8')
