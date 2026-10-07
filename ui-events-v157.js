/* Radar Seguro RJ PRO — ligações de interface v157 */
(()=>{'use strict';

if(window.RadarUIEventsV157)return;

function bind(app,deps={}){
  const VoiceAssistant=deps.VoiceAssistant;
  const Voice=deps.Voice;
  const FuelModule=deps.FuelModule;

  
  
      const on=
        (id,event,fn)=>{
  
          const el=
            document.getElementById(
              id
            );
  
  
          if(el)
            el.addEventListener(
              event,
              fn
            );
  
        };
  
  
      const input=
        document.getElementById(
          'destInput'
        );
  
  
      input.addEventListener(
        'input',
        ()=>{
  
          clearTimeout(
            app.geocodeTimer
          );
  
  
          app.destination=null;
  
  
          const q=
            input.value.trim();
  
  
          if(
            q.length<3
          ){
  
            document
            .getElementById(
              'suggest'
            )
            .classList.remove(
              'show'
            );
  
  
            return;
  
          }
  
  
          app.geocodeTimer=
            setTimeout(
              async ()=>{
  
                try{
  
                  const r=
                    await app.searchAddress(
                      q
                    );
  
  
                  app.renderSuggestions(
                    r
                  );
  
                }catch(e){
  
                  if(
                    e.name!==
                    'AbortError'
                  ){
  
                    app.toast(
                      'Falha na busca.'
                    );
  
                  }
  
                }
  
              },
              650
            );
  
        }
      );
  
  
      input.addEventListener(
        'keydown',
        e=>{
  
          if(
            e.key==='Enter'
          )
            document
            .getElementById(
              'searchBtn'
            )
            .click();
  
        }
      );
  
  
      on(
        'searchBtn',
        'click',
        async ()=>{
  
          const text=
            input.value.trim();
  
  
          if(!text){
  
            app.toast(
              'Digite um destino.'
            );
  
            return;
  
          }
  
  
          if(
            !app.destination
          ){
  
            try{
  
              const r=
                await app.searchAddress(
                  text
                );
  
  
              if(
                !r.length
              ){
  
                app.toast(
                  'Local não encontrado.'
                );
  
                return;
  
              }
  
  
              app.destination=[
                r[0].lon,
                r[0].lat
              ];
  
  
              input.value=
                r[0].display;
  
            }catch(e){
  
              return;
  
            }
  
          }
  
  
          const route=
            await app.calculateRoute();

          if(
            route&&
            app.route
          ){
            app.showRoutePanel();
          }
  
        }
      );
  
  
      on(
        'clearBtn',
        'click',
        ()=>{
  
          input.value='';
  
  
          document
          .getElementById(
            'suggest'
          )
          .classList.remove(
            'show'
          );
  
  
          app.clearRoute();
  
        }
      );
  
  
      on(
        'assistantMicBtn',
        'click',
        ()=>VoiceAssistant.toggle()
      );
  
  
      on(
        'navAssistantMicBtn',
        'click',
        ()=>VoiceAssistant.toggleHandsFree()
      );
  
  
      on(
        'startRadarBtn',
        'click',
        ()=>app.startNavigation()
      );
  
  
      on(
        'stopNavBtn',
        'click',
        ()=>app.clearRoute()
      );
  
  
      on(
        'locateBtn',
        'click',
        ()=>app.recenter()
      );
  
  
      on(
        'navRecenterLeft',
        'click',
        ()=>app.recenter()
      );
  
  
      on(
        'btnRecenter',
        'click',
        ()=>app.recenter()
      );
  
  
      on(
        'northBtn',
        'click',
        ()=>{
  
          app.followMode=false;
  
  
          window.RadarMapMotionV157.easeTo(app.map,{
  
            bearing:0,
  
            pitch:0,
  
            duration:500
  
          });
  
        }
      );
  
  
      on(
        'zoomIn',
        'click',
        ()=>app.map.zoomIn()
      );
  
  
      on(
        'zoomOut',
        'click',
        ()=>app.map.zoomOut()
      );
  
  
      on(
        'soundBtn',
        'click',
        ()=>{
  
          Voice.enabled=
            !Voice.enabled;
  
  
          const b=
            document.getElementById(
              'soundBtn'
            );
  
  
          b.textContent=
            Voice.enabled
            ?
            '🔊'
            :
            '🔇';
  
  
          b.classList.toggle(
            'active-sound',
            Voice.enabled
          );
  
  
          b.classList.toggle(
            'muted-sound',
            !Voice.enabled
          );
  
  
          if(
            !Voice.enabled
          )
            Voice.clear();
  
  
          app.toast(
            Voice.enabled
            ?
            'Voz ativada'
            :
            'Voz silenciada'
          );
  
        }
      );
  
  
      const toggleCommunities=()=>{
  
          app.communityVisible=
            !app.communityVisible;
  
  
          [
            'communityChip',
            'navCommunityChip'
          ].forEach(id=>
            document
            .getElementById(id)
            ?.classList.toggle(
              'active',
              app.communityVisible
            )
          );
  
  
          app.setCommunityVisibility(
            app.communityVisible
          );
  
        };
  
  
      on(
        'communityChip',
        'click',
        toggleCommunities
      );
  
  
      on(
        'navCommunityChip',
        'click',
        toggleCommunities
      );
  
  
      on(
        'fuelChip',
        'click',
        ()=>{
  
          document
          .getElementById(
            'fuelFilterModal'
          )
          .classList.add(
            'show'
          );
  
        }
      );
  
  
      on(
        'navFuelChip',
        'click',
        ()=>{
  
          document
          .getElementById(
            'fuelFilterModal'
          )
          .classList.add(
            'show'
          );
  
        }
      );
  
  
      on(
        'filterAll',
        'click',
        ()=>{
  
          FuelModule.visible=true;
  
          FuelModule.filter='all';
  
          ['fuelChip','navFuelChip'].forEach(id=>
            document.getElementById(id)?.classList.add('active')
          );
  
          FuelModule.render(
            app.map
          );
  
  
          document
          .getElementById(
            'fuelFilterModal'
          )
          .classList.remove(
            'show'
          );
  
        }
      );
  
  
      on(
        'filterGNV',
        'click',
        ()=>{
  
          FuelModule.visible=true;
  
          FuelModule.filter='gnv';
  
          ['fuelChip','navFuelChip'].forEach(id=>
            document.getElementById(id)?.classList.add('active')
          );
  
          FuelModule.render(
            app.map
          );
  
  
          document
          .getElementById(
            'fuelFilterModal'
          )
          .classList.remove(
            'show'
          );
  
        }
      );
  
  
      on(
        'filterOfficial',
        'click',
        ()=>{
  
          FuelModule.visible=true;
  
          FuelModule.filter='official';
  
          ['fuelChip','navFuelChip'].forEach(id=>
            document.getElementById(id)?.classList.add('active')
          );
  
          FuelModule.render(
            app.map
          );
  
          const count=FuelModule.stations.filter(s=>s.official).length;
  
          if(!count){
            app.toast('Nenhum posto desta área possui ocorrência oficial identificada com segurança.');
          }
  
          document
          .getElementById(
            'fuelFilterModal'
          )
          .classList.remove(
            'show'
          );
  
        }
      );
  
  
      on(
        'filterNone',
        'click',
        ()=>{
  
          FuelModule.visible=false;
  
          FuelModule.filter='none';
  
          ['fuelChip','navFuelChip'].forEach(id=>
            document.getElementById(id)?.classList.remove('active')
          );
  
          FuelModule.render(
            app.map
          );
  
  
          document
          .getElementById(
            'fuelFilterModal'
          )
          .classList.remove(
            'show'
          );
  
        }
      );
  
  
      on(
        'closeFuelFilter',
        'click',
        ()=>{
  
          document
          .getElementById(
            'fuelFilterModal'
          )
          .classList.remove(
            'show'
          );
  
        }
      );
  
  
      on(
        'layersBtn',
        'click',
        ()=>{
  
          document
          .getElementById(
            'layersModal'
          )
          .classList.add(
            'show'
          );
  
        }
      );
  
  
      on(
        'closeLayers',
        'click',
        ()=>{
  
          document
          .getElementById(
            'layersModal'
          )
          .classList.remove(
            'show'
          );
  
        }
      );
  
      on(
        'mapAppearanceBtn',
        'click',
        ()=>{
          document.getElementById('layersModal').classList.remove('show');
          document.getElementById('mapAppearanceModal').classList.add('show');
        }
      );
  
      on(
        'closeMapAppearance',
        'click',
        ()=>document.getElementById('mapAppearanceModal').classList.remove('show')
      );
  
  
      on(
        'themeAuto',
        'click',
        ()=>app.setTheme(
          'auto'
        )
      );
  
  
      on(
        'themeLight',
        'click',
        ()=>app.setTheme(
          'light'
        )
      );
  
      on(
        'themeDark',
        'click',
        ()=>app.setTheme(
          'dark'
        )
      );
  
  
      on(
        'themeSatellite',
        'click',
        ()=>app.setTheme(
          'sat'
        )
      );
  
  
      on(
        'transportBtn',
        'click',
        ()=>{
  
          document
          .getElementById(
            'layersModal'
          )
          .classList.remove(
            'show'
          );
  
  
          document
          .getElementById(
            'transportModal'
          )
          .classList.add(
            'show'
          );
  
        }
      );
  
  
      document
      .querySelectorAll(
        '[data-transport]'
      )
      .forEach(btn=>{
  
        btn.addEventListener(
          'click',
          ()=>{
  
            app.transportMode=
              btn.dataset.transport;
  
  
            document
            .getElementById(
              'transportModal'
            )
            .classList.remove(
              'show'
            );
  
  
            app.toast(
              app.transportMode===
              'motorcycle'
              ?
              'Modo moto'
              :
              'Modo carro'
            );
  
  
            if(
              app.destination &&
              app.userPos
            )
              app.calculateRoute();
  
          }
        );
  
      });
  
  
      on(
        'closeTransportModal',
        'click',
        ()=>{
  
          document
          .getElementById(
            'transportModal'
          )
          .classList.remove(
            'show'
          );
  
        }
      );
  
  
      on(
        'streetViewBtn',
        'click',
        ()=>{
  
          const t=
            app.destination ||
            app.userPos ||
            app.map
            .getCenter()
            .toArray();
  
  
          window.open(
            `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${t[1]},${t[0]}`,
            '_blank'
          );
  
        }
      );
  
      on(
        'chatMenuBtn',
        'click',
        ()=>{
          document.getElementById('layersModal').classList.remove('show');
          document.getElementById('chatModal').classList.add('show');
          app.renderChat();
        }
      );
  
  
      on(
        'shareRideBtn',
        'click',
        ()=>app.shareRide()
      );
  
  
      on(
        'speedAlertBtn',
        'click',
        ()=>{
  
          app.speedAlertEnabled=
            !app.speedAlertEnabled;
  
  
          app.toast(
            app.speedAlertEnabled
            ?
            'Alerta de velocidade ativado'
            :
            'Alerta de velocidade desativado'
          );
  
        }
      );
  
  
      on(
        'sheetHandle',
        'click',
        ()=>app.toggleSheet()
      );
  
  
      on(
        'sheetToggleBtn',
        'click',
        ()=>app.toggleSheet()
      );
  
  
      on(
        'openWaze',
        'click',
        ()=>{
  
          if(
            !app.destination
          )
            return;
  
  
          window.open(
            `https://www.waze.com/ul?ll=${app.destination[1]},${app.destination[0]}&navigate=yes`,
            '_blank'
          );
  
        }
      );
  
  
      on(
        'openMaps',
        'click',
        ()=>{
  
          if(
            !app.destination
          )
            return;
  
  
          window.open(
            `https://www.google.com/maps/dir/?api=1&destination=${app.destination[1]},${app.destination[0]}`,
            '_blank'
          );
  
        }
      );
  
  
      on(
        'reportBtn',
        'click',
        ()=>{
  
          document
          .getElementById(
            'reportModal'
          )
          .classList.add(
            'show'
          );
  
        }
      );
  
  
      on(
        'closeReportModal',
        'click',
        ()=>{
  
          document
          .getElementById(
            'reportModal'
          )
          .classList.remove(
            'show'
          );
  
        }
      );
  
  
      on(
        'reportANP',
        'click',
        ()=>window.open(
          ANP_REPORT,
          '_blank'
        )
      );
  
  
      on(
        'reportProcon',
        'click',
        ()=>window.open(
          'https://www.procon.rj.gov.br/',
          '_blank'
        )
      );
  
  
      on(
        'reportMPRJ',
        'click',
        ()=>window.open(
          'https://www.mprj.mp.br/',
          '_blank'
        )
      );
  
  
      on(
        'navReportBtn',
        'click',
        ()=>{
  
          document
          .getElementById(
            'reportLiveModal'
          )
          .classList.add(
            'show'
          );
  
        }
      );
  
      on(
        'alertSourcesBtn',
        'click',
        ()=>{
          document.getElementById('reportLiveModal').classList.remove('show');
          document.getElementById('sourcesCheckedAt').textContent=
            'Última consulta aberta pelo motorista: '+
            new Date().toLocaleString('pt-BR')+'.';
          document.getElementById('sourcesModal').classList.add('show');
        }
      );
  
      on(
        'closeSourcesModal',
        'click',
        ()=>document.getElementById('sourcesModal').classList.remove('show')
      );
  
  
      on(
        'closeReportLiveModal',
        'click',
        ()=>{
  
          document
          .getElementById(
            'reportLiveModal'
          )
          .classList.remove(
            'show'
          );
  
        }
      );
  
  
      on(
        'dangerBannerClose',
        'click',
        ()=>{
  
          document
          .getElementById(
            'dangerBanner'
          )
          .classList.remove(
            'show'
          );
  
        }
      );
  
  
      on(
        'chatBottomBtn',
        'click',
        ()=>{
  
          document
          .getElementById(
            'chatModal'
          )
          .classList.add(
            'show'
          );
  
  
          app.renderChat();
  
        }
      );
  
  
      on(
        'closeChatModal',
        'click',
        ()=>{
  
          document
          .getElementById(
            'chatModal'
          )
          .classList.remove(
            'show'
          );
  
        }
      );
  
  
      on(
        'chatSendBtn',
        'click',
        ()=>app.sendChat()
      );
  
  
      document
      .getElementById(
        'chatInput'
      )
      .addEventListener(
        'keydown',
        e=>{
  
          if(
            e.key==='Enter'
          )
            app.sendChat();
  
        }
      );
  
  
      document.addEventListener(
        'click',
        e=>{
  
          if(
            !e.target.closest(
              '.search'
            )
          ){
  
            document
            .getElementById(
              'suggest'
            )
            .classList.remove(
              'show'
            );
  
          }
  
        }
      );
  
  
      window.addEventListener(
        'pagehide',
        ()=>{
  
          /*
            O ciclo de vida do GPS pertence exclusivamente ao RadarGPS.
            Aqui mantemos apenas recursos que ainda são responsabilidade
            direta do App legado.
          */
          try{
  
            app.mqttClient?.end();
  
          }catch(e){}
  
        }
      );
  
      document.addEventListener(
        'visibilitychange',
        ()=>{
          if(document.visibilityState==='visible'){
  
            VoiceAssistant
            .resumeHandsFree();
  
          }else{
  
            VoiceAssistant
            .suspendHandsFree();
  
          }
        }
      );
  
    
}

window.RadarUIEventsV157=Object.freeze({
  bind,
  version:'157'
});

})();