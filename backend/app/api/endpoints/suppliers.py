import uuid
from typing import Annotated, List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api import deps
from app.core.database import get_db
from app.crud import (
    get_supplier_by_id, get_suppliers_by_tenant, create_supplier, 
    update_supplier, delete_supplier, get_supplier_performance, create_audit_log
)
from app.models.tenant import Tenant
from app.models.user import User
from app.schemas.supplier import SupplierCreate, SupplierUpdate, SupplierOut, SupplierPerformanceOut

router = APIRouter()


@router.get("/", response_model=List[SupplierOut])
async def list_suppliers(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_tenant: Annotated[Tenant, Depends(deps.get_current_tenant)],
    current_user: Annotated[User, Depends(deps.get_current_tenant_user)]
):
    """
    List all suppliers in the active tenant.
    """
    suppliers = await get_suppliers_by_tenant(db, current_tenant.id)
    return suppliers


@router.post("/", response_model=SupplierOut, status_code=status.HTTP_201_CREATED)
async def create_new_supplier(
    obj_in: SupplierCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_tenant: Annotated[Tenant, Depends(deps.get_current_tenant)],
    current_user: Annotated[User, Depends(deps.get_current_tenant_user)],
    _: Annotated[User, Depends(deps.RoleChecker(["OWNER", "MANAGER"]))]
):
    """
    Register a supplier in the active tenant. Restricted to OWNER or MANAGER.
    """
    supplier = await create_supplier(db, obj_in, tenant_id=current_tenant.id)
    
    # Audit logging
    await create_audit_log(
        db,
        tenant_id=current_tenant.id,
        user_id=current_user.id,
        action="SUPPLIER_CREATE",
        table_name="suppliers",
        record_id=str(supplier.id),
        after_state={
            "name": supplier.name,
            "email": supplier.email,
            "phone": supplier.phone
        }
    )
    
    return supplier


@router.get("/{supplier_id}", response_model=SupplierOut)
async def get_supplier(
    supplier_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_tenant: Annotated[Tenant, Depends(deps.get_current_tenant)],
    current_user: Annotated[User, Depends(deps.get_current_tenant_user)]
):
    """
    Get a specific supplier by ID.
    """
    supplier = await get_supplier_by_id(db, supplier_id)
    if not supplier or supplier.tenant_id != current_tenant.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Fornecedor não encontrado."
        )
    return supplier


@router.put("/{supplier_id}", response_model=SupplierOut)
async def update_existing_supplier(
    supplier_id: uuid.UUID,
    obj_in: SupplierUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_tenant: Annotated[Tenant, Depends(deps.get_current_tenant)],
    current_user: Annotated[User, Depends(deps.get_current_tenant_user)],
    _: Annotated[User, Depends(deps.RoleChecker(["OWNER", "MANAGER"]))]
):
    """
    Update details of a supplier. Restricted to OWNER or MANAGER.
    """
    supplier = await get_supplier_by_id(db, supplier_id)
    if not supplier or supplier.tenant_id != current_tenant.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Fornecedor não encontrado."
        )

    before_state = {
        "name": supplier.name,
        "email": supplier.email,
        "phone": supplier.phone,
        "contact_name": supplier.contact_name
    }

    updated = await update_supplier(db, supplier, obj_in)
    
    # Audit logging
    await create_audit_log(
        db,
        tenant_id=current_tenant.id,
        user_id=current_user.id,
        action="SUPPLIER_UPDATE",
        table_name="suppliers",
        record_id=str(supplier_id),
        before_state=before_state,
        after_state={
            "name": updated.name,
            "email": updated.email,
            "phone": updated.phone,
            "contact_name": updated.contact_name
        }
    )
    
    return updated


@router.delete("/{supplier_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_existing_supplier(
    supplier_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_tenant: Annotated[Tenant, Depends(deps.get_current_tenant)],
    current_user: Annotated[User, Depends(deps.get_current_tenant_user)],
    _: Annotated[User, Depends(deps.RoleChecker(["OWNER", "MANAGER"]))]
):
    """
    Delete a supplier. Restricted to OWNER or MANAGER.
    """
    supplier = await get_supplier_by_id(db, supplier_id)
    if not supplier or supplier.tenant_id != current_tenant.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Fornecedor não encontrado."
        )

    before_state = {"name": supplier.name}
    await delete_supplier(db, supplier)
    
    # Audit logging
    await create_audit_log(
        db,
        tenant_id=current_tenant.id,
        user_id=current_user.id,
        action="SUPPLIER_DELETE",
        table_name="suppliers",
        record_id=str(supplier_id),
        before_state=before_state
    )


@router.get("/{supplier_id}/performance", response_model=SupplierPerformanceOut)
async def get_performance(
    supplier_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_tenant: Annotated[Tenant, Depends(deps.get_current_tenant)],
    current_user: Annotated[User, Depends(deps.get_current_tenant_user)]
):
    """
    Fetch performance statistics for a supplier (delivery days and ratings).
    """
    supplier = await get_supplier_by_id(db, supplier_id)
    if not supplier or supplier.tenant_id != current_tenant.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Fornecedor não encontrado."
        )
    
    performance = await get_supplier_performance(db, supplier_id, current_tenant.id)
    return performance
