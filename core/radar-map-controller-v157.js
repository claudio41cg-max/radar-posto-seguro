/* Radar Seguro RJ PRO — controlador visual do mapa v157 */
(()=>{'use strict';

if(window.RadarMapControllerV157)return;

function createMap(app,deps){
  const RJ_CENTER=deps.RJ_CENTER;
  
  
      app.appliedTheme=
        app.themeMode==='auto'
        ? app.automaticThemeNow()
        : app.themeMode;
  
      app.map=
        new maplibregl.Map({
  
          container:'map',
  
          center:RJ_CENTER,
  
          zoom:11,
  
          pitch:0,
  
          bearing:0,
  
          maxPitch:70,
  
          maxZoom:18,
  
          attributionControl:false,
  
          style:
            app.getThemeStyle(
              app.themeMode
            ),
  
          antialias:true,
  
          renderWorldCopies:false
  
        });
  
  
      app.map.addControl(
        new maplibregl.AttributionControl({
          compact:true
        }),
        'bottom-left'
      );
  
  
      app.map.on(
        'style.load',
        ()=>{
  
          app.improveVectorMap();
  
          app.add3DBuildings();
  
          app.addTomTomTrafficLayer();
  
          app.addCommunityLayers();
  
  
          if(
            app.route
          ){
  
            app.drawRoute(
              app.route,
              false
            );
  
          }
  
        }
      );
  
  
      app.map.once(
        'load',
        ()=>{
  
          app.startGPS();
  
        }
      );
  
  
      const pauseFollow=()=>{
        app.followMode=false;
  
  
        clearTimeout(
          app.manualFollowTimer
        );
  
  
        app.manualFollowTimer=
          setTimeout(
            ()=>{
  
              app.followMode=true;
  
              app.updateCamera();
  
            },
            10000
          );
  
      };
  
  
      app.map.on(
        'dragstart',
        e=>{
          if(e.originalEvent)
            pauseFollow();
        }
      );
  
  
      app.map.on(
        'zoomstart',
        e=>{
          if(e.originalEvent)
            pauseFollow();
        }
      );
  
  
      app.map.on(
        'rotatestart',
        e=>{
          if(e.originalEvent)
            pauseFollow();
        }
      );
  
    
}

function improveVectorMap(app){
  
  
      try{
  
        const style=
          app.map.getStyle();
  
  
        for(
          const layer
          of style.layers||[]
        ){
  
          /*
            Aumenta levemente o contraste dos nomes.
          */
          if(
            layer.type==='symbol'
          ){
  
            try{
  
              if(
                layer.layout &&
                layer.layout['text-field']
              ){
  
                app.map.setPaintProperty(
                  layer.id,
                  'text-halo-width',
                  1.25
                );
  
                app.map.setPaintProperty(
                  layer.id,
                  'text-halo-blur',
                  .4
                );
  
              }
  
            }catch(e){}
  
          }
  
        }
  
      }catch(e){}
  
    
}

function cleanupGlobalTraffic(app){
  
  
      /*
        A camada global de trânsito foi aposentada.
        O Radar usa somente o trânsito real aplicado ao trecho da rota
        por route-traffic-v74.js, evitando sobreposição e disputa visual.
      */
      try{
  
        if(
          app.map.getLayer(
            'tomtom-traffic-flow'
          )
        )
          app.map.removeLayer(
            'tomtom-traffic-flow'
          );
  
        if(
          app.map.getSource(
            'tomtom-traffic'
          )
        )
          app.map.removeSource(
            'tomtom-traffic'
          );
  
      }catch(e){
  
        console.warn(
          'Falha ao limpar camada global de trânsito.',
          e
        );
  
      }
  
    
}

function add3DBuildings(app){
  
  
      try{
  
        if(
          app.map.getLayer(
            'radar-3d-buildings'
          )
        )
          return;
  
  
        const style=
          app.map.getStyle();
  
  
        const vectorSource=
          Object.entries(
            style.sources||{}
          )
          .find(
            ([id,s])=>
              s.type==='vector'
          );
  
  
        if(
          !vectorSource
        )
          return;
  
  
        app.map.addLayer({
  
          id:'radar-3d-buildings',
  
          source:
            vectorSource[0],
  
          'source-layer':
            'building',
  
          type:'fill-extrusion',
  
          minzoom:15.2,
  
          paint:{
  
            'fill-extrusion-color':[
              'interpolate',
              ['linear'],
              ['zoom'],
              15.2,
              '#d6d3d1',
              18,
              '#a8a29e'
            ],
  
            'fill-extrusion-height':[
              'coalesce',
              ['get','render_height'],
              ['get','height'],
              8
            ],
  
            'fill-extrusion-base':[
              'coalesce',
              ['get','render_min_height'],
              ['get','min_height'],
              0
            ],
  
            'fill-extrusion-opacity':
              .62
  
          }
  
        });
  
      }catch(e){
  
        console.warn(
          'Prédios 3D não disponíveis nesta região.'
        );
  
      }
  
    
}

window.RadarMapControllerV157=Object.freeze({
  createMap,
  improveVectorMap,
  cleanupGlobalTraffic,
  add3DBuildings,
  version:'157'
});

})();