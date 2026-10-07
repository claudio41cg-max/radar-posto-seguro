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
**Status:** CORRIGIDO EM CÓDIGO — AGUARDANDO TESTE DE RUA

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

Correção aplicada:
- bearing da rota só é usado quando `matchConfidence > 0`;
- ao perder o snap ou entrar em recálculo, `routeBearing()` retorna `null`;
- seta e câmera então caem para o bearing real/filtrado do movimento;
- quando o novo match volta a ficar confiável, a orientação da rota volta automaticamente.

Falta validar na rua:
- sair de propósito da rota;
- observar se mapa/seta seguem a rua real durante o desvio;
- confirmar recálculo e retorno à nova rota.

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

### N8 — Recálculo chega atrasado e aplica rota já velha
**Status:** CORRIGIDO EM CÓDIGO — SEGUNDA ETAPA APLICADA, AGUARDANDO TESTE DE RUA

Sintoma observado:
- ao sair da rota, o app demora para estabilizar uma nova rota;
- "Rota atualizada" aparece várias vezes;
- se o carro passa da conversão sugerida antes da resposta chegar, o app aplica uma rota que já ficou desatualizada;
- em seguida perde o match de novo e entra em novo recálculo;
- isso faz a orientação/mapa alternar entre esquerda/direita e parecer perdido.

Causas confirmadas no código:
- `recalculateRoute()` usa primeiro `filteredPos`, mesmo existindo `currentRouteOrigin()` que prefere GPS cru recente quando a precisão está boa;
- durante o cálculo o carro continua avançando;
- quando a resposta chega, a nova rota é aplicada sem validar se a posição atual do carro ainda está perto do começo dessa rota;
- não existe hoje um descarte/recalculo imediato de resposta "velha" por deslocamento significativo do veículo.

Referência profissional:
- OsmAnd mantém a localização atual no processo de recálculo;
- ao aplicar a nova rota, reposiciona/valida a rota contra a localização mais recente;
- não trata cegamente o ponto inicial antigo como se ainda fosse a posição do carro.

Correção aplicada:
- o recálculo usa `currentRouteOrigin()` para escolher a posição mais fresca/confiável;
- quando a resposta chega, a posição atual do carro é comparada com a rota recebida usando o próprio `RadarRouteProgress`;
- se a rota não encaixa mais na posição atual, ela é descartada antes de `applyRoute()`;
- respostas envelhecidas deixaram de virar erro imediatamente;
- o Radar permanece em estado de recálculo por uma janela controlada de 15 segundos, renovando silenciosamente a origem conforme o carro anda;
- só uma rota ainda compatível com a posição atual é aplicada;
- se a janela expirar sem rota válida, o ciclo termina sem mostrar uma falsa falha e o detector off-route pode iniciar outro ciclo com posição mais recente;
- erros reais do provedor continuam aparecendo normalmente.

Falta validar na rua:
- sair de propósito da rota;
- continuar andando durante o recálculo;
- passar por uma conversão enquanto a rota está sendo calculada;
- confirmar que não aparece mais "Falha ao atualizar rota" apenas porque a resposta envelheceu;
- confirmar que o app estabiliza uma nova rota sem alternar repetidamente esquerda/direita.

### N9 — GPS não inicia na primeira abertura
**Status:** CONCLUÍDO — VALIDADO EM TESTE REAL

Sintoma:
- ao abrir o Radar, o GPS podia permanecer sem localização;
- após atualizar a página, o GPS passava a funcionar.

Causa confirmada:
- o módulo GPS podia se vincular ao `window.RadarApp` provisório criado antes do `DOMContentLoaded`;
- o módulo também não iniciava `watchPosition()` automaticamente quando o App real ficava pronto;
- o primeiro rastreamento dependia de um evento posterior como `pageshow`/retomada.

Referência profissional:
- OsmAnd ativa `requestLocationUpdates()` quando o provedor de localização entra/retoma o estado ativo;
- o GPS não depende de um refresh manual para começar.

Correção aplicada:
- o GPS agora só se vincula ao App real, validando as APIs esperadas;
- o placeholder inicial é ignorado;
- assim que o App real está pronto e a página está visível, `startTracking()` é chamado automaticamente;
- os fluxos de resume/visibility continuam preservados.

Validação real:
- GPS passou a iniciar corretamente já na primeira abertura, sem precisar atualizar a página.

### N10 — Fluxo manual abre navegação antes de a rota ficar pronta
**Status:** CONCLUÍDO — VALIDADO EM TESTE REAL

Sintoma:
- após digitar um endereço ou tocar numa sugestão, o painel de navegação podia aparecer antes de `App.route` existir;
- se o usuário tocasse em iniciar nesse intervalo, o app respondia como se ainda faltasse uma rota/destino.

Causa confirmada:
- `ui-events-v157.js` chamava `showRoutePanel()` e disparava `calculateRoute()` sem `await`;
- `search-v156.js` fazia o mesmo ao tocar numa sugestão.

Correção aplicada:
- os dois fluxos agora aguardam `await app.calculateRoute()`;
- o painel só abre quando a rota retornou e `app.route` está disponível;
- o botão de iniciar não fica acessível antes da rota estar pronta.

Validação real:
- endereço digitado manualmente;
- rota criada normalmente;
- navegação iniciada sem voltar a pedir destino/rota.

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
