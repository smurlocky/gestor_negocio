from typing import Annotated
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func

from app.api import deps
from app.core.database import get_db
from app.models.tenant import Tenant
from app.models.user import User
from app.models.insumo import Insumo
from app.models.order import Order
from app.models.product import Product

router = APIRouter()


@router.get("/")
async def get_dashboard_metrics(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_tenant: Annotated[Tenant, Depends(deps.get_current_tenant)],
    current_user: Annotated[User, Depends(deps.get_current_tenant_user)]
):
    """
    Retrieve unified operational and financial dashboard metrics for the tenant.
    """
    # 1. Critical stock insumos (current_stock < minimum_stock)
    critical_query = await db.execute(
        select(Insumo).filter(
            Insumo.tenant_id == current_tenant.id,
            Insumo.current_stock < Insumo.minimum_stock
        )
    )
    critical_insumos = critical_query.scalars().all()
    
    # 2. Total insumos count
    total_insumos_query = await db.execute(
        select(func.count(Insumo.id)).filter(Insumo.tenant_id == current_tenant.id)
    )
    total_insumos = total_insumos_query.scalar() or 0

    # 3. Total products count
    total_products_query = await db.execute(
        select(func.count(Product.id)).filter(Product.tenant_id == current_tenant.id)
    )
    total_products = total_products_query.scalar() or 0

    # 4. Financial metrics: Total revenue and orders count
    orders_query = await db.execute(
        select(
            func.sum(Order.total_price),
            func.count(Order.id)
        ).filter(Order.tenant_id == current_tenant.id)
    )
    revenue, orders_count = orders_query.first()
    revenue = float(revenue) if revenue else 0.0
    orders_count = int(orders_count) if orders_count else 0

    # Average ticket calculation
    avg_ticket = round(revenue / orders_count, 2) if orders_count > 0 else 0.0

    return {
        "operation": {
            "total_insumos": total_insumos,
            "total_products": total_products,
            "critical_stock_count": len(critical_insumos),
            "critical_insumos": [
                {
                    "id": str(i.id),
                    "name": i.name,
                    "unit": i.unit,
                    "current_stock": i.current_stock,
                    "minimum_stock": i.minimum_stock
                }
                for i in critical_insumos
            ]
        },
        "financial": {
            "total_revenue": revenue,
            "orders_count": orders_count,
            "average_ticket": avg_ticket
        }
    }
