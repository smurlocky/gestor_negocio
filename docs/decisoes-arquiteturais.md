# Decisões Arquiteturais (ADRs) - Módulo 0

Esta documentação consolida as principais decisões técnicas tomadas na concepção do Módulo Base do SaaS.

---

## 1. Escolha da Abordagem Multitenant (Logical Isolation)

- **Decisão**: Banco de dados único e isolamento lógico utilizando a coluna discriminante `tenant_id`.
- **Alternativas consideradas**:
  - Múltiplos Schemas do Postgres.
  - Banco de Dados Físico por Cliente (Database-per-tenant).
- **Racional**:
  - **Eficiência e Custo**: Em um MVP escalável de PMEs, gerenciar centenas de conexões e executar migrações de esquemas concorrentes em múltiplos bancos encarece significativamente a infraestrutura inicial.
  - **Facilidade de Manutenção**: A discriminação lógica via SQLAlchemy é extremamente limpa, garantindo isolamento na camada de aplicação, mantendo a facilidade de gerar relatórios consolidados no futuro.
- **Conseqüências**: É imprescindível que as dependências (`deps.py`) forcem e validem o `tenant_id` em todas as rotas operacionais de negócio, o que foi 100% implementado e testado.

---

## 2. Rotação de Refresh Token (Token Rotation)

- **Decisão**: Toda vez que um novo Access Token for solicitado através de um Refresh Token, o Refresh Token antigo é revogado e um novo Refresh Token é emitido (Token Rotation).
- **Racional**:
  - **Prevenção de Replay Attacks**: Se um hacker interceptar um Refresh Token e tentar usá-lo após o proprietário legítimo já ter rodado sua sessão, o backend detecta que o token já foi usado/revogado e invalida a sessão inteira imediatamente, protegendo a conta.
- **Conseqüências**: Exige gravação das sessões e status no banco de dados, o que foi coberto pela tabela `refresh_tokens`.

---

## 3. Estruturação dos Logs de Auditoria com before/after JSONB

- **Decisão**: Gravar estados completos de antes (`before_state`) e depois (`after_state`) em formato JSON/JSONB nos logs de auditoria.
- **Racional**:
  - **AI-First**: Modelos futuros de IA precisam de rastro de dados estruturados claros para prever fluxos de trabalho e anomalias. Guardar a mudança exata do registro facilita o treinamento de redes neurais sem precisar analisar transações cruas de banco ou triggers complexos de DB.
  - **Auditoria Rígida**: O gestor tem visão forense exata do que mudou, quem mudou, qual era o valor antigo e qual o novo valor de forma instantânea.
- **Conseqüências**: Ligeiro aumento do espaço em disco ocupado por logs, mitigável por políticas de expiração de logs antigos no futuro.

---

## 4. Estratégia de Flexibilidade de Banco de Dados Local (SQLite + Async)

- **Decisão**: Utilização de `sqlite+aiosqlite` por padrão localmente, com suporte transparente a `postgresql+asyncpg` configurável via variáveis de ambiente (`DATABASE_URL`).
- **Racional**:
  - **Fricção Zero no Desenvolvimento**: Permite rodar e testar o projeto de forma assíncrona localmente sem requerer Docker, Postgres ou serviços externos configurados por padrão, tornando a experiência de onboarding de novos devs (ou execução local pelo usuário) imediata e livre de problemas.
- **Conseqüências**: Requer listeners adicionais no SQLAlchemy para habilitar chaves estrangeiras (`PRAGMA foreign_keys=ON`) e tratamento cuidadoso de fusos horários/datetimes na camada de banco de dados, os quais foram completamente sanados e testados no conftest.
