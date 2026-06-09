import uuid
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from app.models.tenant import Tenant
from app.schemas.tenant import TenantCreate, TenantUpdate


async def get_tenant_by_id(db: AsyncSession, tenant_id: uuid.UUID) -> Tenant | None:
    result = await db.execute(select(Tenant).filter(Tenant.id == tenant_id))
    return result.scalars().first()


async def get_tenant_by_slug(db: AsyncSession, slug: str) -> Tenant | None:
    result = await db.execute(select(Tenant).filter(Tenant.slug == slug))
    return result.scalars().first()


async def create_tenant(db: AsyncSession, obj_in: TenantCreate) -> Tenant:
    db_obj = Tenant(
        name=obj_in.name,
        slug=obj_in.slug
    )
    db.add(db_obj)
    await db.flush()
    return db_obj


async def update_tenant(db: AsyncSession, db_obj: Tenant, obj_in: TenantUpdate) -> Tenant:
    if obj_in.name is not None:
        db_obj.name = obj_in.name
    if obj_in.status is not None:
        db_obj.status = obj_in.status
    db.add(db_obj)
    await db.flush()
    return db_obj
