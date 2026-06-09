import uuid
from datetime import datetime
from typing import Any
from pydantic import BaseModel


class AuditLogOut(BaseModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    user_id: uuid.UUID | None
    action: str
    table_name: str | None
    record_id: str | None
    before_state: Any | None
    after_state: Any | None
    ip_address: str | None
    created_at: datetime

    class Config:
        from_attributes = True
