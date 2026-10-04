/* Radar Seguro RJ PRO — visualização da rota v157 */
(()=>{'use strict';

if(window.RadarRouteViewV157)return;

function updateRemaining(app){
  
  
      if(
        !app.route?.coords?.length ||
        !app.map
      )
        return;
  
  
      const source=
        app.map.getSource(
          'route'
        );
  
  
      if(!source)
        return;
  
  
      const start=
        Math.max(
          0,
          Math.min(
            app.routeProgressIndex+1,
            app.route.coords.length-1
          )
        );
  
  
      const remaining=[
  
        app.userPos,
  
        ...app.route.coords.slice(
          start
        )
  
      ];
  
  
      if(remaining.length<2)
        return;
  
  
      source.setData({
  
        type:'Feature',
  
        geometry:{
  
          type:'LineString',
  
          coordinates:remaining
  
        }
  
      });
  
    
}

function draw(app,route,fit=true){
  
  
      if(
        !app.map ||
        !route
      )
        return;
  
  
      try{
  
        if(
          app.map.getLayer(
            'route-main'
          )
        )
          app.map.removeLayer(
            'route-main'
          );
  
  
        if(
          app.map.getLayer(
            'route-outline'
          )
        )
          app.map.removeLayer(
            'route-outline'
          );
  
  
        if(
          app.map.getSource(
            'route'
          )
        )
          app.map.removeSource(
            'route'
          );
  
  
        app.map.addSource(
          'route',
          {
  
            type:'geojson',
  
            data:{
  
              type:'Feature',
  
              geometry:{
                type:'LineString',
                coordinates:
                  route.coords
              }
  
            }
  
          }
        );
  
  
        app.map.addLayer({
  
          id:'route-outline',
  
          type:'line',
  
          source:'route',
  
          layout:{
  
            'line-join':'round',
  
            'line-cap':'round'
  
          },
  
          paint:{
  
            'line-color':
              '#312e81',
  
            'line-width':[
              'interpolate',
              ['linear'],
              ['zoom'],
              12,6,
              15,10,
              18,14
            ],
  
            'line-opacity':
              .95
  
          }
  
        });
  
  
        app.map.addLayer({
  
          id:'route-main',
  
          type:'line',
  
          source:'route',
  
          layout:{
  
            'line-join':'round',
  
            'line-cap':'round'
  
          },
  
          paint:{
  
            'line-color':
              '#9333ea',
  
            'line-width':[
              'interpolate',
              ['linear'],
              ['zoom'],
              12,3,
              15,6,
              18,9
            ]
  
          }
  
        });
  
  
        if(
          fit &&
          route.coords.length
        ){
  
          const bounds=
            route.coords.reduce(
  
              (b,p)=>
                b.extend(p),
  
              new maplibregl
              .LngLatBounds(
                route.coords[0],
                route.coords[0]
              )
  
            );
  
  
          app.map.fitBounds(
            bounds,
            {
  
              padding:{
                top:145,
                bottom:150,
                left:30,
                right:30
              },
  
              maxZoom:17,
  
              duration:600
  
            }
          );
  
        }
  
      }catch(e){
  
        console.warn(
          'Erro ao desenhar rota',
          e
        );
  
      }
  
    
}

function updateSummary(app){
  
  
      if(
        !app.route
      )
        return;
  
  
      document
      .getElementById(
        'sheetTime'
      )
      .textContent=
        Math.max(
          1,
          Math.round(
            app.route.duration/60
          )
        )+
        ' min';
  
  
      document
      .getElementById(
        'sheetDist'
      )
      .textContent=
        (
          app.route.distance/1000
        )
        .toFixed(1)+
        ' km • chegada prevista';
  
    
}

function renderDestination(app){
  
  
      if(
        app.destinationMarker
      ){
  
        app.destinationMarker
        .remove();
  
        app.destinationMarker=null;
  
      }
  
  
      if(
        !app.route?.coords?.length
      )
        return;
  
  
      const final=
        app.route.coords[
          app.route.coords.length-1
        ];
  
  
      const el=
        document.createElement(
          'div'
        );
  
  
      el.className=
        'finish-flag-marker';
  
  
      el.textContent='🏁';
  
  
      app.destinationMarker=
        new maplibregl.Marker({
  
          element:el,
  
          anchor:'bottom'
  
        })
        .setLngLat(final)
        .addTo(app.map);
  
    
}

window.RadarRouteViewV157=Object.freeze({
  updateRemaining,
  draw,
  updateSummary,
  renderDestination,
  version:'157'
});

})();