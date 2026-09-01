from pathlib import Path
import re
p=Path('index.html')
s=p.read_text(encoding='utf-8')
s=re.sub(r'<meta name="radar-build" content="[^"]+">','<meta name="radar-build" content="42-route-traffic-colors">',s,count=1)

# Pedimos ao TomTom as seções de trânsito e a geometria completa da rota.
s=s.replace('&computeTravelTimeFor=all&maxAlternatives=1', '&computeTravelTimeFor=all&maxAlternatives=1&sectionType=traffic&routeRepresentation=polyline')

# Métodos de desenho leves: apenas trechos com retenção são sobrepostos à rota azul.
anchor='  schedule(delay=60000){\n'
if anchor in s and 'drawTrafficOverlay(route)' not in s:
    methods=r'''  trafficSourceId:'radar-route-traffic-v42',
  trafficLayerOrange:'radar-route-traffic-orange-v42',
  trafficLayerRed:'radar-route-traffic-red-v42',

  routeTrafficPoints(route){
    const out=[];
    const legs=Array.isArray(route?.legs)?route.legs:[];
    for(const leg of legs){
      for(const pt of (leg?.points||[])){
        const lat=Number(pt?.latitude ?? pt?.lat);
        const lon=Number(pt?.longitude ?? pt?.lon ?? pt?.lng);
        if(Number.isFinite(lat)&&Number.isFinite(lon)) out.push([lon,lat]);
      }
    }
    if(!out.length){
      for(const pt of (route?.points||[])){
        const lat=Number(pt?.latitude ?? pt?.lat ?? pt?.[1]);
        const lon=Number(pt?.longitude ?? pt?.lon ?? pt?.lng ?? pt?.[0]);
        if(Number.isFinite(lat)&&Number.isFinite(lon)) out.push([lon,lat]);
      }
    }
    return out;
  },

  trafficSections(route){
    const all=[];
    if(Array.isArray(route?.sections)) all.push(...route.sections);
    for(const leg of (route?.legs||[])) if(Array.isArray(leg?.sections)) all.push(...leg.sections);
    return all.filter(sec=>String(sec?.sectionType||'').toUpperCase()==='TRAFFIC' || sec?.simpleCategory || Number(sec?.delayInSeconds)>0);
  },

  trafficFeatureCollection(route){
    const points=this.routeTrafficPoints(route);
    const sections=this.trafficSections(route);
    const features=[];
    if(points.length<2) return {type:'FeatureCollection',features};
    for(const sec of sections){
      const a=Math.max(0,Number(sec?.startPointIndex)||0);
      const b=Math.min(points.length-1,Number(sec?.endPointIndex));
      if(!Number.isFinite(b)||b<=a) continue;
      const coords=points.slice(a,b+1);
      if(coords.length<2) continue;
      const mag=Number(sec?.magnitudeOfDelay);
      const delay=Number(sec?.delayInSeconds||0);
      const cat=String(sec?.simpleCategory||'').toUpperCase();
      let level='orange';
      if(cat==='ROAD_CLOSURE' || cat==='JAM' && (mag>=3 || delay>=300) || mag>=3) level='red';
      else if((Number.isFinite(mag)&&mag<=0) && delay<60) continue;
      features.push({
        type:'Feature',
        properties:{level,delaySeconds:delay,category:cat},
        geometry:{type:'LineString',coordinates:coords}
      });
    }
    return {type:'FeatureCollection',features};
  },

  ensureTrafficLayers(){
    const map=App.map;
    if(!map || !map.getStyle || !map.isStyleLoaded?.()) return false;
    try{
      if(!map.getSource(this.trafficSourceId)){
        map.addSource(this.trafficSourceId,{type:'geojson',data:{type:'FeatureCollection',features:[]}});
      }
      if(!map.getLayer(this.trafficLayerOrange)){
        map.addLayer({
          id:this.trafficLayerOrange,
          type:'line',
          source:this.trafficSourceId,
          filter:['==',['get','level'],'orange'],
          paint:{'line-color':'#f59e0b','line-width':8,'line-opacity':0.95},
          layout:{'line-cap':'round','line-join':'round'}
        });
      }
      if(!map.getLayer(this.trafficLayerRed)){
        map.addLayer({
          id:this.trafficLayerRed,
          type:'line',
          source:this.trafficSourceId,
          filter:['==',['get','level'],'red'],
          paint:{'line-color':'#ef4444','line-width':9,'line-opacity':0.98},
          layout:{'line-cap':'round','line-join':'round'}
        });
      }
      return true;
    }catch(e){
      console.warn('Radar camada de trânsito:',e);
      return false;
    }
  },

  drawTrafficOverlay(route){
    try{
      if(!this.ensureTrafficLayers()) return;
      const src=App.map?.getSource(this.trafficSourceId);
      if(src?.setData) src.setData(this.trafficFeatureCollection(route));
    }catch(e){ console.warn('Radar desenho de trânsito:',e); }
  },

  clearTrafficOverlay(){
    try{
      const src=App.map?.getSource(this.trafficSourceId);
      if(src?.setData) src.setData({type:'FeatureCollection',features:[]});
    }catch(e){}
  },

'''
    s=s.replace(anchor,methods+anchor,1)

# Sempre que uma rota TomTom fresca chegar, atualiza os trechos laranja/vermelho.
if 'this.drawTrafficOverlay(route);' not in s:
    s=s.replace("      const route=data?.routes?.[0];\n      if(!route) return null;", "      const route=data?.routes?.[0];\n      if(!route) return null;\n      this.drawTrafficOverlay(route);",1)
    s=s.replace("      const route=data?.routes?.[0];\n      const freshSec=Number(route?.summary?.travelTimeInSeconds);", "      const route=data?.routes?.[0];\n      if(route) this.drawTrafficOverlay(route);\n      const freshSec=Number(route?.summary?.travelTimeInSeconds);",1)

# Atualiza em intervalo moderado somente durante navegação, equilibrando trânsito e bateria.
s=s.replace('if(App.navActive) this.schedule(90000);','if(App.navActive) this.schedule(75000);')
s=s.replace('this.schedule(90000);','this.schedule(75000);')

# Ao encerrar rota, limpa os trechos coloridos sem tocar no núcleo da navegação.
old="""        TrafficAssistantV40.pending=null;
        return originalClear.apply(this,args);"""
new="""        TrafficAssistantV40.pending=null;
        TrafficAssistantV40.clearTrafficOverlay();
        return originalClear.apply(this,args);"""
if old in s:
    s=s.replace(old,new,1)

required=['42-route-traffic-colors','drawTrafficOverlay(route)','radar-route-traffic-orange-v42','radar-route-traffic-red-v42','sectionType=traffic']
missing=[x for x in required if x not in s]
if missing: raise SystemExit('v42 markers missing: '+', '.join(missing))
p.write_text(s,encoding='utf-8')
print('patch v42 aplicado')
