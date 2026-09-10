# 01 — Produto e escopo

## Resultado do MVP

Uma pessoa pesquisadora deve conseguir explorar um conjunto histórico curado, comparar narrativas regionais de um evento e encontrar uma cadeia explicável entre dois eventos sem precisar conhecer bancos de grafos.

## Usuários prioritários

- **Pesquisador/a ou estudante:** investiga relações e confere as fontes de cada afirmação.
- **Curador/a do conjunto de dados:** prepara arquivos válidos e rastreáveis para publicação.
- **Pessoa demonstradora do projeto:** executa o sistema localmente com um único comando e reproduz cenários conhecidos.

## Jornadas do MVP

### PRD-01 — Explorar o grafo

Ao abrir a aplicação, a pessoa vê eventos e conexões, pode mover, ampliar e selecionar um nó. A seleção mostra título, intervalo de data, regiões, narrativas e fontes.

Critérios de aceitação:

- um conjunto inicial de até 500 eventos torna-se interativo em até 3 segundos após a resposta da API em uma máquina de desenvolvimento de referência;
- selecionar um evento não perde o contexto do grafo;
- toda conexão visível informa tipo, direção e grau de confiança.

### PRD-02 — Comparar perspectivas

Na página de um evento, a pessoa vê narrativas separadas por perspectiva e idioma, sem que uma delas seja apresentada como texto neutro ou definitivo.

Critérios de aceitação:

- cada narrativa mostra região/perspectiva, idioma e ao menos uma fonte;
- textos UTF-8 em português, francês e japonês são armazenados, retornados e renderizados sem corrupção;
- quando não existe narrativa para um filtro, a interface explica que o conjunto não possui aquele recorte.

### PRD-03 — Descobrir uma conexão

A pessoa escolhe origem e destino e recebe uma rota entre eles. Cada passo explica por que os eventos estão ligados.

Critérios de aceitação:

- no modo “menos conexões”, o resultado é um caminho mínimo por número de arestas;
- no modo “maior confiança”, o resultado minimiza o custo derivado da confiança, conforme `DOM-10`;
- ausência de rota é um resultado válido e distinto de erro;
- o resultado informa algoritmo, custo total e quantidade de passos.

### PRD-04 — Filtrar por região e perspectiva

A pessoa inclui ou exclui regiões e perspectivas; nós e conexões fora do recorte deixam de participar da visualização e do cálculo de rota.

Critérios de aceitação:

- filtros ativos permanecem visíveis e podem ser limpos em uma ação;
- a rota usa exatamente o mesmo subconjunto mostrado na tela;
- a URL representa seleção e filtros para permitir compartilhamento/reprodução.

## Escopo

### MVP

- leitura de um conjunto de dados versionado;
- listagem e detalhe de eventos;
- narrativas multilíngues e fontes;
- grafo direcionado com tipos de relação;
- BFS e Dijkstra;
- filtros por região, perspectiva, período e tipo de relação;
- interface web responsiva e acessível para exploração e comparação;
- validação offline do conjunto de dados.

### Fora do MVP

- login, permissões e edição pela interface;
- colaboração em tempo real;
- importação automática, scraping ou geração de narrativas por IA;
- recomendação de relações sem curadoria humana;
- Neo4j, distribuição horizontal ou suporte offline completo;
- afirmação automática de causalidade histórica;

## Métricas de sucesso da primeira versão

- os três cenários de demonstração definidos no plano de entrega são concluídos sem intervenção técnica;
- 100% das narrativas e relações publicadas têm ao menos uma fonte;
- zero falhas de validação no conjunto distribuído;
- todos os critérios MVP estão cobertos por teste automatizado ou roteiro de aceitação reproduzível.
