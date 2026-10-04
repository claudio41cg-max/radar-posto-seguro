/* Radar Seguro RJ PRO — estado central do App v157
   Responsabilidade exclusiva:
   - fornecer o estado inicial compartilhado;
   - não executar GPS, rota, câmera, voz, UI ou rede.
*/
(()=>{'use strict';

if(window.RadarAppStateV157)return;

function create(){
  return {
    map:null,
    userPos:null,
    rawUserPos:null,
    filteredPos:null,
    lastRawPos:null,
    userMarker:null,
    destinationMarker:null,
    destination:null,
    route:null,
    routeProgressIndex:0,
    routeProgressMeters:0,
    routeStepIndex:0,
    navActive:false,
    GPSWatch:null,
    currentBearing:0,
    currentSpeed:0,
    currentAccuracy:999,
    lastGPSAt:0,
    lastRawAt:0,
    gpsKalman:null,
    gpsContinuityTimer:null,
    lastTrustedProgressMeters:0,
    lastTrustedSpeed:0,
    matchConfidence:0,
    followMode:true,
    manualFollowTimer:null,
    lastCameraUpdate:0,
    lastRerouteAt:0,
    rerouting:false,
    offRouteHits:0,
    transportMode:'car',
    themeMode:'auto',
    appliedTheme:null,
    autoThemeTimer:null,
    communityVisible:true,
    communityBillboardMarker:null,
    nearestCommunityName:null,
    nearbyCommunityAlerted:{},
    insideCommunityAlerted:{},
    lastCommunityDistance:{},
    geocodeTimer:null,
    geocodeAbort:null,
    sheetExpanded:false,
    speedAlertEnabled:true,
    hazardMarkers:[],
    routeHazards:[],
    hazardFetchController:null,
    chatMessages:[],
    fogoRecentOccurrences:[],
    fogoFeedLoaded:false,
    fogoFeedError:false,
    fogoFeedUpdatedAt:null,
    mqttClient:null,
    lastArrivalAnnounced:false,
    activeGuidanceStep:-1
  };
}

window.RadarAppStateV157=Object.freeze({
  create,
  version:'157'
});

})();