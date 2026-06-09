import uuid
from datetime import datetime
from pydantic import BaseModel, Field, EmailStr


class SupplierBase(BaseModel):
    name: str = Field(..., min_length=2, max_length=255)
    document: str | None = Field(None, max_length=50, description="CNPJ or CPF")
    phone: str | None = Field(None, max_length=50)
    email: EmailStr | None = Field(None, description="Supplier contact email")
    contact_name: str | None = Field(None, max_length=255)


class SupplierCreate(SupplierBase):
    pass


class SupplierUpdate(BaseModel):
    name: str | None = Field(None, min_length=2, max_length=255)
    document: str | None = Field(None, max_length=50)
    phone: str | None = Field(None, max_length=50)
    email: EmailStr | None = Field(None)
    contact_name: str | None = Field(None, max_length=255)


class SupplierOut(SupplierBase):
    id: uuid.UUID
    tenant_id: uuid.UUID
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class SupplierPerformanceOut(BaseModel):
    average_delivery_days: float | None = None
    average_quality_rating: float | None = None
    average_price_rating: float | None = None
    total_purchases_value: float = 0.0
    purchase_orders_count: int = 0
