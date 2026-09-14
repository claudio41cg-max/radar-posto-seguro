# Radar Seguro RJ PRO — pesquisa de navegação v191

Esta etapa compara padrões de projetos open-source maduros e adapta os conceitos ao Radar, sem copiar código incompatível de outros projetos.

## Referências estudadas

- **MapLibre Navigation SDK** — MIT. Padrões usados como referência: separar localização GPS bruta da localização encaixada na rota, snap-to-route, progresso somente quando próximo da rota, detecção de off-route com tolerância e estado de navegação desacoplado da UI.
- **Organic Maps** — Apache 2.0. Referência arquitetural para navegação e mapas offline. Nenhum código binário/mapa do projeto foi incorporado nesta etapa.
- **OsmAnd / OsmAnd-resources** — GPL / recursos próprios. Foi estudado apenas o comportamento e a configuração de recálculo inteligente; nenhum código GPL foi copiado para o Radar.

## Alterações arquiteturais v191

1. Um único motor (`navigation-engine-v191.js`) concentra snap-to-route, progresso, câmera durante a navegação, detecção de desvio e recálculo.
2. GPS bruto é preservado em `rawUserPos`; a seta pode usar uma posição encaixada na geometria da rota somente quando a confiança é suficiente.
3. O progresso não deve saltar para frente por um ponto GPS ruim. Ele só avança quando o veículo está próximo da rota e o segmento é coerente com o sentido de deslocamento.
4. Desvio precisa ser confirmado por várias leituras. Precisão GPS ruim reduz a agressividade do recálculo.
5. Sem internet, a rota atual é mantida e o recálculo é suspenso, em vez de destruir a navegação.
6. Uma nova rota só substitui a antiga depois que o cálculo TomTom terminou com sucesso.
7. Busca TomTom preserva `entryPoints` de POIs. Para estações, mercados, hospitais e locais grandes, o roteamento pode usar um acesso dirigível em vez do centro geométrico do local.

## Próxima etapa: mapa offline

Não foi ativado cache indiscriminado dos tiles externos atuais, porque provedores de tiles têm regras próprias de armazenamento. A próxima etapa deve usar uma fonte explicitamente adequada para offline (por exemplo, pacote próprio/PMTiles ou solução nativa equivalente), com download de região/corredor de rota e atualização controlada.
