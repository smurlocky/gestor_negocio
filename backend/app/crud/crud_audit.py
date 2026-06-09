import uuid
from typing import Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from app.models.audit import AuditLog


async def create_audit_log(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    user_id: uuid.UUID | None,
    action: str,
    table_name: str | None = None,
    record_id: str | None = None,
    before_state: Any | None = None,
    after_state: Any | None = None,
    ip_address: str | None = None
) -> AuditLog:
    db_obj = AuditLog(
        tenant_id=tenant_id,
        user_id=user_id,
        action=action,
        table_name=table_name,
        record_id=record_id,
        before_state=before_state,
        after_state=after_state,
        ip_address=ip_address
    )
    db.add(db_obj)
    await db.flush()
    return db_obj


async def get_audit_logs_by_tenant(
    db: AsyncSession, tenant_id: uuid.UUID, limit: int = 100, offset: int = 0
) -> list[AuditLog]:
    result = await db.execute(
        select(AuditLog)
        .filter(AuditLog.tenant_id == tenant_id)
        .order_by(AuditLog.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    return list(result.scalars().all())
