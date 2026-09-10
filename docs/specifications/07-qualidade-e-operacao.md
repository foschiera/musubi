# 07 — Qualidade e operação

## Pirâmide de testes

- **Unidade:** invariantes, datas, filtros, BFS, Dijkstra, desempate e serialização determinística.
- **Componente:** carregamento de cada arquivo, falhas semânticas e publicação transacional do grafo.
- **Contrato:** requisições/respostas contra OpenAPI, incluindo todos os erros públicos.
- **Integração:** dataset demo → API real → respostas conhecidas.
- **Interface:** jornadas críticas em navegador, teclado e viewport móvel.
- **Aceitação:** três demonstrações de `06-plano-de-entrega.md` em ambiente limpo.

Cobertura percentual é diagnóstico, não objetivo isolado. Toda correção de bug começa com teste que reproduz o defeito quando isso for viável.

## Requisitos não funcionais

- **QLT-01 — Correção:** algoritmos são verificados em grafos vazios, desconexos, cíclicos, direcionados, com empate e com Unicode nos metadados.
- **QLT-02 — Desempenho:** com 10.000 eventos e 50.000 relações, uma consulta de rota sem I/O externo termina em p95 ≤ 250 ms na máquina de referência.
- **QLT-03 — API:** com o dataset demo de até 500 eventos, respostas p95 ≤ 300 ms localmente, excluindo renderização do navegador.
- **QLT-04 — Inicialização:** dataset de referência (10.000/50.000) valida e carrega em ≤ 5 s e usa ≤ 512 MiB.
- **QLT-05 — Robustez:** entrada inválida não causa crash, vazamento, leitura fora de limites nem grafo parcial.
- **QLT-06 — Portabilidade:** build e testes passam nas versões suportadas de Linux com compilador documentado; outra plataforma só é declarada suportada quando entra no CI.
- **QLT-07 — Acessibilidade:** fluxos principais passam em auditoria automatizada sem violações críticas/sérias e em roteiro manual de teclado.
- **QLT-08 — Reprodutibilidade:** mesma versão, dataset e consulta produzem a mesma ordenação e rota.

A “máquina de referência” (CPU, RAM, compilador, modo release e comando) deve ser registrada junto ao primeiro benchmark; até lá os números são orçamento, não alegação medida.

## Segurança e privacidade

- validar tamanho, tipo e enum de todo parâmetro antes de processá-lo;
- impor limites de corpo, paginação e subgrafo;
- escapar texto curado na UI; narrativas nunca são HTML executável;
- aceitar somente URLs `https` em fontes publicadas;
- não revelar caminhos locais, stack traces ou conteúdo de arquivos em erros HTTP;
- executar análise estática e sanitizers de endereço/comportamento indefinido no CI ou job periódico;
- gerar inventário de dependências e revisar alertas antes de releases;
- escutar em `127.0.0.1` por padrão, pois o MVP não tem autenticação.

## Observabilidade

Logs estruturados incluem `timestamp`, `level`, `request_id`, `method`, rota normalizada, status e duração. Não incluem corpo de requisição, IP completo por padrão, texto de narrativa ou termo de busca.

O processo expõe:

- `/health` para disponibilidade e versão do dataset;
- contadores de requisições e erros por rota normalizada;
- histograma de duração das consultas;
- duração e resultado do carregamento do dataset.

Uma falha inesperada retorna `INTERNAL_ERROR` com request ID; o detalhe fica somente no log local.

## Gates do CI

`make check` deve executar, nesta ordem lógica (paralelização interna é permitida):

1. verificação de formatação e lint;
2. validação de schemas, OpenAPI e dataset demo;
3. testes unitários e de componente;
4. testes de contrato e integração;
5. build de produção do backend e frontend.

Testes de navegador, sanitizers e benchmarks podem estar em jobs próprios, mas são obrigatórios para release. Nenhum gate deve modificar arquivos versionados silenciosamente.

## Compatibilidade e releases

Versões seguem SemVer para aplicação e contrato de dataset. Cada release registra: commit, versão da API, versão/formato do dataset, toolchain e checksums dos artefatos. Mudanças de schema incluem mensagem de migração ou erro claro de versão incompatível.

## Diagnóstico de falhas de dados

O validador retorna todas as falhas independentes encontradas (até limite documentado) com arquivo, ID do registro, caminho JSON, regra (`DOM-*`) e sugestão. Isso permite ao curador corrigir um lote em vez de repetir um ciclo por erro.
