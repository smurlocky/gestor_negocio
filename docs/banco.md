# Modelagem de Banco de Dados - Módulos 0, 1 e 2

Esta documentação descreve a modelagem lógica e física do banco de dados (SQLite/PostgreSQL) para a base SaaS multitenant.

---

## 1. Diagrama de Relações Lógicas

```
[tenants] <1>-------<N> [users]
    |
    +-------<N> [categories] <1>-------<N> [insumos] <1>-------<N> [product_ingredients]
    |                                         |                             |
    |                                         +-------<N> [purchase_items]  |
    |                                                                       |
    +-------<N> [products] <1>----------------------------------------------+
    |           |
    |           +---<1> [order_items] <N>-------<1> [orders]
    |
    +-------<N> [suppliers] <1>-------<N> [purchase_orders]
    |
    +-------<N> [stock_movements]
    |
    +-------<N> [audit_logs]
    |
    +-------<N> [employee_schedules] <1>-------<N> [shift_trades]
    |
    +-------<N> [absences]
```

---

## 2. Dicionário de Tabelas (Base e RBAC)

### Tabela `tenants`
Armazena as empresas cadastradas no ecossistema SaaS.
- `id` (UUID, Primary Key): Identificador único global da empresa.
- `name` (VARCHAR(255), Not Null): Nome fantasia do negócio.
- `slug` (VARCHAR(255), Unique, Not Null, Index): Identificador de URL amigável.
- `status` (VARCHAR(50), Default "active"): Estado da conta (`active`, `suspended`, `inactive`).
- `created_at` (TIMESTAMP WITH TIME ZONE): Data/hora de registro.
- `updated_at` (TIMESTAMP WITH TIME ZONE): Última atualização de cadastro.

### Tabela `users`
Armazena as contas de acesso de colaboradores e proprietários.
- `id` (UUID, Primary Key): Identificador único global do usuário.
- `tenant_id` (UUID, Foreign Key -> `tenants.id`, Nullable): Identificador da empresa. Null apenas para administradores globais (`SUPER_ADMIN`).
- `name` (VARCHAR(255), Not Null): Nome completo do usuário.
- `email` (VARCHAR(255), Unique, Not Null, Index): E-mail de acesso.
- `hashed_password` (VARCHAR(255), Not Null): Hash criptografado (bcrypt) da senha.
- `role` (VARCHAR(50), Default "OPERATOR"): Papel organizacional (`SUPER_ADMIN`, `OWNER`, `MANAGER`, `SUPERVISOR`, `OPERATOR`).
- `is_active` (BOOLEAN, Default True): Indicador se a conta está ativa.
- `created_at` (TIMESTAMP WITH TIME ZONE): Data de criação da conta.
- `updated_at` (TIMESTAMP WITH TIME ZONE): Última edição.

### Tabela `refresh_tokens`
Armazena sessões ativas para rotação de tokens JWT.
- `id` (UUID, Primary Key): Identificador único do registro de sessão.
- `user_id` (UUID, Foreign Key -> `users.id`, On Delete CASCADE): Usuário dono da sessão.
- `token` (VARCHAR(512), Unique, Not Null, Index): JWT Refresh Token criptografado.
- `expires_at` (TIMESTAMP): Data limite de expiração.
- `is_revoked` (BOOLEAN, Default False): Indicador se o token foi revogado de forma manual ou automática (por rotação).
- `created_at` (TIMESTAMP): Momento do login/emissão.

### Tabela `audit_logs`
Armazena logs e auditoria detalhados de transações e mudanças de estado.
- `id` (UUID, Primary Key): Identificador único.
- `tenant_id` (UUID, Foreign Key -> `tenants.id`, On Delete CASCADE): Empresa em que a ação ocorreu.
- `user_id` (UUID, Foreign Key -> `users.id`, On Delete SET NULL, Nullable): Usuário executor.
- `action` (VARCHAR(255), Not Null): Nome da ação (ex: `USER_CREATE`, `PRODUCT_UPDATE`).
- `table_name` (VARCHAR(100), Nullable): Tabela de dados afetada.
- `record_id` (VARCHAR(255), Nullable): Chave primária do registro afetado.
- `before_state` (JSON, Nullable): Estado do registro ANTES da alteração.
- `after_state` (JSON, Nullable): Estado do registro DEPOIS da alteração.
- `ip_address` (VARCHAR(45), Nullable): Endereço IP de origem.
- `created_at` (TIMESTAMP): Data/hora precisa do evento.

---

## 3. Dicionário de Tabelas de Estoque e Receitas (Módulo 1)

### Tabela `categories`
Categorias compartilhadas para insumos e produtos.
- `id` (UUID, Primary Key)
- `tenant_id` (UUID, Foreign Key -> `tenants.id`, Index)
- `name` (VARCHAR(255), Not Null)
- `type` (VARCHAR(50), Not Null): Tipo da categoria (`INSUMO` ou `PRODUCT`)
- `created_at` (TIMESTAMP)

