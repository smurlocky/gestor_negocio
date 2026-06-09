import pytest
from datetime import datetime, timedelta, timezone
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.tenant import Tenant
from app.models.user import User
from app.crud import get_tenant_by_slug, get_user_by_email, get_refresh_token
from app.core import security


@pytest.mark.asyncio
async def test_register_tenant(client: AsyncClient, db: AsyncSession):
    payload = {
        "company_name": "Hamburgueria do Bairro",
        "slug": "hamburgueria-bairro",
        "admin_name": "Carlos Hamburguer",
        "admin_email": "carlos@hamburgueria.com",
        "admin_password": "supersecretpassword"
    }
    
    response = await client.post("/api/v1/auth/register-tenant", json=payload)
    assert response.status_code == 201
    data = response.json()
    
    assert data["name"] == payload["admin_name"]
    assert data["email"] == payload["admin_email"]
    assert data["role"] == "OWNER"
    assert data["tenant_id"] is not None

    # Validate database records
    tenant = await get_tenant_by_slug(db, payload["slug"])
    assert tenant is not None
    assert tenant.name == payload["company_name"]
    
    user = await get_user_by_email(db, payload["admin_email"])
    assert user is not None
    assert user.tenant_id == tenant.id


@pytest.mark.asyncio
async def test_register_tenant_duplicate_slug(client: AsyncClient, test_tenant: Tenant):
    payload = {
        "company_name": "Duplicate Company",
        "slug": test_tenant.slug, # Duplicate
        "admin_name": "Carlos Owner",
        "admin_email": "carlos@duplicate.com",
        "admin_password": "supersecretpassword"
    }
    
    response = await client.post("/api/v1/auth/register-tenant", json=payload)
    assert response.status_code == 400
    assert "slug já está sendo utilizado" in response.json()["detail"]


@pytest.mark.asyncio
async def test_register_tenant_duplicate_email(client: AsyncClient, test_owner: User):
    payload = {
        "company_name": "New Company",
        "slug": "new-company-unique-slug",
        "admin_name": "Carlos Owner",
        "admin_email": test_owner.email, # Duplicate
        "admin_password": "supersecretpassword"
    }
    
    response = await client.post("/api/v1/auth/register-tenant", json=payload)
    assert response.status_code == 400
    assert "e-mail informado já está cadastrado" in response.json()["detail"]


@pytest.mark.asyncio
async def test_login_success(client: AsyncClient, test_owner: User):
    login_data = {
        "username": test_owner.email,
        "password": "password123"
    }
    
    response = await client.post("/api/v1/auth/login", data=login_data)
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert "refresh_token" in data
    assert data["token_type"] == "bearer"


@pytest.mark.asyncio
async def test_login_failure(client: AsyncClient, test_owner: User):
    login_data = {
        "username": test_owner.email,
        "password": "wrongpassword"
    }
    
    response = await client.post("/api/v1/auth/login", data=login_data)
    assert response.status_code == 400
    assert "incorretos" in response.json()["detail"]


@pytest.mark.asyncio
async def test_login_inactive_user(client: AsyncClient, db: AsyncSession, test_tenant: Tenant):
    # Create an inactive user
    user = User(
        tenant_id=test_tenant.id,
        name="Inactive Guy",
        email="inactive@guy.com",
        hashed_password=security.get_password_hash("password123"),
        role="OPERATOR",
        is_active=False
    )
    db.add(user)
    await db.commit()

    login_data = {
        "username": user.email,
        "password": "password123"
    }
    
    response = await client.post("/api/v1/auth/login", data=login_data)
    assert response.status_code == 400
    assert "inativo" in response.json()["detail"]


@pytest.mark.asyncio
async def test_login_inactive_tenant(client: AsyncClient, db: AsyncSession, test_inactive_tenant: Tenant):
    user = User(
        tenant_id=test_inactive_tenant.id,
        name="Guy Suspended",
        email="guy@suspended.com",
        hashed_password=security.get_password_hash("password123"),
        role="OWNER",
        is_active=True
    )
    db.add(user)
    await db.commit()

    login_data = {
        "username": user.email,
        "password": "password123"
    }
    
    response = await client.post("/api/v1/auth/login", data=login_data)
    assert response.status_code == 400
    assert "inativa ou suspensa" in response.json()["detail"]


@pytest.mark.asyncio
async def test_refresh_token_success(client: AsyncClient, test_owner: User):
    # First login to get a refresh token
    login_data = {
        "username": test_owner.email,
        "password": "password123"
    }
    response = await client.post("/api/v1/auth/login", data=login_data)
    refresh_token = response.json()["refresh_token"]

    # Call refresh
    refresh_response = await client.post(
        f"/api/v1/auth/refresh?refresh_token={refresh_token}"
    )
    assert refresh_response.status_code == 200
    new_data = refresh_response.json()
    assert "access_token" in new_data
    assert "refresh_token" in new_data
    assert new_data["refresh_token"] != refresh_token


@pytest.mark.asyncio
async def test_refresh_token_revoked(client: AsyncClient, test_owner: User, db: AsyncSession):
    # Login
    login_data = {
        "username": test_owner.email,
        "password": "password123"
    }
    response = await client.post("/api/v1/auth/login", data=login_data)
    refresh_token = response.json()["refresh_token"]

    # Revoke it in DB
    db_token = await get_refresh_token(db, refresh_token)
    db_token.is_revoked = True
    db.add(db_token)
    await db.commit()

    # Call refresh (should fail)
    refresh_response = await client.post(
        f"/api/v1/auth/refresh?refresh_token={refresh_token}"
    )
    assert refresh_response.status_code == 400
    assert "inválido, expirado ou revogado" in refresh_response.json()["detail"]


@pytest.mark.asyncio
async def test_logout(client: AsyncClient, test_owner: User, db: AsyncSession):
    # Login
    login_data = {
        "username": test_owner.email,
        "password": "password123"
    }
    response = await client.post("/api/v1/auth/login", data=login_data)
    refresh_token = response.json()["refresh_token"]

    # Logout
    logout_response = await client.post(
        f"/api/v1/auth/logout?refresh_token={refresh_token}"
    )
    assert logout_response.status_code == 204
    
    # Check revoked in DB
    db_token = await get_refresh_token(db, refresh_token)
    assert db_token.is_revoked is True
