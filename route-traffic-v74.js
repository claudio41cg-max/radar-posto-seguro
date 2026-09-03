/* Radar Seguro RJ PRO v114 — trânsito real mais sensível somente sobre a rota ativa */
(() => {
  'use strict';
  if (window.__radarRouteTrafficV114) return;
  window.__radarRouteTrafficV114 = true;

  const WORKER = 'https://radar-seguro-ia-rj.claudio41cg.workers.dev';
  const SOURCE_ID = 'route-traffic-v74';
  const LAYER_ID = 'route-traffic-v74-line';
  const MAX_SAMPLES = 56;
  const TARGET_SAMPLE_METERS = 550;
  const REFRESH_MS = 45000;
  const FLOW_CACHE_MS = 30000;
  const MAX_FLOW_CACHE_ITEMS = 220;
  const MAX_CONCURRENT = 7;
  const COLORS = { free:'#2563eb', moderate:'#f59e0b', heavy:'#ef4444' };
  const flowCache = new Map();

  function getApp(){ try { if(typeof App!=='undefined'&&App)return App; }catch(_){} return window.App||null; }
  function hideGlobalTraffic(){
    const map=getApp()?.map;if(!map)return;
    try{if(map.getLayer?.('tomtom-traffic-flow'))map.removeLayer('tomtom-traffic-flow');}catch(_){}
    try{if(map.getSource?.('tomtom-traffic'))map.removeSource('tomtom-traffic');}catch(_){}
  }

  function trafficStatus(data){
    const d=data?.flowSegmentData||{};
    const current=Number(d.currentSpeed), free=Number(d.freeFlowSpeed);
    if(!Number.isFinite(current)||!Number.isFinite(free)||free<=0)return 'free';
    const ratio=current/free;
    /* Mais próximo do comportamento visual do Waze/Maps: retenções leves já ficam visíveis. */
    if(ratio<0.48 || (free-current)>=35)return 'heavy';
    if(ratio<0.93 || (free-current)>=10)return 'moderate';
    return 'free';
  }

  function cacheKey(lat,lon){return `${lat.toFixed(4)},${lon.toFixed(4)}`;}
  function getCachedFlow(key){const e=flowCache.get(key);if(!e)return '';if(Date.now()-e.at>FLOW_CACHE_MS){flowCache.delete(key);return '';}flowCache.delete(key);flowCache.set(key,e);return e.status;}
  function setCachedFlow(key,status){if(flowCache.has(key))flowCache.delete(key);flowCache.set(key,{status,at:Date.now()});while(flowCache.size>MAX_FLOW_CACHE_ITEMS)flowCache.delete(flowCache.keys().next().value);}

  async function flowAt(coord){
    const lon=Number(coord?.[0]),lat=Number(coord?.[1]);if(!Number.isFinite(lat)||!Number.isFinite(lon))return 'free';
    const key=cacheKey(lat,lon),cached=getCachedFlow(key);if(cached)return cached;
    const path=`/traffic/services/4/flowSegmentData/absolute/10/json?point=${encodeURIComponent(lat+','+lon)}&unit=KMPH&openLr=false`;
    try{const r=await fetch(`${WORKER}/v1/tomtom?path=${encodeURIComponent(path)}`,{cache:'no-store'});if(!r.ok)return 'free';const status=trafficStatus(await r.json());setCachedFlow(key,status);return status;}catch(_){return 'free';}
  }

  function haversineMeters(a,b){const lon1=Number(a?.[0]),lat1=Number(a?.[1]),lon2=Number(b?.[0]),lat2=Number(b?.[1]);if(![lon1,lat1,lon2,lat2].every(Number.isFinite))return 0;const R=6371000,p1=lat1*Math.PI/180,p2=lat2*Math.PI/180,dp=(lat2-lat1)*Math.PI/180,dl=(lon2-lon1)*Math.PI/180,h=Math.sin(dp/2)**2+Math.cos(p1)*Math.cos(p2)*Math.sin(dl/2)**2;return 2*R*Math.atan2(Math.sqrt(h),Math.sqrt(1-h));}

  function buildRanges(coords){
    if(!Array.isArray(coords)||coords.length<2)return [];
    const cumulative=[0];for(let i=1;i<coords.length;i++)cumulative[i]=cumulative[i-1]+haversineMeters(coords[i-1],coords[i]);
    const total=cumulative[cumulative.length-1]||0,segmentCount=Math.max(1,Math.min(MAX_SAMPLES,Math.ceil(total/TARGET_SAMPLE_METERS)||1)),out=[];let prev=0;
    for(let s=1;s<=segmentCount;s++){const target=total*(s/segmentCount);let end=prev+1;while(end<cumulative.length-1&&cumulative[end]<target)end++;end=Math.min(coords.length-1,Math.max(prev+1,end));const midTarget=(cumulative[prev]+cumulative[end])/2;let mid=prev;while(mid<end&&cumulative[mid]<midTarget)mid++;out.push([prev,end,Math.min(end,Math.max(prev,mid))]);prev=end;if(prev>=coords.length-1)break;}
    if(out.length&&out[out.length-1][1]<coords.length-1){const last=out[out.length-1];last[1]=coords.length-1;last[2]=Math.floor((last[0]+last[1])/2);}return out;
  }

  async function mapLimit(items,limit,worker){const results=new Array(items.length);let next=0;const runners=Array.from({length:Math.min(limit,items.length)},async()=>{while(true){const i=next++;if(i>=items.length)return;results[i]=await worker(items[i],i);}});await Promise.all(runners);return results;}
  async function buildTrafficFeatures(coords){const ranges=buildRanges(coords);return mapLimit(ranges,MAX_CONCURRENT,async([a,b,mid])=>({type:'Feature',properties:{status:await flowAt(coords[mid]||coords[a])},geometry:{type:'LineString',coordinates:coords.slice(a,b+1)}}));}
  function keepLayerOnTop(map){try{if(map.getLayer?.(LAYER_ID)&&typeof map.moveLayer==='function')map.moveLayer(LAYER_ID);}catch(_){}}
  function ensureLayer(map,data){
    try{const source=map.getSource(SOURCE_ID);if(source?.setData){source.setData(data);keepLayerOnTop(map);return;}if(map.getLayer(LAYER_ID))map.removeLayer(LAYER_ID);if(map.getSource(SOURCE_ID))map.removeSource(SOURCE_ID);map.addSource(SOURCE_ID,{type:'geojson',data});map.addLayer({id:LAYER_ID,type:'line',source:SOURCE_ID,layout:{'line-join':'round','line-cap':'round'},paint:{'line-color':['match',['get','status'],'heavy',COLORS.heavy,'moderate',COLORS.moderate,COLORS.free],'line-width':['interpolate',['linear'],['zoom'],11,5.5,14,8.5,17,11.5],'line-opacity':1}});keepLayerOnTop(map);}catch(e){console.warn('Radar v114: erro ao desenhar trânsito da rota',e);}
  }

  let refreshToken=0,lastRouteKey='',refreshTimer=null;
  function routeKey(route){const coords=route?.coords;if(!Array.isArray(coords)||coords.length<2)return '';const first=coords[0]||[],last=coords[coords.length-1]||[];return `${coords.length}:${Number(first[0]).toFixed(5)},${Number(first[1]).toFixed(5)}:${Number(last[0]).toFixed(5)},${Number(last[1]).toFixed(5)}`;}
  async function refreshRouteTraffic(route,force=false){const map=getApp()?.map,coords=route?.coords;if(!map||!Array.isArray(coords)||coords.length<2)return;const key=routeKey(route);if(!force&&key&&key===lastRouteKey&&map.getSource?.(SOURCE_ID)){keepLayerOnTop(map);return;}lastRouteKey=key;hideGlobalTraffic();const token=++refreshToken,features=await buildTrafficFeatures(coords);if(token!==refreshToken)return;ensureLayer(map,{type:'FeatureCollection',features});}
  function startPeriodicRefresh(){clearInterval(refreshTimer);refreshTimer=setInterval(()=>{if(document.visibilityState==='hidden')return;const route=getApp()?.route;if(route?.coords?.length)refreshRouteTraffic(route,true);},REFRESH_MS);}
  function install(){const app=getApp();if(!app||app.__routeTrafficV114Installed)return false;app.__routeTrafficV114Installed=true;const originalDrawRoute=typeof app.drawRoute==='function'?app.drawRoute.bind(app):null;if(originalDrawRoute){app.drawRoute=function(route,fit){const result=originalDrawRoute(route,fit);setTimeout(()=>refreshRouteTraffic(route,true),120);return result;};}hideGlobalTraffic();if(app.route?.coords?.length)setTimeout(()=>refreshRouteTraffic(app.route,true),300);startPeriodicRefresh();return true;}
  let tries=0;const timer=setInterval(()=>{tries++;if(install()||tries>80)clearInterval(timer);},250);
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&getApp()?.route?.coords?.length)setTimeout(()=>refreshRouteTraffic(getApp().route,true),250);});
  window.addEventListener('pagehide',()=>{flowCache.clear();clearInterval(refreshTimer);});
  window.RadarRouteTrafficV74={version:'114-route-live-traffic-sensitive',refresh:()=>refreshRouteTraffic(getApp()?.route,true),hideGlobalTraffic,clearCache:()=>flowCache.clear()};
})();
