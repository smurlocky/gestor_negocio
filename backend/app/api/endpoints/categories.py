import uuid
from typing import Annotated, List
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api import deps
from app.core.database import get_db
from app.crud import (
    get_category_by_id, get_categories_by_tenant, create_category, 
    update_category, delete_category, create_audit_log
)
from app.models.tenant import Tenant
from app.models.user import User
from app.schemas.category import CategoryCreate, CategoryUpdate, CategoryOut

router = APIRouter()


@router.get("/", response_model=List[CategoryOut])
async def list_categories(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_tenant: Annotated[Tenant, Depends(deps.get_current_tenant)],
    current_user: Annotated[User, Depends(deps.get_current_tenant_user)],
    cat_type: str | None = Query(None, pattern="^(INSUMO|PRODUCT)$")
):
    """
    List all categories in the tenant. Optional type filter.
    """
    categories = await get_categories_by_tenant(db, current_tenant.id, cat_type=cat_type)
    return categories


@router.post("/", response_model=CategoryOut, status_code=status.HTTP_201_CREATED)
async def create_new_category(
    obj_in: CategoryCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_tenant: Annotated[Tenant, Depends(deps.get_current_tenant)],
    current_user: Annotated[User, Depends(deps.get_current_tenant_user)],
    _: Annotated[User, Depends(deps.RoleChecker(["OWNER", "MANAGER"]))]
):
    """
    Create a new category in the tenant. Restricted to OWNER or MANAGER.
    """
    category = await create_category(db, obj_in, tenant_id=current_tenant.id)
    
    # Audit logging
    await create_audit_log(
        db,
        tenant_id=current_tenant.id,
        user_id=current_user.id,
        action="CATEGORY_CREATE",
        table_name="categories",
        record_id=str(category.id),
        after_state={"name": category.name, "type": category.type}
    )
    
    return category


@router.put("/{category_id}", response_model=CategoryOut)
async def update_existing_category(
    category_id: uuid.UUID,
    obj_in: CategoryUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_tenant: Annotated[Tenant, Depends(deps.get_current_tenant)],
    current_user: Annotated[User, Depends(deps.get_current_tenant_user)],
    _: Annotated[User, Depends(deps.RoleChecker(["OWNER", "MANAGER"]))]
):
    """
    Update a category. Restricted to OWNER or MANAGER.
    """
    category = await get_category_by_id(db, category_id)
    if not category or category.tenant_id != current_tenant.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Categoria não encontrada."
        )

    before_state = {"name": category.name, "type": category.type}
    updated = await update_category(db, category, obj_in)
    
    # Audit logging
    await create_audit_log(
        db,
        tenant_id=current_tenant.id,
        user_id=current_user.id,
        action="CATEGORY_UPDATE",
        table_name="categories",
        record_id=str(category_id),
        before_state=before_state,
        after_state={"name": updated.name, "type": updated.type}
    )
    
    return updated


@router.delete("/{category_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_existing_category(
    category_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_tenant: Annotated[Tenant, Depends(deps.get_current_tenant)],
    current_user: Annotated[User, Depends(deps.get_current_tenant_user)],
    _: Annotated[User, Depends(deps.RoleChecker(["OWNER", "MANAGER"]))]
):
    """
    Delete a category. Restricted to OWNER or MANAGER.
    """
    category = await get_category_by_id(db, category_id)
    if not category or category.tenant_id != current_tenant.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Categoria não encontrada."
        )

    before_state = {"name": category.name, "type": category.type}
    await delete_category(db, category)
    
    # Audit logging
    await create_audit_log(
        db,
        tenant_id=current_tenant.id,
        user_id=current_user.id,
        action="CATEGORY_DELETE",
        table_name="categories",
        record_id=str(category_id),
        before_state=before_state
    )
