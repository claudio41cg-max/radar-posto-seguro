/* Radar Seguro RJ PRO — runtime Fogo Cruzado v157
   Responsabilidade:
   - carregar feed/histórico;
   - associar ocorrências às comunidades;
   - renderizar marcadores;
   - atualizar o estado de ocorrências;
   - gerenciar o refresh de 15 minutos.
*/
(()=>{'use strict';

if(window.RadarFogoRuntimeV157)return;

function init(app,deps={}){
  if(!app||app.__radarFogoRuntimeV157)return false;
  app.__radarFogoRuntimeV157=true;

  const rawAreas=Array.isArray(deps.rawAreas)?deps.rawAreas:[];
  const distanceToCommunityKm=deps.distanceToCommunityKm;
  const officialCommunityGeometries=deps.officialCommunityGeometries||{};
  const Utils=deps.Utils;
  const communitiesPolygonGeoJSON=deps.communitiesPolygonGeoJSON;

  if(
    typeof distanceToCommunityKm!=='function'||
    !Utils||
    typeof communitiesPolygonGeoJSON!=='function'
  ){
    console.warn('[RadarFogoRuntimeV157] dependências indisponíveis.');
    app.__radarFogoRuntimeV157=false;
    return false;
  }

      const escapeFogoText=value=>String(value??'')
        .replace(/&/g,'&amp;')
        .replace(/</g,'&lt;')
        .replace(/>/g,'&gt;')
        .replace(/"/g,'&quot;')
        .replace(/'/g,'&#039;');
  
      let lastFogoRefreshAt=0;
      const loadFogoCruzado=async()=>{
        try{
          const response=await fetch(
            './data/fogo-cruzado.json?ts='+Date.now(),
            {cache:'no-store'}
          );
          if(!response.ok)
            throw new Error('Feed Fogo Cruzado indisponível');
  
          const feed=await response.json();
          let historyFeed=null;
          try{
            const historyResponse=await fetch(
              './data/fogo-cruzado-history.json?ts='+Date.now(),
              {cache:'no-store'}
            );
            if(historyResponse.ok)
              historyFeed=await historyResponse.json();
          }catch(e){}
  
          const recentOccurrences=feed.occurrences||[];
          const allOccurrences=historyFeed?.occurrences||recentOccurrences;
          const rioDateKey=value=>{
            const date=new Date(value);
            if(Number.isNaN(date.getTime())) return null;
            return new Intl.DateTimeFormat('en-CA',{
              timeZone:'America/Sao_Paulo',
              year:'numeric',
              month:'2-digit',
              day:'2-digit'
            }).format(date);
          };
          const todayKey=rioDateKey(new Date());
          const monthKey=todayKey?.slice(0,7);
          const yearKey=todayKey?.slice(0,4);
          const todayStart=new Date(todayKey+'T00:00:00-03:00').getTime();
          const yesterdayKey=rioDateKey(new Date(todayStart-60000));
          const occurrenceStatusByName={};
          const communityOccurrenceInfo={};
  
          const matchOccurrenceCommunity=point=>{
            let best=null;
            rawAreas.forEach(area=>{
              const distance=distanceToCommunityKm(point,area);
              if(distance>.18) return;
              const candidate={
                area,
                distance,
                official:Boolean(officialCommunityGeometries[area.name]),
                centerDistance:Utils.distanceKm(point,area.c)
              };
              if(
                !best ||
                candidate.distance<best.distance-1e-6 ||
                (
                  Math.abs(candidate.distance-best.distance)<=1e-6 &&
                  (
                    Number(candidate.official)>Number(best.official) ||
                    (
                      candidate.official===best.official &&
                      candidate.centerDistance<best.centerDistance
                    )
                  )
                )
              ) best=candidate;
            });
            return best?.area || null;
          };
  
          const communityMarkerPoint=(point,area)=>{
            if(!area || distanceToCommunityKm(point,area)===0) return point;
            if(distanceToCommunityKm(area.c,area)===0) return [...area.c];
            const geometry=officialCommunityGeometries[area.name];
            const polygons=geometry
              ? (geometry.type==='MultiPolygon' ? geometry.coordinates : [geometry.coordinates])
              : [];
            for(const polygon of polygons){
              const ring=polygon[0] || [];
              if(!ring.length) continue;
              const candidate=[
                ring.reduce((sum,value)=>sum+value[0],0)/ring.length,
                ring.reduce((sum,value)=>sum+value[1],0)/ring.length
              ];
              if(distanceToCommunityKm(candidate,area)===0) return candidate;
            }
            return [...area.c];
          };
  
          rawAreas.forEach(area=>{
            communityOccurrenceInfo[area.name]={
              status:'normal',
              last7:0,
              month:0,
              year:0,
              recent:[],
              visibleDays:new Set()
            };
          });
  
          allOccurrences.forEach(item=>{
            const date=new Date(item.date);
            const longitude=Number(item.longitude);
            const latitude=Number(item.latitude);
            if(
              Number.isNaN(date.getTime()) ||
              !Number.isFinite(longitude) ||
              !Number.isFinite(latitude)
            ) return;
            const dateKey=rioDateKey(item.date);
            if(!dateKey) return;
            const itemDayStart=new Date(dateKey+'T00:00:00-03:00').getTime();
            const ageDays=Math.round((todayStart-itemDayStart)/86400000);
            const area=matchOccurrenceCommunity([longitude,latitude]);
            if(!area) return;
            const info=communityOccurrenceInfo[area.name];
            if(ageDays>=0 && ageDays<7){
              info.last7++;
              info.recent.push(item);
            }
            if(dateKey.slice(0,7)===monthKey) info.month++;
            if(dateKey.slice(0,4)===yearKey) info.year++;
            if(dateKey===todayKey || dateKey===yesterdayKey)
              info.visibleDays.add(dateKey);
          });
  
          Object.entries(communityOccurrenceInfo).forEach(([name,info])=>{
            info.recent.sort((a,b)=>new Date(b.date)-new Date(a.date));
            const hasToday=info.visibleDays.has(todayKey);
            const hasYesterday=info.visibleDays.has(yesterdayKey);
            info.status=hasToday
              ? 'today'
              : hasYesterday
                ? 'recent'
                : 'normal';
            occurrenceStatusByName[name]=info.status;
            delete info.visibleDays;
          });
  
          app.communityOccurrenceInfo=communityOccurrenceInfo;
  
          const communitiesSource=app.map.getSource('communities');
          if(communitiesSource)
            communitiesSource.setData(
              communitiesPolygonGeoJSON(occurrenceStatusByName)
            );
  
          (app.fogoMarkers||[]).forEach(marker=>marker.remove());
          app.fogoMarkers=[];
  
          if(!app.fogoMarkerZoomHandler){
            app.fogoMarkerZoomHandler=()=>{
              const zoom=app.map?.getZoom?.() ?? 12;
              const size=
                zoom<7 ? 12 :
                zoom<9 ? 15 :
                zoom<11 ? 18 :
                zoom<13 ? 21 :
                24;
              document.documentElement.style.setProperty(
                '--fogo-marker-size',
                size+'px'
              );
              document.querySelectorAll('.fogo-live-marker').forEach(element=>{
                element.style.setProperty('--fogo-size',size+'px');
              });
            };
            app.map.on('zoom',app.fogoMarkerZoomHandler);
          }
          app.fogoMarkerZoomHandler();
  
          const nowMs=Date.now();
  
          const occurrenceDateKeys=new Set([todayKey,yesterdayKey]);
  
          const visibleOccurrences=[];
          const seenOccurrences=new Set();
  
          allOccurrences
            .slice()
            .sort((a,b)=>new Date(b.date)-new Date(a.date))
            .forEach(item=>{
              const time=new Date(item.date).getTime();
              const longitude=Number(item.longitude);
              const latitude=Number(item.latitude);
              const dateKey=rioDateKey(item.date);
  
              if(
                !Number.isFinite(time) ||
                !Number.isFinite(longitude) ||
                !Number.isFinite(latitude) ||
                longitude<-46 ||
                longitude>-40 ||
                latitude<-24 ||
                latitude>-20 ||
                time>nowMs+5*60000 ||
                !dateKey ||
                !occurrenceDateKeys.has(dateKey)
              ) return;
  
              const occurrenceKey=String(
                item.id ||
                item.documentNumber ||
                [time,latitude.toFixed(6),longitude.toFixed(6)].join('|')
              );
  
              if(seenOccurrences.has(occurrenceKey)) return;
              seenOccurrences.add(occurrenceKey);
  
              const community=matchOccurrenceCommunity([longitude,latitude]);
              const markerCoordinates=communityMarkerPoint(
                [longitude,latitude],
                community
              );
              visibleOccurrences.push({
                ...item,
                longitude,
                latitude,
                _time:time,
                _dateKey:dateKey,
                _communityName:community?.name || null,
                _markerCoordinates:markerCoordinates
              });
            });
  
          const occurrencesToday=
            visibleOccurrences.filter(
              item=>item._dateKey===todayKey
            );
  
          const occurrencesLast24h=
            visibleOccurrences.filter(
              item=>{
                const ageHours=(nowMs-item._time)/3600000;
                return ageHours>=0 && ageHours<=24;
              }
            );
  
          app.fogoRecentOccurrences=
            occurrencesLast24h.map(item=>{
              const cleanItem={...item};
              delete cleanItem._time;
              delete cleanItem._dateKey;
              delete cleanItem._communityName;
              delete cleanItem._markerCoordinates;
              return cleanItem;
            });
  
          app.fogoFeedLoaded=true;
  
          app.fogoFeedError=false;
  
          app.fogoFeedUpdatedAt=
            feed.generatedAt ||
            feed.lastUpdate ||
            new Date().toISOString();
  
          const feedUpdatedTime=
            new Date(app.fogoFeedUpdatedAt).getTime();
  
          app.fogoFeedStale=
            Number.isFinite(feedUpdatedTime)
              ? nowMs-feedUpdatedTime>90*60000
              : true;
  
          visibleOccurrences
            .forEach(item=>{
            const isToday=item._dateKey===todayKey;
            const marker=document.createElement('button');
            marker.type='button';
            marker.className=
              'fogo-live-marker'+
              (isToday?' fogo-today':' fogo-previous');
            const markerZoom=app.map?.getZoom?.() ?? 12;
            const markerSize=
              markerZoom<7 ? 12 :
              markerZoom<9 ? 15 :
              markerZoom<11 ? 18 :
              markerZoom<13 ? 21 :
              24;
            marker.style.setProperty('--fogo-size',markerSize+'px');
            marker.setAttribute(
              'aria-label',
              isToday
                ? 'Ocorrência de hoje informada pelo Fogo Cruzado'
                : 'Ocorrência de ontem informada pelo Fogo Cruzado'
            );
            marker.title=
              isToday
                ? 'Ocorrência de hoje • Fogo Cruzado'
                : 'Ocorrência de ontem • Fogo Cruzado';
            marker.textContent='';
  
            const date=new Date(item.date);
            const when=Number.isNaN(date.getTime())
              ? 'Horário não informado'
              : date.toLocaleString('pt-BR',{
                  timeZone:'America/Sao_Paulo',
                  day:'2-digit',
                  month:'2-digit',
                  year:'numeric',
                  hour:'2-digit',
                  minute:'2-digit'
                });
  
            const statusTitle=
              isToday
                ? '🔴 Ocorrência de hoje'
                : '🟠 Ocorrência de ontem';
  
            const popup=new maplibregl.Popup({
              offset:22,
              closeButton:true,
              maxWidth:'310px'
            }).setHTML(
              '<div style="color:#101828;font-family:Arial,sans-serif;line-height:1.35">'+
                '<strong style="font-size:15px">'+statusTitle+'</strong><br>'+
                '<b>Data e hora:</b> '+escapeFogoText(when)+'<br>'+
                '<b>Bairro:</b> '+escapeFogoText(item.neighborhood||'Não informado')+'<br>'+
                '<b>Local:</b> '+escapeFogoText(item.locality||item.address||'Não informado')+'<br>'+
                '<b>Motivo:</b> '+escapeFogoText(item.reason||'Não informado')+'<br>'+
                '<span style="display:block;margin-top:7px;font-size:12px;color:#475467">'+
                  'Fonte oficial: Instituto Fogo Cruzado<br>'+
                  'Vermelho: hoje • Laranja: ontem • exibição por 2 dias<br>'+
                  'Atualização automática a cada 15 minutos'+
                '</span>'+
              '</div>'
            );
  
            const mapMarker=new maplibregl.Marker({
              element:marker,
              anchor:'center'
            })
              .setLngLat(item._markerCoordinates || [item.longitude,item.latitude])
              .setPopup(popup)
              .addTo(app.map);
  
            app.fogoMarkers.push(mapMarker);
          });
  
          app.fogoCruzado={
            count:occurrencesLast24h.length,
            todayCount:occurrencesToday.length,
            visibleCount:visibleOccurrences.length,
            stale:app.fogoFeedStale,
            generatedAt:feed.generatedAt||null,
            lastUpdate:feed.lastUpdate||null,
            source:feed.source||null
          };
  
          lastFogoRefreshAt=Date.now();
  
          return true;
        }catch(error){
          app.fogoFeedError=true;
          console.warn('Fogo Cruzado indisponível no momento.',error);
          return false;
        }
      };
  
      app.refreshFogoCruzado=
        loadFogoCruzado;
  
      if(app.map?.loaded())
        loadFogoCruzado();
      else
        app.map?.once('load',loadFogoCruzado);
  
      const FOGO_REFRESH_MS=
        15*60*1000;
  
      setInterval(
        ()=>{
          if(document.visibilityState!=='visible')
            return;
  
          loadFogoCruzado();
        },
        FOGO_REFRESH_MS
      );
  
      document.addEventListener(
        'visibilitychange',
        ()=>{
          if(
            document.visibilityState==='visible' &&
            Date.now()-lastFogoRefreshAt>=FOGO_REFRESH_MS
          ){
            loadFogoCruzado();
          }
        }
      );
  

  return true;
}

window.RadarFogoRuntimeV157=Object.freeze({
  init,
  version:'157'
});

})();