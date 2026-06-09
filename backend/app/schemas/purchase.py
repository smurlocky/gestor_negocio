import uuid
from datetime import datetime
from typing import List
from pydantic import BaseModel, Field
from app.schemas.insumo import InsumoOut
from app.schemas.supplier import SupplierOut


class PurchaseItemBase(BaseModel):
    insumo_id: uuid.UUID
    quantity: float = Field(..., gt=0.0)
    unit_cost: float = Field(..., ge=0.0)


class PurchaseItemCreate(PurchaseItemBase):
    pass


class PurchaseItemOut(PurchaseItemBase):
    id: uuid.UUID
    purchase_order_id: uuid.UUID
    insumo: InsumoOut | None = None

    class Config:
        from_attributes = True


class PurchaseOrderBase(BaseModel):
    supplier_id: uuid.UUID


class PurchaseOrderCreate(PurchaseOrderBase):
    items: List[PurchaseItemCreate] = Field(..., min_length=1)


class PurchaseOrderUpdate(BaseModel):
    status: str | None = Field(None, pattern="^(PENDING|COMPLETED|CANCELLED)$")
    delivery_days: int | None = Field(None, ge=0)
    quality_rating: int | None = Field(None, ge=1, le=5)
    price_rating: int | None = Field(None, ge=1, le=5)


class PurchaseOrderOut(PurchaseOrderBase):
    id: uuid.UUID
    tenant_id: uuid.UUID
    status: str
    total_price: float
    delivery_days: int | None = None
    quality_rating: int | None = None
    price_rating: int | None = None
    created_at: datetime
    updated_at: datetime
    items: List[PurchaseItemOut] = []
    supplier: SupplierOut | None = None

    class Config:
        from_attributes = True
