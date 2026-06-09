import uuid
from typing import Annotated, List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api import deps
from app.core.database import get_db
from app.crud import (
    get_purchase_order_by_id, get_purchase_orders_by_tenant, create_purchase_order, 
    update_purchase_order_status, get_supplier_by_id, get_insumo_by_id, create_audit_log
)
from app.models.tenant import Tenant
from app.models.user import User
from app.schemas.purchase import PurchaseOrderCreate, PurchaseOrderUpdate, PurchaseOrderOut

router = APIRouter()


@router.get("/", response_model=List[PurchaseOrderOut])
async def list_purchases(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_tenant: Annotated[Tenant, Depends(deps.get_current_tenant)],
    current_user: Annotated[User, Depends(deps.get_current_tenant_user)]
):
    """
    List all purchase orders for the active tenant.
    """
    purchases = await get_purchase_orders_by_tenant(db, current_tenant.id)
    return purchases


@router.post("/", response_model=PurchaseOrderOut, status_code=status.HTTP_201_CREATED)
async def create_new_purchase_order(
    obj_in: PurchaseOrderCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_tenant: Annotated[Tenant, Depends(deps.get_current_tenant)],
    current_user: Annotated[User, Depends(deps.get_current_tenant_user)],
    _: Annotated[User, Depends(deps.RoleChecker(["OWNER", "MANAGER", "SUPERVISOR"]))]
):
    """
    Register a purchase order. Restricted to OWNER, MANAGER, or SUPERVISOR.
    """
    # 1. Validate Supplier
    supplier = await get_supplier_by_id(db, obj_in.supplier_id)
    if not supplier or supplier.tenant_id != current_tenant.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="O fornecedor informado é inválido ou não pertence ao seu perfil."
        )

    # 2. Validate Insumos
    for item in obj_in.items:
        insumo = await get_insumo_by_id(db, item.insumo_id)
        if not insumo or insumo.tenant_id != current_tenant.id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"O insumo com ID {item.insumo_id} é inválido ou não pertence ao seu estoque."
            )

    purchase = await create_purchase_order(db, obj_in, tenant_id=current_tenant.id)
    
    # Audit logging
    await create_audit_log(
        db,
        tenant_id=current_tenant.id,
        user_id=current_user.id,
        action="PURCHASE_ORDER_CREATE",
        table_name="purchase_orders",
        record_id=str(purchase.id),
        after_state={
            "supplier_name": supplier.name,
            "total_price": purchase.total_price,
            "items_count": len(purchase.items),
            "status": purchase.status
        }
    )
    
    return purchase


@router.get("/{purchase_order_id}", response_model=PurchaseOrderOut)
async def get_purchase(
    purchase_order_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_tenant: Annotated[Tenant, Depends(deps.get_current_tenant)],
    current_user: Annotated[User, Depends(deps.get_current_tenant_user)]
):
    """
    Get a specific purchase order by ID.
    """
    purchase = await get_purchase_order_by_id(db, purchase_order_id)
    if not purchase or purchase.tenant_id != current_tenant.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Pedido de compra não encontrado."
        )
    return purchase


@router.put("/{purchase_order_id}", response_model=PurchaseOrderOut)
async def update_existing_purchase_order(
    purchase_order_id: uuid.UUID,
    obj_in: PurchaseOrderUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_tenant: Annotated[Tenant, Depends(deps.get_current_tenant)],
    current_user: Annotated[User, Depends(deps.get_current_tenant_user)],
    _: Annotated[User, Depends(deps.RoleChecker(["OWNER", "MANAGER", "SUPERVISOR"]))]
):
    """
    Update purchase order status and supplier performance reviews.
    Trigger inventory additions and moving average cost recalcs when transitioned to COMPLETED.
    Restricted to OWNER, MANAGER, or SUPERVISOR.
    """
    purchase = await get_purchase_order_by_id(db, purchase_order_id)
    if not purchase or purchase.tenant_id != current_tenant.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Pedido de compra não encontrado."
        )

    before_state = {
        "status": purchase.status,
        "delivery_days": purchase.delivery_days,
        "quality_rating": purchase.quality_rating,
        "price_rating": purchase.price_rating
    }

    updated = await update_purchase_order_status(
        db, 
        db_obj=purchase, 
        obj_in=obj_in, 
        user_id=current_user.id
    )
    
    # Audit logging
    await create_audit_log(
        db,
        tenant_id=current_tenant.id,
        user_id=current_user.id,
        action="PURCHASE_ORDER_UPDATE_STATUS",
        table_name="purchase_orders",
        record_id=str(purchase_order_id),
        before_state=before_state,
        after_state={
            "status": updated.status,
            "delivery_days": updated.delivery_days,
            "quality_rating": updated.quality_rating,
            "price_rating": updated.price_rating
        }
    )
    
    return updated
