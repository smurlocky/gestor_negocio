# Memória do Projeto - Funcionalidades Concluídas

## Módulo 0: Fundação SaaS Multitenant, Autenticação, RBAC e Auditoria

### Backend
- [x] Configuração estrutural do app assíncrono.
- [x] Modelagem e migração de banco (`Tenant`, `User`, `RefreshToken`, `AuditLog`).
- [x] Onboarding assíncrono de nova empresa e proprietário (`POST /auth/register-tenant`).
- [x] Autenticação segura JWT, Refresh Tokens e Rotação automática de token (`POST /auth/login`, `/auth/refresh`, `/auth/logout`).
- [x] Injeção de dependência e controle multitenant rígido (`deps.py`).
- [x] CRUD de usuários com restrições hierárquicas RBAC (`/users`).
- [x] Coleta e persistência automática de logs auditáveis (`before_state` e `after_state` em colunas JSON).
- [x] 51 testes automatizados (Pytest) com 97% de cobertura.

### Frontend
- [x] Design visual premium baseado em dark mode refinado, glassmorphism, micro-animações e tipografia moderna (Outfit/Inter).
- [x] Cliente Axios interceptador para injeção de token e auto-refresh de JWT.
- [x] AuthContext de gerenciamento de sessão persistente no LocalStorage.
- [x] Tela de Login moderna e reativa.
- [x] Tela de Registro de Tenant interativa (auto-gerador de slug).
- [x] Dashboard Shell com sidebar colapsável responsiva.
- [x] Dashboard Overview com estatísticas consolidadas do tenant (Total usuários, ações, status).
- [x] CRUD de Colaboradores integrado com abertura de modais fluidos.
- [x] Timeline de logs de auditoria mostrando histórico detalhado das operações.

## Módulo 1: Gestão de Estoque, Produtos, Ficha Técnica e Motor de Baixa Automática

### Backend
- [x] Novos modelos de banco de dados (`Category`, `Insumo`, `Product`, `ProductIngredient`, `Order`, `OrderItem`, `StockMovement`).
- [x] Schemas Pydantic completos para validação de entradas comerciais e receitas.
- [x] Média ponderada móvel unitária automática no lançamento manual de entradas (`INPUT`).
- [x] **Motor de Baixa Automática (Consumo Transacional)**: Dedução atômica de frações de insumos atreladas à receita do produto na realização de vendas (`POST /orders`).
- [x] Rollback atômico e íntegro em falhas de estoque insuficiente ou erros transacionais.
- [x] Isolamento de dados multitenant rígido em todas as consultas e operações de estoque.
- [x] Endpoint unificado `/dashboard` retornando faturamento, contagens, ticket médio e alertas de estoque crítico.
- [x] Testes de integração Pytest cobrindo 100% dos fluxos de baixa e custos, elevando a cobertura total a 97%.

### Frontend
- [x] Tela premium de **Controle de Estoque e Insumos** (`InsumosStock.tsx`):
  - Filtro inteligente de categorias e status (normal, crítico, zerado).
  - Modal dinâmico para cadastrar insumos e unidades de medida.
  - Lançador de movimentação manual (Entrada/Saída/Ajuste) com recálculo automático de custo ponderado.
- [x] Tela premium de **Produtos & Receitas (Ficha Técnica)** (`ProductsRecipes.tsx`):
  - Grid de produtos em estilo glassmorphism elegante com indicadores de margem.
  - **Construtor Interativo de Ficha Técnica**: Cálculo dinâmico do custo agregado dos ingredientes e margem grossa comercial estimada em tempo real com alertas visuais para margens baixas/prejuízo.
- [x] Tela de **Ponto de Venda Simulador (Caixa Rápido)** (`POSSimulator.tsx`):
  - Catálogo de vendas interativo filtrado por categorias para simulação rápida de pedidos.
  - Carrinho ativo com suporte a incremento de quantidades e checkout instantâneo.
  - Timeline de cupons emitidos e processamento reativo de baixa com notificações animadas.
- [x] Widgets gerenciais de alta fidelidade integrados à **Visão Geral** do dashboard (`DashboardShell.tsx`):
  - KPIs de Faturamento Acumulado, Ticket Médio de Vendas, e Contagem de Ruptura de Estoque.
  - Cartões interativos de alerta de segurança detalhando insumos abaixo do limite para compras imediatas.

