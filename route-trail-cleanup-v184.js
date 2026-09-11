/* Radar Seguro RJ PRO v184 — remove apenas o trecho da rota já percorrido durante a navegação. Não altera câmera, busca, voz ou comunidades. */
(()=>{
'use strict';
if(window.__radarRouteTrailCleanupV184)return;
window.__radarRouteTrailCleanupV184=true;

const app=()=>{try{return window.RadarApp?.map?window.RadarApp:(typeof App!=='undefined'&&App?.map?App:null)}catch(_){return null}};
const point=p=>Array.isArray(p)&&p.length>=2&&Number.isFinite(+p[0])&&Number.isFinite(+p[1]);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const rad=d=>d*Math.PI/180;
function distM(a,b){if(!point(a)||!point(b))return Infinity;const R=6371000,p1=rad(+a[1]),p2=rad(+b[1]),d1=p2-p1,d2=rad(+b[0]-+a[0]);const q=Math.sin(d1/2)**2+Math.cos(p1)*Math.cos(p2)*Math.sin(d2/2)**2;return 2*R*Math.asin(Math.min(1,Math.sqrt(q)));}
function markerPoint(a){try{const ll=a?.userMarker?.getLngLat?.();if(ll&&Number.isFinite(+ll.lng)&&Number.isFinite(+ll.lat))return[+ll.lng,+ll.lat];}catch(_){}if(point(a?.filteredPos))return[+a.filteredPos[0],+a.filteredPos[1]];if(point(a?.rawUserPos))return[+a.rawUserPos[0],+a.rawUserPos[1]];if(point(a?.userPos))return[+a.userPos[0],+a.userPos[1]];return null;}
function cumulative(route){if(Array.isArray(route?.cumulative)&&route.cumulative.length===route.coords?.length)return route.cumulative;const c=route?.coords||[],out=[0];let sum=0;for(let i=1;i<c.length;i++){const d=distM(c[i-1],c[i]);sum+=Number.isFinite(d)?d:0;out[i]=sum;}return out;}
function remaining(a){const route=a?.route,c=route?.coords;if(!a?.navActive||!Array.isArray(c)||c.length<2)return null;const cum=cumulative(route),total=cum[cum.length-1]||+route.distance||0,progress=clamp(+a.routeProgressMeters||0,0,total||Infinity);let idx=clamp(+a.routeProgressIndex||0,0,c.length-2);if(cum.length===c.length&&progress>0){let lo=idx,hi=c.length-1;while(lo<hi){const mid=Math.floor((lo+hi)/2);if((cum[mid]||0)<progress)lo=mid+1;else hi=mid;}idx=Math.max(idx,Math.max(0,lo-1));}
 const pos=markerPoint(a),dest=point(a.destination)?a.destination:(a.destination&&Number.isFinite(+(a.destination.lon??a.destination.lng))&&Number.isFinite(+a.destination.lat)?[+(a.destination.lon??a.destination.lng),+a.destination.lat]:c[c.length-1]);
 const remainM=total>0?Math.max(0,total-progress):distM(pos,dest);
 if((remainM<=7)||(point(pos)&&point(dest)&&distM(pos,dest)<=10&&progress>=total*.92))return[];
 const out=[];if(point(pos))out.push(pos);const start=Math.min(c.length-1,idx+1);for(let i=start;i<c.length;i++){const p=c[i];if(!point(p))continue;const last=out[out.length-1];if(!last||distM(last,p)>.8)out.push([+p[0],+p[1]]);}if(out.length<2&&point(c[c.length-1]))out.push(c[c.length-1]);return out;}
function data(coords){return{type:'FeatureCollection',features:Array.isArray(coords)&&coords.length>=2?[{type:'Feature',properties:{remaining:true},geometry:{type:'LineString',coordinates:coords}}]:[]};}
function apply(){const a=app(),m=a?.map;if(!a||!m||!a.navActive)return;const coords=remaining(a);if(coords===null)return;const gj=data(coords);
 for(const id of['route','route-primary-v131']){try{const s=m.getSource(id);if(s?.setData)s.setData(gj);}catch(_){}}
}
function install(){const a=app(),m=a?.map;if(!a||!m)return false;if(a.__routeTrailCleanupV184)return true;a.__routeTrailCleanupV184=true;
 const oldRemaining=typeof a.updateRemainingRouteLine==='function'?a.updateRemainingRouteLine.bind(a):null;if(oldRemaining)a.updateRemainingRouteLine=function(...args){const out=oldRemaining(...args);setTimeout(apply,0);return out;};
 const oldGPS=typeof a.handleGPS==='function'?a.handleGPS.bind(a):null;if(oldGPS)a.handleGPS=function(position,...args){const out=oldGPS(position,...args);if(this.navActive)setTimeout(apply,15);return out;};
 const oldNav=typeof a.updateNavigation==='function'?a.updateNavigation.bind(a):null;if(oldNav)a.updateNavigation=function(...args){const out=oldNav(...args);if(this.navActive)setTimeout(apply,0);return out;};
 const oldStart=typeof a.startNavigation==='function'?a.startNavigation.bind(a):null;if(oldStart)a.startNavigation=function(...args){const out=oldStart(...args);setTimeout(apply,250);return out;};
 try{m.on?.('styledata',()=>{if(a.navActive)setTimeout(apply,80);});}catch(_){}
 setInterval(()=>{const x=app();if(x?.navActive)apply();},260);
 if(a.navActive)setTimeout(apply,300);
 return true;}
let tries=0,t=setInterval(()=>{tries++;if(install()||tries>300)clearInterval(t);},100);
window.RadarRouteTrailCleanupV184={version:'184',refresh:apply};
})();