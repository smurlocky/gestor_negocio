import uuid
from datetime import datetime
from pydantic import BaseModel


class StockMovementOut(BaseModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    insumo_id: uuid.UUID
    quantity: float
    type: str
    reason: str | None = None
    user_id: uuid.UUID | None = None
    order_id: uuid.UUID | None = None
    created_at: datetime

    class Config:
        from_attributes = True
