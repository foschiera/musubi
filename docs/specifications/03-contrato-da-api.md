# 03 — Contrato da API REST

## Convenções

- Prefixo: `/api/v1`.
- Conteúdo: `application/json; charset=utf-8`.
- IDs são opacos para clientes.
- Datas seguem `HistoricalDate`.
- Listas têm ordem determinística e paginação por cursor.
- Parâmetros desconhecidos retornam `400`; recursos inexistentes retornam `404`.
- O contrato formal deve ser mantido em `openapi/musubi-v1.yaml`; este documento define o comportamento esperado até esse arquivo existir.

## Endpoints do MVP

### API-01 — Saúde

`GET /health`

Retorna `200` com `{ "status": "ok", "dataset_version": "..." }` quando o processo atende requisições e o conjunto foi carregado. Retorna `503` quando o conjunto não está disponível.

### API-02 — Metadados e taxonomias

`GET /api/v1/meta`

Retorna versão do contrato, versão do conjunto, regiões, perspectivas, idiomas, tipos de relação, limites e capacidades habilitadas.

### API-03 — Listar eventos

`GET /api/v1/events`

Parâmetros:

| Nome | Exemplo | Semântica |
|---|---|---|
| `region` | `south_america,east_asia` | união entre valores |
| `perspective` | `brazilian,japanese` | união entre valores |
| `from` / `to` | `1930` / `1960-12-31` | sobreposição com o intervalo |
| `relationship_type` | `influenced` | evento participa desse tipo |
| `q` | `industrialização` | busca insensível a caixa em título e resumo |
| `limit` | `50` | 1–200, padrão 50 |
| `cursor` | opaco | próxima página |

Resposta resumida:

```json
{
  "items": [{
    "id": "evt_example",
    "title": "Exemplo",
    "date": {"start": "1945", "end": "1945", "precision": "year", "circa": false},
    "region_ids": ["south_america"],
    "summary": "Resumo curto."
  }],
  "next_cursor": null,
  "total": 1
}
```

### API-04 — Detalhar evento

`GET /api/v1/events/{event_id}`

Retorna todos os campos do evento, narrativas e fontes referenciadas. `?language=pt-BR` prioriza essa língua, mas não remove as demais.

### API-05 — Obter subgrafo

`GET /api/v1/graph`

Aceita os filtros de `API-03`, mais `limit` (padrão 500, máximo 2.000). Retorna `{ "nodes": [...], "edges": [...], "truncated": false }`. Se o limite for excedido, retorna uma seleção determinística, `truncated: true` e aviso legível; nunca entrega aresta com extremo ausente.

### API-06 — Calcular rota

`POST /api/v1/paths`

Requisição:

```json
{
  "from_event_id": "evt_a",
  "to_event_id": "evt_b",
  "strategy": "fewest_hops",
  "filters": {
    "region_ids": ["south_america", "east_asia"],
    "perspective_ids": [],
    "relationship_types": [],
    "from": null,
    "to": null
  }
}
```

`strategy` aceita `fewest_hops` (BFS) e `highest_confidence` (Dijkstra). Resposta encontrada:

```json
{
  "found": true,
  "strategy": "fewest_hops",
  "total_cost": 2,
  "events": ["evt_a", "evt_middle", "evt_b"],
  "relationships": ["rel_1", "rel_2"]
}
```

Sem rota, retorna `200` com `found: false`, custo e listas como `null`/vazias e `reason: "no_path_in_filtered_graph"`.

## Erros

Todo erro usa o mesmo envelope:

```json
{
  "error": {
    "code": "INVALID_FILTER",
    "message": "O filtro 'region' contém um valor desconhecido.",
    "details": {"values": ["unknown"]},
    "request_id": "req_01..."
  }
}
```

Códigos mínimos: `INVALID_REQUEST`, `INVALID_FILTER`, `EVENT_NOT_FOUND`, `DATASET_UNAVAILABLE`, `LIMIT_EXCEEDED`, `INTERNAL_ERROR`.

## Compatibilidade

- Campos podem ser adicionados em `/v1`; remoção, renomeação ou mudança de semântica exige `/v2`.
- Clientes devem ignorar campos desconhecidos.
- Snapshots OpenAPI e testes de contrato impedem mudanças acidentais.
