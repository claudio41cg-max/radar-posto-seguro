# Radar Seguro RJ PRO — Pendências de Navegação

Este arquivo é a lista oficial de problemas/melhorias de navegação ainda pendentes.
A regra é resolver **um item por vez**, testar na rua e só então marcar como concluído.

## Pendentes

### N1 — Câmera/mapa não gira acompanhando a seta
**Status:** REABERTO APÓS TESTE DE RUA — CAUSA IDENTIFICADA

Teste real: a seta muda de direção, mas o mapa/câmera não acompanha a curva para recolocar o carro visualmente de frente.

Hipóteses já identificadas:
- a seta usa o bearing do segmento casado da rota;
- a câmera ainda calcula bearing de forma independente usando `pointAhead(...)`;
- com velocidade abaixo de 5 km/h a câmera mantém o bearing anterior;
- o recenter ainda usa `currentBearing`, diferente do bearing profissional da seta.

Correção aplicada:
- câmera e seta agora consomem a mesma referência direcional da rota;
- o look-ahead ficou responsável pelo centro/antecipação visual, não pela rotação;
- removido o congelamento antigo do bearing em baixa velocidade quando existe rota ativa;
- preservado follow mode e o controle manual/norte do usuário.

Falta validar na rua:
- curva de 90 graus;
- curva lenta;
- rotatória;
- saída de rotatória.

### N6 — Bearing preso à rota antiga quando o carro sai da rota
**Status:** ABERTO — identificado por vídeo de teste real

Sintoma observado:
- ao entrar propositalmente numa rua fora da rota, a seta/câmera continuam usando o bearing da rota antiga;
- isso pode fazer o carro parecer voltar, o mapa parecer invertido ou uma conversão à esquerda parecer estar à direita;
- o problema acontece antes/durante o recálculo, não porque a nova rota herda o progresso antigo.

Causa confirmada no código:
- quando o map matching perde o snap, `matchConfidence` cai;
- mesmo assim `RadarArrowV157.routeBearing(...)` continua usando `routeProgressIndex` da rota ativa;
- a câmera usa esse mesmo bearing;
- `resetProgress()` do roteamento está correto e zera o progresso quando a nova rota é aplicada.

Referência profissional:
- OsmAnd projeta/balanceia posição e bearing enquanto a posição está adequadamente correlacionada à rota;
- quando há desvio/recálculo, não deve continuar forçando a orientação da rota antiga como verdade do veículo.

Correção desejada:
- usar bearing da rota somente quando o match estiver confiável;
- quando perder o snap ou entrar em off-route/recalc, usar bearing real/filtrado do movimento;
- voltar ao bearing da rota somente após o novo match ficar confiável novamente.

### N7 — Navegação totalmente muda
**Status:** ABERTO — causa identificada no código

Sintoma observado no teste real:
- nenhuma fala de "vire à direita/esquerda";
- nenhuma distância para manobra;
- nenhuma orientação de rua;
- nenhum aviso de recálculo;
- navegação inteira permaneceu muda.

Causa confirmada:
- `voice/voice-engine-v157.js` cria normalmente o motor de fala com `enabled:true`;
- em `app-main-v157.js`, esse motor fica em uma variável local `const Voice`;
- `core/radar-guidance-v1.js` tenta falar usando `window.Voice?.speak(...)`;
- não existe atualmente uma atribuição `window.Voice = Voice`;
- por causa do optional chaining (`?.`), a falha não gera erro visível: a orientação simplesmente não fala.

Correção futura:
- conectar o guidance ao motor de voz por dependência explícita/API, preferencialmente sem depender de global;
- validar fala de início, manobras, chegada e recálculo;
- manter motor de voz separado da lógica de guidance.

### N2 — Map matching: reforçar continuidade e direção
**Status:** PENDENTE

Inspirado em OsmAnd/Navit:
- peso maior para continuidade do segmento atual;
- direção de movimento;
- evitar pular para rua paralela ou segmento errado;
- manter posição projetada no segmento correto.

### N3 — Off-route menos agressivo
**Status:** PENDENTE

Inspirado em Organic Maps/OsmAnd:
- não recalcular por uma única leitura ruim;
- usar persistência temporal/confiança;
- considerar precisão do GPS;
- considerar se a distância da rota está realmente aumentando.

### N4 — Câmera/zoom profissional baseado em velocidade e próxima manobra
**Status:** PENDENTE

Inspirado em OsmAnd:
- abandonar degraus rígidos quando possível;
- usar distância visível baseada em velocidade;
- aproximar a câmera ao chegar perto de curva/manobra;
- manter movimento suave.

### N5 — Rotatórias e curvas: validar seta seguindo a tangente real
**Status:** EM TESTE

A seta v157.1 já deixou de mirar 72 m à frente e passou a usar:
- segmento atual;
- próximo segmento;
- suavização conforme progresso na geometria.

Falta validar após correção N1:
- entrada na rotatória;
- circulação;
- saída correta;
- curva de 90 graus;
- rua sinuosa.

## Concluídos relacionados

### C1 — Separação estrutural dos módulos
**Status:** CONCLUÍDO

GPS, rota, map matching, seta, câmera, recenter, mapa, voz, UI e outros domínios foram separados.

### C2 — Remoção de monkeypatches principais
**Status:** CONCLUÍDO

Foram removidas sobrescritas ocultas como:
- `VoiceAssistant.handle`;
- `window.fetch`;
- `map.easeTo`;
- autoridades paralelas de rota.

## Regra de trabalho

1. Escolher um item desta lista.
2. Atualizar `backup-last`.
3. Alterar somente o módulo dono.
4. Validar diff/sintaxe.
5. Testar na rua quando necessário.
6. Marcar o item como concluído somente após o teste.
