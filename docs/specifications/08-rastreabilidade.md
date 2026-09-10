# 08 — Matriz de rastreabilidade

Esta matriz é o ponto de partida para planejar issues e revisar cobertura. Ela não substitui os critérios detalhados dos documentos de origem.

| Resultado | Regras principais | API | UX | Verificação mínima | Marco |
|---|---|---|---|---|---|
| `PRD-01` explorar grafo | `DOM-01`–`DOM-06` | `API-02`, `API-03`, `API-04`, `API-05` | `UX-01`, `UX-11`, `UX-14` | integração do subgrafo + jornada por mouse/teclado | M1–M2 |
| `PRD-02` comparar perspectivas | `DOM-02`, `DOM-03`, `DOM-07` | `API-02`, `API-04` | `UX-03` | fixture multilíngue + snapshot/consulta acessível dos cartões | M1 |
| `PRD-03` descobrir conexão | `DOM-06`, `DOM-08`–`DOM-10` | `API-06` | `UX-02`, `UX-11`, `UX-15` | unidade dos algoritmos + contrato + jornada com e sem rota | M3 |
| `PRD-04` filtrar recorte | `DOM-06`, `DOM-07` | `API-03`, `API-05`, `API-06` | `UX-01`, `UX-02` | integração prova mesmo subgrafo na tela e na rota + restauração por URL | M2–M3 |

## Checklist para abrir uma issue

- selecionar uma linha/resultado da matriz;
- citar IDs específicos e copiar somente os critérios relevantes;
- definir a fixture ou cenário observável que comprova o resultado;
- listar contrato e estados de interface afetados;
- declarar explicitamente o que não será entregue;
- escolher o marco mais próximo que permita demonstração ponta a ponta.

## Checklist para revisão

- a implementação mantém as invariantes citadas?
- os testes falham se o critério de aceite deixar de ser atendido?
- o OpenAPI, os schemas e exemplos continuam coerentes?
- erro, vazio, carregamento e acessibilidade foram tratados?
- a mudança adicionou uma decisão que precisa entrar nas especificações?
