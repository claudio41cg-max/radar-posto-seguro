from pathlib import Path
import re

p=Path('index.html')
s=p.read_text(encoding='utf-8')
s=re.sub(r'<meta name="radar-build" content="[^"]+">','<meta name="radar-build" content="64-proximity-alias">',s,count=1)

old="""    const pq=nearestPlaceQuery(command);
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

new="""    let normalizedCommand=norm(command);
    // O usuário confirmou em teste real que \"mais próximo da minha casa\" funciona.
    // Portanto, quando a frase termina apenas em \"mais próximo/mais perto\", tratamos
    // isso como o mesmo pedido relativo à posição atual/casa, sem deixar outro fluxo decidir.
    if(/\\b(mais proximo|mais proxima|mais perto)\\s*$/.test(normalizedCommand)){
      normalizedCommand=normalizedCommand.replace(/\\b(mais proximo|mais proxima|mais perto)\\s*$/,'mais proximo da minha casa');
      command=normalizedCommand;
    }
    const pq=nearestPlaceQuery(command);
    if(pq){
      let cleaned=norm(command)
        .replace(/^radar[, ]*/,'')
        .replace(/\\b(mais perto da minha casa|mais proximo da minha casa|mais proxima da minha casa|perto da minha casa|perto de casa|perto de mim|perto daqui|proximo de mim|proxima de mim|da minha casa)\\b/g,' ')
        .replace(/\\b(o|a)\\s+(mais proximo|mais proxima|mais perto)\\b/g,' ')
        .replace(/\\b(mais proximo|mais proxima|mais perto)\\b/g,' ')
        .replace(/\\s+/g,' ').trim();
      if(!/^(me leve|me leva|leve me|leva me|quero ir|ir|va|vá)\\b/.test(cleaned)) cleaned='me leva para '+pq;
      return originalHandle(cleaned,...rest);
    }
    return originalHandle(command,...rest);"""

if old not in s:
    raise SystemExit('bloco v63 nao localizado')
s=s.replace(old,new,1)
p.write_text(s,encoding='utf-8')
print('v64 aplicado')
