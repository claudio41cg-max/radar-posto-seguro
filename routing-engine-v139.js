/* Radar Seguro RJ PRO v139 — motor de rota extraido do index.html */
window.RadarRoutingV139 = {

  async fetchTomTomRoute(a,b){

    const mode=
      this.transportMode===
      'motorcycle'
      ?
      'motorcycle'
      :
      'car';


    const path=
`/routing/1/calculateRoute/${a[1]},${a[0]}:${b[1]},${b[0]}/json?traffic=true&travelMode=${mode}&instructionsType=text&language=pt-BR&routeType=fastest&avoid=unpavedRoads&computeTravelTimeFor=all&maxAlternatives=2`;
    const url='https://radar-seguro-ia-rj.claudio41cg.workers.dev/v1/tomtom?path='+encodeURIComponent(path);


    const controller=
      new AbortController();


    const timeout=
      setTimeout(
        ()=>controller.abort(),
        7000
      );


    try{

      const r=
        await fetch(
          url,
          {
            signal:
              controller.signal
          }
        );


      if(!r.ok)
        throw new Error(
          'TomTom HTTP '+
          r.status
        );


      const j=
        await r.json();


      if(
        !j.routes?.length
      )
        throw new Error(
          'TomTom sem rota'
        );


      const rt=
        j.routes[0];


      const coords=
        rt.legs
        .flatMap(
          leg=>
            leg.points
            .map(
              p=>[
                p.longitude,
                p.latitude
              ]
            )
        );


      const steps=
        (
          rt.guidance
          ?.instructions
          ||
          []
        )
        .map(i=>({

          name:
            i.street ||
            i.roadNumbers?.[0] ||
            'Siga pela via',

          maneuver:{

            type:
              i.maneuver ||
              '',

            modifier:
              this.tomTomModifier(
                i.maneuver
              ),

            location:[
              i.point.longitude,
              i.point.latitude
            ]

          },

          routeOffsetMeters:
            Number(
              i.routeOffsetInMeters
            )||0

        }));


      const route={

        coords,

        steps,

        distance:
          rt.summary
          .lengthInMeters,

        duration:
          rt.summary
          .travelTimeInSeconds,

        trafficDelaySeconds:Number(rt.summary?.trafficDelayInSeconds||0),
        liveTraffic:true,
        engine:'tomtom'

      };


      this.prepareRouteGeometry(
        route
      );


      return route;


    }finally{

      clearTimeout(
        timeout
      );

    }

  },


  tomTomModifier(type){

    const t=
      String(type||'')
      .toUpperCase();


    if(
      t.includes('LEFT')
    )
      return 'left';


    if(
      t.includes('RIGHT')
    )
      return 'right';


    if(
      t.includes('ROUNDABOUT')
    )
      return 'roundabout';


    if(
      t.includes('UTURN')
    )
      return 'uturn';


    return 'straight';

  },


/* =========================================================
   OSRM FALLBACK
========================================================= */

  async fetchOSRMRoute(a,b){

    const controller=
      new AbortController();


    const timeout=
      setTimeout(
        ()=>controller.abort(),
        5000
      );


    try{

      const url=
`https://router.project-osrm.org/route/v1/driving/${a[0]},${a[1]};${b[0]},${b[1]}?overview=full&geometries=geojson&steps=true&alternatives=false`;


      const r=
        await fetch(
          url,
          {
            signal:
              controller.signal
          }
        );


      if(!r.ok)
        throw new Error(
          'OSRM'
        );


      const j=
        await r.json();


      if(
        !j.routes?.length
      )
        throw new Error(
          'Sem rota'
        );


      const rt=
        j.routes[0];


      const steps=
        (
          rt.legs||[]
        )
        .flatMap(
          leg=>
            leg.steps||[]
        )
        .map(s=>({

          name:
            s.name ||
            'Siga pela via',

          maneuver:{

            type:
              s.maneuver?.type ||
              '',

            modifier:
              s.maneuver?.modifier ||
              'straight',

            location:
              s.maneuver?.location ||
              rt.geometry.coordinates[0]

          }

        }));


      const route={

        coords:
          rt.geometry.coordinates,

        steps,

        distance:
          rt.distance,

        duration:
          rt.duration,

        engine:'osrm'

      };


      this.prepareRouteGeometry(
        route
      );


      return route;


    }finally{

      clearTimeout(
        timeout
      );

    }

  },


  async getRoute(a,b){

    try{

      return await
        this.fetchTomTomRoute(
          a,b
        );

    }catch(e){

      console.warn(
        'TomTom falhou. Usando OSRM.',
        e
      );


      return await
        this.fetchOSRMRoute(
          a,b
        );

    }

  },


/* =========================================================
   CALCULAR ROTA
========================================================= */

  async calculateRoute(){

    if(
      !this.userPos
    ){

      this.toast(
        'Aguardando localização GPS.'
      );

      return;

    }


    if(
      !this.destination
    )
      return;


    this.toast(
      'Calculando melhor rota...'
    );


    try{

      const route=
        await this.getRoute(
          this.userPos,
          this.destination
        );


      this.route=route;

      this.routeProgressIndex=0;

      this.routeProgressMeters=0;

      this.lastTrustedProgressMeters=0;

      this.lastTrustedSpeed=0;

      this.routeStepIndex=0;

      this.activeGuidanceStep=-1;

      this.lastGuidanceStep=-1;

      this.announced={};


      this.drawRoute(
        route,
        true
      );


      this.renderDestinationFlag();

      this.updateRouteSummary();

      this.checkDestinationCommunity();

    }catch(e){

      console.error(e);


      this.toast(
        'Não foi possível calcular a rota.'
      );

    }

  },



};
