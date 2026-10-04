/* Radar Seguro RJ PRO — camadas de comunidades v156 */
(()=>{'use strict';

if(window.RadarCommunityLayersV156)return;

function add(app,Utils,deps){
  try{
  
        [
          'community-pointer',
          'community-label',
          'community-dot',
          'community-inner-shadow',
          'community-inner-glow',
          'community-outline',
          'community-fill',
          'community-bridge-outline',
          'community-bridge'
        ]
        .forEach(id=>{
  
          if(
            app.map.getLayer(id)
          )
            app.map.removeLayer(id);
  
        });
  
  
        [
          'community-bridges',
          'community-points',
          'communities'
        ]
        .forEach(id=>{
  
          if(
            app.map.getSource(id)
          )
            app.map.removeSource(id);
  
        });
  
  
        app.map.addSource(
          'community-bridges',
          {
            type:'geojson',
            data:deps.communityBridgesGeoJSON()
          }
        );
  
        app.map.addLayer({
          id:'community-bridge',
          type:'line',
          source:'community-bridges',
          minzoom:8.8,
          layout:{'line-cap':'round','line-join':'round'},
          paint:{
            'line-color':
              (app.appliedTheme==='dark'||app.appliedTheme==='sat')
              ? '#fbbf24'
              : '#475569',
            'line-width':['interpolate',['linear'],['zoom'],11.7,1.5,16,5],
            'line-blur':['interpolate',['linear'],['zoom'],11.7,.2,16,.65],
            'line-opacity':.07
          }
        });
  
        app.map.addLayer({
          id:'community-bridge-outline',
          type:'line',
          source:'community-bridges',
          minzoom:8.8,
          layout:{'line-cap':'round','line-join':'round'},
          paint:{
            'line-color':
              (app.appliedTheme==='dark'||app.appliedTheme==='sat')
              ? '#fbbf24'
              : '#111827',
            'line-width':['interpolate',['linear'],['zoom'],11.7,.45,16,1.35],
            'line-opacity':.70
          }
        });
  
        app.map.addSource(
          'communities',
          {
            type:'geojson',
            data:
              deps.communitiesPolygonGeoJSON()
          }
        );
  
  
        app.map.addLayer({
  
          id:'community-fill',
  
          type:'fill',
  
          source:'communities',
  
          minzoom:8.8,
  
          paint:{
  
            'fill-color':[
              'match',
              ['get','occurrenceStatus'],
              'today','#dc2626',
              'recent','#f97316',
              [
                'case',
                ['get','officialBoundary'],
                (
                  app.appliedTheme==='dark' ||
                  app.appliedTheme==='sat'
                )
                ? '#fbbf24'
                : '#334155',
                '#475569'
              ]
            ],
  
            'fill-opacity':[
              'case',
              ['==',['get','occurrenceStatus'],'today'],
              ['interpolate',['linear'],['zoom'],8.8,.13,11.7,.30,14,.42,17,.50],
              ['==',['get','occurrenceStatus'],'recent'],
              ['interpolate',['linear'],['zoom'],8.8,.10,11.7,.24,14,.34,17,.42],
              ['case',
                ['get','officialBoundary'],
                ['interpolate',['linear'],['zoom'],8.8,.05,9.8,.08,10.5,.12,11.7,.18,14,.28,17,.35],
                ['interpolate',['linear'],['zoom'],8.8,.04,9.8,.07,10.5,.11,11.7,.17,14,.26,17,.33]
              ]
            ]
  
          }
  
        });
  
  
        app.map.addLayer({
  
          id:'community-outline',
  
          type:'line',
  
          source:'communities',
  
          minzoom:8.8,
  
          layout:{
            'line-cap':'round',
            'line-join':'round'
          },
  
          paint:{
  
            'line-color':[
              'match',
              ['get','occurrenceStatus'],
              'today','#ef4444',
              'recent','#fb923c',
              [
                'case',
                ['get','officialBoundary'],
                (
                  app.appliedTheme==='dark' ||
                  app.appliedTheme==='sat'
                )
                ? '#fbbf24'
                : '#020617',
                '#ef4444'
              ]
            ],
  
            'line-width':[
              'interpolate',
              ['linear'],
              ['zoom'],
              8.8,.2,
              9.8,.45,
              11.7,1,
              16,2.5
            ]
  
          }
  
        });
  
  
        app.map.addSource(
          'community-points',
          {
            type:'geojson',
            data:
              deps.communitiesPointGeoJSON()
          }
        );
  
  
        app.map.addLayer({
  
          id:'community-dot',
  
          type:'circle',
  
          source:'community-points',
  
          filter:[
            '!=',
            ['get','officialBoundary'],
            true
          ],
  
          maxzoom:13,
  
          paint:{
  
            'circle-radius':[
              'interpolate',
              ['linear'],
              ['zoom'],
              7,3,
              10,5,
              12.5,7
            ],
  
            'circle-color':
              '#dc2626',
  
            'circle-stroke-color':
              '#fff',
  
            'circle-stroke-width':
              1.3
  
          }
  
        });
  
  
        app.map.addLayer({
  
          id:'community-label',
  
          type:'symbol',
  
          source:'community-points',
  
          minzoom:13.4,
  
          layout:{
  
            'text-field':
              ['get','displayName'],
  
            'text-size':[
              'interpolate',
              ['linear'],
              ['zoom'],
              12.8,8.5,
              14.2,10.5,
              17,12.5
            ],
  
            'text-anchor':'top',
  
            'text-offset':[0,.9],
  
            'text-max-width':12,
  
            'text-letter-spacing':.01,
  
            'text-allow-overlap':
              false
  
          },
  
          paint:{
  
            'text-color':[
              'case',
              ['get','officialBoundary'],
              '#ffffff',
              '#fee2e2'
            ],
  
            'text-halo-color':[
              'case',
              ['get','officialBoundary'],
              '#111827',
              '#7f1d1d'
            ],
  
            'text-halo-width':
              1.7,
  
            'text-opacity':.96
  
          }
  
        });
  
        if(app._communityClickHandler){
          try{
            app.map.off('click','community-fill',app._communityClickHandler);
          }catch(e){}
        }
  
        app._communityClickHandler=e=>{
          const feature=e.features?.[0];
          const name=feature?.properties?.name;
          if(!name) return;
  
          const info=app.communityOccurrenceInfo?.[name] || {
            status:'normal',
            last7:0,
            month:0,
            year:0,
            recent:[]
          };
          const statusText=
            info.status==='today'
            ? 'Ocorrência de hoje'
            : info.status==='recent'
              ? 'Ocorrência de ontem'
              : 'Sem ocorrência recente cadastrada';
          const statusColor=
            info.status==='today'
            ? '#dc2626'
            : info.status==='recent'
              ? '#f97316'
              : '#334155';
          const recentHTML=info.recent.length
            ? info.recent.slice(0,8).map(item=>{
                const date=new Date(item.date);
                const when=Number.isNaN(date.getTime())
                  ? 'Data não informada'
                  : date.toLocaleString('pt-BR',{
                      timeZone:'America/Sao_Paulo',
                      day:'2-digit',
                      month:'2-digit',
                      year:'numeric',
                      hour:'2-digit',
                      minute:'2-digit'
                    });
                return '<div style="padding:7px 0;border-top:1px solid #e2e8f0">'+
                  '<b>'+Utils.sanitize(when)+'</b><br>'+
                  Utils.sanitize(item.reason||'Motivo não informado')+
                  '</div>';
              }).join('')
            : '<div style="margin-top:8px;color:#64748b">Nenhuma ocorrência recente registrada.</div>';
  
          new maplibregl.Popup({
            closeButton:true,
            maxWidth:'330px'
          })
            .setLngLat(e.lngLat)
            .setHTML(
              '<div style="color:#0f172a;font-family:Arial,sans-serif;line-height:1.35">'+
                '<strong style="font-size:16px">'+Utils.sanitize(name)+'</strong>'+
                '<div style="margin:7px 0;color:'+statusColor+';font-weight:800">'+
                  Utils.sanitize(statusText)+
                '</div>'+
                '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:5px;text-align:center">'+
                  '<div style="padding:7px 3px;background:#f1f5f9;border-radius:8px"><b>'+info.last7+'</b><br><small>7 dias</small></div>'+
                  '<div style="padding:7px 3px;background:#f1f5f9;border-radius:8px"><b>'+info.month+'</b><br><small>no mês</small></div>'+
                  '<div style="padding:7px 3px;background:#f1f5f9;border-radius:8px"><b>'+info.year+'</b><br><small>no ano</small></div>'+
                '</div>'+
                '<div style="margin-top:9px;font-weight:700">Ocorrências recentes</div>'+
                recentHTML+
                '<div style="margin-top:8px;font-size:11px;color:#64748b">'+
                  'Fonte: Instituto Fogo Cruzado. Histórico acumulado pelo aplicativo desde a ativação.'+
                '</div>'+
              '</div>'
            )
            .addTo(app.map);
        };
  
        app.map.on('click','community-fill',app._communityClickHandler);
  
        setVisibility(
          app,
          app.communityVisible
        );
  
      }catch(e){
  
        console.warn(
          'Erro ao desenhar comunidades',
          e
        );
  
      }
}

function setVisibility(app,show){
  app.communityVisible=show;
  
  
      [
        'community-fill',
        'community-bridge',
        'community-bridge-outline',
        'community-outline',
        'community-dot',
        'community-pointer',
        'community-label'
      ]
      .forEach(id=>{
  
        if(
          app.map.getLayer(id)
        ){
  
          app.map.setLayoutProperty(
            id,
            'visibility',
            show
            ?
            'visible'
            :
            'none'
          );
  
        }
  
      });
}

window.RadarCommunityLayersV156=Object.freeze({
  add,
  setVisibility,
  version:'156'
});

})();