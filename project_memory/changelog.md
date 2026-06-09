# Memória do Projeto - Registro de Mudanças (Changelog)

Todas as alterações relevantes no repositório são rastreadas abaixo:

## [1.0.0] - 2026-06-02

### Adicionado
- **Setup Inicial**: Orquestração de Docker Compose (Postgres, Redis), `requirements.txt` e configurações de compilação do front React/TS/Vite.
- **Backend FastAPI**:
  - Modelos de banco assíncronos SQLAlchemy (`Tenant`, `User`, `RefreshToken`, `AuditLog`).
  - Segurança integrada com password hashing BCRYPT e tokens JWT.
  - Endpoints operacionais de login, renovação rotação de tokens, onboarding de tenants.
  - CRUD de controle de colaboradores com escopos rígidos RBAC.
  - timeline de logs de auditoria detalhados persistindo estados JSON de antes/depois.
  - 51 testes assíncronos com cobertura de 97%.
- **Frontend React**:
  - Cliente Axios customizado com auto-refresh de JWT.
  - Tela de login premium com glassmorphism e cores HSL refinadas.
  - Tela de onboarding para novas empresas com auto-slug inteligente.
  - Dashboard Shell com navegação por abas responsiva, estatísticas em tempo real, CRUD de colaboradores interativo e visualização de logs de auditoria.

## [1.1.0] - 2026-06-02

### Adicionado
- **Módulo de Estoque e PDV**:
  - **Novos Modelos de Banco**: `Category`, `Insumo`, `Product`, `ProductIngredient`, `Order`, `OrderItem` e `StockMovement` com isolamento estrito de tenant.
  - **Média Ponderada Móvel**: Recálculo automático de custos unitários de estoque no recebimento de entradas de compras manuais.
  - **Motor de Baixa Automática**: Processamento transacional de baixa atômica e deduções de insumos do estoque baseado na ficha técnica no registro de vendas, com suporte a rollback transacional e controle de consistência.
  - **FastAPI Endpoints**: CRUDs assíncronos `/categories`, `/insumos`, `/products`, `/orders`, e rota unificada de dashboard de desempenho financeiro e estoques críticos `/dashboard`.
  - **Test Suite**: Aumento para 57 testes assíncronos passando com sucesso (100% de sucesso) e mantendo 97% de cobertura.
- **Frontend Premium**:
  - **Controle de Estoque (`InsumosStock.tsx`)**: Inventário de insumos interativo, filtros rápidos de status, cadastros e lançador de movimentações manuais integradas.
  - **Produtos & Receitas (`ProductsRecipes.tsx`)**: Grid comercial de produtos, indicadores visuais de lucratividade e **Construtor de Ficha Técnica** integrado calculando margem e custos em tempo real.
  - **Simulador PDV (`POSSimulator.tsx`)**: Caixa rápido com carrinho e checkout integrado disparando o motor de baixa transacional.
  - **Visão Geral Dinâmica (`DashboardShell.tsx`)**: Widgets executivos de Faturamento, Ticket Médio e cartões informativos de alertas de ruptura de estoque físico.

## [1.2.0] - 2026-06-02

### Adicionado
- **Módulo de Fornecedores e Compras**:
  - **Novos Modelos de Banco**: `Supplier`, `PurchaseOrder` e `PurchaseItem` com relacionamentos assíncronos e multitenancy lógico estrito.
  - **Scorecard de Desempenho**: Agregador analítico calculando o prazo médio de entrega real e as notas médias dadas aos fornecedores por estrelas (qualidade física e custo).
  - **Trigger de Abastecimento Automático**: Completar um pedido de compra no banco dispara automaticamente o lançamento de movimentos `INPUT` de estoque e atualiza os custos médios ponderados dos materiais.
  - **FastAPI Endpoints**: CRUDs assíncronos `/suppliers`, `/suppliers/{id}/performance`, e `/purchases` integrados com logs e controle RBAC.
  - **Test Suite**: Aumento para 60 testes de integração assíncronos Pytest passando com sucesso, validando compras, integridade e isolamento.
- **Frontend Premium**:
  - **Parceiros Fornecedores (`SuppliersManagement.tsx`)**: CRUD de contatos e Scorecard de Performance com estrelas de rating dinâmicas em amarelo.
  - **Compras e Suprimentos (`PurchasesManagement.tsx`)**: Tabela de rastreamento de notas fiscais, formulário dinâmico de novos pedidos e modal de avaliação para recebimento.
  - **Overview Dashboard Integrada (`DashboardShell.tsx`)**: Enlace de atalhos rápidos ligando alertas de estoque crítico à criação automática de ordens de suprimentos.

