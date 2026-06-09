import uuid
from typing import Annotated, List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api import deps
from app.core.database import get_db
from app.crud import (
    get_product_by_id, get_products_by_tenant, create_product, 
    update_product, delete_product, create_audit_log, get_insumo_by_id
)
from app.models.tenant import Tenant
from app.models.user import User
from app.schemas.product import ProductCreate, ProductUpdate, ProductOut

router = APIRouter()


@router.get("/", response_model=List[ProductOut])
async def list_products(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_tenant: Annotated[Tenant, Depends(deps.get_current_tenant)],
    current_user: Annotated[User, Depends(deps.get_current_tenant_user)]
):
    """
    List all products in the active tenant. Eagerly loads ingredients/recipe (Ficha Técnica).
    """
    products = await get_products_by_tenant(db, current_tenant.id)
    return products


@router.post("/", response_model=ProductOut, status_code=status.HTTP_201_CREATED)
async def create_new_product(
    obj_in: ProductCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_tenant: Annotated[Tenant, Depends(deps.get_current_tenant)],
    current_user: Annotated[User, Depends(deps.get_current_tenant_user)],
    _: Annotated[User, Depends(deps.RoleChecker(["OWNER", "MANAGER"]))]
):
    """
    Register a product along with its Ficha Técnica (ingredients recipe). Restricted to OWNER or MANAGER.
    """
    # 1. Category validation if provided
    if obj_in.category_id:
        from app.crud.crud_category import get_category_by_id
        cat = await get_category_by_id(db, obj_in.category_id)
        if not cat or cat.tenant_id != current_tenant.id or cat.type != "PRODUCT":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="A categoria informada é inválida ou não pertence aos seus produtos."
            )

    # 2. Ingredients validation
    for ing in obj_in.ingredients:
        insumo = await get_insumo_by_id(db, ing.insumo_id)
        if not insumo or insumo.tenant_id != current_tenant.id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"O insumo com ID {ing.insumo_id} é inválido ou não pertence ao seu estoque."
            )

    product = await create_product(db, obj_in, tenant_id=current_tenant.id)
    
    # Audit logging
    await create_audit_log(
        db,
        tenant_id=current_tenant.id,
        user_id=current_user.id,
        action="PRODUCT_CREATE",
        table_name="products",
        record_id=str(product.id),
        after_state={
            "name": product.name,
            "price": product.price,
            "ingredients_count": len(product.ingredients)
        }
    )
    
    return product


@router.put("/{product_id}", response_model=ProductOut)
async def update_existing_product(
    product_id: uuid.UUID,
    obj_in: ProductUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_tenant: Annotated[Tenant, Depends(deps.get_current_tenant)],
    current_user: Annotated[User, Depends(deps.get_current_tenant_user)],
    _: Annotated[User, Depends(deps.RoleChecker(["OWNER", "MANAGER"]))]
):
    """
    Update a product and its ingredients recipe (Ficha Técnica). Restricted to OWNER or MANAGER.
    """
    product = await get_product_by_id(db, product_id)
    if not product or product.tenant_id != current_tenant.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Produto não encontrado."
        )

    if obj_in.category_id:
        from app.crud.crud_category import get_category_by_id
        cat = await get_category_by_id(db, obj_in.category_id)
        if not cat or cat.tenant_id != current_tenant.id or cat.type != "PRODUCT":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="A categoria informada é inválida."
            )

    if obj_in.ingredients is not None:
        for ing in obj_in.ingredients:
            insumo = await get_insumo_by_id(db, ing.insumo_id)
            if not insumo or insumo.tenant_id != current_tenant.id:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Insumo ID {ing.insumo_id} inválido."
                )

    before_state = {
        "name": product.name,
        "price": product.price,
        "is_active": product.is_active,
        "ingredients_count": len(product.ingredients)
    }

    updated = await update_product(db, product, obj_in)
    
    # Audit logging
    await create_audit_log(
        db,
        tenant_id=current_tenant.id,
        user_id=current_user.id,
        action="PRODUCT_UPDATE",
        table_name="products",
        record_id=str(product_id),
        before_state=before_state,
        after_state={
            "name": updated.name,
            "price": updated.price,
            "is_active": updated.is_active,
            "ingredients_count": len(updated.ingredients)
        }
    )
    
    return updated


@router.delete("/{product_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_existing_product(
    product_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_tenant: Annotated[Tenant, Depends(deps.get_current_tenant)],
    current_user: Annotated[User, Depends(deps.get_current_tenant_user)],
    _: Annotated[User, Depends(deps.RoleChecker(["OWNER", "MANAGER"]))]
):
    """
    Remove a product. Restricted to OWNER or MANAGER.
    """
    product = await get_product_by_id(db, product_id)
    if not product or product.tenant_id != current_tenant.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Produto não encontrado."
        )

    before_state = {"name": product.name, "price": product.price}
    await delete_product(db, product)
    
    # Audit logging
    await create_audit_log(
        db,
        tenant_id=current_tenant.id,
        user_id=current_user.id,
        action="PRODUCT_DELETE",
        table_name="products",
        record_id=str(product_id),
        before_state=before_state
    )
