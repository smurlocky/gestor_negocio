import uuid
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from app.models.category import Category
from app.schemas.category import CategoryCreate, CategoryUpdate


async def get_category_by_id(db: AsyncSession, category_id: uuid.UUID) -> Category | None:
    result = await db.execute(select(Category).filter(Category.id == category_id))
    return result.scalars().first()


async def get_categories_by_tenant(db: AsyncSession, tenant_id: uuid.UUID, cat_type: str | None = None) -> list[Category]:
    query = select(Category).filter(Category.tenant_id == tenant_id)
    if cat_type:
        query = query.filter(Category.type == cat_type)
    result = await db.execute(query)
    return list(result.scalars().all())


async def create_category(db: AsyncSession, obj_in: CategoryCreate, tenant_id: uuid.UUID) -> Category:
    db_obj = Category(
        tenant_id=tenant_id,
        name=obj_in.name,
        type=obj_in.type
    )
    db.add(db_obj)
    await db.flush()
    return db_obj


async def update_category(db: AsyncSession, db_obj: Category, obj_in: CategoryUpdate) -> Category:
    if obj_in.name is not None:
        db_obj.name = obj_in.name
    if obj_in.type is not None:
        db_obj.type = obj_in.type
    db.add(db_obj)
    await db.flush()
    return db_obj


async def delete_category(db: AsyncSession, db_obj: Category) -> None:
    await db.delete(db_obj)
    await db.flush()
