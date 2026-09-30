/* Radar Seguro RJ PRO — Guidance Module v1
   Única autoridade de guidance/manobras.

   Responsabilidade:
   - interpretar as instruções TomTom;
   - escolher próxima manobra;
   - atualizar HUD de navegação;
   - anunciar manobras usando announcement points TomTom;
   - anunciar chegada.

   Não faz:
   - GPS;
   - cálculo de rota;
   - map matching;
   - câmera;
   - GPT/assistente geral.

   Importante:
   - elimina os gatilhos legados fixos 350/120/35;
   - não monkeypatcha Voice.speak;
   - um único módulo decide quando falar manobras.
*/
(()=>{'use strict';

if(window.RadarGuidance)return;

const kernel=window.RadarKernel;
if(!kernel){
  console.error('[RadarGuidance] RadarKernel não carregado.');
  return;
}

let appRef=null;
let routeRef=null;
let events=[];
let lastSpeakAt=0;
let lastArrivalAt=0;

function app(){
  return appRef||window.RadarApp||window.App||null;
}

function isRoundaboutStep(step){
  const type=String(step?.maneuver?.type||'').toLowerCase();
  const mod=String(step?.maneuver?.modifier||'').toLowerCase();

  return (
    type.includes('roundabout')||
    type.includes('rotary')||
    mod.includes('roundabout')
  );
}

function isTurnStep(step){
  if(!step)return false;

  const type=String(step.maneuver?.type||'').toLowerCase();
  const mod=String(step.maneuver?.modifier||'').toLowerCase();

  if(isRoundaboutStep(step))return true;
  if(type.includes('arrive'))return true;

  return (
    mod.includes('left')||
    mod.includes('right')||
    mod.includes('uturn')||
    type.includes('turn')||
    type.includes('fork')||
    type.includes('exit')||
    type.includes('ramp')
  );
}

function maneuverIcon(step){
  const type=String(step?.maneuver?.type||'').toLowerCase();
  const mod=String(step?.maneuver?.modifier||'').toLowerCase();

  if(type.includes('arrive'))return '🏁';
  if(isRoundaboutStep(step))return '↻';
  if(mod.includes('left'))return '↰';
  if(mod.includes('right'))return '↱';
  if(mod.includes('uturn'))return '↶';
  return '↑';
}

function maneuverText(step){
  const type=String(step?.maneuver?.type||'').toLowerCase();
  const mod=String(step?.maneuver?.modifier||'').toLowerCase();

  if(type.includes('arrive'))return 'Você chegou ao destino';
  if(isRoundaboutStep(step))return 'Entre na rotatória';
  if(mod.includes('left'))return 'Vire à esquerda';
  if(mod.includes('right'))return 'Vire à direita';
  if(mod.includes('uturn'))return 'Faça o retorno';
  return 'Siga em frente';
}

function getUpcomingGuidance(a=app()){
  if(!a?.route?.steps?.length)return null;

  const steps=a.route.steps;
  let chosen=-1;

  for(
    let i=Math.max(0,Number(a.routeStepIndex||0)-1);
    i<steps.length;
    i++
  ){
    const offset=Number(steps[i].routeOffsetMeters||0);

    if(offset<Number(a.routeProgressMeters||0)-22){
      continue;
    }

    if(isTurnStep(steps[i])){
      chosen=i;
      break;
    }
  }

  if(chosen<0){
    for(let i=0;i<steps.length;i++){
      if(
        Number(steps[i].routeOffsetMeters||0)>=
        Number(a.routeProgressMeters||0)-15
      ){
        chosen=i;
        break;
      }
    }
  }

  if(chosen<0)chosen=steps.length-1;

  a.routeStepIndex=Math.max(
    Number(a.routeStepIndex||0),
    chosen
  );

  const step=steps[chosen];
  const distance=Math.max(
    0,
    Number(step.routeOffsetMeters||0)-
    Number(a.routeProgressMeters||0)
  );

  let next=null;

  for(let i=chosen+1;i<steps.length;i++){
    if(isTurnStep(steps[i])){
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
}

function isComplexManeuverArea(guidance){
  if(!guidance?.step)return false;

  if(isRoundaboutStep(guidance.step))return true;

  if(
    isTurnStep(guidance.step)&&
    guidance.distance<=180
  ){
    return true;
  }

  if(!guidance.next)return false;

  const currentOffset=Number(
    guidance.step.routeOffsetMeters||0
  );

  const nextOffset=Number(
    guidance.next.routeOffsetMeters||0
  );

  const between=nextOffset-currentOffset;

  return between>0&&between<260;
}

function isArrivalInstruction(i){
  const m=String(i?.maneuver||'').toUpperCase();
  const t=String(i?.instructionType||'').toUpperCase();

  return (
    m.startsWith('ARRIVE')||
    t==='LOCATION_ARRIVAL'
  );
}

function isDepartureInstruction(i){
  const m=String(i?.maneuver||'').toUpperCase();
  const t=String(i?.instructionType||'').toUpperCase();

  return (
    m==='DEPART'||
    t==='LOCATION_DEPARTURE'
  );
}

function rebuildEvents(route){
  routeRef=route;
  events=[];

  const instructions=
    route?.tomtomRoute?.guidance?.instructions||
    [];

  instructions.forEach((instruction,index)=>{
    if(
      isArrivalInstruction(instruction)||
      isDepartureInstruction(instruction)
    ){
      return;
    }

    const offset=Math.max(
      0,
      Number(instruction.routeOffsetInMeters)||0
    );

    const phases=[
      ['early',instruction.earlyWarningAnnouncement],
      ['main',instruction.mainAnnouncement],
      ['confirmation',instruction.confirmationAnnouncement]
    ];

    for(const [phase,announcement] of phases){
      if(
        !announcement||
        !Number.isFinite(Number(announcement.distanceInMeters))
      ){
        continue;
      }

      const distance=Math.max(
        0,
        Number(announcement.distanceInMeters)
      );

      events.push({
        id:index+':'+phase,
        index,
        phase,
        trigger:Math.max(0,offset-distance),
        offset,
        instruction,
        spoken:false
      });
    }
  });

  events.sort(
    (a,b)=>
      a.trigger-b.trigger||
      a.offset-b.offset
  );

  kernel.emit('guidance:rebuilt',{
    count:events.length
  });
}

function roundedDistance(meters){
  const m=Math.max(0,Math.round(meters));

  if(m<100)return Math.max(10,Math.round(m/10)*10);
  if(m<1000)return Math.max(50,Math.round(m/50)*50);
  return Math.round(m/100)*100;
}

function instructionText(event,progress){
  const instruction=event?.instruction||{};

  const base=String(
    (
      event.phase==='early'&&
      instruction.combinedMessage
    )||
    instruction.message||
    ''
  ).trim();

  if(!base)return '';

  if(event.phase==='confirmation'){
    return base;
  }

  const remain=Math.max(
    0,
    event.offset-progress
  );

  const distance=roundedDistance(remain);

  if(distance<=0)return base;

  if(
    distance>=1000&&
    distance%1000===0
  ){
    const km=distance/1000;

    return (
      'Em '+
      km+
      ' quilômetro'+
      (km===1?'':'s')+
      ', '+
      base.charAt(0).toLowerCase()+
      base.slice(1)
    );
  }

  return (
    'Em '+
    distance+
    ' metros, '+
    base.charAt(0).toLowerCase()+
    base.slice(1)
  );
}

function speak(text,priority=true){
  if(!text)return false;

  try{
    window.Voice?.speak?.(
      text,
      priority
    );

    lastSpeakAt=Date.now();

    kernel.emit('guidance:spoken',{text});
    return true;

  }catch(error){
    console.warn('[RadarGuidance] voice:',error);
    return false;
  }
}

function markPassed(progress){
  for(const event of events){
    if(
      !event.spoken&&
      progress>event.offset+40
    ){
      event.spoken=true;
    }
  }
}

function announceDue(a){
  if(
    !a?.navActive||
    !a.route||
    a.rerouting
  ){
    return;
  }

  if(
    !a.route.tomtomRoute||
    a.route.engine!=='tomtom'
  ){
    return;
  }

  if(a.route!==routeRef){
    rebuildEvents(a.route);
  }

  if(!events.length)return;

  const progress=Math.max(
    0,
    Number(a.routeProgressMeters)||0
  );

  markPassed(progress);

  if(Date.now()-lastSpeakAt<900){
    return;
  }

  const due=events.filter(event=>
    !event.spoken&&
    progress+8>=event.trigger&&
    progress<=event.offset+30
  );

  if(!due.length)return;

  const firstOffset=Math.min(
    ...due.map(event=>event.offset)
  );

  const sameTurn=due
    .filter(event=>
      Math.abs(event.offset-firstOffset)<3
    )
    .sort(
      (a,b)=>b.trigger-a.trigger
    );

  const chosen=sameTurn[0];

  for(const event of events){
    if(
      event.index===chosen.index&&
      event.trigger<=chosen.trigger+1
    ){
      event.spoken=true;
    }
  }

  const text=instructionText(
    chosen,
    progress
  );

  if(text)speak(text,true);
}

function updateHUD(a,guidance){
  if(!guidance?.step)return;

  const step=guidance.step;
  const next=guidance.next;
  const distM=Math.round(guidance.distance);

  a.activeGuidanceStep=guidance.index;

  const dist=document.getElementById('hudDist');
  if(dist){
    dist.textContent=
      distM<1000
        ?distM+' m'
        :(distM/1000).toFixed(1)+' km';
  }

  const street=document.getElementById('hudStreet');
  if(street){
    street.textContent=
      step.name||
      'Siga pela via';
  }

  const arrow=document.getElementById('hudArrow');
  if(arrow){
    arrow.textContent=
      maneuverIcon(step);
  }

  const road=document.getElementById('currentRoadPill');
  if(road){
    road.textContent=
      step.name||
      'Via atual';
  }

  const nextIcon=document.getElementById('hudNextIcon');
  const nextStreet=document.getElementById('hudNextStreet');

  if(next){
    if(nextIcon){
      nextIcon.textContent=
        maneuverIcon(next);
    }

    if(nextStreet){
      nextStreet.textContent=
        next.name||
        'próximo acesso';
    }
  }else if(nextStreet){
    nextStreet.textContent='Destino';
  }
}

function announceArrival(a){
  if(
    !a?.navActive||
    !a.destination||
    !a.userPos
  ){
    return;
  }

  if(a.lastArrivalAnnounced)return;

  let distance=Infinity;

  try{
    distance=
      Utils.distanceKm(
        a.userPos,
        a.destination
      )*1000;
  }catch(_){}

  if(
    distance<28&&
    Number(a.currentSpeed||0)<12&&
    Date.now()-lastArrivalAt>3000
  ){
    a.lastArrivalAnnounced=true;
    lastArrivalAt=Date.now();

    speak(
      'Você chegou ao seu destino.',
      true
    );

    try{
      a.toast?.(
        '🏁 Você chegou ao destino.'
      );
    }catch(_){}
  }
}

function update(){
  const a=app();

  if(
    !a?.navActive||
    !a.route||
    !a.userPos||
    a.rerouting
  ){
    return false;
  }

  const guidance=
    getUpcomingGuidance(a);

  if(!guidance?.step){
    return false;
  }

  updateHUD(a,guidance);
  announceDue(a);
  announceArrival(a);

  return true;
}

function repeat(){
  const a=app();

  if(!a?.route){
    return 'Não existe uma rota ativa.';
  }

  const guidance=
    getUpcomingGuidance(a);

  if(!guidance?.step){
    return 'A próxima orientação ainda não está disponível.';
  }

  const street=
    guidance.step.name
      ?' na '+guidance.step.name
      :'';

  const phrase=
    maneuverText(guidance.step)+
    street;

  return guidance.distance>180
    ?'Em '+
      Math.round(guidance.distance/10)*10+
      ' metros, '+
      phrase.toLocaleLowerCase('pt-BR')+
      '.'
    :phrase+'.';
}

function bindApp(){
  const a=window.RadarApp||window.App||null;
  if(!a)return false;

  appRef=a;

  if(a.__radarGuidanceV1Bound)return true;
  a.__radarGuidanceV1Bound=true;

  a.maneuverIcon=step=>
    maneuverIcon(step);

  a.maneuverText=step=>
    maneuverText(step);

  a.isRoundaboutStep=step=>
    isRoundaboutStep(step);

  a.isTurnStep=step=>
    isTurnStep(step);

  a.getUpcomingGuidance=()=>
    getUpcomingGuidance(a);

  a.isComplexManeuverArea=guidance=>
    isComplexManeuverArea(guidance);

  a.updateNavigation=()=>
    update();

  kernel.emit('guidance:bound',{
    module:'guidance-v1'
  });

  return true;
}

const api={
  version:'1.0.0',
  update,
  repeat,
  rebuild:rebuildEvents,
  getUpcoming:getUpcomingGuidance,
  maneuverIcon,
  maneuverText,
  isRoundaboutStep,
  isTurnStep,
  isComplexManeuverArea,
  events:()=>events.map(event=>({
    id:event.id,
    index:event.index,
    phase:event.phase,
    trigger:event.trigger,
    offset:event.offset,
    spoken:event.spoken
  })),
  bindApp
};

window.RadarGuidance=Object.freeze(api);

const registration=
  kernel.registerModule({
    name:'guidance-v1',
    version:'1.0.0',
    owns:['navigation.guidance'],

    async start({resources}){
      const id=resources.interval(()=>{
        if(bindApp()){
          clearInterval(id);
        }
      },100);

      /*
        500 ms é suficiente para guidance veicular e reduz a frequência
        do antigo loop de 220 ms.
      */
      resources.interval(()=>{
        update();
      },500);

      return api;
    },

    async stop(){
      events=[];
      routeRef=null;
    }
  });

registration.start().catch(error=>{
  console.error('[RadarGuidance] falha ao iniciar módulo:',error);
});

})();