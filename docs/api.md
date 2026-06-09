# Referência da API REST - Módulos 0, 1 e 2

Esta documentação descreve as rotas de API implementadas na plataforma (v1).

*Todas as rotas de negócio exigem os cabeçalhos:*
- `Authorization: Bearer <JWT_ACCESS_TOKEN>`
- `X-Tenant-ID: <TENANT_UUID>`

---

## 1. Módulo de Autenticação (`/api/v1/auth`)

### POST `/register-tenant`
Realiza o registro inicial de uma empresa (Tenant) e seu primeiro Proprietário (`OWNER`).
- **Corpo da requisição**:
  ```json
  {
    "company_name": "Hamburgueria Exemplo",
    "slug": "hamburgueria-exemplo",
    "admin_name": "Carlos Owner",
    "admin_email": "carlos@exemplo.com",
    "admin_password": "senha_segura"
  }
  ```
- **Resposta (201 Created)**: perfil do administrador e tenant criados.

### POST `/login`
Autentica o usuário e emite tokens de acesso.
- **Corpo da requisição** (Form URL Encoded): `username`, `password`.
- **Resposta (200 OK)**: `access_token`, `refresh_token`, `token_type`.

---

## 2. Módulo de Usuários e RBAC (`/api/v1/users`)

### GET `/`
Lista todos os colaboradores pertencentes ao tenant ativo.
- **Restrição**: Apenas `OWNER` e `MANAGER`.

### POST `/`
Cadastra um novo colaborador no tenant.
- **Restrição**: Apenas `OWNER` e `MANAGER`.

### PUT `/{user_id}`
Atualiza dados do colaborador.
- **Restrição**: `OWNER` ou `MANAGER`.

### DELETE `/{user_id}`
Remove um colaborador.

---

## 3. Módulo de Categorias (`/api/v1/categories`)

### GET `/`
Lista as categorias de insumos e produtos.
- **Query Params**: `cat_type=INSUMO` ou `cat_type=PRODUCT` para filtrar.

### POST `/`
Cadastra nova categoria.
- **Restrição**: Apenas `OWNER` e `MANAGER`.

---

## 4. Módulo de Estoque e Insumos (`/api/v1/insumos`)

### GET `/`
Lista o inventário físico de insumos com custos e estoques atuais.

### POST `/`
Cadastra um novo insumo com estoque inicial e custo.
- **Restrição**: Apenas `OWNER` e `MANAGER`.

### POST `/{insumo_id}/movement`
Lança uma movimentação manual de estoque (Entrada/Saída/Ajuste).
- **Corpo da requisição**:
  ```json
  {
    "quantity": 1500.0,
    "type": "INPUT",
    "reason": "Nota Fiscal 321"
  }
  ```
- **Observação**: Entradas (`INPUT`) atualizam automaticamente o **Custo Médio Ponderado Móvel** do insumo.

---

## 5. Módulo de Produtos & Ficha Técnica (`/api/v1/products`)

### GET `/`
Lista os produtos de venda do cardápio e suas fichas técnicas (ingredientes de receita) associadas.

### POST `/`
Cadastra um produto e monta sua Ficha Técnica (ingredientes).
- **Corpo da requisição**:
  ```json
  {
    "name": "Pizza Margherita",
    "price": 45.0,
    "ingredients": [
      { "insumo_id": "insumo-uuid", "quantity": 150.0 }
    ]
  }
  ```

---

## 6. Módulo de Vendas & Baixa Automática (`/api/v1/orders`)

### POST `/`
Registra uma nova venda. Dispara o **Motor de Baixa Automática** de ingredientes.
- **Corpo da requisição**:
  ```json
  {
    "items": [
      { "product_id": "product-uuid", "quantity": 2 }
    ]
  }
  ```
- **Comportamento**: A transação calcula as frações de receitas consumidas, abate do estoque de `insumos` e insere logs `AUTOMATIC_CONSUMPTION` em `stock_movements`. Em caso de estoque insuficiente, a transação inteira sofre rollback.

---

## 7. Módulo de Fornecedores (`/api/v1/suppliers`)

### GET `/`
Lista todos os fornecedores cadastrados na empresa.

### POST `/`
Cadastra um fornecedor comercial.
- **Restrição**: Apenas `OWNER` e `MANAGER`.
- **Corpo da requisição**:
  ```json
  {
    "name": "Tomates do Sul Ltda",
    "document": "98765432000188",
    "phone": "(51) 9999-8888",
    "email": "vendas@tomatesdosul.com",
    "contact_name": "Rita Tomate"
  }
  ```

### GET `/{supplier_id}/performance`
Consolida e retorna o Scorecard de Performance do fornecedor em tempo real.
- **Resposta (200 OK)**:
  ```json
  {
    "average_delivery_days": 3.0,
    "average_quality_rating": 4.8,
    "average_price_rating": 4.5,
    "total_purchases_value": 12500.0,
    "purchase_orders_count": 8
  }
  ```

