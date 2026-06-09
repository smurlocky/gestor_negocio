# Memória do Projeto - Problemas Conhecidos (Known Issues)

## 1. Persistência de Dados em SQLite
- **Detalhe**: SQLite não valida nativamente alguns tipos complexos de campos como arrays ou JSON de forma tão estrita quanto o PostgreSQL (JSONB).
- **Ações mitigadoras**: Todos os inputs JSON nos logs de auditoria são validados na camada da aplicação por meio do Pydantic antes de serem persistidos, mitigando incompatibilidades. Para produção, a variável de ambiente `DATABASE_URL` deve obrigatoriamente apontar para uma instância PostgreSQL.

## 2. Mocking de Conexão com Redis
- **Detalhe**: No MVP inicial (Módulo 0), as sessões de token revogados e cache básico são persistidas de forma simplificada em banco e variáveis devido à ausência local do Redis no ambiente do desenvolvedor por padrão.
- **Ações mitigadoras**: O código está preparado com conectores do Redis configurados em `app/core/config.py` (`USE_REDIS`), desativados por padrão localmente para fricção zero.
