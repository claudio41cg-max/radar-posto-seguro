/* Radar Seguro RJ PRO v141 — recalculo/fora da rota extraidos do index.html */
window.RadarRerouteV141 = {

  isRoundaboutSoon(){

    const guidance=
      this.getUpcomingGuidance();


    if(
      !guidance?.step
    )
      return false;


    return (
      this.isRoundaboutStep(
        guidance.step
      ) &&
      guidance.distance<=180
    );

  },


  checkOffRoute(match){

    if(
      !this.navActive ||
      !this.route ||
      !this.userPos ||
      this.rerouting
    )
      return;


    if(this.currentSpeed<4){

      this.offRouteHits=0;

      return;

    }


    /*
      UMA LEITURA RUIM NÃO PODE
      FORÇAR RECÁLCULO.
    */
    if(this.currentAccuracy>55)
      return;


    let threshold=
      Math.max(
        28,
        Math.min(
          48,
          24+
          this.currentAccuracy*.38
        )
      );


    if(this.isRoundaboutSoon())
      threshold=60;


    if(match.distance>threshold){

      this.offRouteHits++;

    }else{

      this.offRouteHits=0;

      return;

    }


    const now=
      Date.now();


    if(
      now-
      this.lastRerouteAt<
      2500
    )
      return;


    const requiredHits=
      this.currentAccuracy<=20
      ?
      2
      :
      3;


    const clearlyAway=
      match.distance>
      Math.max(
        75,
        this.currentAccuracy*2+
        30
      );


    if(
      clearlyAway ||
      this.offRouteHits>=
      requiredHits
    ){

      this.offRouteHits=0;

      this.recalculateRoute();

    }

  },

  async recalculateRoute(){

    if(
      !this.destination ||
      !this.userPos ||
      this.rerouting
    )
      return;


    this.rerouting=true;

    this.lastRerouteAt=
      Date.now();


    Voice.clear();


    this.toast(
      'Atualizando rota...'
    );


    try{

      const routeOrigin=
        this.filteredPos ||
        this.rawUserPos ||
        this.userPos;


      const newRoute=
        await this.getRoute(
          routeOrigin,
          this.destination
        );


      this.route=
        newRoute;


      this.routeProgressIndex=0;

      this.routeProgressMeters=0;

      this.lastTrustedProgressMeters=0;

      this.lastTrustedSpeed=0;

      this.routeStepIndex=0;

      this.activeGuidanceStep=-1;

      this.lastGuidanceStep=-1;

      this.announced={};


      this.drawRoute(
        newRoute,
        false
      );


      this.updateRouteSummary();

      this.renderDestinationFlag();

      this.fetchHazardsAlongRoute();


      this.toast(
        'Rota atualizada.'
      );


      setTimeout(
        ()=>this.updateNavigation(),
        350
      );

    }catch(e){

      console.warn(
        'Falha no recálculo',
        e
      );


      this.toast(
        'Não foi possível atualizar a rota.'
      );

    }finally{

      this.rerouting=false;

    }

  },



};
