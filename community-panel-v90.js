/* Radar Seguro RJ PRO v91 — painel de comunidades + histórico Fogo Cruzado */
(() => {
  'use strict';
  if (window.__radarCommunityPanelV91) return;
  window.__radarCommunityPanelV91 = true;

  const HISTORY_URL = './data/fogo-cruzado-history.json';
  const LIVE_URL = './data/fogo-cruzado.json';
  const PANEL_ID = 'radar-community-panel-v91';
  const SELECTED_LAYER = 'community-selected-v91';
  let cache = null;
  let cacheAt = 0;
  let selectedName = '';
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
    return m?.[1]?.trim()||'Rio de Janeiro';
  }

  function ensureStyle(){
    if(document.getElementById('radar-community-panel-style-v91')) return;
    const style=document.createElement('style');
    style.id='radar-community-panel-style-v91';
    style.textContent=`
      #${PANEL_ID}{position:fixed;z-index:70;background:rgba(7,19,31,.97);color:#fff;border:1px solid rgba(255,255,255,.16);box-shadow:0 18px 48px rgba(0,0,0,.52);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif;backdrop-filter:blur(12px);display:none;overflow:auto}
      #${PANEL_ID} .rc-title{font-size:21px;font-weight:900;line-height:1.1;padding-right:48px}
      #${PANEL_ID} .rc-sub{font-size:12px;opacity:.65;margin-top:5px}
      #${PANEL_ID} .rc-desc{font-size:13px;line-height:1.48;opacity:.83;margin-top:12px}
      #${PANEL_ID} .rc-section{font-size:12px;font-weight:900;letter-spacing:.06em;margin:17px 0 9px;opacity:.85}
      #${PANEL_ID} .rc-cards{display:grid;grid-template-columns:1fr 1fr;gap:9px}
      #${PANEL_ID} .rc-card{border:1px solid rgba(255,255,255,.15);border-radius:12px;padding:11px;text-align:center;background:rgba(255,255,255,.035)}
      #${PANEL_ID} .rc-card b{display:block;font-size:22px;margin:3px 0}
      #${PANEL_ID} .rc-card small{font-size:10px;opacity:.7;text-transform:uppercase}
      #${PANEL_ID} .rc-recent{padding:10px 0;border-top:1px solid rgba(255,255,255,.09)}
      #${PANEL_ID} .rc-close{position:absolute;right:12px;top:12px;border:0;background:rgba(255,255,255,.08);color:#fff;width:34px;height:34px;border-radius:50%;font-size:22px}
      @media (min-width:800px){#${PANEL_ID}{right:12px;top:72px;bottom:12px;width:min(400px,34vw);border-radius:16px;padding:18px}}
      @media (max-width:799px){#${PANEL_ID}{left:8px;right:8px;bottom:10px;max-height:62vh;border-radius:18px;padding:16px}}
    `;
    document.head.appendChild(style);
  }

  function ensurePanel(){
    ensureStyle();
    let panel=document.getElementById(PANEL_ID);
    if(panel) return panel;
    panel=document.createElement('section'); panel.id=PANEL_ID;
    document.body.appendChild(panel);
    return panel;
  }

  function closeOldPopup(){
    document.querySelectorAll('.maplibregl-popup-close-button').forEach(btn=>{ try{btn.click();}catch(e){} });
  }

  function selectOnMap(name){
    selectedName=name||'';
    const map=window.RadarApp?.map;
    if(!map) return;
    try{
      if(map.getLayer(SELECTED_LAYER)) map.setFilter(SELECTED_LAYER,['==',['get','name'],selectedName]);
    }catch(e){}
  }

  async function openPanel(name){
    if(!name) return;
    selectOnMap(name);
    const panel=ensurePanel(); panel.style.display='block';
    panel.innerHTML='<button class="rc-close" aria-label="Fechar">×</button><div class="rc-title">'+esc(name)+'</div><div class="rc-sub">Carregando dados da comunidade...</div>';
    panel.querySelector('.rc-close')?.addEventListener('click',()=>{panel.style.display='none';selectOnMap('');},{once:true});

    let data; try{data=await loadOccurrences();}catch(e){data={occurrences:[]};}
    const matched=(data.occurrences||[]).filter(o=>occurrenceMatches(name,o)).sort((a,b)=>new Date(b.date)-new Date(a.date));
    const s=statsFor(matched), region=regionFromName(name), recent=matched.slice(0,6);
    const description='Área de comunidade cadastrada no Radar Seguro RJ, na região de '+esc(region)+'. O Radar cruza o limite geográfico da comunidade com registros disponíveis do Instituto Fogo Cruzado para formar um histórico local de ocorrências.';
    const cards=[['Hoje',s.today],['Últimos 30 dias',s.month],['Ano de '+s.yearLabel,s.year],['Total armazenado',s.total]].map(([label,value],i)=>{
      const border=['rgba(239,68,68,.65)','rgba(245,158,11,.65)','rgba(34,197,94,.55)','rgba(59,130,246,.6)'][i];
      return '<div class="rc-card" style="border-color:'+border+'"><small>'+label+'</small><b>'+value+'</b><span style="font-size:11px;opacity:.65">ocorrências</span></div>';
    }).join('');
    const list=recent.length?recent.map(o=>{
      const d=new Date(o.date); const when=Number.isFinite(d.getTime())?d.toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}):'Data não informada';
      const reason=esc(o.reason||'Ocorrência registrada');
      const place=esc(o.locality||o.neighborhood||o.address||'');
      return '<div class="rc-recent"><div style="font-weight:750">'+reason+'</div><div style="font-size:11px;opacity:.68;margin-top:3px">'+when+(place?' • '+place:'')+'</div></div>';
    }).join(''):'<div style="padding:11px 0;opacity:.68">Nenhuma ocorrência associada a esta comunidade no histórico atualmente armazenado pelo Radar.</div>';

    panel.innerHTML='<button class="rc-close" aria-label="Fechar">×</button>'+
      '<div class="rc-title">'+esc(name)+'</div><div class="rc-sub">'+esc(region)+' • RJ</div>'+
      '<div class="rc-desc">'+description+'</div>'+
      '<div class="rc-section">FOGO CRUZADO</div><div class="rc-cards">'+cards+'</div>'+
      '<div class="rc-section">OCORRÊNCIAS MAIS RECENTES</div>'+list+
      '<div style="font-size:10px;opacity:.5;margin-top:9px">Fonte: Instituto Fogo Cruzado. As contagens refletem o histórico disponível no Radar e podem não representar toda a série histórica da comunidade.</div>';
    panel.querySelector('.rc-close')?.addEventListener('click',()=>{panel.style.display='none';selectOnMap('');},{once:true});
  }

  function applyCommunityVisual(map){
    if(!map) return false;
    try{
      /* Contorno mais claro; preenchimento base leve. */
      if(map.getLayer('community-fill')) map.setPaintProperty('community-fill','fill-opacity',0.13);
      if(map.getLayer('community-outline')){
        map.setPaintProperty('community-outline','line-opacity',0.78);
        map.setPaintProperty('community-outline','line-width',1.7);
      }

      /* Sombra transparente DENTRO do polígono. */
      if(map.getSource('communities') && !map.getLayer('community-inner-shade-v91')){
        const before=map.getLayer('community-outline')?'community-outline':undefined;
        map.addLayer({
          id:'community-inner-shade-v91',type:'fill',source:'communities',
          paint:{'fill-color':'#07131f','fill-opacity':0.16}
        },before);
      }

      /* Halo discreto junto à borda, sem escurecer o mapa inteiro. */
      if(map.getSource('communities') && !map.getLayer('community-edge-shadow-v91')){
        const before=map.getLayer('community-outline')?'community-outline':undefined;
        map.addLayer({
          id:'community-edge-shadow-v91',type:'line',source:'communities',
          paint:{'line-color':'#02070c','line-width':4,'line-opacity':0.16,'line-blur':3}
        },before);
      }

      /* Destaque apenas da comunidade tocada. */
      if(map.getSource('communities') && !map.getLayer(SELECTED_LAYER)){
        const before=map.getLayer('community-outline')?'community-outline':undefined;
        map.addLayer({
          id:SELECTED_LAYER,type:'fill',source:'communities',
          filter:['==',['get','name'],'__nenhuma__'],
          paint:{'fill-color':'#ffffff','fill-opacity':0.09}
        },before);
      }
      return !!map.getLayer('community-fill');
    }catch(e){ console.warn('Radar v91 visual comunidades:',e); return false; }
  }

  function featureName(feature){
    return String(feature?.properties?.name || feature?.properties?.nome || feature?.properties?.community || '').trim();
  }

  function findCommunityAt(map, point){
    const candidates=['community-fill','community-label','community-dot','community-pointer'].filter(id=>map.getLayer(id));
    try{
      const features=candidates.length?map.queryRenderedFeatures(point,{layers:candidates}):[];
      for(const feature of features){ const name=featureName(feature); if(name) return name; }
    }catch(e){}
    return '';
  }

  function install(){
    const app=window.RadarApp;
    const map=app?.map;
    if(!map || typeof map.on!=='function') return false;
    if(map.__radarCommunityPanelV91) return true;
    map.__radarCommunityPanelV91=true;

    const visual=()=>applyCommunityVisual(map);
    if(map.loaded?.()) visual();
    map.on('style.load',()=>setTimeout(visual,0));

    /* Clique genérico é mais robusto do que depender só de community-fill. */
    map.on('click',e=>{
      const name=findCommunityAt(map,e.point);
      if(!name) return;
      setTimeout(closeOldPopup,0);
      openPanel(name);
    });

    try{
      map.on('mousemove',e=>{
        const name=findCommunityAt(map,e.point);
        map.getCanvas().style.cursor=name?'pointer':'';
      });
    }catch(e){}

    return true;
  }

  let tries=0;
  const timer=setInterval(()=>{ if(install() || ++tries>140) clearInterval(timer); },150);
  window.addEventListener('load',install,{once:true});
  window.RadarCommunityPanelV91={version:'91-community-panel-fixed-click',open:openPanel,refresh:()=>{cache=null;cacheAt=0;},install};
})();
