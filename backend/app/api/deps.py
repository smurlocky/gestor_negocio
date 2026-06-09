import uuid
from typing import Annotated, List
from fastapi import Depends, HTTPException, Header, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.core.security import decode_token
from app.crud.crud_tenant import get_tenant_by_id
from app.crud.crud_user import get_user_by_id
from app.models.tenant import Tenant
from app.models.user import User
from app.schemas.token import TokenPayload

# OAuth2 scheme for retrieving the token from the Authorization header
oauth2_scheme = OAuth2PasswordBearer(
    tokenUrl=f"{settings.API_V1_STR}/auth/login-oauth2"  # Standard standard for FastAPI docs
)


async def get_current_tenant(
    db: Annotated[AsyncSession, Depends(get_db)],
    x_tenant_id: Annotated[str | None, Header(description="UUID do Tenant (empresa)")] = None
) -> Tenant:
    """
    Dependency that extracts the tenant ID from the custom HTTP Header 'X-Tenant-ID'.
    Verifies that the tenant exists and is active.
    """
    if not x_tenant_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Header 'X-Tenant-ID' ausente. Identificação da empresa é obrigatória."
        )
    
    try:
        tenant_uuid = uuid.UUID(x_tenant_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Header 'X-Tenant-ID' inválido. Deve ser um UUID."
        )

    tenant = await get_tenant_by_id(db, tenant_uuid)
    if not tenant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Empresa (Tenant) não encontrada."
        )
        
    if tenant.status != "active":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Empresa (Tenant) inativa ou suspensa."
        )
        
    return tenant


async def get_current_user(
    db: Annotated[AsyncSession, Depends(get_db)],
    token: Annotated[str, Depends(oauth2_scheme)]
) -> User:
    """
    Dependency that extracts and validates the active user from the JWT token.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Não foi possível validar as credenciais. Token inválido ou expirado.",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    try:
        payload = decode_token(token)
        user_id_str: str = payload.get("sub")
        token_type: str = payload.get("type")
        
        if user_id_str is None or token_type != "access":
            raise credentials_exception
            
        user_id = uuid.UUID(user_id_str)
    except (JWTError, ValueError):
        raise credentials_exception
        
    user = await get_user_by_id(db, user_id)
    if not user:
        raise credentials_exception
        
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Usuário inativo."
        )
        
    return user


async def get_current_tenant_user(
    current_tenant: Annotated[Tenant, Depends(get_current_tenant)],
    current_user: Annotated[User, Depends(get_current_user)]
) -> User:
    """
    Dependency that ensures the authenticated user belongs to the current active tenant
    (or is a SUPER_ADMIN).
    """
    if current_user.role == "SUPER_ADMIN":
        return current_user
        
    if current_user.tenant_id != current_tenant.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Acesso proibido. Usuário não pertence a esta empresa."
        )
        
    return current_user


class RoleChecker:
    """
    Parameterized dependency to enforce Role-Based Access Control (RBAC).
    """
    def __init__(self, allowed_roles: List[str]):
        self.allowed_roles = allowed_roles

    def __call__(self, current_user: Annotated[User, Depends(get_current_user)]) -> User:
        # SUPER_ADMIN bypasses all role checks
        if current_user.role == "SUPER_ADMIN":
            return current_user
            
        if current_user.role not in self.allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Acesso negado. Nível de permissão insuficiente."
            )
        return current_user
