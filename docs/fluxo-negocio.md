# Fluxos de Negócio - Módulo 0

Esta documentação descreve os principais fluxos operacionais de negócio da base da plataforma SaaS.

---

## 1. Fluxo de Registro de Nova Empresa (Tenant Onboarding)

Este fluxo representa a porta de entrada para novos clientes adquirirem o SaaS.

```mermaid
sequenceDiagram
    actor U as Novo Proprietário (Cliente)
    participant F as Frontend (React)
    participant B as Backend (FastAPI)
    participant DB as Banco de Dados

    U->>F: Preenche dados da empresa e dados pessoais
    F->>B: POST /api/v1/auth/register-tenant
    B->>DB: Valida se slug e e-mail são únicos
    alt Já existem
        DB-->>B: Conflito de dados
        B-->>F: Erro 400 (Slug/E-mail duplicado)
        F-->>U: Exibe mensagem de erro intuitiva
    else Sucesso
        B->>DB: Cria Tenant (tabela tenants)
        B->>DB: Cria Usuário com papel OWNER (tabela users)
        B->>DB: Grava log de auditoria
        DB-->>B: Sucesso
        B-->>F: Retorna dados do proprietário cadastrado
        F->>B: POST /api/v1/auth/login (auto login)
        B-->>F: Emite Tokens JWT (Access e Refresh)
        F-->>U: Redireciona para o Dashboard Shell
    end
```

---

## 2. Fluxo de Login Seguro e Rotação de Token

Este fluxo assegura que as sessões sejam mantidas ativas sem que o usuário precise digitar a senha frequentemente, mantendo a segurança com rotação de refresh token (Token Rotation).

```mermaid
sequenceDiagram
    actor U as Usuário
    participant F as Frontend (React)
    participant B as Backend (FastAPI)
    participant DB as Banco de Dados

    U->>F: Insere e-mail e senha
    F->>B: POST /api/v1/auth/login
    B->>DB: Valida credenciais e se tenant está ativo
    B->>DB: Cria Refresh Token no banco de dados
    B-->>F: Retorna Access Token e Refresh Token
    F->>F: Armazena tokens no LocalStorage

    note over F, B: Ocorre expiração do Access Token (30 min)
    
    F->>B: Faz chamada de API protegida
    B-->>F: Retorna Erro 401 Unauthorized
    
    F->>B: POST /api/v1/auth/refresh?refresh_token=...
    B->>DB: Valida se refresh token é válido e ativo no banco
    B->>DB: Revoga o refresh token atual (segurança de rotação)
    B->>DB: Cria um novo Refresh Token e Access Token
    B-->>F: Retorna novos tokens
    F->>F: Atualiza LocalStorage e refaz chamada original
```

---

## 3. Fluxo de Gestão de Usuários (RBAC)

Fluxo operacional restrito para adição de novos funcionários no time.

1. **Acesso**: O Proprietário (`OWNER`) ou Gerente (`MANAGER`) entra na tela "Colaboradores".
2. **Formulário**: Preenche o nome, e-mail, senha inicial e seleciona o perfil (`OPERATOR`, `SUPERVISOR`, `MANAGER`).
3. **Restrição**:
   - Se o usuário ativo for um `MANAGER`, a seleção de perfil bloqueia a escolha de `OWNER` e `SUPER_ADMIN`.
4. **Gravação**: O Backend cria o usuário associado ao mesmo `tenant_id` do criador, encripta a senha com bcrypt e insere no banco.
5. **Auditoria**: É registrado um log de auditoria relacionando quem criou quem, o IP e o timestamp.
