import uuid
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from app.models.purchase import PurchaseOrder, PurchaseItem
from app.schemas.purchase import PurchaseOrderCreate, PurchaseOrderUpdate
from app.crud.crud_insumo import add_stock_movement


async def get_purchase_order_by_id(db: AsyncSession, purchase_order_id: uuid.UUID) -> PurchaseOrder | None:
    result = await db.execute(
        select(PurchaseOrder)
        .filter(PurchaseOrder.id == purchase_order_id)
        .options(
            selectinload(PurchaseOrder.supplier),
            selectinload(PurchaseOrder.items).selectinload(PurchaseItem.insumo)
        )
    )
    return result.scalars().first()


async def get_purchase_orders_by_tenant(db: AsyncSession, tenant_id: uuid.UUID) -> list[PurchaseOrder]:
    result = await db.execute(
        select(PurchaseOrder)
        .filter(PurchaseOrder.tenant_id == tenant_id)
        .options(
            selectinload(PurchaseOrder.supplier),
            selectinload(PurchaseOrder.items).selectinload(PurchaseItem.insumo)
        )
    )
    return list(result.scalars().all())


async def create_purchase_order(db: AsyncSession, obj_in: PurchaseOrderCreate, tenant_id: uuid.UUID) -> PurchaseOrder:
    # 1. Calculate total consolidated price
    total_price = sum(item.quantity * item.unit_cost for item in obj_in.items)

    # 2. Create the Purchase Order
    db_order = PurchaseOrder(
        tenant_id=tenant_id,
        supplier_id=obj_in.supplier_id,
        status="PENDING",
        total_price=total_price
    )
    db.add(db_order)
    await db.flush()

    # 3. Create items
    for item in obj_in.items:
        db_item = PurchaseItem(
            purchase_order_id=db_order.id,
            insumo_id=item.insumo_id,
            quantity=item.quantity,
            unit_cost=item.unit_cost
        )
        db.add(db_item)
    
    await db.flush()
    return await get_purchase_order_by_id(db, db_order.id)


async def update_purchase_order_status(
    db: AsyncSession, 
    db_obj: PurchaseOrder, 
    obj_in: PurchaseOrderUpdate,
    user_id: uuid.UUID | None = None
) -> PurchaseOrder:
    old_status = db_obj.status
    new_status = obj_in.status

    # 1. Update ratings and comments if provided
    if obj_in.delivery_days is not None:
        db_obj.delivery_days = obj_in.delivery_days
    if obj_in.quality_rating is not None:
        db_obj.quality_rating = obj_in.quality_rating
    if obj_in.price_rating is not None:
        db_obj.price_rating = obj_in.price_rating
    
    if new_status is not None:
        db_obj.status = new_status

    db.add(db_obj)
    await db.flush()

    # 2. Trigger Stock Feeding if transited to COMPLETED
    # To prevent double-feeding: only trigger if changing state from PENDING/CANCELLED to COMPLETED
    if new_status == "COMPLETED" and old_status != "COMPLETED":
        for item in db_obj.items:
            await add_stock_movement(
                db,
                tenant_id=db_obj.tenant_id,
                insumo_id=item.insumo_id,
                quantity=item.quantity,
                mv_type="INPUT",
                reason=f"Entrada automática: Compra concluída #{str(db_obj.id)[:8]}",
                user_id=user_id,
                unit_cost_input=item.unit_cost
            )
            
    return await get_purchase_order_by_id(db, db_obj.id)
