import uuid
from datetime import datetime
from typing import List
from pydantic import BaseModel, Field


class OrderItemBase(BaseModel):
    product_id: uuid.UUID
    quantity: int = Field(..., gt=0)


class OrderItemCreate(OrderItemBase):
    pass


class OrderItemOut(OrderItemBase):
    id: uuid.UUID
    order_id: uuid.UUID
    unit_price: float

    class Config:
        from_attributes = True


class OrderCreate(BaseModel):
    items: List[OrderItemCreate] = Field(...)


class OrderOut(BaseModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    total_price: float
    created_at: datetime
    items: List[OrderItemOut] = []

    class Config:
        from_attributes = True
