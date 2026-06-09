# Memória do Projeto - Registro de Decisões (Decisions Log)

Este arquivo documenta as decisões chave de engenharia efetuadas no Módulo 0.

## 01. Abordagem de Isolamento Lógico (Multitenancy)
- **Decisão**: Discriminador de coluna `tenant_id` em banco de dados compartilhado.
- **Racional**: Velocidade de desenvolvimento, facilidade de manutenção de migrações e baixo custo de infraestrutura inicial para PMEs. Isolamento total garantido por validações centralizadas no FastAPI.

## 02. Rotação Granular de Tokens JWT
- **Decisão**: Revogação de Refresh Tokens antigos a cada requisição de `/refresh`.
- **Racional**: Segurança estrita contra replay attacks em redes não confiáveis.

## 03. Registro Auditável Temporal para IA
- **Decisão**: Gravação de colunas JSON `before_state` e `after_state` em cada entrada da tabela `audit_logs`.
- **Racional**: Preparação perfeita dos dados cronológicos estruturados para treinamento de modelos futuros de inteligência artificial.

## 04. Geração Exclusiva de Tokens (Prevenção de Colisão)
- **Decisão**: Inclusão de um claim `jti` (JWT ID) único por meio de `uuid.uuid4()` em todas as emissões de tokens.
- **Racional**: Evita colisões de chave única `UNIQUE` de token em banco de dados quando múltiplos tokens são gerados em milissegundos idênticos (frequente em baterias de testes automáticos).

## 05. Flexibilidade do DB Local (aiosqlite)
- **Decisão**: Conexão assíncrona com SQLite por padrão localmente, expansível a PostgreSQL via config de env.
- **Racional**: Reduz barreira de entrada para execução local do MVP eliminando dependência imediata do Docker/Postgres.
