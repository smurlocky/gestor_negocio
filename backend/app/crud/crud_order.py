import uuid
from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload

from app.models.order import Order, OrderItem
from app.models.product import Product
from app.models.insumo import Insumo
from app.models.stock_movement import StockMovement
from app.schemas.order import OrderCreate


async def get_order_by_id(db: AsyncSession, order_id: uuid.UUID) -> Order | None:
    result = await db.execute(
        select(Order)
        .filter(Order.id == order_id)
        .options(selectinload(Order.items).selectinload(OrderItem.product))
    )
    return result.scalars().first()


async def get_orders_by_tenant(db: AsyncSession, tenant_id: uuid.UUID) -> list[Order]:
    result = await db.execute(
        select(Order)
        .filter(Order.tenant_id == tenant_id)
        .options(selectinload(Order.items).selectinload(OrderItem.product))
        .order_by(Order.created_at.desc())
    )
    return list(result.scalars().all())


async def create_order_with_stock_deduction(
    db: AsyncSession, obj_in: OrderCreate, tenant_id: uuid.UUID
) -> Order:
    """
    Automated Stock Consumption Engine (Motor de Baixa Automática).
    1. Creates a Sales Order and Order Items.
    2. Loads technical sheets (ingredients recipe list) for each product sold.
    3. Subtracts quantities from stock and registers AUTOMATIC_CONSUMPTION stock movements.
    4. Everything runs in a single database transaction.
    """
    # Initialize the base order
    db_order = Order(
        tenant_id=tenant_id,
        total_price=0.0
    )
    db.add(db_order)
    await db.flush()

    total_price = 0.0

    # Process items and deduct stock
    for item in obj_in.items:
        # Load product with its recipe ingredients
        product_result = await db.execute(
            select(Product)
            .filter(Product.id == item.product_id, Product.tenant_id == tenant_id)
            .options(selectinload(Product.ingredients))
        )
        product = product_result.scalars().first()
        
        if not product:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Produto com ID {item.product_id} não cadastrado na sua empresa."
            )
            
        if not product.is_active:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Produto '{product.name}' está inativo e não pode ser vendido."
            )

        item_total = product.price * item.quantity
        total_price += item_total

        # Save order item
        db_item = OrderItem(
            order_id=db_order.id,
            product_id=product.id,
            quantity=item.quantity,
            unit_price=product.price
        )
        db.add(db_item)

        # STOCK REDUCTION MOTOR (Baixa Automática)
        for ingredient in product.ingredients:
            insumo_result = await db.execute(
                select(Insumo).filter(Insumo.id == ingredient.insumo_id)
            )
            insumo = insumo_result.scalars().first()
            
            if not insumo:
                # If an ingredient in recipe doesn't exist, we prevent the sale to avoid data leakage
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=f"Insumo ID {ingredient.insumo_id} da receita do produto '{product.name}' não encontrado."
                )

            # Calculate total consumption for this recipe ingredient
            consumption_qty = ingredient.quantity * item.quantity
            
            # Deduct stock (allow negative stock if needed, but warning alerts are triggered in UI)
            insumo.current_stock -= consumption_qty
            db.add(insumo)

            # Record stock movement
            db_movement = StockMovement(
                tenant_id=tenant_id,
                insumo_id=insumo.id,
                quantity=-consumption_qty,
                type="AUTOMATIC_CONSUMPTION",
                reason=f"Baixa automática: Venda de {product.name}",
                order_id=db_order.id
            )
            db.add(db_movement)

    # Update final total price of sale
    db_order.total_price = total_price
    db.add(db_order)
    await db.flush()

    # Return order with relations loaded
    return await get_order_by_id(db, db_order.id)
