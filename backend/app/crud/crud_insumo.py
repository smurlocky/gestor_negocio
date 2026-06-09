import uuid
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from app.models.insumo import Insumo
from app.models.stock_movement import StockMovement
from app.schemas.insumo import InsumoCreate, InsumoUpdate


async def get_insumo_by_id(db: AsyncSession, insumo_id: uuid.UUID) -> Insumo | None:
    result = await db.execute(select(Insumo).filter(Insumo.id == insumo_id))
    return result.scalars().first()


async def get_insumos_by_tenant(db: AsyncSession, tenant_id: uuid.UUID) -> list[Insumo]:
    result = await db.execute(select(Insumo).filter(Insumo.tenant_id == tenant_id))
    return list(result.scalars().all())


async def create_insumo(db: AsyncSession, obj_in: InsumoCreate, tenant_id: uuid.UUID) -> Insumo:
    db_obj = Insumo(
        tenant_id=tenant_id,
        category_id=obj_in.category_id,
        name=obj_in.name,
        unit=obj_in.unit,
        current_stock=obj_in.current_stock,
        minimum_stock=obj_in.minimum_stock,
        unit_cost=obj_in.unit_cost
    )
    db.add(db_obj)
    await db.flush()

    # If initial stock is provided, create an initial stock movement
    if obj_in.current_stock > 0:
        initial_movement = StockMovement(
            tenant_id=tenant_id,
            insumo_id=db_obj.id,
            quantity=obj_in.current_stock,
            type="INPUT",
            reason="Lançamento inicial de estoque"
        )
        db.add(initial_movement)
        await db.flush()

    return db_obj


async def update_insumo(db: AsyncSession, db_obj: Insumo, obj_in: InsumoUpdate) -> Insumo:
    if obj_in.name is not None:
        db_obj.name = obj_in.name
    if obj_in.unit is not None:
        db_obj.unit = obj_in.unit
    if obj_in.minimum_stock is not None:
        db_obj.minimum_stock = obj_in.minimum_stock
    if obj_in.category_id is not None:
        db_obj.category_id = obj_in.category_id
    
    db.add(db_obj)
    await db.flush()
    return db_obj


async def delete_insumo(db: AsyncSession, db_obj: Insumo) -> None:
    await db.delete(db_obj)
    await db.flush()


async def add_stock_movement(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    insumo_id: uuid.UUID,
    quantity: float,  # Always positive representation from input
    mv_type: str,     # INPUT, OUTPUT, ADJUSTMENT
    reason: str | None = None,
    user_id: uuid.UUID | None = None,
    unit_cost_input: float = 0.0  # Used for weighted average cost on INPUT
) -> StockMovement:
    """
    Creates a stock movement and updates the Insumo stock in the database.
    Calculates moving weighted average cost automatically on INPUT movements.
    """
    insumo = await get_insumo_by_id(db, insumo_id)
    if not insumo:
        raise ValueError("Insumo não encontrado.")

    # Calculate actual signed quantity for inventory impact
    # INPUT is positive, OUTPUT and ADJUSTMENT (if reason is loss) are usually negative.
    # To keep schema clean: quantity parameter is absolute, signed inside helper.
    actual_qty = quantity
    if mv_type in ["OUTPUT", "ADJUSTMENT"]:
        actual_qty = -quantity

    # 1. Moving weighted average cost calculation on INPUT
    if mv_type == "INPUT" and unit_cost_input > 0:
        current_stock = max(0.0, insumo.current_stock)
        total_old_cost = current_stock * insumo.unit_cost
        total_new_cost = quantity * unit_cost_input
        new_total_stock = current_stock + quantity
        
        if new_total_stock > 0:
            insumo.unit_cost = round((total_old_cost + total_new_cost) / new_total_stock, 2)

    # 2. Update stock value
    insumo.current_stock += actual_qty
    db.add(insumo)

    # 3. Create movement record
    db_movement = StockMovement(
        tenant_id=tenant_id,
        insumo_id=insumo_id,
        quantity=actual_qty,
        type=mv_type,
        reason=reason,
        user_id=user_id
    )
    db.add(db_movement)
    await db.flush()

    return db_movement