## [1.3.0] - 2026-06-02

### Adicionado
- **Módulo de Escalas e Trocas de Turno**:
  - **Novos Modelos de Banco**: `EmployeeSchedule` (grade de turnos), `ShiftTrade` (motor de trocas de escalas) e `Absence` (férias, licenças e faltas) com isolamento estrito de tenant.
  - **Motor de Troca Atômica (Shift Swap)**: Ao aprovar um pedido de troca, o banco de dados executa uma transação atômica permutando a titularidade (`user_id`) das escalas envolvidas.
  - **Validador de Afastamentos & Wipes**: Regra que impede a atribuição de escala de trabalho para funcionários ausentes/afastados, além de deletar (limpar) automaticamente qualquer escala conflitante já agendada no intervalo de uma nova licença ou férias aprovadas.
  - **FastAPI Endpoints**: CRUDs assíncronos `/schedules`, `/schedules/trades` e `/schedules/absences` protegidos por RBAC e logs auditáveis completos (com antes/depois).
  - **Test Suite**: Criação de bateria de testes complexos em `backend/tests/test_schedules.py`, elevando o total de testes para **64 testes 100% verdes** sob pytest.
- **Frontend Premium**:
  - **Central de Escalas & Turnos (`SchedulesManagement.tsx`)**:
    - **Quadro de Escalas**: Grid interativo semanal conectando colaboradores aos dias da semana, permitindo atribuições rápidas de turnos em células livres com layouts de vidro premium e paletas harmônicas.
    - **Central de Trocas**: Lista de solicitações ativas com comparativo visual do turno ofertado vs turno pretendido em cartões minimalistas de aceitação rápida por gestores.
    - **Afastamentos & Férias**: Registro simplificado de indisponibilidades com tagging de status (amber, emerald, red) reativa e aprovações rápidas.
  - **Dashboard Shell (`DashboardShell.tsx`)**: Integração da nova aba de Escalas & Turnos no sidebar principal, unindo os colaboradores às suas respectivas jornadas de trabalho em tempo real.

## [1.4.0] - 2026-06-02

### Adicionado
- **Módulo de IA Analytics & Copiloto (AI-First)**:
  - **Tabelas Analíticas de IA**: Modelagem física das tabelas `demand_forecasts` e `ai_recommendations`.
  - **Motor de Previsão de Demanda**: Algoritmo analítico projetando faturamento e volume de pedidos para os próximos 7 dias baseado em histórico real e modulações climáticas/aleatórias.
  - **Insights Acionáveis (1-Click Auto-Purchase)**: Cruzamento de previsões com níveis de estoque para sugerir reabastecimento inteligente com o melhor fornecedor do scorecard. A aplicação gera um pedido de compra pendente instantaneamente.
  - **Copiloto Conversacional NLP**: Chatbot integrado que processa consultas em linguagem natural por meio de buscas diretas em SQLite (faturamento, escalas de hoje, estoque crítico) de forma instantânea e sem custos de API.
  - **Visualizadores Gráficos**: Gráfico em curvas SVG neon com gradientes reativos e balões de informações interativos em hover.
- **Melhorias Premium de UX & Experiência de Usuário**:
  - **Validação Inline Reativa**: Inputs de e-mail, senha, slug e empresa do Onboarding validam dados em tempo real, mudando a cor das bordas (Rose/Emerald) com dicas de feedback antes do submit.
  - **Alternador de Visibilidade de Senha**: Botões de ícones de olho (`Eye` / `EyeOff`) integrados nos campos de senha de login e cadastro.
  - **Efeito de Digitação Gradual (Streaming Typewriter)**: Respostas do Copiloto de IA fluem na tela palavra por palavra de forma animada e em alta definição.
  - **Legenda Visual**: Legenda de cores explicativa para os status de escalas no Quadro de Horários.
- **Ajustes de Integridade de Código**:
  - Resolução de erros estritos de tipagem do compilador TypeScript (`TS18047` nulos/undefined).
  - Limpeza de imports e variáveis locais não utilizadas.
  - Build de produção via Vite e suíte completa de backend (68 testes verdes) 100% funcionais.
