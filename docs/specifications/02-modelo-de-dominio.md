# 02 — Modelo de domínio

## Princípios

O sistema distingue fato de apresentação. Um **evento** representa uma unidade histórica identificável; uma **narrativa** representa um relato situado; uma **relação** representa uma afirmação curada e sustentada por fontes. Região não é texto livre e confiança não significa verdade absoluta.

## Entidades

### Event

| Campo | Tipo | Obrigatório | Regra |
|---|---|---:|---|
| `id` | string | sim | estável, único, formato `evt_[a-z0-9_]+` |
| `title` | string UTF-8 | sim | 1–160 caracteres |
| `date` | `HistoricalDate` | sim | intervalo válido |
| `region_ids` | string[] | sim | pelo menos uma região conhecida |
| `summary` | string UTF-8 | sim | 1–600 caracteres, descrição factual curta |
| `narratives` | `Narrative[]` | sim | ao menos uma no conjunto publicado |
| `source_ids` | string[] | sim | fontes para os dados comuns do evento |

### HistoricalDate

Representa incerteza sem inventar precisão:

```json
{
  "start": "1945-08-06",
  "end": "1945-08-06",
  "precision": "day",
  "circa": false
}
```

`start` e `end` usam ISO 8601 nos níveis permitidos (`YYYY`, `YYYY-MM`, `YYYY-MM-DD`) e devem ter a mesma precisão. `end` não pode anteceder `start`. O MVP aceita anos de `0001` a `9999`; eras anteriores ficam para versão posterior.

### Narrative

| Campo | Tipo | Regra |
|---|---|---|
| `id` | string | único dentro do evento |
| `perspective_id` | string | perspectiva conhecida |
| `language` | string | tag BCP 47, por exemplo `pt-BR`, `fr`, `ja` |
| `text` | string UTF-8 | 1–5.000 caracteres |
| `source_ids` | string[] | pelo menos uma fonte |

### Relationship

| Campo | Tipo | Regra |
|---|---|---|
| `id` | string | estável, formato `rel_[a-z0-9_]+` |
| `source_event_id` | string | evento existente |
| `target_event_id` | string | evento existente e diferente da origem |
| `type` | enum | `influenced`, `funded`, `conflicted`, `enabled`, `responded_to`, `contemporary_with` |
| `directed` | boolean | coerente com o tipo |
| `confidence` | number | inteiro de 1 a 5 |
| `description` | string | explicação de 1–500 caracteres |
| `perspective_ids` | string[] | perspectivas que sustentam a interpretação |
| `source_ids` | string[] | pelo menos uma fonte |

`contemporary_with` é não direcionada; os demais tipos são direcionados. Uma relação não direcionada é armazenada uma vez e percorrida nos dois sentidos.

### Source

| Campo | Tipo | Regra |
|---|---|---|
| `id` | string | estável, formato `src_[a-z0-9_]+` |
| `title` | string | obrigatório |
| `authors` | string[] | pode ser vazio quando autoria é desconhecida |
| `published_year` | integer/null | ano conhecido ou `null` |
| `url` | string/null | `https` quando presente |
| `citation` | string | referência legível e suficiente para localização |
| `kind` | enum | `primary`, `secondary` |

### Region e Perspective

Ambas usam catálogo controlado com `id`, `label` e `description`. `Region` pode ainda possuir `parent_id` para recortes hierárquicos. No MVP, filtrar uma região pai inclui seus descendentes.

## Invariantes verificáveis

- **DOM-01:** todos os IDs e referências são únicos e resolvíveis.
- **DOM-02:** todo texto é UTF-8 válido e normalizado em NFC na importação.
- **DOM-03:** nenhum evento, narrativa ou relação publicado fica sem fonte.
- **DOM-04:** relações duplicadas com mesma origem, destino e tipo são rejeitadas.
- **DOM-05:** relações não direcionadas têm os IDs dos eventos em ordem lexicográfica para serialização determinística.
- **DOM-06:** filtros são aplicados aos eventos antes do cálculo das rotas; uma aresta só participa se seus dois extremos permanecerem no subgrafo.
- **DOM-07:** filtro de perspectiva mantém relações que declarem pelo menos uma das perspectivas selecionadas.
- **DOM-08:** empates de rota são resolvidos pela sequência lexicográfica de IDs, garantindo resultados reproduzíveis.
- **DOM-09:** BFS atribui custo 1 a cada relação.
- **DOM-10:** Dijkstra usa `cost = 6 - confidence`; portanto, maior confiança implica menor custo e todo custo é positivo.
- **DOM-11:** a API nunca expõe ponteiros, índices internos ou ordem de inserção.

## Formato de persistência do MVP

O conjunto é composto por quatro arquivos JSON (`events.json`, `relationships.json`, `sources.json`, `taxonomies.json`). Um JSON Schema versionado valida estrutura; um validador semântico checa as invariantes entre arquivos. A versão do formato é registrada em `dataset_manifest.json` e começa em `1.0`.
