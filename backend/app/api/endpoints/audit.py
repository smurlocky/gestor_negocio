from typing import Annotated, List
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api import deps
from app.core.database import get_db
from app.crud import get_audit_logs_by_tenant
from app.models.tenant import Tenant
from app.models.user import User
from app.schemas.audit import AuditLogOut

router = APIRouter()


@router.get("/", response_model=List[AuditLogOut])
async def list_audit_logs(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_tenant: Annotated[Tenant, Depends(deps.get_current_tenant)],
    current_user: Annotated[User, Depends(deps.get_current_tenant_user)],
    _: Annotated[User, Depends(deps.RoleChecker(["OWNER", "MANAGER", "SUPERVISOR"]))],
    limit: int = Query(100, ge=1, le=100),
    offset: int = Query(0, ge=0)
):
    """
    List audit logs for the active tenant. Restricted to OWNER, MANAGER or SUPERVISOR.
    """
    logs = await get_audit_logs_by_tenant(db, current_tenant.id, limit=limit, offset=offset)
    return logs
