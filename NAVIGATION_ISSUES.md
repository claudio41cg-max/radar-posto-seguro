# Radar Seguro RJ PRO — Pendências de Navegação

Este arquivo é a lista oficial de problemas/melhorias de navegação ainda pendentes.
A regra é resolver **um item por vez**, testar na rua e só então marcar como concluído.

## Pendentes

### N1 — Câmera/mapa não gira acompanhando a seta
**Status:** CORRIGIDO EM CÓDIGO — AGUARDANDO TESTE DE RUA

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
