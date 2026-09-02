/* Radar Seguro RJ PRO v90 — painel de comunidades + histórico Fogo Cruzado */
(() => {
  'use strict';
  if (window.__radarCommunityPanelV90) return;
  window.__radarCommunityPanelV90 = true;

  const HISTORY_URL = './data/fogo-cruzado-history.json';
  const LIVE_URL = './data/fogo-cruzado.json';
  const PANEL_ID = 'radar-community-panel-v90';
  let cache = null;
  let cacheAt = 0;
  const CACHE_MS = 60000;

  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[ch]));

  function distanceKm(a,b){
    const R=6371, dLat=(b[1]-a[1])*Math.PI/180, dLon=(b[0]-a[0])*Math.PI/180;
    const la1=a[1]*Math.PI/180, la2=b[1]*Math.PI/180;
    const h=Math.sin(dLat/2)**2+Math.cos(la1)*Math.cos(la2)*Math.sin(dLon/2)**2;
    return 2*R*Math.asin(Math.sqrt(h));
  }

  function inRing(point, ring){
    let inside=false;
    for(let i=0,j=ring.length-1;i<ring.length;j=i++){
      const xi=ring[i][0], yi=ring[i][1], xj=ring[j][0], yj=ring[j][1];
      const hit=((yi>point[1])!==(yj>point[1])) && (point[0] < (xj-xi)*(point[1]-yi)/((yj-yi)||1e-12)+xi);
      if(hit) inside=!inside;
    }
    return inside;
  }

  function inPolygon(point, coords){
    if(!coords?.length || !inRing(point, coords[0])) return false;
    for(let i=1;i<coords.length;i++) if(inRing(point, coords[i])) return false;
    return true;
  }

  function pointInGeometry(point, geom){
    if(!geom) return false;
    if(geom.type==='Polygon') return inPolygon(point, geom.coordinates);
    if(geom.type==='MultiPolygon') return (geom.coordinates||[]).some(poly=>inPolygon(point,poly));
    return false;
  }

  function areaFor(name){
    try {
      if(typeof rawAreas!=='undefined' && Array.isArray(rawAreas)) return rawAreas.find(a=>a.name===name)||null;
    } catch(e){}
    return null;
  }

  function occurrenceMatches(name, occurrence){
    const lon=Number(occurrence?.longitude), lat=Number(occurrence?.latitude);
    if(!Number.isFinite(lon)||!Number.isFinite(lat)) return false;
    const geom=window.RADAR_COMMUNITY_GEOMETRIES?.[name];
    if(geom && pointInGeometry([lon,lat],geom)) return true;
    const area=areaFor(name);
    if(area?.c && Number.isFinite(Number(area.r))) return distanceKm(area.c,[lon,lat])<=Number(area.r);
    const hay=[occurrence?.locality,occurrence?.subNeighborhood,occurrence?.neighborhood,occurrence?.address].filter(Boolean).join(' ').toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[\u0300-\u036f]/g,'');
    const needle=String(name||'').replace(/\([^)]*\)/g,'').replace(/\b(?:comunidade|complexo|do|da|de)\b/gi,' ').replace(/\s+/g,' ').trim().toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[\u0300-\u036f]/g,'');
    return needle.length>=5 && hay.includes(needle);
  }

  async function loadOccurrences(){
    if(cache && Date.now()-cacheAt<CACHE_MS) return cache;
    const [history,live]=await Promise.all([
      fetch(HISTORY_URL,{cache:'no-store'}).then(r=>r.ok?r.json():{}).catch(()=>({})),
      fetch(LIVE_URL,{cache:'no-store'}).then(r=>r.ok?r.json():{}).catch(()=>({}))
    ]);
    const map=new Map();
    for(const item of [...(history?.occurrences||[]),...(live?.occurrences||[])]){
      const key=item?.id || item?.documentNumber || [item?.date,item?.latitude,item?.longitude].join('|');
      if(key) map.set(String(key),item);
    }
    cache={occurrences:[...map.values()], generatedAt:history?.generatedAt||live?.generatedAt||null};
    cacheAt=Date.now();
    return cache;
  }

  function startOfDay(d){ const x=new Date(d); x.setHours(0,0,0,0); return x; }
  function statsFor(items){
    const now=new Date(), today=startOfDay(now).getTime(), monthAgo=now.getTime()-30*86400000, year=now.getFullYear();
    let todayCount=0, monthCount=0, yearCount=0;
    for(const o of items){
      const d=new Date(o.date); if(!Number.isFinite(d.getTime())) continue;
      if(d.getTime()>=today) todayCount++;
      if(d.getTime()>=monthAgo) monthCount++;
      if(d.getFullYear()===year) yearCount++;
    }
    return {today:todayCount,month:monthCount,year:yearCount,total:items.length,yearLabel:year};
  }

  function regionFromName(name){
    const m=String(name||'').match(/\(([^)]+)\)/);
    return m?.[1]?.trim()||'';
  }

  function ensurePanel(){
    let panel=document.getElementById(PANEL_ID);
    if(panel) return panel;
    panel=document.createElement('section'); panel.id=PANEL_ID;
    panel.style.cssText='position:fixed;left:10px;right:10px;bottom:12px;z-index:60;max-height:58vh;overflow:auto;background:rgba(7,19,31,.96);color:#fff;border:1px solid rgba(255,255,255,.16);border-radius:18px;box-shadow:0 12px 36px rgba(0,0,0,.45);padding:16px;display:none;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif;backdrop-filter:blur(10px)';
    document.body.appendChild(panel);
    return panel;
  }

  function closeOldPopup(){
    document.querySelectorAll('.maplibregl-popup-close-button').forEach(btn=>{ try{btn.click();}catch(e){} });
  }

  async function openPanel(name){
    const panel=ensurePanel(); panel.style.display='block';
    panel.innerHTML='<div style="font-weight:800;font-size:17px">'+esc(name)+'</div><div style="opacity:.72;margin-top:7px">Carregando histórico de ocorrências...</div>';
    let data; try{data=await loadOccurrences();}catch(e){data={occurrences:[]};}
    const matched=(data.occurrences||[]).filter(o=>occurrenceMatches(name,o)).sort((a,b)=>new Date(b.date)-new Date(a.date));
    const s=statsFor(matched), region=regionFromName(name);
    const recent=matched.slice(0,5);
    const description=region
      ? 'Comunidade cadastrada no Radar Seguro RJ na região de '+esc(region)+'. O limite do mapa é usado para relacionar ocorrências próximas registradas pelo Instituto Fogo Cruzado.'
      : 'Comunidade cadastrada no Radar Seguro RJ. O limite do mapa é usado para relacionar ocorrências próximas registradas pelo Instituto Fogo Cruzado.';
    const cards=[['Hoje',s.today],['30 dias',s.month],[String(s.yearLabel),s.year],['Histórico',s.total]].map(([label,value])=>'<div style="flex:1;min-width:70px;background:rgba(255,255,255,.07);border-radius:12px;padding:10px;text-align:center"><div style="font-size:20px;font-weight:800">'+value+'</div><div style="font-size:11px;opacity:.72">'+label+'</div></div>').join('');
    const list=recent.length?recent.map(o=>{
      const d=new Date(o.date); const when=Number.isFinite(d.getTime())?d.toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}):'Data não informada';
      const reason=esc(o.reason||'Ocorrência registrada');
      const place=esc(o.locality||o.neighborhood||o.address||'');
      return '<div style="padding:10px 0;border-top:1px solid rgba(255,255,255,.09)"><div style="font-weight:700">'+reason+'</div><div style="font-size:12px;opacity:.76;margin-top:3px">'+when+(place?' • '+place:'')+'</div></div>';
    }).join(''):'<div style="padding:10px 0;opacity:.72">Nenhuma ocorrência associada a esta comunidade no histórico atualmente armazenado pelo Radar.</div>';
    panel.innerHTML='<button id="radar-community-close-v90" aria-label="Fechar" style="float:right;border:0;background:rgba(255,255,255,.1);color:#fff;width:34px;height:34px;border-radius:50%;font-size:20px">×</button>'+
      '<div style="font-weight:900;font-size:19px;padding-right:42px">'+esc(name)+'</div>'+
      '<div style="font-size:13px;line-height:1.45;opacity:.82;margin-top:8px">'+description+'</div>'+
      '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:13px">'+cards+'</div>'+
      '<div style="margin-top:14px;font-size:12px;font-weight:800;letter-spacing:.04em;opacity:.8">FOGO CRUZADO — REGISTROS ASSOCIADOS</div>'+list+
      '<div style="font-size:10px;opacity:.55;margin-top:8px">Fonte: Instituto Fogo Cruzado. As contagens refletem o histórico disponível no Radar e podem não representar toda a série histórica da comunidade.</div>';
    document.getElementById('radar-community-close-v90')?.addEventListener('click',()=>panel.style.display='none',{once:true});
  }

  function applyCommunityVisual(map){
    if(!map) return false;
    try{
      if(map.getLayer('community-fill')) map.setPaintProperty('community-fill','fill-opacity',0.28);
      if(map.getSource('communities') && !map.getLayer('community-inner-shade-v90')){
        const before=map.getLayer('community-outline')?'community-outline':undefined;
        map.addLayer({id:'community-inner-shade-v90',type:'fill',source:'communities',paint:{'fill-color':'#000000','fill-opacity':0.075}},before);
      }
      if(map.getSource('communities') && !map.getLayer('community-soft-shadow-v90')){
        const before=map.getLayer('community-outline')?'community-outline':undefined;
        map.addLayer({id:'community-soft-shadow-v90',type:'line',source:'communities',paint:{'line-color':'#000000','line-width':6,'line-opacity':0.18,'line-blur':4}},before);
      }
      return !!map.getLayer('community-fill');
    }catch(e){ return false; }
  }

  function install(){
    const app=window.RadarApp;
    const map=app?.map;
    if(!map || typeof map.on!=='function') return false;
    if(map.__radarCommunityPanelV90) return true;
    map.__radarCommunityPanelV90=true;
    const visual=()=>applyCommunityVisual(map);
    if(map.loaded?.()) visual();
    map.on('style.load',visual);
    map.on('click','community-fill',e=>{
      const feature=e?.features?.[0];
      const name=feature?.properties?.name;
      if(!name) return;
      setTimeout(closeOldPopup,0);
      openPanel(name);
    });
    try{ map.on('mouseenter','community-fill',()=>{map.getCanvas().style.cursor='pointer';}); map.on('mouseleave','community-fill',()=>{map.getCanvas().style.cursor='';}); }catch(e){}
    return true;
  }

  let tries=0;
  const timer=setInterval(()=>{ if(install() || ++tries>100) clearInterval(timer); },150);
  window.addEventListener('load',install,{once:true});
  window.RadarCommunityPanelV90={version:'90-community-history-panel',open:openPanel,refresh:()=>{cache=null;cacheAt=0;}};
})();
