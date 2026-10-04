/* Radar Seguro RJ PRO — hazards da rota v156 */
(()=>{'use strict';

if(window.RadarHazardsV156)return;

function clear(app){
  app.hazardMarkers.forEach(m=>{
    try{m.remove()}catch(_){}
  });
  app.hazardMarkers=[];
  app.routeHazards=[];
}

async function fetchAlongRoute(app,Utils){
  clear(app);

  if(!app.navActive||!app.route?.coords?.length)return;

  const coords=app.route.coords;

  let minLon=Infinity;
  let maxLon=-Infinity;
  let minLat=Infinity;
  let maxLat=-Infinity;

  coords.forEach(p=>{
    minLon=Math.min(minLon,p[0]);
    maxLon=Math.max(maxLon,p[0]);
    minLat=Math.min(minLat,p[1]);
    maxLat=Math.max(maxLat,p[1]);
  });

  const margin=.004;
  const bbox=
    `${minLat-margin},${minLon-margin},${maxLat+margin},${maxLon+margin}`;

  const query=
`[out:json][timeout:10];
(
node["traffic_calming"](${bbox});
node["highway"="speed_camera"](${bbox});
node["highway"="traffic_signals"](${bbox});
);
out body;`;

  const routeRef=app.route;

  if(app.hazardFetchController){
    try{app.hazardFetchController.abort()}catch(_){}
  }

  const controller=new AbortController();
  app.hazardFetchController=controller;

  const timeout=setTimeout(()=>controller.abort(),12000);

  try{
    const r=await fetch(
      'https://overpass-api.de/api/interpreter?data='+
      encodeURIComponent(query),
      {
        signal:controller.signal,
        cache:'no-store'
      }
    );

    if(!r.ok)throw new Error('Overpass');

    const data=await r.json();

    if(controller.signal.aborted||app.route!==routeRef)return;

    for(const el of data.elements||[]){
      if(el.lat==null||el.lon==null)continue;

      let type=null;

      if(el.tags?.traffic_calming)type='lombada';
      else if(el.tags?.highway==='speed_camera')type='radar';
      else if(el.tags?.highway==='traffic_signals')type='semaforo';

      if(!type)continue;

      const point=[el.lon,el.lat];
      let nearestDist=Infinity;
      let routeIndex=0;
      let routeBearing=0;

      for(let i=0;i<coords.length-1;i+=2){
        const res=Utils.pointToSegment(point,coords[i],coords[i+1]);

        if(res.distanceMeters<nearestDist){
          nearestDist=res.distanceMeters;
          routeIndex=i;
          routeBearing=res.bearing;
        }
      }

      if(nearestDist<=22){
        app.routeHazards.push({
          type,
          coords:point,
          routeIndex,
          bearing:routeBearing
        });
      }
    }

    render(app);

  }catch(error){
    if(error?.name!=='AbortError'){
      console.warn('Falha ao obter elementos da rota.',error);
    }
  }finally{
    clearTimeout(timeout);

    if(app.hazardFetchController===controller){
      app.hazardFetchController=null;
    }
  }
}

function svg(type){
  if(type==='lombada'){
    return `
<svg viewBox="0 0 48 48">
<polygon points="24,2 46,24 24,46 2,24"
fill="#facc15"
stroke="#111827"
stroke-width="4"/>
<path d="M10 30 Q24 12 38 30"
fill="none"
stroke="#111827"
stroke-width="5"
stroke-linecap="round"/>
</svg>`;
  }

  if(type==='radar'){
    return `
<svg viewBox="0 0 48 48">
<circle cx="24" cy="24" r="21"
fill="#0284c7"
stroke="#fff"
stroke-width="3"/>
<rect x="14" y="15" width="20" height="17"
rx="4"
fill="#fff"/>
<circle cx="24" cy="23.5" r="5"
fill="#0284c7"/>
</svg>`;
  }

  return `
<svg viewBox="0 0 48 48">
<rect x="15" y="3" width="18" height="42"
rx="6"
fill="#111827"
stroke="#fff"
stroke-width="2"/>
<circle cx="24" cy="12" r="4"
fill="#ef4444"/>
<circle cx="24" cy="24" r="4"
fill="#eab308"/>
<circle cx="24" cy="36" r="4"
fill="#22c55e"/>
</svg>`;
}

function render(app){
  app.hazardMarkers.forEach(m=>{
    try{m.remove()}catch(_){}
  });

  app.hazardMarkers=[];

  if(!app.navActive)return;

  app.routeHazards.forEach(h=>{
    if(h.routeIndex<app.routeProgressIndex-5)return;

    const el=document.createElement('div');
    el.className='hazard-marker';
    el.innerHTML=svg(h.type);

    const marker=
      new maplibregl.Marker({
        element:el,
        anchor:'center'
      })
      .setLngLat(h.coords)
      .addTo(app.map);

    app.hazardMarkers.push(marker);
  });
}

window.RadarHazardsV156=Object.freeze({
  clear,
  fetchAlongRoute,
  svg,
  render,
  version:'156'
});

})();