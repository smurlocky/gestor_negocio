import uuid
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from app.models.product import Product, ProductIngredient
from app.schemas.product import ProductCreate, ProductUpdate


async def get_product_by_id(db: AsyncSession, product_id: uuid.UUID) -> Product | None:
    # Use selectinload to eagerly load the ingredients relationship and their insumo details
    result = await db.execute(
        select(Product)
        .filter(Product.id == product_id)
        .options(selectinload(Product.ingredients).selectinload(ProductIngredient.insumo))
    )
    return result.scalars().first()


async def get_products_by_tenant(db: AsyncSession, tenant_id: uuid.UUID) -> list[Product]:
    result = await db.execute(
        select(Product)
        .filter(Product.tenant_id == tenant_id)
        .options(selectinload(Product.ingredients).selectinload(ProductIngredient.insumo))
    )
    return list(result.scalars().all())


async def create_product(db: AsyncSession, obj_in: ProductCreate, tenant_id: uuid.UUID) -> Product:
    # 1. Create the base Product
    db_product = Product(
        tenant_id=tenant_id,
        category_id=obj_in.category_id,
        name=obj_in.name,
        price=obj_in.price,
        is_active=obj_in.is_active
    )
    db.add(db_product)
    await db.flush()

    # 2. Add ingredients (Ficha Técnica)
    for ing in obj_in.ingredients:
        db_ingredient = ProductIngredient(
            product_id=db_product.id,
            insumo_id=ing.insumo_id,
            quantity=ing.quantity
        )
        db.add(db_ingredient)
    
    await db.flush()
    
    # Reload and return with ingredients loaded
    return await get_product_by_id(db, db_product.id)


async def update_product(db: AsyncSession, db_obj: Product, obj_in: ProductUpdate) -> Product:
    # 1. Update product base fields
    if obj_in.name is not None:
        db_obj.name = obj_in.name
    if obj_in.price is not None:
        db_obj.price = obj_in.price
    if obj_in.category_id is not None:
        db_obj.category_id = obj_in.category_id
    if obj_in.is_active is not None:
        db_obj.is_active = obj_in.is_active

    db.add(db_obj)
    await db.flush()

    # 2. Update ingredients if provided
    if obj_in.ingredients is not None:
        # Easy: delete all existing recipe items and recreate
        from sqlalchemy import delete
        await db.execute(
            delete(ProductIngredient).where(ProductIngredient.product_id == db_obj.id)
        )
        await db.flush()

        for ing in obj_in.ingredients:
            db_ingredient = ProductIngredient(
                product_id=db_obj.id,
                insumo_id=ing.insumo_id,
                quantity=ing.quantity
            )
            db.add(db_ingredient)
        await db.flush()

    # Reload and return
    return await get_product_by_id(db, db_obj.id)


async def delete_product(db: AsyncSession, db_obj: Product) -> None:
    await db.delete(db_obj)
    await db.flush()
