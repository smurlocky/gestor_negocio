# Requisitos do Sistema - Gestor de Negócio

Esta documentação descreve os requisitos funcionais e não funcionais do MVP.

---

## 1. Requisitos Funcionais (RF)

### RF01: Onboarding de Empresa (Tenant)
- O sistema deve permitir que um novo proprietário registre sua empresa informando: nome da empresa, identificador slug único e dados de usuário administrador (nome, e-mail, senha).

### RF02: Autenticação de Usuários
- Os usuários devem poder efetuar login utilizando e-mail e senha.
- A autenticação deve emitir tokens JWT (Access Token com expiração de 30 minutos e Refresh Token com expiração de 7 dias).
- O sistema deve suportar rotação de Refresh Token (Token Rotation) para segurança máxima de sessão.

### RF03: Isolamento Multitenant
- Toda operação de leitura, gravação, alteração ou exclusão deve filtrar os dados exclusivamente pelo tenant ativo associado à requisição.

### RF04: Gestão de Colaboradores (CRUD)
- Usuários com perfil `OWNER` (Proprietário) ou `MANAGER` (Gerente) devem poder cadastrar, listar, atualizar e desativar contas de colaboradores dentro do mesmo tenant.
- Um usuário não pode cadastrar ou atualizar colaboradores para cargos com hierarquia superior ou igual à dele (por exemplo: um `MANAGER` não pode criar um `OWNER`).

### RF05: Logs de Auditoria
- Toda operação crítica (criação de usuário, login, atualizações de perfil, etc.) deve gerar um registro de auditoria contendo: autor, ação, tabela afetada, ID do registro, IP e comparação do estado anterior/posterior (before/after).

---

## 2. Requisitos Não Funcionais (RNF)

### RNF01: Isolamento de Dados Estrito
- Nenhuma informação de um tenant pode ser acessível a usuários de outro tenant. Falhas neste requisito devem retornar `403 Forbidden` ou `404 Not Found`.

### RNF02: Desempenho e Concorrência
- Operações de login e rotas API básicas devem responder em menos de 100ms.
- Utilização de banco de dados assíncrono com SQLAlchemy (`aiosqlite`/`asyncpg`) para evitar bloqueios de threads.

### RNF03: Cobertura de Testes Automatizados
- Cobertura obrigatória mínima de 100% de testes automatizados para todas as lógicas centrais e endpoints da aplicação.

### RNF04: Interface Premium (UX/UI)
- Visual moderno com foco em dark mode refinado, glassmorphism e micro-animações suaves para propiciar uma experiência de alta fidelidade e premium.
