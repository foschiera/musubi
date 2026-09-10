# 06 — Plano de entrega

## Estratégia

O trabalho é organizado em fatias verticais demonstráveis. Cada fatia termina com dados reais de exemplo passando do arquivo até a interface; camadas isoladas sem caso de uso não contam como incremento.

## M0 — Fundação reproduzível

Entrega:

- estrutura mínima do repositório;
- `Makefile` com `build`, `test`, `check` e `run`;
- dependências fixadas e CI executando `make check`;
- página e endpoint de saúde.

Aceite: uma pessoa em ambiente UNIX suportado clona o repositório, executa os comandos documentados e vê a aplicação saudável sem configuração manual oculta.

## M1 — Um evento, várias perspectivas

Entrega:

- schemas e validador;
- dataset demo com fontes, taxonomias e ao menos três idiomas;
- carregamento transacional;
- `/meta`, lista e detalhe de eventos;
- UI de lista e detalhe com narrativas e fontes.

Aceite: demonstração reproduz `PRD-01` e `PRD-02`; fixture com UTF-8 inválido, referência ausente e evento sem fonte falha com diagnóstico preciso.

## M2 — Grafo explorável e filtros

Entrega:

- relações e lista de adjacência;
- endpoint de subgrafo;
- filtros compartilhados entre backend e UI;
- visualização D3, legenda, alternativa em lista e URL compartilhável.

Aceite: demonstração aplica um recorte entre Ásia Oriental e América do Sul, seleciona um evento e restaura o mesmo estado ao abrir o link copiado.

## M3 — Conexões explicáveis

Entrega:

- BFS e Dijkstra determinísticos;
- endpoint de rota;
- seletor de origem/destino e estratégias;
- visualização/lista dos passos, custo e fontes;
- estados “sem rota” e erro.

Aceite: grafos unitários provam caminho mínimo, maior confiança, direção, empate e ausência de rota; a demonstração conecta dois eventos separados por pelo menos duas relações.

## M4 — Endurecimento e release

Entrega:

- limites e índices necessários para o orçamento de desempenho;
- testes de acessibilidade e contrato;
- documentação de execução, autoria de dados e troubleshooting;
- pacote/release reproduzível com dataset demo validado.

Aceite: todos os itens da definição de pronto, `QLT-*` e jornadas do MVP passam em ambiente limpo.

## Ordem recomendada dentro de cada fatia

1. Escrever exemplo de aceitação e fixture mínima.
2. Fixar/ajustar contrato e schema.
3. Implementar domínio e testes unitários.
4. Integrar transporte e testar contrato.
5. Implementar UI, inclusive estados não ideais.
6. Executar o roteiro de demonstração e atualizar documentação.

## Backlog posterior priorizado

1. ferramenta de autoria assistida e revisão editorial;
2. importação/exportação e versionamento de conjuntos;
3. datas anteriores à era comum e calendários alternativos;
4. persistência em banco de grafo após medição justificar a migração;
5. colaboração, permissões e trilha de auditoria;
6. novos algoritmos de descoberta e comparação.

## Política de issues

Cada issue deve conter: requisito (`PRD/DOM/API/UX/QLT`), resultado observável, critérios de aceite, fora de escopo e dependências. Uma issue que atravessa mais de uma semana deve ser dividida pelo resultado do usuário, não apenas por camada técnica.
