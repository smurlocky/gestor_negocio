import uuid
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from app.models.user import User, RefreshToken
from app.schemas.user import UserCreate, UserUpdate
from app.core.security import get_password_hash


async def get_user_by_id(db: AsyncSession, user_id: uuid.UUID) -> User | None:
    result = await db.execute(select(User).filter(User.id == user_id))
    return result.scalars().first()


async def get_user_by_email(db: AsyncSession, email: str) -> User | None:
    result = await db.execute(select(User).filter(User.email == email))
    return result.scalars().first()


async def get_users_by_tenant(db: AsyncSession, tenant_id: uuid.UUID) -> list[User]:
    result = await db.execute(select(User).filter(User.tenant_id == tenant_id))
    return list(result.scalars().all())


async def create_user(db: AsyncSession, obj_in: UserCreate, tenant_id: uuid.UUID | None = None) -> User:
    db_obj = User(
        tenant_id=tenant_id,
        name=obj_in.name,
        email=obj_in.email,
        hashed_password=get_password_hash(obj_in.password),
        role=obj_in.role
    )
    db.add(db_obj)
    await db.flush()
    return db_obj


async def update_user(db: AsyncSession, db_obj: User, obj_in: UserUpdate) -> User:
    if obj_in.name is not None:
        db_obj.name = obj_in.name
    if obj_in.email is not None:
        db_obj.email = obj_in.email
    if obj_in.password is not None:
        db_obj.hashed_password = get_password_hash(obj_in.password)
    if obj_in.role is not None:
        db_obj.role = obj_in.role
    if obj_in.is_active is not None:
        db_obj.is_active = obj_in.is_active
    
    db.add(db_obj)
    await db.flush()
    return db_obj


async def delete_user(db: AsyncSession, db_obj: User) -> None:
    await db.delete(db_obj)
    await db.flush()


# --- Refresh Token Database Operations ---

async def create_refresh_token_db(
    db: AsyncSession, user_id: uuid.UUID, token: str, expires_at: datetime
) -> RefreshToken:
    db_obj = RefreshToken(
        user_id=user_id,
        token=token,
        expires_at=expires_at
    )
    db.add(db_obj)
    await db.flush()
    return db_obj


async def get_refresh_token(db: AsyncSession, token: str) -> RefreshToken | None:
    result = await db.execute(select(RefreshToken).filter(RefreshToken.token == token))
    return result.scalars().first()


async def revoke_refresh_token(db: AsyncSession, refresh_token: RefreshToken) -> None:
    refresh_token.is_revoked = True
    db.add(refresh_token)
    await db.flush()
