# Memória do Projeto - Arquitetura Atual

## Estrutura do Módulo Base (Módulo 0)
- **Backend (FastAPI)**:
  - `app/core/config.py`: Definições globais.
  - `app/core/database.py`: Conexão assíncrona SQLAlchemy (suporta SQLite e PostgreSQL).
  - `app/core/security.py`: JWT, Refresh Tokens, BCRYPT.
  - `app/models/`: Modelos de banco (`Tenant`, `User`, `RefreshToken`, `AuditLog`).
  - `app/schemas/`: Schemas Pydantic.
  - `app/crud/`: Utilitários CRUD assíncronos.
  - `app/api/deps.py`: Injeção de dependência (`get_current_tenant`, `get_current_user`, `RoleChecker`).
  - `app/api/endpoints/`: Endpoints de autenticação, usuários e auditoria.
  - `tests/`: 51 testes automatizados cobrindo 97% de cobertura real.
- **Frontend (React)**:
  - `src/services/api.ts`: Cliente Axios com auto rotação de token interceptando 401.
  - `src/contexts/AuthContext.tsx`: Sessão de usuário e LocalStorage.
  - `src/pages/Login.tsx`: Login premium glassmorphic dark mode.
  - `src/pages/RegisterTenant.tsx`: Onboarding de novos tenants.
  - `src/pages/DashboardShell.tsx`: Área administrativa, dashboard overview, gerenciamento CRUD de colaboradores e timeline de auditoria.

## Isolamento Multitenant
Isolamento lógico estrito filtrando todas as tabelas pela coluna chave estrangeira `tenant_id` por meio das dependências de rotas operacionais do FastAPI.

## Controle de Acesso (RBAC)
Padrão RBAC granular estabelecido: `SUPER_ADMIN`, `OWNER`, `MANAGER`, `SUPERVISOR`, `OPERATOR`.
