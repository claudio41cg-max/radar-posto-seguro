/* Radar Seguro RJ PRO v140 — desenho e resumo de rota extraidos do index.html */
window.RadarRouteDrawingV140 = {

  updateRemainingRouteLine(){

    if(
      !this.route?.coords?.length ||
      !this.map
    )
      return;


    const source=
      this.map.getSource(
        'route'
      );


    if(!source)
      return;


    const start=
      Math.max(
        0,
        Math.min(
          this.routeProgressIndex+1,
          this.route.coords.length-1
        )
      );


    const remaining=[

      this.userPos,

      ...this.route.coords.slice(
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

  },


  drawRoute(route,fit=true){

    if(
      !this.map ||
      !route
    )
      return;


    try{

      if(
        this.map.getLayer(
          'route-main'
        )
      )
        this.map.removeLayer(
          'route-main'
        );


      if(
        this.map.getLayer(
          'route-outline'
        )
      )
        this.map.removeLayer(
          'route-outline'
        );


      if(
        this.map.getSource(
          'route'
        )
      )
        this.map.removeSource(
          'route'
        );


      this.map.addSource(
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


      this.map.addLayer({

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


      this.map.addLayer({

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


        this.map.fitBounds(
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

  },


  updateRouteSummary(){

    if(
      !this.route
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
          this.route.duration/60
        )
      )+
      ' min';


    document
    .getElementById(
      'sheetDist'
    )
    .textContent=
      (
        this.route.distance/1000
      )
      .toFixed(1)+
      ' km • chegada prevista';

  },


  renderDestinationFlag(){

    if(
      this.destinationMarker
    ){

      this.destinationMarker
      .remove();

      this.destinationMarker=null;

    }


    if(
      !this.route?.coords?.length
    )
      return;


    const final=
      this.route.coords[
        this.route.coords.length-1
      ];


    const el=
      document.createElement(
        'div'
      );


    el.className=
      'finish-flag-marker';


    el.textContent='🏁';


    this.destinationMarker=
      new maplibregl.Marker({

        element:el,

        anchor:'bottom'

      })
      .setLngLat(final)
      .addTo(this.map);

  },



};
