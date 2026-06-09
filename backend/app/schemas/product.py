import uuid
from datetime import datetime
from typing import List
from pydantic import BaseModel, Field


from app.schemas.insumo import InsumoOut


class ProductIngredientBase(BaseModel):
    insumo_id: uuid.UUID
    quantity: float = Field(..., gt=0.0)


class ProductIngredientCreate(ProductIngredientBase):
    pass


class ProductIngredientOut(ProductIngredientBase):
    id: uuid.UUID
    product_id: uuid.UUID
    insumo: InsumoOut | None = None

    class Config:
        from_attributes = True


class ProductBase(BaseModel):
    name: str = Field(..., min_length=2, max_length=255)
    price: float = Field(..., ge=0.0)
    category_id: uuid.UUID | None = None
    is_active: bool = True


class ProductCreate(ProductBase):
    ingredients: List[ProductIngredientCreate] = []


class ProductUpdate(BaseModel):
    name: str | None = None
    price: float | None = Field(None, ge=0.0)
    category_id: uuid.UUID | None = None
    is_active: bool | None = None
    ingredients: List[ProductIngredientCreate] | None = None


class ProductOut(ProductBase):
    id: uuid.UUID
    tenant_id: uuid.UUID
    created_at: datetime
    updated_at: datetime
    ingredients: List[ProductIngredientOut] = []

    class Config:
        from_attributes = True
