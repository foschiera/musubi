# 05 — Experiência do usuário

## Estrutura da interface

A aplicação possui uma tela principal com quatro áreas:

1. barra superior com busca, idioma da interface e ação de copiar link;
2. painel de filtros recolhível;
3. tela do grafo;
4. painel de detalhes/rota, lateral em desktop e folha sobreposta em telas estreitas.

O grafo é uma forma de exploração, não a única forma de acesso. Eventos e passos de rota também aparecem como lista navegável.

## Fluxo UX-01 — Exploração

1. A aplicação carrega metadados e um subgrafo inicial.
2. A pessoa busca ou filtra; a URL é atualizada sem recarregar.
3. Selecionar um nó abre detalhes, destaca suas relações diretas e mantém filtros.
4. A tecla `Escape` fecha o detalhe e devolve foco ao nó selecionado.

## Fluxo UX-02 — Rota

1. A pessoa aciona “Conectar eventos”.
2. Escolhe origem e destino por busca textual ou a partir do nó atual.
3. Seleciona “Menos conexões” ou “Maior confiança”.
4. A interface envia filtros visíveis junto da requisição.
5. O resultado destaca apenas a rota e oferece uma lista ordenada com explicação e fontes de cada relação.

Alterar um filtro invalida o resultado anterior e recalcula somente após confirmação explícita, deixando claro o que mudou.

## Fluxo UX-03 — Comparação de narrativas

O detalhe de evento começa pelo resumo comum e depois apresenta narrativas em cartões paralelos quando houver espaço, ou sequenciais no celular. Cada cartão mostra perspectiva, idioma, texto e fontes. A interface nunca funde narrativas em um texto aparentemente consensual.

## Estados obrigatórios

Cada área que consulta dados implementa:

- **carregando:** esqueleto ou indicador com rótulo acessível, sem falso “nenhum resultado”;
- **vazio inicial:** orientação para ampliar filtros ou escolher outro período;
- **sem rota:** mensagem específica, filtros usados e ação para revisá-los;
- **erro recuperável:** explicação curta, request ID e ação de tentar novamente;
- **dataset indisponível:** página de indisponibilidade, sem interface parcialmente funcional;
- **truncado:** aviso persistente de que o grafo é uma amostra e sugestão de refinar filtros.

## Regras visuais e de interação

- cor nunca é o único indicador de região, perspectiva, seleção ou direção;
- setas e legenda comunicam direção; relações não direcionadas não exibem seta;
- títulos permanecem legíveis sem depender de hover;
- zoom e posição visual não entram no link compartilhado; seleção e filtros entram;
- animação respeita `prefers-reduced-motion`;
- datas imprecisas mostram “c.” e a precisão fornecida, sem completar mês/dia inexistente;
- rótulos da UI podem ser traduzidos, mas textos das fontes e narrativas preservam o idioma original.

## Acessibilidade

- **UX-10:** todas as ações podem ser realizadas por teclado fora da manipulação espacial do grafo.
- **UX-11:** existe lista equivalente para selecionar eventos e percorrer uma rota.
- **UX-12:** foco visível, ordem lógica e devolução de foco após fechar painéis.
- **UX-13:** contraste atende WCAG 2.2 AA e alvos têm tamanho adequado.
- **UX-14:** o canvas/SVG possui nome acessível e resumo textual atualizado.
- **UX-15:** atualizações de rota e contagem de resultados são anunciadas sem interromper leitura.

## Responsividade

- a partir de 1024 px: filtros e detalhes podem coexistir com o grafo;
- de 640 a 1023 px: apenas um painel lateral aberto por vez;
- abaixo de 640 px: lista é a visualização inicial e o grafo é uma opção explícita.

## Telemetria do MVP

Não há rastreamento de usuário. Logs técnicos do backend não armazenam consultas completas nem conteúdo de narrativas. Métricas de produto, se adicionadas depois, exigem revisão de privacidade e consentimento adequado.

## Extensão do protótipo — grafo escuro e zoom semântico

- **UX-20:** tema escuro em toda a aplicação; grafo dirigido por forças, com tamanho dos nós proporcional ao número de conexões e destaque da vizinhança ao passar o cursor.
- **UX-21:** zoom entre 25% e 500%, por roda, gesto de pinça, botões ou teclado. Abaixo de 70%, priorizar conexões; de 70% a 220%, exibir títulos; a partir de 220%, revelar datas e cartão do evento selecionado com resumo e acesso a narrativas/fontes.
- **UX-22:** duplo clique, tecla F ou botão no detalhe centralizam um evento. O foco permite escolher profundidade de uma ou duas conexões; eventos externos ficam esmaecidos, sem alterar o subgrafo da API ou a semântica das rotas. A vizinhança considera ambos os sentidos para exploração; o cálculo de caminhos continua respeitando direção.
- **UX-23:** retornar à visão geral restaura a câmera anterior. Arrastar um nó fixa sua posição; redefinir o layout remove as fixações. Controles ajustam repulsão, distância de conexão, rótulos e setas.
- **UX-24:** manter alternativa em lista e acesso por teclado; respeitar preferência por movimento reduzido. Foco/zoom e ajustes de layout são estados locais da sessão.

Verificação: testes de navegador cobrem níveis de detalhe, foco, profundidade, retorno, fixação por arraste, ajustes de exibição e acesso ao detalhe a partir do celular. Auditoria automatizada de acessibilidade cobre a tela inicial escura.
