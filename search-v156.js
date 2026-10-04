/* Radar Seguro RJ PRO — busca de endereços v156 */
(()=>{'use strict';

if(window.RadarSearchV156)return;

const TOMTOM_WORKER='https://radar-seguro-ia-rj.claudio41cg.workers.dev/v1/tomtom';

function normalize(q){
  q=String(q||'').trim().replace(/\s+/g,' ');

  if(!/rio de janeiro|rj|brasil/i.test(q)){
    q+=', Rio de Janeiro, RJ, Brasil';
  }

  return q;
}

async function geocodeTomTom(app,q,signal){
  const center=
    app.userPos||
    app.map.getCenter().toArray();

  const params=new URLSearchParams({
    limit:'8',
    countrySet:'BR',
    language:'pt-BR',
    lat:center[1],
    lon:center[0]
  });

  const path=
    '/search/2/search/'+
    encodeURIComponent(q)+
    '.json?'+params.toString();

  const r=await fetch(
    TOMTOM_WORKER+'?path='+encodeURIComponent(path),
    {signal,cache:'no-store'}
  );

  if(!r.ok)throw new Error('TomTom Search');

  const j=await r.json();

  return (j.results||[])
    .map(x=>({
      lat:x.position?.lat,
      lon:x.position?.lon,
      name:
        x.poi?.name||
        x.address?.streetName||
        x.address?.municipalitySubdivision||
        'Destino',
      display:
        x.address?.freeformAddress||
        x.poi?.name||
        'Destino'
    }))
    .filter(x=>
      Number.isFinite(x.lat)&&
      Number.isFinite(x.lon)
    );
}

async function geocodeNominatim(q,signal){
  const params=new URLSearchParams({
    format:'jsonv2',
    addressdetails:'1',
    limit:'8',
    countrycodes:'br',
    q
  });

  const r=await fetch(
    'https://nominatim.openstreetmap.org/search?'+params,
    {
      headers:{'Accept-Language':'pt-BR,pt;q=.9'},
      signal
    }
  );

  if(!r.ok)throw new Error('Nominatim');

  const data=await r.json();

  return data.map(x=>({
    lat:+x.lat,
    lon:+x.lon,
    display:x.display_name,
    name:
      x.name||
      x.address?.road||
      x.address?.suburb||
      'Destino'
  }));
}

async function geocodePhoton(app,q,signal){
  const center=
    app.userPos||
    app.map.getCenter().toArray();

  const url=
    'https://photon.komoot.io/api/?'+
    new URLSearchParams({
      q,
      limit:'8',
      lat:center[1],
      lon:center[0],
      lang:'pt'
    });

  const r=await fetch(url,{signal});

  if(!r.ok)throw new Error('Photon');

  const j=await r.json();

  return (j.features||[]).map(f=>{
    const p=f.properties||{};

    return {
      lat:f.geometry.coordinates[1],
      lon:f.geometry.coordinates[0],
      name:p.name||p.street||'Destino',
      display:[
        p.name,
        p.street,
        p.housenumber,
        p.district||p.suburb,
        p.city,
        p.state
      ].filter(Boolean).join(', ')
    };
  });
}

async function search(app,text){
  if(app.geocodeAbort){
    app.geocodeAbort.abort();
  }

  app.geocodeAbort=new AbortController();
  const q=normalize(text);

  try{
    const t=await geocodeTomTom(app,q,app.geocodeAbort.signal);
    if(t.length)return t;
  }catch(error){
    if(error.name==='AbortError')throw error;
  }

  try{
    const n=await geocodeNominatim(q,app.geocodeAbort.signal);
    if(n.length)return n;
  }catch(error){
    if(error.name==='AbortError')throw error;
  }

  return geocodePhoton(app,q,app.geocodeAbort.signal);
}

function render(app,Utils,results){
  const box=document.getElementById('suggest');
  if(!box)return false;

  box.innerHTML='';

  if(!results.length){
    box.innerHTML='<div class="suggest-item">Local não encontrado.</div>';
    box.classList.add('show');
    return true;
  }

  results
    .slice(0,7)
    .forEach(item=>{
      const div=document.createElement('div');
      div.className='suggest-item';
      div.innerHTML=
        '<div class="suggest-primary">'+Utils.sanitize(item.name)+'</div>'+
        '<div class="suggest-secondary">'+Utils.sanitize(item.display)+'</div>';

      div.onclick=()=>{
        const input=document.getElementById('destInput');
        if(input)input.value=item.display;

        app.destination=[item.lon,item.lat];
        box.classList.remove('show');
        app.showRoutePanel();
        app.calculateRoute();
      };

      box.appendChild(div);
    });

  box.classList.add('show');
  return true;
}

window.RadarSearchV156=Object.freeze({
  normalize,
  geocodeTomTom,
  geocodeNominatim,
  geocodePhoton,
  search,
  render,
  version:'156'
});

})();