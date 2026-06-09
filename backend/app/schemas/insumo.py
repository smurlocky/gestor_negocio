import uuid
from datetime import datetime
from pydantic import BaseModel, Field


class InsumoBase(BaseModel):
    name: str = Field(..., min_length=2, max_length=255)
    unit: str = Field(..., min_length=1, max_length=50)  # kg, g, l, ml, un
    minimum_stock: float = Field(0.0, ge=0.0)
    category_id: uuid.UUID | None = None


class InsumoCreate(InsumoBase):
    current_stock: float = Field(0.0, ge=0.0)
    unit_cost: float = Field(0.0, ge=0.0)


class InsumoUpdate(BaseModel):
    name: str | None = None
    unit: str | None = None
    minimum_stock: float | None = Field(None, ge=0.0)
    category_id: uuid.UUID | None = None


class InsumoOut(InsumoBase):
    id: uuid.UUID
    tenant_id: uuid.UUID
    current_stock: float
    unit_cost: float
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class StockMovementManual(BaseModel):
    quantity: float = Field(..., gt=0.0, description="Quantidade a movimentar (positiva)")
    type: str = Field(..., pattern="^(INPUT|OUTPUT|ADJUSTMENT)$")
    reason: str | None = Field(None, max_length=255)
