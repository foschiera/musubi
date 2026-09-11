# Neo4j local

## Interface de exploração

Execute `docker compose up -d --build` neste diretório e abra
<http://localhost:8000>. A interface é servida pela API, sem um servidor ou build
de frontend separado. HTML, CSS e JavaScript ficam em `web/`, sem dependências
externas de navegador.

Busque um evento, escolha o artigo e aguarde a importação. O grafo permite
selecionar relações, mover o mapa e ajustar o zoom; a lista abaixo oferece acesso
a todas as relações e às fontes com navegação por teclado. Para manter o mapa
legível, a visão geral mostra até 24 relações. O resumo e as referências ficam
disponíveis abaixo do grafo. O calendário e a precisão das datas podem ser
consultados no valor original de cada declaração.

Eventos recentes guardam apenas ID e título no armazenamento local do navegador.
Ao reabri-los, os dados são lidos do Neo4j sem uma nova importação. O endereço
`/#Q6534`, por exemplo, abre esse evento se ele já existir no banco. Uma busca
ou importação com erro preserva o evento que estava aberto.

O teste de navegador `tests/browser_smoke.cjs` usa respostas simuladas, sem
gravar no banco. Com Playwright e Chromium instalados, execute
`node tests/browser_smoke.cjs`. Opcionalmente, defina `PLAYWRIGHT_MODULE` para
o caminho do pacote e `BROWSER_EXECUTABLE` para o executável do navegador.

## Coleta de eventos históricos

Suba o banco e a API com `docker compose up -d --build` neste diretório.
Abra <http://localhost:8000/docs> para testar a API interativamente.

1. Busque o evento: `GET /search?q=Revolução%20Francesa&language=pt`.
2. Escolha o `page_id` do artigo correto entre os resultados.
3. Envie `POST /events/import` com `{"page_id": 123, "language": "pt"}`,
   substituindo `123` pelo ID escolhido. A resposta contém o grafo importado.
4. Consulte a importação salva com `GET /events/{id}`, usando o ID Wikidata
   retornado, como `Q6534`.

Exemplo de busca no terminal:

```bash
curl --get http://localhost:8000/search \
  --data-urlencode 'q=Revolução Francesa' --data-urlencode 'language=pt'
```

A seleção explícita evita importar automaticamente o primeiro resultado de uma
busca ambígua. Idiomas aceitos: português, inglês e espanhol. Cabe ao usuário
selecionar um evento histórico: a API não classifica automaticamente os artigos
como eventos. Páginas ausentes, desambiguações e artigos sem item Wikidata são
recusados. Não são necessárias chaves de API ou serviços de IA.

As fontes iniciais são Wikipédia (introdução do artigo) e Wikidata (declarações
estruturadas). Não há busca geral na web nem extração de fatos do texto livre.
Datas, locais, países, participantes, classes, relações de parte/todo, causas e
efeitos são importados apenas quando declarados na fonte; os dados podem estar
incompletos ou contestados. Datas preservam precisão e calendário originais,
inclusive anos anteriores à era comum. Ranks, qualificadores e referências são
preservados como JSON; declarações depreciadas ou sem valor são ignoradas.

Modelo: `(HistoricalEvent:Entity)-[:HAS_STATEMENT]->(Statement)-[:VALUE]->(Entity)`.
O `Statement.property` identifica a propriedade Wikidata e `predicate` fornece
seu nome legível. Datas ficam em `value_json`. Eventos e declarações têm ligações
`DOCUMENTED_BY` para fontes, com URLs, revisões e horário de consulta. A resposta
também mantém resumo, título, idioma e URL para atribuição da Wikipédia (CC BY-SA);
os dados estruturados Wikidata são CC0. Preserve essa atribuição na futura interface.

Cada importação usa uma transação única e IDs estáveis: repetir a importação não
duplica entidades ou declarações. Declarações removidas da fonte ficam com
`active=false`; a resposta de leitura representa a última importação, no último
idioma solicitado. Somente o evento selecionado é expandido, sem coleta recursiva.

No Neo4j Browser, visualize as relações atuais:

```cypher
MATCH (e:HistoricalEvent)-[:HAS_STATEMENT]->(s:Statement)
WHERE s.active
OPTIONAL MATCH (s)-[:VALUE]->(target:Entity)
RETURN e, s, target;
```

Falhas de fonte retornam HTTP 502, seleção inválida retorna 422 e indisponibilidade
do banco retorna 503. Requisições externas têm timeout de 20 segundos e até três
tentativas. A API é síncrona e local, sem autenticação; a coleta pode levar alguns
segundos. Para uso público serão necessários autenticação, limites e fila de tarefas.
Se a Wikimedia responder 403, a importação falha sem gravar dados: verifique o
acesso de rede e configure `WIKIMEDIA_USER_AGENT` com a identificação e contato
reais do seu projeto. O serviço não contorna bloqueios do provedor.

```bash
python -m venv .venv
.venv/bin/pip install -r requirements.txt
.venv/bin/python -m unittest discover -s tests -v
```

O teste de integração é optativo e deve usar um Neo4j descartável: defina
`NEO4J_TEST_URI` e `NEO4J_TEST_PASSWORD`. Ele grava os IDs de fixture Q100/Q200.
Os demais testes usam respostas HTTP simuladas e não precisam de rede ou banco.

Referências: [MediaWiki Query](https://www.mediawiki.org/wiki/API:Query),
[TextExtracts](https://www.mediawiki.org/wiki/Extension:TextExtracts),
[Wikibase API](https://www.mediawiki.org/wiki/Wikibase/API),
[transações Neo4j](https://neo4j.com/docs/python-manual/current/transactions/).

The Compose stack starts Neo4j and, once the database is healthy, loads an
idempotent sample graph with users, interests, and relationships.

## Start

```bash
cd src
docker compose up -d
docker compose ps --all
```

Neo4j Browser is available at <http://localhost:7474>. Sign in with user
`neo4j` and password `musubi_dev_password`. To use different local credentials
or ports, copy `.env.example` to `.env` and edit its values before starting the
stack.

The initializer is expected to finish with exit code 0. Confirm that it ran and
query the sample graph with:

```bash
docker compose logs neo4j-init
docker compose exec neo4j sh -c 'cypher-shell \
  --username neo4j --password "${NEO4J_AUTH#neo4j/}" \
  "MATCH (node) RETURN labels(node) AS labels, node ORDER BY labels;"'
```

Because the seed uses `MERGE`, it can safely be run again:

```bash
docker compose run --rm neo4j-init
```

## Stop

```bash
docker compose down
```

The named volumes retain the database and logs. For a completely fresh local
database, explicitly remove them with `docker compose down --volumes`.
