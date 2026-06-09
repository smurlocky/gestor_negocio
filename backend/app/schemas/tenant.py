import uuid
from datetime import datetime
from pydantic import BaseModel, Field


class TenantBase(BaseModel):
    name: str = Field(..., min_length=2, max_length=255, description="Nome da empresa/tenant")
    slug: str = Field(..., min_length=2, max_length=255, description="Slug identificador único")


class TenantCreate(TenantBase):
    pass


class TenantUpdate(BaseModel):
    name: str | None = None
    status: str | None = None


class TenantOut(TenantBase):
    id: uuid.UUID
    status: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
        json_schema_extra = {
            "example": {
                "id": "123e4567-e89b-12d3-a456-426614174000",
                "name": "Minha Lanchonete",
                "slug": "minha-lanchonete",
                "status": "active",
                "created_at": "2026-06-02T03:30:00Z",
                "updated_at": "2026-06-02T03:30:00Z"
            }
        }
