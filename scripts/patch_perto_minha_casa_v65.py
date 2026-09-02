from pathlib import Path
import re

p=Path('index.html')
s=p.read_text(encoding='utf-8')
s=re.sub(r'<meta name="radar-build" content="[^"]+">','<meta name="radar-build" content="65-perto-minha-casa">',s,count=1)

needle="""    let normalizedCommand=norm(command);
    // O usuário confirmou em teste real que \"mais próximo da minha casa\" funciona.
"""
replacement="""    let normalizedCommand=norm(command);
    // Teste real confirmou que \"mais próximo da minha casa\" usa a referência correta.
    // Normalize também as formas naturais \"perto de minha casa\" / \"perto da minha casa\"
    // para exatamente a mesma intenção antes de qualquer regex ou busca concorrente.
    normalizedCommand=normalizedCommand
      .replace(/\\b(perto de minha casa|perto da minha casa|perto de casa)\\b/g,'mais proximo da minha casa');
    command=normalizedCommand;
    // O usuário confirmou em teste real que \"mais próximo da minha casa\" funciona.
"""
if needle not in s:
    raise SystemExit('ponto v64 nao localizado')
s=s.replace(needle,replacement,1)
p.write_text(s,encoding='utf-8')
print('v65 aplicado')
