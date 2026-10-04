/* Radar Seguro RJ PRO — composição principal v157
   Este arquivo monta os módulos. Regras de negócio ficam nos módulos donos.
*/
(function(){

window.RADAR_RUNTIME_BUILD='155';

'use strict';


/* =========================================================
   CONFIGURAÇÕES
========================================================= */

const RADAR_CONFIG = window.RADAR_CONFIG_V100 || {};
const TOMTOM_KEY = RADAR_CONFIG.TOMTOM_KEY || '';
const ANP_APP = RADAR_CONFIG.ANP_APP || 'https://anpcomvcpostos.anp.gov.br/';
const ANP_REPORT = RADAR_CONFIG.ANP_REPORT || '';
const VERIFIED_FUEL_INCIDENTS = Array.from(RADAR_CONFIG.VERIFIED_FUEL_INCIDENTS || []);
const VERIFIED_FUEL_URL = RADAR_CONFIG.VERIFIED_FUEL_URL || './data/postos-oficiais.json';
const ANP_STATIONS = Array.from(RADAR_CONFIG.ANP_STATIONS || []);

const ANP_STATIONS_URL = RADAR_CONFIG.ANP_STATIONS_URL || './data/postos-anp-rio.json';

const MAP_UTILS = window.RADAR_MAP_UTILS_V101;
const RJ_CENTER = MAP_UTILS.RJ_CENTER;
const STYLE_VECTOR = MAP_UTILS.STYLE_VECTOR;
const satelliteStyle = MAP_UTILS.satelliteStyle;
const darkStyle = MAP_UTILS.darkStyle;
const Utils = MAP_UTILS.Utils;

/* =========================================================
   COMUNIDADES
========================================================= */

/* Catálogo rawAreas carregado de community-index-preload.js antes do mapa. */

/*
  LIMITES OFICIAIS (IPP/SMH, Prefeitura do Rio).
  Base: limites oficiais de comunidades, com fotointerpretação de ortofotos de 2019.
  Nomes locais: Carobinha = Jardim Nossa Senhora das Graças;
  Barbante = Nova Cidade.
*/
const COMMUNITY_GEOMETRY=window.RadarCommunityGeometryV156;
const officialCommunityGeometries=COMMUNITY_GEOMETRY.officialCommunityGeometries;
const riskRadius=COMMUNITY_GEOMETRY.riskRadius;
const distanceToCommunityKm=COMMUNITY_GEOMETRY.distanceToCommunityKm;
const communitiesPolygonGeoJSON=COMMUNITY_GEOMETRY.communitiesPolygonGeoJSON;
const communitiesPointGeoJSON=COMMUNITY_GEOMETRY.communitiesPointGeoJSON;
const communityBridgesGeoJSON=COMMUNITY_GEOMETRY.communityBridgesGeoJSON;


/* =========================================================
   VOZ
========================================================= */

const Voice=window.RadarVoiceEngineV157.create({
  getAssistant:()=>VoiceAssistant
});


/* =========================================================
   ASSISTENTE DE VOZ LOCAL E GRATUITA
========================================================= */

const VoiceAssistant=window.RadarVoiceAssistantV157.create({
  RADAR_CONFIG,
  Voice,
  getApp:()=>App,
  getFuelModule:()=>FuelModule,
  getTrafficAssistant:()=>TrafficAssistantV40
});


/* =========================================================
   POSTOS
========================================================= */

const FuelModule=window.RadarFuelModuleV156.create({
  Utils,
  verifiedFuelIncidents:VERIFIED_FUEL_INCIDENTS,
  verifiedFuelUrl:VERIFIED_FUEL_URL,
  anpStations:ANP_STATIONS,
  anpStationsUrl:ANP_STATIONS_URL,
  anpApp:ANP_APP,
  getApp:()=>window.RadarApp||window.App||null
});


/* Expose only the existing local voice assistant reference for external Gemini modules.
   No routing/GPS/TomTom logic is changed here. */
window.VoiceAssistant = VoiceAssistant;

/* =========================================================
   APP
========================================================= */

const App = {

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

  activeGuidanceStep:-1,

/* =========================================================
   INIT
========================================================= */

  init(){

    window.RadarMapThemeV156.load(this);

    this.createMap();

    this.bindEvents();

    VoiceAssistant.init();

    this.startMQTT();

    this.autoThemeTimer=setInterval(
      ()=>this.refreshAutomaticTheme(),
      60000
    );

    this.toast(
      'Radar Seguro RJ PRO pronto.'
    );

  },


  getThemeStyle(){
    return window.RadarMapThemeV156.getStyle(this,{
      styleVector:STYLE_VECTOR,
      satelliteStyle,
      darkStyle
    });
  },

  automaticThemeNow(){
    return window.RadarMapThemeV156.automaticNow();
  },

  refreshAutomaticTheme(){
    return window.RadarMapThemeV156.refresh(this,{
      styleVector:STYLE_VECTOR,
      satelliteStyle,
      darkStyle
    });
  },

  applyThemeStyle(){
    return window.RadarMapThemeV156.apply(this,{
      styleVector:STYLE_VECTOR,
      satelliteStyle,
      darkStyle
    });
  },


/* =========================================================
   MAPA
========================================================= */

  createMap(){
    return window.RadarMapControllerV157.createMap(this,{RJ_CENTER});
  },


/*
  MELHORA VISUAL DO MAPA SEM TROCAR
  A ESTRUTURA DO APLICATIVO.
*/
  improveVectorMap(){
    return window.RadarMapControllerV157.improveVectorMap(this);
  },


/* =========================================================
   TRÂNSITO TOMTOM SOBRE O MAPA ATUAL
========================================================= */

  addTomTomTrafficLayer(){
    return window.RadarMapControllerV157.cleanupGlobalTraffic(this);
  },


/* =========================================================
   3D
========================================================= */

  add3DBuildings(){
    return window.RadarMapControllerV157.add3DBuildings(this);
  },


/* =========================================================
   COMUNIDADES
========================================================= */

  addCommunityLayers(){
    return window.RadarCommunityLayersV156.add(
      this,
      Utils,
      {
        communityBridgesGeoJSON,
        communitiesPolygonGeoJSON,
        communitiesPointGeoJSON
      }
    );
  },

  setCommunityVisibility(show){
    return window.RadarCommunityLayersV156.setVisibility(
      this,
      show
    );
  },


/* =========================================================
   GPS
========================================================= */

  /* =========================================================
     GPS — FACHADA MODULAR
     Toda lógica real foi extraída para core/radar-gps-v1.js.
     O App mantém apenas estes nomes para compatibilidade temporária.
  ========================================================= */

  startGPS(){
    return window.RadarGPS?.start?.();
  },

  resumeGPS(){
    return window.RadarGPS?.resume?.();
  },

  suspendIdleGPS(){
    return window.RadarGPS?.suspendIfIdle?.();
  },

  handleGPSError(error){
    return window.RadarGPS?.handleError?.(error);
  },

  filterGPSPosition(raw,accuracy,speedKmh,timestamp){
    return window.RadarGPS?.filter?.(
      raw,
      accuracy,
      speedKmh,
      timestamp
    ) || raw;
  },

  continueDuringGPSGap(){
    return window.RadarGPS?.continueDuringGap?.();
  },

  runAdaptiveGPSTasks(force=false){
    return window.RadarGPSAuxV157.run(this,force);
  },



  handleGPS(position){
    return window.RadarGPS?.process?.(position);
  },

  setGPSStatus(ok,text){
    return window.RadarUIRuntimeV157.setGPSStatus(this,ok,text);
  },


/* =========================================================
   MAP MATCHING
========================================================= */

  /* =========================================================
     MAP MATCHING / PROGRESSO — FACHADA MODULAR
     Toda lógica real está em core/radar-route-progress-v1.js.
  ========================================================= */

  matchPositionToRoute(point,sampleSeconds=1){
    return window.RadarRouteProgress?.match?.(
      point,
      sampleSeconds,
      this
    ) || {
      point,
      index:this.routeProgressIndex||0,
      distance:999,
      bearing:this.currentBearing||0,
      progress:this.routeProgressMeters||0,
      snapped:false,
      confidence:0
    };
  },

  prepareRouteGeometry(route){
    return window.RadarRouteProgress?.prepare?.(route) || route;
  },

  findIndexForOffset(route,offset){
    return window.RadarRouteProgress?.findIndexForOffset?.(
      route,
      offset
    ) ?? 0;
  },

  calculateProgressMeters(index,point){
    return window.RadarRouteProgress?.calculateProgressMeters?.(
      index,
      point,
      this.route
    ) ?? 0;
  },


/* =========================================================
   CÂMERA PROFISSIONAL / OLHA À FRENTE
========================================================= */

  pointAhead(distanceMeters){
    return window.RadarLookAheadV157.pointAhead(
      this,
      Utils,
      distanceMeters
    );
  },


  updateUserMarker(){
    const updated=window.RadarArrowV157.update(this,Utils);
    this.updateCamera();
    return updated;
  },


  updateCamera(){
    return window.RadarCameraV157.update(this,Utils);
  },


  updateSpeedUI(){
    return window.RadarUIRuntimeV157.updateSpeed(this);
  },


/* =========================================================
   BUSCA
========================================================= */

  normalizeSearch(q){
    return window.RadarSearchV156.normalize(q);
  },

  geocodeTomTom(q,signal){
    return window.RadarSearchV156.geocodeTomTom(this,q,signal);
  },

  geocodeNominatim(q,signal){
    return window.RadarSearchV156.geocodeNominatim(q,signal);
  },

  geocodePhoton(q,signal){
    return window.RadarSearchV156.geocodePhoton(this,q,signal);
  },

  searchAddress(text){
    return window.RadarSearchV156.search(this,text);
  },

  renderSuggestions(results){
    return window.RadarSearchV156.render(this,Utils,results);
  },


/* =========================================================
   ROTA — FACHADA MODULAR
   A autoridade real está em core/radar-routing-v1.js.
   Não existe mais fallback silencioso para OSRM neste bloco.
========================================================= */

  tomTomModifier(type){
    return window.RadarRouting?.modifier?.(type) || 'straight';
  },

  async fetchTomTomRoute(a,b){
    return await window.RadarRouting?.fetch?.(a,b);
  },

  async getRoute(a,b){
    return await window.RadarRouting?.fetch?.(a,b);
  },

  async calculateRoute(options={}){
    return await window.RadarRouting?.calculate?.(options);
  },


/* =========================================================
   DESENHO ROTA
========================================================= */

  updateRemainingRouteLine(){
    return window.RadarRouteViewV157.updateRemaining(this);
  },


  drawRoute(route,fit=true){
    return window.RadarRouteViewV157.draw(this,route,fit);
  },


  updateRouteSummary(){
    return window.RadarRouteViewV157.updateSummary(this);
  },


  renderDestinationFlag(){
    return window.RadarRouteViewV157.renderDestination(this);
  },


/* =========================================================
   FORA DA ROTA
========================================================= */

  isRoundaboutSoon(){
    return window.RadarOffRouteV157.isRoundaboutSoon(this);
  },


  checkOffRoute(match){
    return window.RadarOffRouteV157.check(this,match);
  },

  async recalculateRoute(){
    return await window.RadarRouting?.recalculate?.();
  },


/* =========================================================
   MANOBRAS
========================================================= */

  /* =========================================================
     GUIDANCE / MANOBRAS — FACHADA MODULAR
     A lógica real está em core/radar-guidance-v1.js.
  ========================================================= */

  maneuverIcon(step){
    return window.RadarGuidance?.maneuverIcon?.(step) || '↑';
  },

  maneuverText(step){
    return window.RadarGuidance?.maneuverText?.(step) || 'Siga em frente';
  },

  isRoundaboutStep(step){
    return !!window.RadarGuidance?.isRoundaboutStep?.(step);
  },

  isTurnStep(step){
    return !!window.RadarGuidance?.isTurnStep?.(step);
  },

  getUpcomingGuidance(){
    return window.RadarGuidance?.getUpcoming?.(this) || null;
  },

  isComplexManeuverArea(guidance){
    return !!window.RadarGuidance?.isComplexManeuverArea?.(guidance);
  },


/* =========================================================
   NAVEGAÇÃO
========================================================= */

  updateNavigation(){
    return window.RadarGuidance?.update?.();
  },


/* =========================================================
   COMUNIDADE
========================================================= */

  routeNearCommunity(area){
    return window.RadarCommunityAlertsV156.routeNear(
      this,
      Utils,
      riskRadius,
      area
    );
  },

  checkCommunityDanger(){
    return window.RadarCommunityAlertsV156.checkDanger(
      this,
      Utils,
      riskRadius,
      rawAreas,
      Voice
    );
  },

  checkDestinationCommunity(){
    return window.RadarCommunityAlertsV156.checkDestination(
      this,
      Utils,
      riskRadius,
      rawAreas
    );
  },


/* =========================================================
   OUTDOOR
========================================================= */

  updateCommunityBillboard(){
    return window.RadarCommunityOutdoorV156.update(
      this,
      Utils,
      rawAreas,
      distanceToCommunityKm
    );
  },

  removeCommunityBillboard(){
    return window.RadarCommunityOutdoorV156.remove(this);
  },


/* =========================================================
   HAZARDS
========================================================= */

  clearHazards(){
    return window.RadarHazardsV156.clear(this);
  },

  fetchHazardsAlongRoute(){
    return window.RadarHazardsV156.fetchAlongRoute(this,Utils);
  },

  hazardSVG(type){
    return window.RadarHazardsV156.svg(type);
  },

  renderHazards(){
    return window.RadarHazardsV156.render(this);
  },


/* =========================================================
   SEMÁFOROS DA ROTA
   Os símbolos continuam vindo do OpenStreetMap/Overpass.
   Não existe inferência local de estado vermelho/amarelo/verde.
========================================================= */


/* =========================================================
   START NAV
========================================================= */

  startNavigation(){
    return window.RadarNavigationLifecycle?.start?.(
      this,
      {
        speak:(text,priority)=>Voice.speak(text,priority),
        stopAssistant:()=>VoiceAssistant.stopHandsFree(false),
        clearVoice:()=>Voice.clear()
      }
    );
  },


  stopNavigation(){
    return window.RadarNavigationLifecycle?.stop?.(
      this,
      {
        stopAssistant:()=>VoiceAssistant.stopHandsFree(false),
        clearVoice:()=>Voice.clear()
      }
    );
  },


  clearRoute(){
    return window.RadarNavigationLifecycle?.clear?.(
      this,
      {
        stopAssistant:()=>VoiceAssistant.stopHandsFree(false),
        clearVoice:()=>Voice.clear()
      }
    );
  },


  recenter(){
    return window.RadarRecenterV157.recenter(this,Utils);
  },


/* =========================================================
   UI
========================================================= */

  showRoutePanel(){
    return window.RadarUIRuntimeV157.showRoutePanel(this);
  },


  toggleSheet(force=null){
    return window.RadarUIRuntimeV157.toggleSheet(this,force);
  },


  toast(text,time=3200){
    return window.RadarUIRuntimeV157.toast(this,text,time);
  },


  setTheme(mode){
    return window.RadarMapThemeV156.set(this,mode,{
      styleVector:STYLE_VECTOR,
      satelliteStyle,
      darkStyle
    });
  },


/* =========================================================
   SHARE
========================================================= */

  shareRide(){
    return window.RadarUIRuntimeV157.shareRide(this);
  },


/* =========================================================
   MQTT
========================================================= */

  startMQTT(){
    return window.RadarMqttChatV156.start(this,Utils);
  },

  sendReport(type,label){
    return window.RadarMqttChatV156.sendReport(this,type,label);
  },

  sendChat(){
    return window.RadarMqttChatV156.sendChat(this);
  },

  renderChat(){
    return window.RadarMqttChatV156.render(this,Utils);
  },


/* =========================================================
   EVENTOS
========================================================= */

  bindEvents(){
    return window.RadarUIEventsV157.bind(this,{
      VoiceAssistant,
      Voice,
      FuelModule
    });
  }

};


const TrafficAssistantV40=window.RadarTrafficAssistantV157.create({
  getApp:()=>App,
  getVoiceAssistant:()=>VoiceAssistant
});


const RadarVoicePickerV41=window.RadarVoicePickerV157;

window.RadarApp={

  sendReport:
    (type,label)=>
      App.sendReport(
        type,label
      )

};


document.addEventListener(
  'DOMContentLoaded',
  ()=>{
    // ETAPA 1: prévia paralela de rotas desativada.
    // A rota exibida deve vir da autoridade principal (TomTom), sem um segundo
    // módulo reapresentando ou escolhendo alternativas por conta própria.
    App.showRoutePreviewV43=()=>false;
    window.RadarApp=App;
App.init();
    window.RadarTrafficVisualV157?.init?.();
    // Módulos paralelos antigos de escolha de rota foram removidos.
    // RadarRouting permanece como única autoridade de rota.
    setTimeout(()=>RadarVoicePickerV41.init(),500);

    window.RadarFogoRuntimeV157.init(App,{
      rawAreas,
      distanceToCommunityKm,
      officialCommunityGeometries,
      Utils,
      communitiesPolygonGeoJSON
    });
  }
);

})();
