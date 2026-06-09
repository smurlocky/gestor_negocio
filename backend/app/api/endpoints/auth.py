from datetime import datetime, timedelta, timezone
from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession

from app.api import deps
from app.core import security
from app.core.config import settings
from app.core.database import get_db
from app.crud import (
    create_tenant, get_tenant_by_slug,
    create_user, get_user_by_email, get_user_by_id,
    create_refresh_token_db, get_refresh_token, revoke_refresh_token,
    create_audit_log
)
from app.schemas.tenant import TenantCreate
from app.schemas.user import UserCreate, UserRegisterTenant, UserOut
from app.schemas.token import Token
from app.models.tenant import get_utc_now

router = APIRouter()


@router.post("/register-tenant", response_model=UserOut, status_code=status.HTTP_201_CREATED)
async def register_tenant(
    obj_in: UserRegisterTenant,
    db: Annotated[AsyncSession, Depends(get_db)]
):
    """
    Onboarding: registers a new company (tenant) and its initial Owner account.
    """
    # 1. Check if slug or email already exists
    existing_tenant = await get_tenant_by_slug(db, obj_in.slug)
    if existing_tenant:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Este identificador slug já está sendo utilizado por outra empresa."
        )
        
    existing_user = await get_user_by_email(db, obj_in.admin_email)
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="O e-mail informado já está cadastrado no sistema."
        )

    # 2. Create the tenant
    tenant_in = TenantCreate(name=obj_in.company_name, slug=obj_in.slug)
    tenant = await create_tenant(db, tenant_in)
    
    # 3. Create the OWNER user
    user_in = UserCreate(
        name=obj_in.admin_name,
        email=obj_in.admin_email,
        password=obj_in.admin_password,
        role="OWNER"
    )
    user = await create_user(db, user_in, tenant_id=tenant.id)
    
    # 4. Write audit log
    await create_audit_log(
        db,
        tenant_id=tenant.id,
        user_id=user.id,
        action="TENANT_REGISTER",
        table_name="tenants",
        record_id=str(tenant.id),
        after_state={"tenant_name": tenant.name, "owner_email": user.email}
    )
    
    return user


@router.post("/login", response_model=Token)
async def login(
    obj_in: Annotated[OAuth2PasswordRequestForm, Depends()],
    db: Annotated[AsyncSession, Depends(get_db)]
):
    """
    Standard OAuth2 / login endpoint returning Access and Refresh JWT Tokens.
    """
    user = await get_user_by_email(db, obj_in.username)
    if not user or not security.verify_password(obj_in.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="E-mail ou senha incorretos."
        )
        
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Usuário inativo."
        )

    # If the user belongs to a tenant, check if the tenant is active
    if user.tenant_id:
        from app.crud.crud_tenant import get_tenant_by_id
        tenant = await get_tenant_by_id(db, user.tenant_id)
        if not tenant or tenant.status != "active":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Empresa associada está inativa ou suspensa."
            )

    # Generate JWT Tokens
    access_token = security.create_access_token(subject=user.id)
    refresh_token = security.create_refresh_token(subject=user.id)
    
    # Save Refresh Token in Database
    expires_at = get_utc_now() + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    await create_refresh_token_db(db, user_id=user.id, token=refresh_token, expires_at=expires_at)
    
    # Log Audit
    if user.tenant_id:
        await create_audit_log(
            db,
            tenant_id=user.tenant_id,
            user_id=user.id,
            action="USER_LOGIN",
            table_name="users",
            record_id=str(user.id)
        )

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer"
    }


@router.post("/refresh", response_model=Token)
async def refresh(
    refresh_token: str,
    db: Annotated[AsyncSession, Depends(get_db)]
):
    """
    Token rotation: receives an active Refresh Token and issues a new pair.
    """
    db_refresh_token = await get_refresh_token(db, refresh_token)
    if not db_refresh_token or db_refresh_token.is_revoked:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Token de atualização inválido, expirado ou revogado."
        )

    # Ensure expires_at is timezone-aware for comparison (SQLite compatibility)
    expires_at = db_refresh_token.expires_at
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)

    if expires_at < get_utc_now():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Token de atualização inválido, expirado ou revogado."
        )

    user = await get_user_by_id(db, db_refresh_token.user_id)
    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Usuário inativo ou inexistente."
        )

    # Revoke old refresh token (Token Rotation principle)
    await revoke_refresh_token(db, db_refresh_token)

    # Generate new pair
    new_access_token = security.create_access_token(subject=user.id)
    new_refresh_token = security.create_refresh_token(subject=user.id)
    
    expires_at = get_utc_now() + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    await create_refresh_token_db(db, user_id=user.id, token=new_refresh_token, expires_at=expires_at)

    return {
        "access_token": new_access_token,
        "refresh_token": new_refresh_token,
        "token_type": "bearer"
    }


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(
    refresh_token: str,
    db: Annotated[AsyncSession, Depends(get_db)]
):
    """
    Revokes the active refresh token, signing out the session.
    """
    db_refresh_token = await get_refresh_token(db, refresh_token)
    if db_refresh_token:
        await revoke_refresh_token(db, db_refresh_token)