---

## 8. Módulo de Compras & Entrada (`/api/v1/purchases`)

### GET `/`
Lista todos os lançamentos e notas de compras.

### POST `/`
Cadastra um pedido de compra pendente (`PENDING`).
- **Corpo da requisição**:
  ```json
  {
    "supplier_id": "supplier-uuid",
    "items": [
      { "insumo_id": "insumo-uuid", "quantity": 2000.0, "unit_cost": 0.12 }
    ]
  }
  ```

### PUT `/{purchase_order_id}`
Atualiza o status do pedido de compra ou registra sua avaliação física/comercial.
- **Corpo da requisição**:
  ```json
  {
    "status": "COMPLETED",
    "delivery_days": 4,
    "quality_rating": 5,
    "price_rating": 4
  }
  ```
- **Comportamento Crítico**: Transições de PENDING/CANCELLED para **`COMPLETED`** ativam o motor de abastecimento, lançando entradas `INPUT` no estoque e atualizando o custo médio ponderado unitário dos materiais comprados.

---

## 9. Módulo de Escalas e Trocas (`/api/v1/schedules`)

### GET `/`
Lista todas as escalas e turnos do tenant ativo.
- **Query Params**: `start_date` e `end_date` (formato `AAAA-MM-DD`) opcionais para filtrar intervalo.

### POST `/`
Atribui um turno de trabalho para um colaborador.
- **Restrição**: `OWNER`, `MANAGER` ou `SUPERVISOR`.
- **Validação**: Bloqueia escalações em datas conflitantes com afastamentos ou férias aprovados.
- **Corpo da requisição**:
  ```json
  {
    "user_id": "user-uuid",
    "shift_date": "2026-06-05",
    "start_time": "08:00",
    "end_time": "16:00",
    "notes": "Plantão Cozinha"
  }
  ```

### PUT `/{schedule_id}`
Atualiza dados de uma escala atribuída.
- **Restrição**: `OWNER`, `MANAGER` ou `SUPERVISOR`.

### DELETE `/{schedule_id}`
Remove um turno do quadro de horários.
- **Restrição**: `OWNER`, `MANAGER` ou `SUPERVISOR`.

### GET `/trades`
Lista todos os pedidos de trocas e substituições de turnos.

### POST `/trades`
Registra uma nova solicitação de troca.
- **Validação**: O usuário autenticado (`requesting_user_id`) deve ser o proprietário da escala ofertada.
- **Corpo da requisição**:
  ```json
  {
    "requesting_schedule_id": "schedule-a-uuid",
    "target_user_id": "user-b-uuid",
    "target_schedule_id": "schedule-b-uuid"
  }
  ```

### PUT `/trades/{trade_id}`
Aprova ou rejeita uma solicitação de troca de turno.
- **Restrição**: `OWNER`, `MANAGER` ou `SUPERVISOR`.
- **Efeito Colateral (Atomic Swap)**: Se aprovada (`status: APPROVED`), o sistema executa uma transação atômica que permuta os `user_id` das escalas envolvidas automaticamente no banco de dados.

### GET `/absences`
Lista as férias e afastamentos programados.

### POST `/absences`
Cadastra férias, licenças médicas ou faltas.
- **Comportamento**: Colaboradores criam pedidos `PENDING`. Gestores (`OWNER`, `MANAGER`, `SUPERVISOR`) criam registros `APPROVED` diretamente.
- **Efeito Colateral**: Registros aprovados eliminam (deletam) automaticamente qualquer turno de trabalho conflitante do colaborador no intervalo informado.

### PUT `/absences/{absence_id}`
Aprova ou rejeita um pedido de afastamento de colaborador.
- **Restrição**: `OWNER`, `MANAGER` ou `SUPERVISOR`.

---

## 10. Módulo de IA & Analytics (`/api/v1/ai`)

### GET `/forecast`
Retorna a série temporal preditiva de vendas para os próximos 7 dias.

### GET `/recommendations`
Lista todas as recomendações de IA pendentes (reabastecimento ou otimização de escalas).

### POST `/recommendations/{rec_id}/apply`
Aplica uma recomendação de IA pendente.
- **Restrição**: `OWNER`, `MANAGER` ou `SUPERVISOR`.
- **Efeito Colateral (1-Click Auto Purchase)**: Para `STOCK_REPLENISHMENT`, cria automaticamente uma Ordem de Compra pendente pré-preenchida com o fornecedor e itens recomendados.

### POST `/recommendations/{rec_id}/dismiss`
Dispensa (rejeita) uma recomendação de IA pendente.
- **Restrição**: `OWNER`, `MANAGER` ou `SUPERVISOR`.

### POST `/copilot`
Endpoint de conversação com o Copiloto NLP Direct-SQLite.
- **Corpo da requisição**:
  ```json
  {
    "message": "Como está o faturamento de vendas?"
  }
  ```
- **Resposta**: Retorna a análise real dos dados do tenant formatados em Markdown.

