(function(){
'use strict';
const RJ_CENTER=[-43.40,-22.90];
const STYLE_VECTOR='https://tiles.openfreemap.org/styles/liberty';
function satelliteStyle(){return {version:8,sources:{sat:{type:'raster',tiles:['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],tileSize:256,attribution:'Tiles © Esri'}},layers:[{id:'sat',type:'raster',source:'sat'}]};}
function darkStyle(){return 'https://tiles.openfreemap.org/styles/dark';}
const Utils = {

  distanceKm(a,b){

    const R = 6371;

    const lat1 = a[1] * Math.PI / 180;
    const lat2 = b[1] * Math.PI / 180;

    const dLat =
      (b[1]-a[1]) * Math.PI / 180;

    const dLon =
      (b[0]-a[0]) * Math.PI / 180;

    const h =
      Math.sin(dLat/2)**2 +
      Math.cos(lat1) *
      Math.cos(lat2) *
      Math.sin(dLon/2)**2;

    return 2 * R *
      Math.asin(Math.sqrt(h));

  },


  bearing(a,b){

    const lat1 =
      a[1] * Math.PI / 180;

    const lat2 =
      b[1] * Math.PI / 180;

    const dLon =
      (b[0]-a[0]) * Math.PI / 180;

    const y =
      Math.sin(dLon) *
      Math.cos(lat2);

    const x =
      Math.cos(lat1) *
      Math.sin(lat2) -
      Math.sin(lat1) *
      Math.cos(lat2) *
      Math.cos(dLon);

    return (
      Math.atan2(y,x) *
      180 / Math.PI +
      360
    ) % 360;

  },


  angleDiff(a,b){

    let d =
      Math.abs(a-b) % 360;

    if(d > 180)
      d = 360-d;

    return d;

  },


  sanitize(v){

    return String(v ?? '')
      .replace(/[&<>"']/g,m=>({

        '&':'&amp;',
        '<':'&lt;',
        '>':'&gt;',
        '"':'&quot;',
        "'":'&#039;'

      }[m]));

  },


  makeCircle(lon,lat,rKm,points=48){

    const coords=[];

    const rLat =
      rKm/111;

    const rLon =
      rKm /
      (
        111 *
        Math.cos(
          lat *
          Math.PI/180
        )
      );

    for(let i=0;i<=points;i++){

      const ang =
        i/points *
        Math.PI*2;

      coords.push([

        lon +
        rLon *
        Math.cos(ang),

        lat +
        rLat *
        Math.sin(ang)

      ]);

    }

    return coords;

  },


  pointToSegment(p,a,b){

    const cosLat =
      Math.cos(
        p[1] *
        Math.PI/180
      );

    const P=[
      p[0]*cosLat,
      p[1]
    ];

    const A=[
      a[0]*cosLat,
      a[1]
    ];

    const B=[
      b[0]*cosLat,
      b[1]
    ];

    const dx =
      B[0]-A[0];

    const dy =
      B[1]-A[1];

    const len2 =
      dx*dx + dy*dy;

    let t =
      len2>0
      ?
      (
        (P[0]-A[0])*dx +
        (P[1]-A[1])*dy
      ) / len2
      :
      0;

    t =
      Math.max(
        0,
        Math.min(1,t)
      );

    const px =
      A[0]+t*dx;

    const py =
      A[1]+t*dy;

    const point=[
      px/cosLat,
      py
    ];

    return {

      distanceMeters:
        Utils.distanceKm(
          p,
          point
        )*1000,

      point,

      t,

      bearing:
        Utils.bearing(a,b)

    };

  },


  interpolatePoint(a,b,t){

    return [
      a[0]+(b[0]-a[0])*t,
      a[1]+(b[1]-a[1])*t
    ];

  }

};
window.RADAR_MAP_UTILS_V101=Object.freeze({RJ_CENTER,STYLE_VECTOR,satelliteStyle,darkStyle,Utils});
})();
