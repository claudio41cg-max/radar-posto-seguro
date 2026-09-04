/* Radar Seguro RJ PRO v142 — manobras e orientacao da navegacao extraidas do index.html */
window.RadarNavigationGuidanceV142 = {

  maneuverIcon(step){

    const m=
      step?.maneuver||{};


    const type=
      String(
        m.type||''
      )
      .toLowerCase();


    const mod=
      String(
        m.modifier||''
      )
      .toLowerCase();


    if(
      type.includes('arrive')
    )
      return '🏁';


    if(
      this.isRoundaboutStep(step)
    )
      return '↻';


    if(
      mod.includes('left')
    )
      return '↰';


    if(
      mod.includes('right')
    )
      return '↱';


    if(
      mod.includes('uturn')
    )
      return '↶';


    return '↑';

  },


  maneuverText(step){

    const m=
      step?.maneuver||{};


    const type=
      String(
        m.type||''
      )
      .toLowerCase();


    const mod=
      String(
        m.modifier||''
      )
      .toLowerCase();


    if(
      type.includes('arrive')
    )
      return 'Você chegou ao destino';


    if(
      this.isRoundaboutStep(step)
    )
      return 'Entre na rotatória';


    if(
      mod.includes('left')
    )
      return 'Vire à esquerda';


    if(
      mod.includes('right')
    )
      return 'Vire à direita';


    if(
      mod.includes('uturn')
    )
      return 'Faça o retorno';


    return 'Siga em frente';

  },


  isRoundaboutStep(step){

    const type=
      String(
        step?.maneuver?.type||''
      )
      .toLowerCase();


    const mod=
      String(
        step?.maneuver?.modifier||''
      )
      .toLowerCase();


    return (
      type.includes('roundabout') ||
      type.includes('rotary') ||
      mod.includes('roundabout')
    );

  },


  isTurnStep(step){

    if(!step)
      return false;


    const type=
      String(
        step.maneuver?.type||''
      )
      .toLowerCase();


    const mod=
      String(
        step.maneuver?.modifier||''
      )
      .toLowerCase();


    if(
      this.isRoundaboutStep(step)
    )
      return true;


    if(
      type.includes('arrive')
    )
      return true;


    return (
      mod.includes('left') ||
      mod.includes('right') ||
      mod.includes('uturn') ||
      type.includes('turn') ||
      type.includes('fork') ||
      type.includes('exit') ||
      type.includes('ramp')
    );

  },


/*
  DESCOBRE QUAL É A PRÓXIMA MANOBRA
  USANDO O PROGRESSO AO LONGO DA ROTA,
  NÃO A DISTÂNCIA EM LINHA RETA.
*/
  getUpcomingGuidance(){

    if(
      !this.route?.steps?.length
    )
      return null;


    const steps=
      this.route.steps;


    let chosen=-1;


    for(
      let i=
        Math.max(
          0,
          this.routeStepIndex-1
        );
      i<steps.length;
      i++
    ){

      const offset=
        steps[i]
        .routeOffsetMeters||0;


      /*
        MANOBRA JÁ FICOU PARA TRÁS.
      */
      if(
        offset<
        this.routeProgressMeters-22
      ){

        continue;

      }


      /*
        PRIORIZA MANOBRAS REAIS.
      */
      if(
        this.isTurnStep(
          steps[i]
        )
      ){

        chosen=i;

        break;

      }

    }


    /*
      SE NÃO HOUVER MANOBRA ESPECIAL,
      PEGA A PRÓXIMA INSTRUÇÃO.
    */
    if(
      chosen<0
    ){

      for(
        let i=0;
        i<steps.length;
        i++
      ){

        if(
          (
            steps[i]
            .routeOffsetMeters||0
          )>=
          this.routeProgressMeters-15
        ){

          chosen=i;

          break;

        }

      }

    }


    if(
      chosen<0
    )
      chosen=
        steps.length-1;


    this.routeStepIndex=
      Math.max(
        this.routeStepIndex,
        chosen
      );


    const step=
      steps[chosen];


    const distance=
      Math.max(
        0,
        (
          step.routeOffsetMeters||0
        )-
        this.routeProgressMeters
      );


    let next=null;


    for(
      let i=chosen+1;
      i<steps.length;
      i++
    ){

      if(
        this.isTurnStep(
          steps[i]
        )
      ){

        next=steps[i];

        break;

      }

    }


    return {

      index:chosen,

      step,

      distance,

      next

    };

  },


/*
  VERIFICA SE EXISTEM DUAS MANOBRAS
  MUITO PRÓXIMAS. NESTE CASO,
  PARA DE FALAR "A 200/300 METROS".
*/
  isComplexManeuverArea(guidance){

    if(
      !guidance?.step
    )
      return false;


    if(
      this.isRoundaboutStep(
        guidance.step
      )
    )
      return true;


    /*
      CURVA JÁ PRÓXIMA: FALA SOMENTE
      A MANOBRA, SEM CONTAGEM LONGA.
    */
    if(
      this.isTurnStep(
        guidance.step
      ) &&
      guidance.distance<=180
    )
      return true;


    if(
      !guidance.next
    )
      return false;


    const currentOffset=
      guidance.step
      .routeOffsetMeters||0;


    const nextOffset=
      guidance.next
      .routeOffsetMeters||0;


    const between=
      nextOffset-currentOffset;


    return (
      between>0 &&
      between<260
    );

  },


/* =========================================================
   NAVEGAÇÃO
========================================================= */

  updateNavigation(){

    if(
      !this.navActive ||
      !this.route ||
      !this.userPos ||
      this.rerouting
    )
      return;


    const guidance=
      this.getUpcomingGuidance();


    if(
      !guidance?.step
    )
      return;


    const step=
      guidance.step;


    const next=
      guidance.next;


    const distM=
      Math.round(
        guidance.distance
      );


    this.activeGuidanceStep=
      guidance.index;


    document
    .getElementById(
      'hudDist'
    )
    .textContent=
      distM<1000
      ?
      distM+' m'
      :
      (
        distM/1000
      )
      .toFixed(1)+
      ' km';


    document
    .getElementById(
      'hudStreet'
    )
    .textContent=
      step.name||
      'Siga pela via';


    document
    .getElementById(
      'hudArrow'
    )
    .textContent=
      this.maneuverIcon(
        step
      );


    document
    .getElementById(
      'currentRoadPill'
    )
    .textContent=
      step.name||
      'Via atual';


    if(next){

      document
      .getElementById(
        'hudNextIcon'
      )
      .textContent=
        this.maneuverIcon(
          next
        );


      document
      .getElementById(
        'hudNextStreet'
      )
      .textContent=
        next.name||
        'próximo acesso';

    }else{

      document
      .getElementById(
        'hudNextStreet'
      )
      .textContent=
        'Destino';

    }


    /*
      NÃO FALA PARADO.
    */
    if(
      this.currentSpeed<4.5
    )
      return;


    const phrase=
      this.maneuverText(
        step
      );


    const street=
      (
        step.name &&
        !String(
          step.name
        )
        .toLowerCase()
        .includes(
          'siga pela via'
        )
      )
      ?
      ' na '+
      step.name
      :
      '';


    const complex=
      this.isComplexManeuverArea(
        guidance
      );


    /*
      ================================================
      NOVA LÓGICA DE VOZ
      ================================================

      ÁREA NORMAL:
      350 m
      120 m
      35 m

      CURVA PRÓXIMA / ROTATÓRIA /
      VÁRIAS MANOBRAS JUNTAS:
      NÃO FALA 350 / 200 / 120.
      ESPERA CHEGAR PERTO E FALA A MANOBRA.
    */


    if(complex){

      const key=
        'complex-'+
        guidance.index;


      /*
        FALA UMA ÚNICA VEZ,
        PERTO DA MANOBRA.
      */
      if(
        distM<=75 &&
        !this.announced[key]
      ){

        const now=
          Date.now();


        if(
          now-
          this.lastStepVoiceAt>
          2200
        ){

          this.announced[key]=true;

          this.lastStepVoiceAt=now;


          Voice.speak(
            phrase+
            street+
            '.',
            true
          );

        }

      }

    }else{

      const thresholds=[
        350,
        120,
        35
      ];


      for(
        const t
        of thresholds
      ){

        const key=
          guidance.index+
          '-'+
          t;


        if(
          distM<=t &&
          !this.announced[key]
        ){

          /*
            NÃO ANUNCIA 350 SE O GPS
            COMEÇOU A NAVEGAÇÃO JÁ PERTO.
          */
          if(
            t===350 &&
            distM<220
          ){

            this.announced[key]=true;

            continue;

          }


          const now=
            Date.now();


          if(
            now-
            this.lastStepVoiceAt<
            2400
          )
            break;


          this.announced[key]=true;

          this.lastStepVoiceAt=now;


          if(
            t===35
          ){

            Voice.speak(
              phrase+
              street+
              '.',
              true
            );

          }else{

            const spokenDistance=
              Math.max(
                50,
                Math.round(
                  distM/50
                )*50
              );

            Voice.speak(
              'Em '+
              spokenDistance+
              ' metros, '+
              phrase.toLowerCase()+
              street+
              '.'
            );

          }


          break;

        }

      }

    }


    /*
      CHEGADA.
    */
    if(
      this.destination
    ){

      const destinationDistance=
        Utils.distanceKm(
          this.userPos,
          this.destination
        )*1000;


      if(
        destinationDistance<28 &&
        this.currentSpeed<12 &&
        !this.lastArrivalAnnounced
      ){

        this.lastArrivalAnnounced=true;


        Voice.speak(
          'Você chegou ao seu destino.',
          true
        );


        this.toast(
          '🏁 Você chegou ao destino.'
        );

      }

    }

  },



};
