import uuid
from typing import Annotated, List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api import deps
from app.core.database import get_db
from app.crud import (
    create_user, get_users_by_tenant, get_user_by_id, get_user_by_email,
    update_user, delete_user, create_audit_log
)
from app.models.tenant import Tenant
from app.models.user import User
from app.schemas.user import UserCreate, UserUpdate, UserOut

router = APIRouter()


@router.get("/me", response_model=UserOut)
async def read_user_me(
    current_user: Annotated[User, Depends(deps.get_current_user)]
):
    """
    Get current logged in user details.
    """
    return current_user


@router.get("/", response_model=List[UserOut])
async def list_users(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_tenant: Annotated[Tenant, Depends(deps.get_current_tenant)],
    current_user: Annotated[User, Depends(deps.get_current_tenant_user)],
    _: Annotated[User, Depends(deps.RoleChecker(["OWNER", "MANAGER"]))]
):
    """
    List all users belonging to the active tenant. Restricted to OWNER or MANAGER.
    """
    users = await get_users_by_tenant(db, current_tenant.id)
    return users


@router.post("/", response_model=UserOut, status_code=status.HTTP_201_CREATED)
async def register_new_user(
    obj_in: UserCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_tenant: Annotated[Tenant, Depends(deps.get_current_tenant)],
    current_user: Annotated[User, Depends(deps.get_current_tenant_user)],
    _: Annotated[User, Depends(deps.RoleChecker(["OWNER", "MANAGER"]))]
):
    """
    Create a new user within the active tenant. Restricted to OWNER or MANAGER.
    """
    # Validate e-mail uniqueness
    existing_user = await get_user_by_email(db, obj_in.email)
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="O e-mail informado já está cadastrado no sistema."
        )

    # Validate roles (cannot assign a role higher or equal to their own unless OWNER)
    if current_user.role == "MANAGER" and obj_in.role in ["OWNER", "SUPER_ADMIN"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Você não tem permissão para cadastrar usuários com este perfil."
        )

    new_user = await create_user(db, obj_in, tenant_id=current_tenant.id)
    
    # Audit logging
    await create_audit_log(
        db,
        tenant_id=current_tenant.id,
        user_id=current_user.id,
        action="USER_CREATE",
        table_name="users",
        record_id=str(new_user.id),
        after_state={"user_email": new_user.email, "role": new_user.role}
    )
    
    return new_user


@router.get("/{user_id}", response_model=UserOut)
async def read_user(
    user_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_tenant: Annotated[Tenant, Depends(deps.get_current_tenant)],
    current_user: Annotated[User, Depends(deps.get_current_tenant_user)],
    _: Annotated[User, Depends(deps.RoleChecker(["OWNER", "MANAGER"]))]
):
    """
    Retrieve user details by ID. Must belong to the same tenant.
    """
    user = await get_user_by_id(db, user_id)
    if not user or (user.tenant_id != current_tenant.id and current_user.role != "SUPER_ADMIN"):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Usuário não encontrado."
        )
    return user


@router.put("/{user_id}", response_model=UserOut)
async def update_existing_user(
    user_id: uuid.UUID,
    obj_in: UserUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_tenant: Annotated[Tenant, Depends(deps.get_current_tenant)],
    current_user: Annotated[User, Depends(deps.get_current_tenant_user)],
):
    """
    Update user details. Users can update themselves.
    OWNER and MANAGER can update others (roles restriction apply).
    """
    user_to_update = await get_user_by_id(db, user_id)
    if not user_to_update or (user_to_update.tenant_id != current_tenant.id and current_user.role != "SUPER_ADMIN"):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Usuário não encontrado."
        )

    # Permission check: must be editing themselves or be OWNER/MANAGER
    is_self = current_user.id == user_to_update.id
    is_admin = current_user.role in ["OWNER", "MANAGER"]
    
    if not is_self and not is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Sem permissão para atualizar este usuário."
        )

    # Restrictions: cannot change own role unless OWNER
    if is_self and obj_in.role is not None and current_user.role != obj_in.role:
        if current_user.role != "OWNER":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Você não pode alterar seu próprio perfil/cargo."
            )

    # If updating role, check manager restriction
    if obj_in.role is not None and current_user.role == "MANAGER" and obj_in.role in ["OWNER", "SUPER_ADMIN"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Sem permissão para atribuir este perfil."
        )

    # Check e-mail uniqueness if email is changed
    if obj_in.email is not None and obj_in.email != user_to_update.email:
        existing = await get_user_by_email(db, obj_in.email)
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="O e-mail informado já está cadastrado no sistema."
            )

    before_state = {
        "name": user_to_update.name,
        "email": user_to_update.email,
        "role": user_to_update.role,
        "is_active": user_to_update.is_active
    }

    updated = await update_user(db, user_to_update, obj_in)
    
    # Audit logging
    await create_audit_log(
        db,
        tenant_id=current_tenant.id,
        user_id=current_user.id,
        action="USER_UPDATE",
        table_name="users",
        record_id=str(updated.id),
        before_state=before_state,
        after_state={
            "name": updated.name,
            "email": updated.email,
            "role": updated.role,
            "is_active": updated.is_active
        }
    )

    return updated


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_existing_user(
    user_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_tenant: Annotated[Tenant, Depends(deps.get_current_tenant)],
    current_user: Annotated[User, Depends(deps.get_current_tenant_user)],
    _: Annotated[User, Depends(deps.RoleChecker(["OWNER", "MANAGER"]))]
):
    """
    Delete a user from the active tenant. Restricted to OWNER or MANAGER.
    """
    user_to_delete = await get_user_by_id(db, user_id)
    if not user_to_delete or (user_to_delete.tenant_id != current_tenant.id and current_user.role != "SUPER_ADMIN"):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Usuário não encontrado."
        )

    # Self deletion is forbidden
    if current_user.id == user_to_delete.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Você não pode excluir sua própria conta."
        )

    # Permission check: MANAGER cannot delete OWNER
    if current_user.role == "MANAGER" and user_to_delete.role in ["OWNER", "SUPER_ADMIN"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Nível de permissão insuficiente para excluir este usuário."
        )

    before_state = {
        "name": user_to_delete.name,
        "email": user_to_delete.email,
        "role": user_to_delete.role
    }

    await delete_user(db, user_to_delete)
    
    # Audit logging
    await create_audit_log(
        db,
        tenant_id=current_tenant.id,
        user_id=current_user.id,
        action="USER_DELETE",
        table_name="users",
        record_id=str(user_id),
        before_state=before_state
    )
