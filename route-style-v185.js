/* Radar Seguro RJ PRO v185 — rota principal estável, sem trilha percorrida piscando. */
(()=>{'use strict';if(window.__radarRouteStyleV185)return;window.__radarRouteStyleV185=true;
const MAIN='#5B21B6',ALT='#69B7FF',SRC='route-primary-v185',CASING='route-primary-v185-casing',LINE='route-primary-v185-line';
let lastSig='';
function app(){try{return window.RadarApp||window.App||null;}catch(_){return null;}}
function point(p){return Array.isArray(p)&&p.length>=2&&Number.isFinite(+p[0])&&Number.isFinite(+p[1]);}
function rad(d){return d*Math.PI/180;}
function distM(a,b){if(!point(a)||!point(b))return Infinity;const R=6371000,p1=rad(+a[1]),p2=rad(+b[1]),d1=p2-p1,d2=rad(+b[0]-+a[0]);const q=Math.sin(d1/2)**2+Math.cos(p1)*Math.cos(p2)*Math.sin(d2/2)**2;return 2*R*Math.asin(Math.min(1,Math.sqrt(q)));}
function currentPoint(a){try{const ll=a?.userMarker?.getLngLat?.();if(ll&&Number.isFinite(+ll.lng)&&Number.isFinite(+ll.lat))return[+ll.lng,+ll.lat];}catch(_){}if(point(a?.filteredPos))return[+a.filteredPos[0],+a.filteredPos[1]];if(point(a?.rawUserPos))return[+a.rawUserPos[0],+a.rawUserPos[1]];if(point(a?.userPos))return[+a.userPos[0],+a.userPos[1]];return null;}
function cumulative(route){if(Array.isArray(route?.cumulative)&&route.cumulative.length===route.coords?.length)return route.cumulative;const c=route?.coords||[],out=[0];let sum=0;for(let i=1;i<c.length;i++){const d=distM(c[i-1],c[i]);sum+=Number.isFinite(d)?d:0;out[i]=sum;}return out;}
function routeCoords(a){const c=a?.route?.coords;if(!Array.isArray(c)||c.length<2)return[];if(!a.navActive)return c.map(p=>[+p[0],+p[1]]);
 const cum=cumulative(a.route),total=cum[cum.length-1]||+a.route.distance||0,progress=Math.max(0,+a.routeProgressMeters||0),pos=currentPoint(a),dest=point(a.destination)?a.destination:c[c.length-1];
 if((total>0&&Math.max(0,total-progress)<=7)||(point(pos)&&point(dest)&&distM(pos,dest)<=10&&progress>=total*.92))return[];
 let idx=Math.max(0,Math.min(c.length-2,+a.routeProgressIndex||0));if(cum.length===c.length&&progress>0){let lo=idx,hi=c.length-1;while(lo<hi){const mid=Math.floor((lo+hi)/2);if((cum[mid]||0)<progress)lo=mid+1;else hi=mid;}idx=Math.max(idx,Math.max(0,lo-1));}
 const out=[];if(point(pos))out.push(pos);for(let i=Math.min(c.length-1,idx+1);i<c.length;i++){const p=c[i];if(!point(p))continue;const last=out[out.length-1];if(!last||distM(last,p)>.8)out.push([+p[0],+p[1]]);}return out.length>=2?out:[];}
function data(coords){return{type:'FeatureCollection',features:coords.length>=2?[{type:'Feature',properties:{},geometry:{type:'LineString',coordinates:coords}}]:[]};}
function trafficLayer(map){try{return (map.getStyle()?.layers||[]).map(x=>String(x.id||'')).find(id=>id==='radar-flow-v131-line'||id.includes('route-main-traffic-v127-line'))||null;}catch(_){return null;}}
function order(map){const t=trafficLayer(map);try{if(t&&map.getLayer(t)){map.moveLayer(CASING,t);map.moveLayer(LINE,t);}else{map.moveLayer(CASING);map.moveLayer(LINE);}}catch(_){}}
function hideLegacy(map){for(const id of['route-main','route-outline']){try{if(map.getLayer(id))map.setPaintProperty(id,'line-opacity',0);}catch(_){}}}
function ensure(){const a=app(),map=a?.map;if(!map)return;const coords=routeCoords(a),sig=coords.length?`${coords.length}|${coords[0][0].toFixed(6)},${coords[0][1].toFixed(6)}|${coords[coords.length-1][0].toFixed(6)},${coords[coords.length-1][1].toFixed(6)}`:'empty';hideLegacy(map);try{const s=map.getSource(SRC);if(!s){map.addSource(SRC,{type:'geojson',data:data(coords)});map.addLayer({id:CASING,type:'line',source:SRC,layout:{'line-join':'round','line-cap':'round'},paint:{'line-color':'#ffffff','line-width':['interpolate',['linear'],['zoom'],9,7,13,10,16,13],'line-opacity':.9}});map.addLayer({id:LINE,type:'line',source:SRC,layout:{'line-join':'round','line-cap':'round'},paint:{'line-color':MAIN,'line-width':['interpolate',['linear'],['zoom'],9,4.8,13,7.2,16,10],'line-opacity':1}});lastSig='';}
 if(sig!==lastSig){map.getSource(SRC)?.setData?.(data(coords));lastSig=sig;}order(map);}catch(e){console.warn('Radar v185 estilo rota:',e);}}
function clear(){const map=app()?.map;if(!map)return;for(const id of[LINE,CASING])try{if(map.getLayer(id))map.removeLayer(id);}catch(_){}try{if(map.getSource(SRC))map.removeSource(SRC);}catch(_){}lastSig='';}
function paintLegacy(){const map=app()?.map;if(!map?.getStyle)return;let layers=[];try{layers=map.getStyle()?.layers||[];}catch(_){return;}for(const l of layers){if(l?.type!=='line')continue;const id=String(l.id||'').toLowerCase();try{if(id.includes('route-alt-v')){map.setPaintProperty(l.id,'line-color',ALT);continue;}if(id.includes('traffic')||id.includes('radar-flow')||id.includes('route-primary-v185')||id==='route-main'||id==='route-outline')continue;const routeLike=(id.includes('route')||id.includes('rota'))&&!id.includes('alt')&&!id.includes('alternative')&&!id.includes('casing')&&!id.includes('hit');if(routeLike)map.setPaintProperty(l.id,'line-opacity',0);}catch(_){}}}
function refresh(){paintLegacy();ensure();}
function install(){const a=app();if(!a?.map)return false;if(a.__routeStyleV185Installed)return true;a.__routeStyleV185Installed=true;
 const wrap=(name,delay=0)=>{const old=typeof a[name]==='function'?a[name].bind(a):null;if(!old)return;a[name]=function(...args){const out=old(...args);setTimeout(refresh,delay);return out;};};
 wrap('drawRoute',30);wrap('updateRemainingRouteLine',0);wrap('updateNavigation',0);wrap('handleGPS',20);wrap('startNavigation',180);wrap('clearRoute',20);
 try{a.map.on?.('styledata',()=>setTimeout(refresh,70));}catch(_){}
 setInterval(()=>{const x=app();if(x?.route)refresh();},900);
 if(a.route?.coords?.length)refresh();else clear();return true;}
let n=0,t=setInterval(()=>{n++;if(install()||n>250)clearInterval(t);},120);
window.RadarRouteStyleV127={paint:refresh,clear,main:MAIN,alternative:ALT,version:'185-stable-remaining'};
})();