# 04 — Arquitetura

## Decisões para o MVP

| Área | Decisão | Motivo produtivo |
|---|---|---|
| Núcleo | C++20, sem dependência de HTTP | algoritmos testáveis em milissegundos e reutilizáveis |
| Processo | monólito modular | implantação e depuração simples |
| Dados | JSON validado, carregado em memória | diffs revisáveis e ausência de infraestrutura |
| API | REST/JSON, adaptador fino | contrato compreensível por navegador e CLI |
| Frontend | TypeScript + D3.js | tipagem do contrato e visualização adequada a grafos |
| Build | `Makefile` como interface pública | comandos consistentes no UNIX e no CI |
| Contratos | OpenAPI + JSON Schema | geração/validação e menos divergência entre camadas |

Bibliotecas concretas de HTTP, JSON, testes e build interno podem ser escolhidas no bootstrap, mas devem ser fixadas por lockfile ou versão vendorizada. A interface diária continua sendo `make`, mesmo que CMake seja usado por baixo.

## Limites dos módulos

```text
dataset files -> loader/validator -> domain graph -> query/path services
                                                -> HTTP adapter -> web client
```

- `domain`: tipos, invariantes, grafo e algoritmos; não conhece HTTP, arquivos ou UI.
- `dataset`: parsing, normalização, validação e construção transacional do grafo.
- `application`: filtros, consultas, paginação e casos de uso.
- `http`: roteamento, serialização, códigos de status e request ID.
- `web`: estado de tela, consumo da API e renderização; não reimplementa pathfinding.

Dependências apontam para dentro: adaptadores dependem de aplicação e domínio, nunca o inverso.

## Estrutura alvo

```text
api/openapi/musubi-v1.yaml
data/demo/{dataset_manifest,events,relationships,sources,taxonomies}.json
schemas/*.schema.json
src/domain/
src/dataset/
src/application/
src/http/
tests/{unit,integration,contract,fixtures}/
web/src/
docs/specifications/
Makefile
```

Diretórios devem nascer apenas quando sua primeira fatia for implementada; a árvore é um destino, não uma tarefa de scaffolding isolada.

## Fluxo de inicialização

1. Ler o manifesto e verificar versão compatível.
2. Validar JSON Schema e referências entre arquivos.
3. Normalizar UTF-8 e construir um grafo temporário.
4. Verificar todas as invariantes de domínio.
5. Publicar o grafo imutável para consultas.
6. Iniciar HTTP e marcar `/health` como disponível.

Qualquer erro aborta antes de servir tráfego e informa arquivo, localização lógica e regra violada. O grafo nunca fica parcialmente carregado.

## Representação do grafo

- mapa `event_id -> Event` para acesso estável;
- lista de adjacência por evento, contendo IDs de relações;
- índices secundários por região, perspectiva, intervalo e tipo de relação;
- ownership por RAII e valores/ponteiros inteligentes; ponteiros crus não possuem memória;
- strings são UTF-8, sem corte por byte em limites de API/UI;
- a ordem externa é explicitamente ordenada, nunca dependente de hash map.

## Configuração

Variáveis suportadas:

| Variável | Padrão | Uso |
|---|---|---|
| `MUSUBI_DATASET_DIR` | `data/demo` | conjunto carregado |
| `MUSUBI_HOST` | `127.0.0.1` | interface de escuta |
| `MUSUBI_PORT` | `8080` | porta HTTP |
| `MUSUBI_LOG_LEVEL` | `info` | `debug`, `info`, `warn`, `error` |

Configuração inválida falha imediatamente com mensagem acionável. Segredos não são necessários no MVP.

## Comandos públicos

- `make setup`: verifica ferramentas e instala dependências locais reproduzíveis.
- `make build`: compila backend e frontend.
- `make run`: executa a aplicação com o conjunto demo.
- `make check`: formatação, lint, validação de dados e todos os testes exigidos no CI.
- `make test`: testes sem alterar arquivos-fonte.
- `make validate-data DATASET=...`: valida um conjunto sem iniciar o servidor.

Todos devem ser não interativos, retornar código diferente de zero em falha e funcionar a partir da raiz.

## Restrições arquiteturais

- **ARC-01:** o domínio não importa bibliotecas de transporte ou persistência.
- **ARC-02:** um dataset só substitui o atual após validação completa.
- **ARC-03:** a UI obtém taxonomias de `/meta`; não mantém listas duplicadas.
- **ARC-04:** nenhuma regra de rota existe somente no frontend.
- **ARC-05:** dependências de produção exigem justificativa, licença compatível e versão fixada.
- **ARC-06:** o MVP não introduz banco, fila, contêiner obrigatório ou microsserviço sem evidência de necessidade.
