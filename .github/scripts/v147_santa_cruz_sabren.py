from pathlib import Path
import json, re, unicodedata, urllib.parse, urllib.request
BASE='https://pgeo3.rio.rj.gov.br/arcgis/rest/services/SABREN'
def get_json(url,params):
 q=urllib.parse.urlencode(params); req=urllib.request.Request(url+'?'+q,headers={'User-Agent':'Radar-Seguro-RJ/147'})
 with urllib.request.urlopen(req,timeout=45) as r:return json.loads(r.read().decode('utf-8'))
def norm(v):
 s=unicodedata.normalize('NFKD',str(v or '')).encode('ascii','ignore').decode().lower();return re.sub(r'[^a-z0-9]+',' ',s).strip()
geo=get_json(BASE+'/DadosGeraisFavelas/FeatureServer/0/query',{'where':'1=1','outFields':'*','returnGeometry':'true','outSR':'4326','f':'geojson'})
names=get_json(BASE+'/Tabelas_SABREN/FeatureServer/36/query',{'where':'1=1','outFields':'*','returnGeometry':'false','f':'json'})
by_code={}
for row in names.get('features',[]):
 a=row.get('attributes') or {};code=a.get('cod_favela');name=a.get('nome')
 if code is not None and name:by_code.setdefault(str(code),set()).add(str(name))
TARGETS={'Cesarão (Santa Cruz)':['cesarao'],'Comunidade do Rola (Santa Cruz)':['rollas','rola','rolas'],'Comunidade de Antares (Santa Cruz)':['antares'],'Comunidade do Aço (Santa Cruz)':['comunidade do aco','aco'],'Três Pontes (Santa Cruz)':['tres pontes'],'João XXIII (Santa Cruz)':['joao xxiii','joao 23'],'Rodo (Santa Cruz)':['rodo'],'Vila Paciência (Santa Cruz)':['vila paciencia']}
def exact_alias(text,aliases):
 n=norm(text);return any(n==norm(a) or n.startswith(norm(a)+' ') or n.endswith(' '+norm(a)) for a in aliases)
matched={k:[] for k in TARGETS};source_features=[]
for f in geo.get('features',[]):
 p=f.get('properties') or {};code=p.get('cod_favela');candidates=set(by_code.get(str(code),set()))
 for v in p.values():
  if isinstance(v,str) and v.strip():candidates.add(v.strip())
 for app_name,aliases in TARGETS.items():
  if any(exact_alias(c,aliases) for c in candidates):
   g=f.get('geometry')
   if g and g.get('type') in ('Polygon','MultiPolygon'):
    matched[app_name].append(g);source_features.append({'type':'Feature','properties':{'app_name':app_name,'cod_favela':code,'sabren_names':sorted(candidates)},'geometry':g})
   break
# Só substitui o que a base oficial realmente encontrou. Aço pode estar classificado em outra base municipal; nesse caso preserva o contorno anterior, sem inventar.
required=['Cesarão (Santa Cruz)','Comunidade do Rola (Santa Cruz)','Comunidade de Antares (Santa Cruz)']
missing=[x for x in required if not matched[x]]
if missing:raise SystemExit('SABREN não retornou correspondência segura para: '+', '.join(missing))
def aggregate(gs):
 polys=[]
 for g in gs:
  if g['type']=='Polygon':polys.append(g['coordinates'])
  else:polys.extend(g['coordinates'])
 return {'type':'MultiPolygon','coordinates':polys}
def points(geom):
 out=[]
 def walk(x):
  if isinstance(x,list) and len(x)>=2 and all(isinstance(v,(int,float)) for v in x[:2]):out.append(x[:2])
  elif isinstance(x,list):
   for y in x:walk(y)
 walk(geom.get('coordinates',[]));return out
geom_path=Path('data/community-geometries.json');data=json.loads(geom_path.read_text(encoding='utf-8'));data['version']=147;data['description']='Geometrias de comunidades. Em Santa Cruz, os nomes encontrados no SABREN/IPP usam os limites municipais; áreas sem correspondência segura preservam a geometria anterior.'
for name,gs in matched.items():
 if gs:data['geometries'][name]=aggregate(gs)
geom_path.write_text(json.dumps(data,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
idx_path=Path('data/community-index.json');idx=json.loads(idx_path.read_text(encoding='utf-8'));areas=idx.get('areas',[]);area_by={a.get('name'):a for a in areas}
for name,gs in matched.items():
 if not gs:continue
 g=aggregate(gs);pts=points(g);cx=sum(p[0] for p in pts)/len(pts);cy=sum(p[1] for p in pts)/len(pts)
 if name in area_by:area_by[name]['c']=[round(cx,6),round(cy,6)]
 else:
  item={'name':name,'c':[round(cx,6),round(cy,6)],'r':0.35};areas.append(item);area_by[name]=item
idx['version']=147;idx['description']='Índice leve. Centros dos polígonos SABREN de Santa Cruz são derivados das geometrias oficiais; raio é apenas proximidade.';idx_path.write_text(json.dumps(idx,ensure_ascii=False,indent=2),encoding='utf-8')
Path('data/sabren-santa-cruz-v147.geojson').write_text(json.dumps({'type':'FeatureCollection','features':source_features},ensure_ascii=False,separators=(',',':')),encoding='utf-8')
Path('community-geometries-preload.js').write_text("/* Radar Seguro RJ PRO v147 — geometrias Santa Cruz SABREN/IPP */\n(function(){window.RADAR_COMMUNITY_GEOMETRIES="+json.dumps(data['geometries'],ensure_ascii=False,separators=(',',':'))+";window.RadarCommunityGeometriesPreload={version:'147-santa-cruz-sabren',count:Object.keys(window.RADAR_COMMUNITY_GEOMETRIES).length};})();\n",encoding='utf-8')
lines=['/* Radar Seguro RJ PRO v147 — índice Santa Cruz SABREN */','const rawAreas = [']
for a in areas:lines.append('  '+json.dumps(a,ensure_ascii=False,separators=(',',':'))+',')
lines += ['];',"window.RadarCommunityIndexPreload={version:'147-santa-cruz-sabren',count:rawAreas.length};",''];Path('community-index-preload.js').write_text('\n'.join(lines),encoding='utf-8')
p=Path('index.html');s=p.read_text(encoding='utf-8');s=re.sub(r'<meta name="radar-build" content="[^"]+">','<meta name="radar-build" content="147-santa-cruz-sabren">',s,count=1);s=re.sub(r'community-index-preload\.js\?v=\d+','community-index-preload.js?v=147',s,count=1);s=re.sub(r'community-geometries-preload\.js\?v=\d+','community-geometries-preload.js?v=147',s,count=1);p.write_text(s,encoding='utf-8')
sw=Path('service-worker.js');w=sw.read_text(encoding='utf-8');w=re.sub(r"const CACHE_NAME = 'radar-seguro-rj-v\d+';","const CACHE_NAME = 'radar-seguro-rj-v147';",w,count=1);w=re.sub(r"build:'\d+'","build:'147'",w,count=1);w=w.replace('./community-index-preload.js?v=86','./community-index-preload.js?v=147').replace('./community-geometries-preload.js?v=89','./community-geometries-preload.js?v=147');sw.write_text(w,encoding='utf-8')
print('SABREN encontrados:')
for k,v in matched.items():print(k,len(v))
print('v147 preparada; áreas sem correspondência oficial foram preservadas, não inventadas.')
