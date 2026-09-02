from pathlib import Path
import re

p=Path('index.html')
s=p.read_text(encoding='utf-8')
s=re.sub(r'<meta name="radar-build" content="[^"]+">','<meta name="radar-build" content="63-proximity-bypass">',s,count=1)

old="""    const pq=nearestPlaceQuery(command);if(pq)return answerNearestPlace(pq);
    return originalHandle(command,...rest);"""
new="""    const pq=nearestPlaceQuery(command);
    if(pq){
      let cleaned=norm(command)
        .replace(/^radar[, ]*/,'')
        .replace(/\\b(o|a)\\s+(mais proximo|mais proxima|mais perto)\\b/g,' ')
        .replace(/\\b(mais proximo|mais proxima|mais perto|mais perto da minha casa|mais proximo da minha casa|mais proxima da minha casa|perto da minha casa|perto de casa|da minha casa|perto de mim|perto daqui|proximo de mim|proxima de mim)\\b/g,' ')
        .replace(/\\s+/g,' ').trim();
      // Usa o mesmo fluxo que ja funciona quando o motorista fala apenas o destino.
      // Assim a expressao de proximidade nao aciona uma segunda busca geografica concorrente.
      if(!/^(me leve|me leva|leve me|leva me|quero ir|ir|va|vá)\\b/.test(cleaned)) cleaned='me leva para '+pq;
      return originalHandle(cleaned,...rest);
    }
    return originalHandle(command,...rest);"""
if old not in s:
    raise SystemExit('ponto de bypass nao localizado')
s=s.replace(old,new,1)
p.write_text(s,encoding='utf-8')
print('v63 aplicado')
