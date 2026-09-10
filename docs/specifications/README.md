# Especificações executáveis do Musubi

Este diretório transforma a visão registrada em
[`Musubi-Project_specifications.md`](../../Musubi-Project_specifications.md) em decisões que podem ser implementadas e verificadas. O documento da raiz continua sendo a fonte da visão; estes arquivos definem o primeiro produto entregável.

## Ordem de leitura

1. [Produto e escopo](01-produto-e-escopo.md): quem usa, qual problema é resolvido e o que entra no MVP.
2. [Modelo de domínio](02-modelo-de-dominio.md): entidades, invariantes e semântica do grafo.
3. [Contrato da API](03-contrato-da-api.md): endpoints, payloads e erros.
4. [Arquitetura](04-arquitetura.md): módulos, dependências e decisões técnicas.
5. [Experiência do usuário](05-experiencia-do-usuario.md): fluxos, estados e acessibilidade.
6. [Plano de entrega](06-plano-de-entrega.md): fatias verticais, critérios e dependências.
7. [Qualidade e operação](07-qualidade-e-operacao.md): testes, desempenho, segurança e observabilidade.
8. [Matriz de rastreabilidade](08-rastreabilidade.md): ligação entre requisito, contrato, teste e marco.

## Hierarquia e manutenção

- A visão da raiz prevalece sobre estes documentos.
- O contrato da API prevalece sobre exemplos de integração presentes nos demais documentos.
- O modelo de domínio prevalece sobre representações internas de código.
- Uma alteração funcional deve atualizar, no mesmo pull request, a especificação afetada e seus testes de aceitação.
- Requisitos usam identificadores estáveis (`PRD-*`, `DOM-*`, `API-*`, `UX-*`, `QLT-*`) para que issues, commits e testes possam apontar para a mesma decisão.
- Texto marcado como **MVP** é compromisso de entrega; texto marcado como **Posterior** não deve bloquear o MVP.

## Definição de pronto de uma mudança

Uma mudança está pronta quando:

1. atende aos critérios de aceitação associados;
2. possui testes no nível mais barato capaz de detectar a regressão;
3. não quebra o contrato público da API sem versionamento;
4. inclui estados de erro, vazio e carregamento quando afeta a interface;
5. atualiza documentação, exemplos e dados de demonstração afetados;
6. passa por `make check` em ambiente limpo.

## Hipóteses adotadas

Para eliminar decisões recorrentes durante o início do projeto, o MVP assume: aplicação local de usuário único, dados curados em arquivo e carregados em memória, API somente leitura, núcleo em C++20, datas históricas possivelmente imprecisas e interface web responsiva. Autenticação, edição colaborativa, banco de grafos e ingestão automática ficam fora do MVP.
