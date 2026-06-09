# Arquitetura do Sistema - Gestor de Negócio SaaS

Esta documentação descreve a arquitetura técnica e estrutural do SaaS de Gestão de Negócios para PMEs.

---

## 1. Visão Geral da Arquitetura

O sistema é construído sobre o padrão **Clean Architecture** e princípios de **Domain-Driven Design (DDD)** para assegurar desacoplamento de camadas, facilidade de testes unitários e sustentabilidade de evolução contínua, em especial para futuras integrações de Inteligência Artificial (*AI-First*).

```
                      [ CLASSE CLIENTE FRONTEND (Vite + React) ]
                                          |
                                          | (Chamadas HTTP / JSON / JWT)
                                          v
                              [ CAMADA DE API (FastAPI) ]
                                          |
                  +-----------------------+-----------------------+
                  |                       |                       |
                  v                       v                       v
          [ CORE / SEGURANÇA ]      [ MIDDLEWARE ]         [ DEPENDÊNCIAS DE SCOPO ]
                  |                       |                       |
                  +-----------------------+-----------------------+
                                          |
                                          v
                            [ DOMÍNIO / MODELOS (SQLAlchemy) ]
                                          |
                                          v
                         [ REPOSITÓRIOS / CRUD (Async DB) ]
                                          |
                                          v
                          [ INFRAESTRUTURA (Postgres / SQLite) ]
```

---

## 2. Padrão Multitenancy

Adotamos a abordagem de **Banco Único com Isolamento Lógico (Single Database / Shared Schema)**:
- Toda tabela relacionada a dados do negócio possui a coluna `tenant_id` (chave estrangeira referenciando a tabela `tenants`).
- Interceptamos todas as requisições autenticadas no FastAPI por meio do injetor de dependências `get_current_tenant` e `get_current_tenant_user`.
- O isolamento impede que dados vazem entre diferentes tenants, mesmo que um usuário mal-intencionado possua um token JWT válido e manipule cabeçalhos HTTP.

---

## 3. Segurança & RBAC (Role-Based Access Control)

Implementamos um controle rigoroso de papéis de acesso:
- **SUPER_ADMIN**: Acesso irrestrito global para manutenção de infraestrutura (bypassa checagens de tenant).
- **OWNER (Proprietário)**: Acesso total às configurações da empresa (incluindo adição/remoção de gerentes e supervisores).
- **MANAGER (Gerente)**: Gestão operacional diária (pode cadastrar operadores e gerenciar estoque).
- **SUPERVISOR**: Visualização de relatórios e logs, mas sem permissão de alteração de papéis organizacionais.
- **OPERATOR (Operador)**: Apenas leitura e inserção de dados operacionais padrão (vendas, caixa, entrada de insumos).

---

## 4. Filosofia AI-First

Para facilitar a inserção futura de módulos de inteligência artificial (como previsões de ruptura de estoque, anomalias e assistentes baseados em LLMs), a arquitetura base conta com:
- **Auditoria Detalhada (Logs Auditáveis)**: Toda alteração de estado no banco salva o estado anterior (`before_state`) e posterior (`after_state`) em colunas JSONB. Isso provê o histórico temporal perfeito para treinar e rodar modelos preditivos de machine learning.
- **Event Barring / Modularidade**: Lógica de negócios isolada da infraestrutura, permitindo que gatilhos assíncronos sejam acoplados posteriormente para enviar dados à IA.