## Módulo 2: Gestão de Fornecedores & Compras

### Backend
- [x] Novos modelos de banco de dados (`Supplier`, `PurchaseOrder` e `PurchaseItem`) com isolamento estrito de tenant.
- [x] Schemas Pydantic completos para parceiros comerciais e carrinho de compras de suprimentos.
- [x] **Motor de Lançamento Automático de Suprimentos**: Ao transitar um pedido para `COMPLETED`, o sistema automaticamente lança movimentos `INPUT` de entrada para todos os itens.
- [x] Integração de custo médio ponderado móvel atômica ao dar entrada via compras.
- [x] API de Fornecedores completa (`/suppliers`) com rota dedicada para ranqueamento de scorecards (`/suppliers/{id}/performance`).
- [x] API de Compras completa (`/purchases`) com suporte a fluxos transacionais consistentes.
- [x] Suíte de testes Pytest completa (`test_purchases.py`) testando fluxos de ponta a ponta e isolamento multitenant, somando 60 testes de integração no backend com 97% de cobertura geral.

### Frontend
- [x] Tela premium de **Fornecedores & Scorecards** (`SuppliersManagement.tsx`):
  - Detalhe e cadastro completo de parceiros corporativos.
  - Gaveta de Scorecard de Performance consultando e exibindo em tempo real: prazo de entrega médio, notas médias estreladas de preço e qualidade física, e faturamento acumulado.
- [x] Tela premium de **Compras & Lançamentos** (`PurchasesManagement.tsx`):
  - Formulário para registrar notas fiscais e adicionar insumos com subtotais e somas consolidadas.
  - Modal elegante de avaliação (estrelas de preço, qualidade, e dias de entrega) para a transição e conclusão do pedido.
- [x] Integração completa no Sidebar e Dashboard:
  - Novas abas de navegação direta e atalhos reativos ligando alertas de estoque crítico a novas ordens de compras.

## Módulo 3: Gestão de Colaboradores Avançada & Escalas

### Backend
- [x] Novos modelos de banco de dados (`EmployeeSchedule` para jornadas de turnos, `ShiftTrade` para motor de trocas, `Absence` para férias/faltas/licenças) com isolamento lógico estrito.
- [x] Schemas Pydantic completos para turnos (com validação HH:MM via regex), trocas simples/duplas e afastamentos.
- [x] **Motor de Troca Atômica (Shift Swap)**: Ao aprovar um pedido de troca, o sistema realiza uma transação atômica permutando o `user_id` das escalas envolvidas automaticamente.
- [x] **Motor de Limpeza de Conflitos (Absence Wiper)**: Ao registrar ou aprovar um afastamento/licença/férias, o sistema apaga automaticamente qualquer escala conflitante e bloqueia novas atribuições de turnos para o colaborador nesse período.
- [x] APIs completas `/schedules`, `/schedules/trades` e `/schedules/absences` com tags, RBAC e registros em logs auditáveis.
- [x] Suíte de testes Pytest completa (`test_schedules.py`) testando fluxos de ponta a ponta, RBAC, conflitos, swap e isolamento multitenant, somando **64 testes 100% aprovados** com 97% de cobertura geral.

### Frontend
- [x] Tela premium de **Escalas & Turnos** (`SchedulesManagement.tsx`):
  - **Quadro de Escalas**: Grid semanal de alta fidelidade ligando colaboradores aos dias da semana, permitindo atribuições rápidas de turnos em células livres com modais fluidos.
  - **Central de Trocas**: Lista de solicitações de trocas ativas com comparativo visual do turno ofertado vs turno pretendido em cartões minimalistas de aceitação rápida por gestores.
  - **Férias & Afastamentos**: Formulário de registro simplificado de indisponibilidades por colaboradores e interface de aprovações/rejeições de férias por gestores.
- [x] Integração completa no Dashboard Shell (`DashboardShell.tsx`):
  - Importação do componente, adição à listagem de `TabType` e inclusão do botão de navegação "Escalas & Turnos" no menu lateral.