### Tabela `insumos`
Cadastro físico de insumos/ingredientes de estoque.
- `id` (UUID, Primary Key)
- `tenant_id` (UUID, Foreign Key -> `tenants.id`, Index)
- `category_id` (UUID, Foreign Key -> `categories.id`, Nullable)
- `name` (VARCHAR(255), Not Null)
- `unit` (VARCHAR(50), Not Null): Unidade de medida (g, ml, un, kg, l)
- `current_stock` (DECIMAL(12,4), Default 0.0): Quantidade física em estoque.
- `minimum_stock` (DECIMAL(12,4), Default 0.0): Limite de segurança de ruptura.
- `unit_cost` (DECIMAL(10,2), Default 0.0): Custo unitário médio ponderado.
- `created_at` (TIMESTAMP)
- `updated_at` (TIMESTAMP)

### Tabela `products`
Cadastro comercial de produtos de venda.
- `id` (UUID, Primary Key)
- `tenant_id` (UUID, Foreign Key -> `tenants.id`, Index)
- `category_id` (UUID, Foreign Key -> `categories.id`, Nullable)
- `name` (VARCHAR(255), Not Null)
- `price` (DECIMAL(10,2)): Preço de venda comercial ao público.
- `is_active` (BOOLEAN, Default True)
- `created_at` (TIMESTAMP)
- `updated_at` (TIMESTAMP)

### Tabela `product_ingredients`
Ficha Técnica de Produtos (árvore de composição de receitas).
- `id` (UUID, Primary Key)
- `product_id` (UUID, Foreign Key -> `products.id`, On Delete CASCADE)
- `insumo_id` (UUID, Foreign Key -> `insumos.id`, On Delete RESTRICT)
- `quantity` (DECIMAL(12,4)): Quantidade exata do insumo gasta para produzir 1 unidade do produto.

### Tabela `orders`
Histórico de cupons de venda de caixa.
- `id` (UUID, Primary Key)
- `tenant_id` (UUID, Foreign Key -> `tenants.id`, Index)
- `total_price` (DECIMAL(10,2)): Total faturado na venda.
- `created_at` (TIMESTAMP)

### Tabela `order_items`
Itens inclusos nas vendas de caixa.
- `id` (UUID, Primary Key)
- `order_id` (UUID, Foreign Key -> `orders.id`, On Delete CASCADE)
- `product_id` (UUID, Foreign Key -> `products.id`, On Delete RESTRICT)
- `quantity` (INTEGER): Quantidade de itens vendidos.
- `unit_price` (DECIMAL(10,2)): Preço de venda unitário gravado historicamente.

### Tabela `stock_movements`
Linha do tempo rastreável de todas as movimentações de inventário.
- `id` (UUID, Primary Key)
- `tenant_id` (UUID, Foreign Key -> `tenants.id`, Index)
- `insumo_id` (UUID, Foreign Key -> `insumos.id`, On Delete CASCADE)
- `quantity` (DECIMAL(12,4)): Quantidade movimentada (positiva para entrada, negativa para saída).
- `type` (VARCHAR(50)): Tipo (`INPUT`, `OUTPUT`, `ADJUSTMENT`, `AUTOMATIC_CONSUMPTION`).
- `reason` (VARCHAR(255), Nullable): Descrição/Observação.
- `user_id` (UUID, Foreign Key -> `users.id`, Nullable)
- `order_id` (UUID, Foreign Key -> `orders.id`, Nullable)
- `created_at` (TIMESTAMP)

---

## 4. Dicionário de Tabelas de Compras e Parceiros (Módulo 2)

### Tabela `suppliers`
Cadastro de fornecedores parceiros comerciais.
- `id` (UUID, Primary Key)
- `tenant_id` (UUID, Foreign Key -> `tenants.id`, Index)
- `name` (VARCHAR(255), Not Null): Razão Social ou Nome Fantasia.
- `document` (VARCHAR(50), Nullable): Registro CNPJ ou CPF para nota fiscal.
- `phone` (VARCHAR(50), Nullable)
- `email` (VARCHAR(255), Nullable)
- `contact_name` (VARCHAR(255), Nullable): Nome do contato comercial.
- `created_at` (TIMESTAMP)
- `updated_at` (TIMESTAMP)

### Tabela `purchase_orders`
Registro de notas e ordens de compra de insumos.
- `id` (UUID, Primary Key)
- `tenant_id` (UUID, Foreign Key -> `tenants.id`, Index)
- `supplier_id` (UUID, Foreign Key -> `suppliers.id`, On Delete RESTRICT)
- `status` (VARCHAR(50), Default "PENDING"): Status (`PENDING`, `COMPLETED`, `CANCELLED`).
- `total_price` (DECIMAL(10,2)): Valor consolidado total.
- `delivery_days` (INTEGER, Nullable): Tempo real corrido de entrega em dias.
- `quality_rating` (INTEGER, Nullable): Nota de qualidade do insumo (1 a 5 estrelas).
- `price_rating` (INTEGER, Nullable): Nota de preço/custo-benefício (1 a 5 estrelas).
- `created_at` (TIMESTAMP)
- `updated_at` (TIMESTAMP)

