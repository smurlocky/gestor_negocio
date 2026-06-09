import uuid
from typing import Annotated, List
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api import deps
from app.core.database import get_db
from app.crud import (
    get_insumo_by_id, get_insumos_by_tenant, create_insumo, 
    update_insumo, delete_insumo, add_stock_movement, create_audit_log
)
from app.models.tenant import Tenant
from app.models.user import User
from app.schemas.insumo import InsumoCreate, InsumoUpdate, InsumoOut, StockMovementManual
from app.schemas.stock_movement import StockMovementOut

router = APIRouter()


@router.get("/", response_model=List[InsumoOut])
async def list_insumos(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_tenant: Annotated[Tenant, Depends(deps.get_current_tenant)],
    current_user: Annotated[User, Depends(deps.get_current_tenant_user)]
):
    """
    List all insumos belonging to the active tenant.
    """
    insumos = await get_insumos_by_tenant(db, current_tenant.id)
    return insumos


@router.post("/", response_model=InsumoOut, status_code=status.HTTP_201_CREATED)
async def create_new_insumo(
    obj_in: InsumoCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_tenant: Annotated[Tenant, Depends(deps.get_current_tenant)],
    current_user: Annotated[User, Depends(deps.get_current_tenant_user)],
    _: Annotated[User, Depends(deps.RoleChecker(["OWNER", "MANAGER"]))]
):
    """
    Register a new raw material/insumo. Restricted to OWNER or MANAGER.
    """
    # Optional category validation if provided
    if obj_in.category_id:
        from app.crud.crud_category import get_category_by_id
        cat = await get_category_by_id(db, obj_in.category_id)
        if not cat or cat.tenant_id != current_tenant.id or cat.type != "INSUMO":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="A categoria informada é inválida ou não pertence ao seu estoque."
            )

    insumo = await create_insumo(db, obj_in, tenant_id=current_tenant.id)
    
    # Audit logging
    await create_audit_log(
        db,
        tenant_id=current_tenant.id,
        user_id=current_user.id,
        action="INSUMO_CREATE",
        table_name="insumos",
        record_id=str(insumo.id),
        after_state={
            "name": insumo.name,
            "unit": insumo.unit,
            "current_stock": insumo.current_stock,
            "unit_cost": insumo.unit_cost
        }
    )
    
    return insumo


@router.put("/{insumo_id}", response_model=InsumoOut)
async def update_existing_insumo(
    insumo_id: uuid.UUID,
    obj_in: InsumoUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_tenant: Annotated[Tenant, Depends(deps.get_current_tenant)],
    current_user: Annotated[User, Depends(deps.get_current_tenant_user)],
    _: Annotated[User, Depends(deps.RoleChecker(["OWNER", "MANAGER"]))]
):
    """
    Update insumo registration details. Stock values are NOT modified here. Restricted to OWNER or MANAGER.
    """
    insumo = await get_insumo_by_id(db, insumo_id)
    if not insumo or insumo.tenant_id != current_tenant.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Insumo não encontrado."
        )

    if obj_in.category_id:
        from app.crud.crud_category import get_category_by_id
        cat = await get_category_by_id(db, obj_in.category_id)
        if not cat or cat.tenant_id != current_tenant.id or cat.type != "INSUMO":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="A categoria informada é inválida."
            )

    before_state = {
        "name": insumo.name,
        "unit": insumo.unit,
        "minimum_stock": insumo.minimum_stock,
        "category_id": str(insumo.category_id) if insumo.category_id else None
    }
    
    updated = await update_insumo(db, insumo, obj_in)
    
    # Audit logging
    await create_audit_log(
        db,
        tenant_id=current_tenant.id,
        user_id=current_user.id,
        action="INSUMO_UPDATE",
        table_name="insumos",
        record_id=str(insumo_id),
        before_state=before_state,
        after_state={
            "name": updated.name,
            "unit": updated.unit,
            "minimum_stock": updated.minimum_stock,
            "category_id": str(updated.category_id) if updated.category_id else None
        }
    )
    
    return updated


@router.delete("/{insumo_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_existing_insumo(
    insumo_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_tenant: Annotated[Tenant, Depends(deps.get_current_tenant)],
    current_user: Annotated[User, Depends(deps.get_current_tenant_user)],
    _: Annotated[User, Depends(deps.RoleChecker(["OWNER", "MANAGER"]))]
):
    """
    Remove an insumo. Restricted to OWNER or MANAGER.
    """
    insumo = await get_insumo_by_id(db, insumo_id)
    if not insumo or insumo.tenant_id != current_tenant.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Insumo não encontrado."
        )

    before_state = {"name": insumo.name, "current_stock": insumo.current_stock}
    await delete_insumo(db, insumo)
    
    # Audit logging
    await create_audit_log(
        db,
        tenant_id=current_tenant.id,
        user_id=current_user.id,
        action="INSUMO_DELETE",
        table_name="insumos",
        record_id=str(insumo_id),
        before_state=before_state
    )


@router.post("/{insumo_id}/movement", response_model=StockMovementOut, status_code=status.HTTP_201_CREATED)
async def manual_stock_transaction(
    insumo_id: uuid.UUID,
    obj_in: StockMovementManual,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_tenant: Annotated[Tenant, Depends(deps.get_current_tenant)],
    current_user: Annotated[User, Depends(deps.get_current_tenant_user)],
    _: Annotated[User, Depends(deps.RoleChecker(["OWNER", "MANAGER", "SUPERVISOR"]))],
    unit_cost_input: float = Query(0.0, ge=0.0, description="Preço de custo da compra (apenas para tipo INPUT)")
):
    """
    Manually register stock movements (INPUT, OUTPUT, ADJUSTMENT).
    Moving weighted average cost calculates automatically if unit_cost_input is provided on INPUT.
    Restricted to OWNER, MANAGER or SUPERVISOR.
    """
    insumo = await get_insumo_by_id(db, insumo_id)
    if not insumo or insumo.tenant_id != current_tenant.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Insumo não encontrado no seu estoque."
        )

    # OUTPUT validations: prevent outputting more than current stock in standard scenarios if strict (we allow but flag, though negative stock outputs are co-managed).
    
    before_stock = insumo.current_stock
    before_cost = insumo.unit_cost

    movement = await add_stock_movement(
        db,
        tenant_id=current_tenant.id,
        insumo_id=insumo_id,
        quantity=obj_in.quantity,
        mv_type=obj_in.type,
        reason=obj_in.reason,
        user_id=current_user.id,
        unit_cost_input=unit_cost_input
    )

    # Load updated insumo values
    await db.refresh(insumo)

    # Audit logging
    await create_audit_log(
        db,
        tenant_id=current_tenant.id,
        user_id=current_user.id,
        action="STOCK_MOVEMENT_MANUAL",
        table_name="stock_movements",
        record_id=str(movement.id),
        after_state={
            "insumo_name": insumo.name,
            "type": movement.type,
            "quantity_moved": movement.quantity,
            "before_stock": before_stock,
            "after_stock": insumo.current_stock,
            "before_unit_cost": before_cost,
            "after_unit_cost": insumo.unit_cost
        }
    )

    return movement
