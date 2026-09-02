from pathlib import Path
import re

p=Path('index.html')
s=p.read_text(encoding='utf-8')
s=re.sub(r'<meta name="radar-build" content="[^"]+">','<meta name="radar-build" content="66-terminal-proximity">',s,count=1)

old="""    let normalizedCommand=norm(command);
    // Teste real confirmou que \"mais próximo da minha casa\" usa a referência correta.
"""
new="""    let normalizedCommand=norm(command).replace(/[.,!?;:]+$/g,'').trim();
    // Sem a palavra \"casa\", reconhecimento de voz pode entregar pontuação ou pequenas
    // variações no fim. Convertemos qualquer final \"mais perto/mais próximo\" para a
    // mesma referência que já funciona: \"mais próximo da minha casa\".
    normalizedCommand=normalizedCommand.replace(
      /\\b(mais proximo|mais proxima|mais perto)\\s*$/,
      'mais proximo da minha casa'
    );
    command=normalizedCommand;
    // Teste real confirmou que \"mais próximo da minha casa\" usa a referência correta.
"""
if old not in s:
    raise SystemExit('ponto de normalizacao v65 nao localizado')
s=s.replace(old,new,1)

# Evita executar duas vezes a mesma conversao mais abaixo; mantém compatibilidade sem mudar o fluxo.
s=s.replace("""    if(/\\b(mais proximo|mais proxima|mais perto)\\s*$/.test(normalizedCommand)){
      normalizedCommand=normalizedCommand.replace(/\\b(mais proximo|mais proxima|mais perto)\\s*$/,'mais proximo da minha casa');
      command=normalizedCommand;
    }
""","""    command=normalizedCommand;
""",1)

p.write_text(s,encoding='utf-8')
print('v66 aplicado')
