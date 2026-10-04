# Radar Seguro RJ PRO — Architecture Contract v157

## Objetivo

O aplicativo deve ser modular. Cada domínio tem um único dono. Alterações em um domínio não devem reimplementar, monkeypatchar ou sobrescrever a autoridade de outro domínio.

## Regra principal

**Um domínio = um dono.**

Antes de alterar código:
1. identificar o domínio;
2. editar apenas o módulo dono;
3. não copiar lógica para `index.html`;
4. não sobrescrever métodos de outro módulo;
5. não criar segunda autoridade para GPS, rota, câmera, voz ou progresso;
6. usar eventos/APIs públicas entre módulos;
7. testar o domínio alterado e as integrações diretas.

## Mapa de propriedade

| Domínio | Módulo dono | Pode fazer | Não pode fazer |
|---|---|---|---|
| GPS | `core/radar-gps-v1.js` | adquirir/filtrar posição e estado GPS | calcular rota, desenhar seta, falar |
| Progresso / map matching | `core/radar-route-progress-v1.js` | casar posição com rota e calcular progresso | ler GPS diretamente, recalcular rota |
| Roteamento | `core/radar-routing-v1.js` | TomTom/OSRM, criar/substituir/recalcular rota | controlar câmera, voz ou seta |
| Guidance | `core/radar-guidance-v1.js` | instruções e manobras | criar rota ou ler GPS diretamente |
| Ciclo da navegação | `core/radar-navigation-lifecycle-v1.js` | iniciar/parar/limpar navegação | calcular rota ou desenhar mapa |
| Saída da rota | `core/radar-offroute-v157.js` | decidir quando pedir recálculo | recalcular por conta própria |
| Seta do veículo | `core/radar-arrow-v157.js` | posição/rotação do marcador do carro | controlar câmera, rota, voz ou GPS |
| Câmera | `core/radar-camera-v157.js` | centro, zoom, pitch e bearing da câmera | alterar rota, seta, voz ou GPS |
| Mapa base | `core/radar-map-controller-v157.js` | criar MapLibre e recursos visuais base/3D | ser autoridade de rota/GPS |
| Visual da rota | `core/radar-route-view-v157.js` | linha, resumo e bandeira de destino | calcular/substituir rota |
| Busca | `search-v156.js` | geocodificação e sugestões | iniciar navegação diretamente fora da API do App |
| Hazards | `hazards-v156.js` | lombadas/radares/semáforos OSM da rota | inferir estado de semáforo ou recalcular rota |
| Geometria de comunidades | `community-geometry-v156.js` | cálculos/GeoJSON | UI, voz ou navegação |
| Camadas de comunidades | `community-layers-v156.js` | desenhar/ocultar comunidades | GPS ou rota |
| Alertas de comunidades | `community-alerts-v156.js` | proximidade/entrada/destino em comunidade | calcular rota |
| Outdoor de comunidades | `community-outdoor-v156.js` | HUD lateral de comunidade | modificar navegação |
| Postos | `fuel-module-v156.js` | ANP/GNV/postos e marcadores | GPS/rota/voz |
| MQTT | `mqtt-chat-v156.js` | chat e alertas comunitários | navegação/GPS |
| Tema do mapa | `map-theme-v156.js` | claro/escuro/satélite | rota/GPS |
| Eventos de UI | `ui-events-v157.js` | conectar botões/inputs aos serviços | implementar regra de negócio |
| Motor de fala | `voice/voice-engine-v157.js` | fila e SpeechSynthesis | interpretar comandos ou calcular rota |
| Assistente de voz | `voice/voice-assistant-v157.js` | interpretar comando e chamar serviços | possuir GPS, rota, seta ou câmera |
| GPT bridge/live | `radar-gpt-*.js` | autenticação e conversa GPT | substituir navegação principal |

## Papel do index.html

`index.html` deve ser **composição**, não implementação.

Permitido:
- HTML;
- carregar CSS e módulos;
- configuração;
- criar o objeto App;
- delegações curtas para APIs de módulos;
- inicialização.

Não permitido:
- novos motores de GPS;
- novos motores de rota;
- lógica grande de voz;
- monkeypatch global;
- wrappers que troquem autoridade;
- cópia de código existente de um módulo.

## Regra específica da seta

Mudança de aparência, tamanho ou rotação da seta deve acontecer em:
`core/radar-arrow-v157.js`

Não editar para esse fim:
- `core/radar-routing-v1.js`
- `core/radar-gps-v1.js`
- `core/radar-camera-v157.js`
- `voice/*`

Se for necessária nova informação para a seta, expor essa informação por uma API, sem mover a autoridade do domínio.

## Regra específica da câmera

Mudança de zoom, pitch, bearing, look-ahead ou acompanhamento:
`core/radar-camera-v157.js`

Não alterar a geometria ou o provedor da rota para corrigir câmera.

## Regra específica de rota

Somente `core/radar-routing-v1.js` cria/substitui a rota canônica.
Nenhum módulo pode escrever uma segunda rota em paralelo.

## Regra específica de GPS

Somente `core/radar-gps-v1.js` abre/gerencia ciclo de localização.
Outros módulos consomem posição já publicada.

## Protocolo de mudança

Para cada alteração:
1. atualizar `backup-last` para o `main` atual;
2. escolher **um domínio**;
3. modificar **um módulo dono**;
4. evitar mudanças colaterais;
5. verificar diff;
6. testar;
7. só então passar ao próximo domínio.

## Anti-padrões proibidos

- monkeypatch de `window.fetch`;
- monkeypatch de protótipos MapLibre;
- segundo `watchPosition` fora do RadarGPS;
- segunda autoridade de rota;
- módulo de voz escrevendo rota diretamente;
- módulo de seta controlando câmera;
- módulo de câmera alterando rota;
- timers de polling criados para “esperar outro módulo” quando houver evento/API disponível;
- adicionar código grande de negócio de volta ao `index.html`.

## Estado da modularização v157

A modularização estrutural está em andamento, mas as autoridades principais já estão separadas. Blocos históricos de compatibilidade ainda devem ser tratados como legado e não devem receber novas funcionalidades.