### Tabela `purchase_items`
Cesta de insumos contidos no pedido de compra.
- `id` (UUID, Primary Key)
- `purchase_order_id` (UUID, Foreign Key -> `purchase_orders.id`, On Delete CASCADE)
- `insumo_id` (UUID, Foreign Key -> `insumos.id`, On Delete RESTRICT)
- `quantity` (DECIMAL(12,4)): Quantidade abastecida.
- `unit_cost` (DECIMAL(10,2)): Preço unitário pago nesta compra.

---

## 5. Dicionário de Tabelas de Escalas e Afastamentos (Módulo 3)

### Tabela `employee_schedules`
Armazena a escala e turnos de trabalho dos colaboradores.
- `id` (UUID, Primary Key)
- `tenant_id` (UUID, Foreign Key -> `tenants.id`, Index)
- `user_id` (UUID, Foreign Key -> `users.id`, On Delete CASCADE, Index): Colaborador escalado.
- `shift_date` (DATE): Data da escala de trabalho.
- `start_time` (VARCHAR(10)): Horário de início do turno (Ex: "08:00").
- `end_time` (VARCHAR(10)): Horário de término do turno (Ex: "16:00").
- `notes` (VARCHAR(255), Nullable): Observações extras do turno.

### Tabela `shift_trades`
Registro de solicitações e transações de troca de turnos.
- `id` (UUID, Primary Key)
- `tenant_id` (UUID, Foreign Key -> `tenants.id`, Index)
- `requesting_user_id` (UUID, Foreign Key -> `users.id`, On Delete RESTRICT): Operador que propôs a troca.
- `target_user_id` (UUID, Foreign Key -> `users.id`, On Delete RESTRICT, Nullable): Substituto proposto.
- `requesting_schedule_id` (UUID, Foreign Key -> `employee_schedules.id`, On Delete CASCADE): Escala ofertada pelo solicitante.
- `target_schedule_id` (UUID, Foreign Key -> `employee_schedules.id`, On Delete CASCADE, Nullable): Escala pretendida em troca.
- `status` (VARCHAR(50), Default "PENDING"): Situação da solicitação (`PENDING`, `APPROVED`, `REJECTED`).
- `approved_by_id` (UUID, Foreign Key -> `users.id`, On Delete SET NULL, Nullable): Gestor aprovador.
- `created_at` (TIMESTAMP)
- `updated_at` (TIMESTAMP)

### Tabela `absences`
Cadastro de férias, faltas e licenças médicas.
- `id` (UUID, Primary Key)
- `tenant_id` (UUID, Foreign Key -> `tenants.id`, Index)
- `user_id` (UUID, Foreign Key -> `users.id`, On Delete CASCADE): Colaborador afastado.
- `start_date` (DATE): Início do período de afastamento.
- `end_date` (DATE): Fim do período de afastamento.
- `type` (VARCHAR(50)): Tipo (`VACATION`, `MEDICAL_LEAVE`, `ABSENCE`, `OTHER`).
- `reason` (VARCHAR(255), Nullable): Justificativa do afastamento.
- `status` (VARCHAR(50), Default "PENDING"): Situação (`PENDING`, `APPROVED`, `REJECTED`).
- `approved_by_id` (UUID, Foreign Key -> `users.id`, On Delete SET NULL, Nullable): Gestor aprovador.

---

## 6. Dicionário de Tabelas de Previsões e Recomendações de IA (Módulo 4)

### Tabela `demand_forecasts`
Grade de série temporal preditiva para faturamento e pedidos de vendas.
- `id` (UUID, Primary Key)
- `tenant_id` (UUID, Foreign Key -> `tenants.id`, Index)
- `target_date` (DATE): Data alvo para a qual a previsão foi realizada.
- `predicted_orders` (INTEGER): Quantidade de pedidos/vendas estimada.
- `predicted_revenue` (DECIMAL(10,2)): Faturamento bruto estimado.
- `confidence_score` (DECIMAL(3,2)): Índice de confiança estatística da previsão (0.00 a 1.00).
- `model_version` (VARCHAR(50)): Identificação da versão do modelo de previsão.
- `created_at` (TIMESTAMP)

### Tabela `ai_recommendations`
Quadro de insights e ações automatizadas geradas pelo scorecard do sistema.
- `id` (UUID, Primary Key)
- `tenant_id` (UUID, Foreign Key -> `tenants.id`, Index)
- `type` (VARCHAR(50)): Tipo do insight (`STOCK_REPLENISHMENT` ou `SHIFT_OPTIMIZATION`).
- `title` (VARCHAR(255)): Título do insight operacional.
- `description` (TEXT): Justificativa analítica detalhada.
- `impact_level` (VARCHAR(50)): Intensidade de prioridade (`HIGH`, `MEDIUM` ou `LOW`).
- `action_data` (JSON, Nullable): Payload estruturado pronto para disparar a automatização de compras ou escalas.
- `status` (VARCHAR(50), Default "PENDING"): Estado do insight (`PENDING`, `APPLIED` ou `DISMISSED`).
- `created_at` (TIMESTAMP)
- `updated_at` (TIMESTAMP)

