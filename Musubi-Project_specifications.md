# Especificação de Projeto: Motor de Grafos Históricos (Historiograph)

## 1. Visão Geral
O Musubi Project é uma aplicação focada em uma arquitetura orientada a grafos para mapear, conectar e contrastar eventos históricos sob diferentes perspectivas regionais. O sistema foge da linearidade cronológica tradicional, permitindo analisar como eventos (ex: na Ásia e na América Latina) se interconectam e como são relatados sob diferentes visões.

## 2. Arquitetura do Sistema e Stack Tecnológico

*   **Motor de Grafos (Backend):** 
    *   Implementação do núcleo de processamento em C ou C++ para garantir controle absoluto sobre o gerenciamento de memória e alta performance no cálculo de caminhos (*shortest path*) e travessia de nós.
    *   Exposição dos dados via uma API REST leve.
*   **Armazenamento de Dados:**
    *   Estrutura inicial customizada em memória (gerenciamento manual de ponteiros, structs estruturadas) para demonstrar proficiência na base computacional. Expansão futura opcional para um banco como Neo4j.
*   **Visualização (Frontend):**
    *   Interface web interativa, consumindo a API e utilizando bibliotecas como D3.js ou vis.js para renderização fluida da teia de eventos no navegador.
*   **Ambiente de Desenvolvimento:**
    *   Arquitetura agnóstica baseada em ferramentas padrão UNIX. Utilização de *Makefiles* para orquestração de compilação.
    *   Estrutura do projeto amigável para integração contínua com *Language Servers* (LSP), como `clangd`, permitindo edição fluida e *linting* robusto diretamente via terminal.

## 3. Funcionalidades Principais

### 3.1. Navegação Multiperspectiva e Multilíngue
*   Cada evento do grafo pode conter múltiplas "Narrativas". O sistema contrastará fontes primárias e secundárias variadas.
*   **Suporte a Internacionalização (i18n):** O processamento de strings deve lidar nativamente com codificações complexas (UTF-8), permitindo indexar e exibir simultaneamente documentos em suas línguas de origem (por exemplo, exibindo fontes em japonês, comentários em francês e análises em português do mesmo período) sem problemas de *encoding*.

### 3.2. Conexão e Descoberta (Pathfinding)
*   O usuário seleciona dois eventos históricos aparentemente isolados. O motor executa algoritmos de busca (*Breadth-First Search* ou *Dijkstra*) para exibir a corrente causal, política ou econômica que conecta os dois pontos na história global.

### 3.3. Filtro Historiográfico Regional
*   Ferramenta analítica para isolar os nós do grafo baseados na origem da perspectiva. Por exemplo, a capacidade de ocultar fluxos de dados focados na Europa e visualizar puramente as intersecções entre os cenários locais do sul global.

## 4. Estrutura de Dados Base (Proposta)

```c
typedef struct Connection {
    struct EventNode* target;
    char* relationship_type; /* ex: "influenciou", "financiou", "conflitou" */
    int weight; /* Para avaliar o peso histórico do dado evento */
} Connection;

typedef struct EventNode {
    unsigned int id;
    char* title;
    char* region; 
    char* date_iso;
    char* perspective_data; /* Estrutura contendo as variações de relatos históricos */
    Connection* edges;
    int edge_count;
} EventNode;
```

