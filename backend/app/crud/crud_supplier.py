import uuid
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func
from app.models.supplier import Supplier
from app.models.purchase import PurchaseOrder
from app.schemas.supplier import SupplierCreate, SupplierUpdate, SupplierPerformanceOut


async def get_supplier_by_id(db: AsyncSession, supplier_id: uuid.UUID) -> Supplier | None:
    result = await db.execute(select(Supplier).filter(Supplier.id == supplier_id))
    return result.scalars().first()


async def get_suppliers_by_tenant(db: AsyncSession, tenant_id: uuid.UUID) -> list[Supplier]:
    result = await db.execute(select(Supplier).filter(Supplier.tenant_id == tenant_id))
    return list(result.scalars().all())


async def create_supplier(db: AsyncSession, obj_in: SupplierCreate, tenant_id: uuid.UUID) -> Supplier:
    db_obj = Supplier(
        tenant_id=tenant_id,
        name=obj_in.name,
        document=obj_in.document,
        phone=obj_in.phone,
        email=obj_in.email,
        contact_name=obj_in.contact_name
    )
    db.add(db_obj)
    await db.flush()
    return db_obj


async def update_supplier(db: AsyncSession, db_obj: Supplier, obj_in: SupplierUpdate) -> Supplier:
    if obj_in.name is not None:
        db_obj.name = obj_in.name
    if obj_in.document is not None:
        db_obj.document = obj_in.document
    if obj_in.phone is not None:
        db_obj.phone = obj_in.phone
    if obj_in.email is not None:
        db_obj.email = obj_in.email
    if obj_in.contact_name is not None:
        db_obj.contact_name = obj_in.contact_name
    
    db.add(db_obj)
    await db.flush()
    return db_obj


async def delete_supplier(db: AsyncSession, db_obj: Supplier) -> None:
    await db.delete(db_obj)
    await db.flush()


async def get_supplier_performance(db: AsyncSession, supplier_id: uuid.UUID, tenant_id: uuid.UUID) -> SupplierPerformanceOut:
    # Query completed purchase orders for the supplier
    result = await db.execute(
        select(
            func.avg(PurchaseOrder.delivery_days),
            func.avg(PurchaseOrder.quality_rating),
            func.avg(PurchaseOrder.price_rating),
            func.sum(PurchaseOrder.total_price),
            func.count(PurchaseOrder.id)
        ).filter(
            PurchaseOrder.supplier_id == supplier_id,
            PurchaseOrder.tenant_id == tenant_id,
            PurchaseOrder.status == "COMPLETED"
        )
    )
    
    avg_delivery, avg_quality, avg_price, total_val, count = result.first()
    
    return SupplierPerformanceOut(
        average_delivery_days=float(avg_delivery) if avg_delivery is not None else None,
        average_quality_rating=float(avg_quality) if avg_quality is not None else None,
        average_price_rating=float(avg_price) if avg_price is not None else None,
        total_purchases_value=float(total_val) if total_val is not None else 0.0,
        purchase_orders_count=int(count) if count is not None else 0
    )
