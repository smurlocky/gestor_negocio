import uuid
from typing import Annotated, List
from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api import deps
from app.core.database import get_db
from app.crud import (
    get_order_by_id, get_orders_by_tenant, create_order_with_stock_deduction, create_audit_log
)
from app.models.tenant import Tenant
from app.models.user import User
from app.schemas.order import OrderCreate, OrderOut

router = APIRouter()


@router.get("/", response_model=List[OrderOut])
async def list_orders(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_tenant: Annotated[Tenant, Depends(deps.get_current_tenant)],
    current_user: Annotated[User, Depends(deps.get_current_tenant_user)]
):
    """
    List sales orders for the active tenant.
    """
    orders = await get_orders_by_tenant(db, current_tenant.id)
    return orders


@router.post("/", response_model=OrderOut, status_code=status.HTTP_201_CREATED)
async def register_sale_with_automatic_stock_deduction(
    obj_in: OrderCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_tenant: Annotated[Tenant, Depends(deps.get_current_tenant)],
    current_user: Annotated[User, Depends(deps.get_current_tenant_user)]
):
    """
    Record a sale. Automatically deducts ingredients/raw materials from stock 
    following each product's Technical Sheet recipe list (Motor de Baixa Automática).
    Open to all roles (Proprietário, Gerente, Supervisor, Operador).
    """
    order = await create_order_with_stock_deduction(db, obj_in, tenant_id=current_tenant.id)
    
    # Audit logging
    await create_audit_log(
        db,
        tenant_id=current_tenant.id,
        user_id=current_user.id,
        action="ORDER_CREATE_AUTOMATIC_STOCK_DEDUCTION",
        table_name="orders",
        record_id=str(order.id),
        after_state={
            "total_price": order.total_price,
            "items_count": len(order.items)
        }
    )
    
    return order
