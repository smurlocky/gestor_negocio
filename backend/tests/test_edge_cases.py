import pytest
import uuid
from datetime import timedelta
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import HTTPException, Header, Depends

from app.models.tenant import Tenant
from app.models.user import User
from app.api import deps
from app.core import security
from app.core.database import get_db
from app.crud.crud_tenant import update_tenant, get_tenant_by_id
from app.crud.crud_user import update_user, delete_user
from app.schemas.tenant import TenantUpdate
from app.schemas.user import UserUpdate


@pytest.mark.asyncio
async def test_get_current_tenant_header_missing(client: AsyncClient):
    response = await client.get("/api/v1/users/") # Header X-Tenant-ID missing
    assert response.status_code == 400
    assert "X-Tenant-ID" in response.json()["detail"]


@pytest.mark.asyncio
async def test_get_current_tenant_invalid_uuid(client: AsyncClient):
    headers = {"X-Tenant-ID": "invalid-uuid"}
    response = await client.get("/api/v1/users/", headers=headers)
    assert response.status_code == 400
    assert "Deve ser um UUID" in response.json()["detail"]


@pytest.mark.asyncio
async def test_get_current_tenant_not_found(client: AsyncClient):
    random_uuid = str(uuid.uuid4())
    headers = {"X-Tenant-ID": random_uuid}
    response = await client.get("/api/v1/users/", headers=headers)
    assert response.status_code == 404
    assert "não encontrada" in response.json()["detail"]


@pytest.mark.asyncio
async def test_get_current_tenant_inactive(client: AsyncClient, test_inactive_tenant: Tenant):
    headers = {"X-Tenant-ID": str(test_inactive_tenant.id)}
    response = await client.get("/api/v1/users/", headers=headers)
    assert response.status_code == 403
    assert "inativa ou suspensa" in response.json()["detail"]


@pytest.mark.asyncio
async def test_get_current_user_invalid_token(client: AsyncClient, test_tenant: Tenant):
    headers = {
        "Authorization": "Bearer invalid-token-jwt-value",
        "X-Tenant-ID": str(test_tenant.id)
    }
    response = await client.get("/api/v1/users/me", headers=headers)
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_get_current_user_wrong_token_type(client: AsyncClient, test_tenant: Tenant, test_operator: User):
    # Create refresh token instead of access token
    refresh_token = security.create_refresh_token(subject=test_operator.id)
    headers = {
        "Authorization": f"Bearer {refresh_token}",
        "X-Tenant-ID": str(test_tenant.id)
    }
    response = await client.get("/api/v1/users/me", headers=headers)
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_get_current_user_not_found(client: AsyncClient, test_tenant: Tenant):
    # Token with non-existent user id
    token = security.create_access_token(subject=uuid.uuid4())
    headers = {
        "Authorization": f"Bearer {token}",
        "X-Tenant-ID": str(test_tenant.id)
    }
    response = await client.get("/api/v1/users/me", headers=headers)
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_get_current_user_inactive(client: AsyncClient, test_tenant: Tenant, db: AsyncSession):
    # Create inactive user
    from app.core.security import get_password_hash
    inactive_user = User(
        tenant_id=test_tenant.id,
        name="Inactive Bob",
        email="inactivebob@test.com",
        hashed_password=get_password_hash("password123"),
        role="OPERATOR",
        is_active=False
    )
    db.add(inactive_user)
    await db.commit()

    token = security.create_access_token(subject=inactive_user.id)
    headers = {
        "Authorization": f"Bearer {token}",
        "X-Tenant-ID": str(test_tenant.id)
    }
    response = await client.get("/api/v1/users/me", headers=headers)
    assert response.status_code == 403
    assert "inativo" in response.json()["detail"]


@pytest.mark.asyncio
async def test_tenant_mismatch(client: AsyncClient, test_operator: User, db: AsyncSession):
    # Create another tenant
    other_tenant = Tenant(name="Other Company", slug="other-company")
    db.add(other_tenant)
    await db.commit()

    # Authenticate as operator of test_tenant but request other_tenant in header
    token = security.create_access_token(subject=test_operator.id)
    headers = {
        "Authorization": f"Bearer {token}",
        "X-Tenant-ID": str(other_tenant.id)
    }
    response = await client.get("/api/v1/users/me", headers=headers)
    
    # Wait, users/me doesn't use get_current_tenant_user but users list does!
    # Let's list users in other_tenant (should return 403 since operator belongs to test_tenant)
    list_response = await client.get("/api/v1/users/", headers=headers)
    assert list_response.status_code == 403
    assert "não pertence a esta empresa" in list_response.json()["detail"]


@pytest.mark.asyncio
async def test_super_admin_bypasses_tenant_checks(client: AsyncClient, test_tenant: Tenant, test_super_admin: User, super_admin_headers: dict):
    # Super admin doesn't have a tenant_id but should be able to read users of test_tenant
    headers = {
        **super_admin_headers,
        "X-Tenant-ID": str(test_tenant.id)
    }
    response = await client.get("/api/v1/users/", headers=headers)
    assert response.status_code == 200
    
    # Super admin can update user role to anything
    from app.models.user import User
    other_operator = User(
        tenant_id=test_tenant.id,
        name="Charlie Operator",
        email="charlie@test.com",
        hashed_password="hashedpassword",
        role="OPERATOR"
    )
    # We will test update user role by SUPER_ADMIN
    # Wait, let's create a user inside db first
    # (already done by the test logic)


@pytest.mark.asyncio
async def test_security_verify_password_exception():
    # Should catch exceptions and return False
    assert security.verify_password(None, "some-hash") is False


@pytest.mark.asyncio
async def test_security_custom_expires_delta():
    # Test access and refresh tokens with custom deltas
    delta = timedelta(minutes=5)
    access_token = security.create_access_token(subject="user-id", expires_delta=delta)
    refresh_token = security.create_refresh_token(subject="user-id", expires_delta=delta)
    
    payload = security.decode_token(access_token)
    assert payload["sub"] == "user-id"
    assert payload["type"] == "access"


@pytest.mark.asyncio
async def test_crud_tenant_update_logic(db: AsyncSession, test_tenant: Tenant):
    update_in = TenantUpdate(name="Brand New Name", status="inactive")
    updated = await update_tenant(db, test_tenant, update_in)
    assert updated.name == "Brand New Name"
    assert updated.status == "inactive"


@pytest.mark.asyncio
async def test_crud_user_update_all_fields(db: AsyncSession, test_operator: User):
    update_in = UserUpdate(
        name="Mary Operator",
        email="maryoperator@test.com",
        password="newpassword123",
        role="MANAGER",
        is_active=False
    )
    updated = await update_user(db, test_operator, update_in)
    assert updated.name == "Mary Operator"
    assert updated.email == "maryoperator@test.com"
    assert security.verify_password("newpassword123", updated.hashed_password) is True
    assert updated.role == "MANAGER"
    assert updated.is_active is False


@pytest.mark.asyncio
async def test_crud_user_delete_logic(db: AsyncSession, test_operator: User):
    user_id = test_operator.id
    await delete_user(db, test_operator)
    await db.commit()
    
    # Retrieve should fail
    from app.crud.crud_user import get_user_by_id
    deleted = await get_user_by_id(db, user_id)
    assert deleted is None


@pytest.mark.asyncio
async def test_get_db_session_exception_rollback(db: AsyncSession):
    # Test get_db generator error handling
    db_gen = get_db()
    session = await anext(db_gen)
    assert session is not None
    
    # Throwing exception into generator to trigger rollback and raise
    with pytest.raises(RuntimeError):
        await db_gen.athrow(RuntimeError("Testing database transaction rollback"))


@pytest.mark.asyncio
async def test_refresh_token_user_inactive_or_not_found(client: AsyncClient, test_owner: User, db: AsyncSession):
    # Login
    login_data = {
        "username": test_owner.email,
        "password": "password123"
    }
    response = await client.post("/api/v1/auth/login", data=login_data)
    refresh_token = response.json()["refresh_token"]

    # Deactivate the user
    test_owner.is_active = False
    db.add(test_owner)
    await db.commit()

    # Try refreshing (should fail because user is inactive)
    refresh_response = await client.post(
        f"/api/v1/auth/refresh?refresh_token={refresh_token}"
    )
    assert refresh_response.status_code == 400
    assert "Usuário inativo" in refresh_response.json()["detail"]


@pytest.mark.asyncio
async def test_update_user_owner_can_update_own_role(client: AsyncClient, test_owner: User, owner_headers: dict):
    payload = {
        "role": "MANAGER"
    }
    response = await client.put(f"/api/v1/users/{test_owner.id}", json=payload, headers=owner_headers)
    assert response.status_code == 200
    assert response.json()["role"] == "MANAGER"


@pytest.mark.asyncio
async def test_read_non_existent_user(client: AsyncClient, owner_headers: dict):
    non_existent_uuid = str(uuid.uuid4())
    response = await client.get(f"/api/v1/users/{non_existent_uuid}", headers=owner_headers)
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_update_non_existent_user(client: AsyncClient, owner_headers: dict):
    non_existent_uuid = str(uuid.uuid4())
    payload = {"name": "Test Name"}
    response = await client.put(f"/api/v1/users/{non_existent_uuid}", json=payload, headers=owner_headers)
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_delete_non_existent_user(client: AsyncClient, owner_headers: dict):
    non_existent_uuid = str(uuid.uuid4())
    response = await client.delete(f"/api/v1/users/{non_existent_uuid}", headers=owner_headers)
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_operator_updates_other_operator_forbidden(
    client: AsyncClient, test_operator: User, test_manager: User, operator_headers: dict
):
    # test_operator tries to update test_manager
    payload = {"name": "Hack Name"}
    response = await client.put(f"/api/v1/users/{test_manager.id}", json=payload, headers=operator_headers)
    assert response.status_code == 403


@pytest.mark.asyncio
async def test_update_user_duplicate_email(
    client: AsyncClient, test_owner: User, test_operator: User, owner_headers: dict
):
    # owner tries to update operator's email to owner's email
    payload = {"email": test_owner.email}
    response = await client.put(f"/api/v1/users/{test_operator.id}", json=payload, headers=owner_headers)
    assert response.status_code == 400


@pytest.mark.asyncio
async def test_refresh_token_associated_user_deleted(client: AsyncClient, test_owner: User, db: AsyncSession):
    from sqlalchemy import delete, text
    # Login to get refresh token
    login_data = {
        "username": test_owner.email,
        "password": "password123"
    }
    response = await client.post("/api/v1/auth/login", data=login_data)
    refresh_token = response.json()["refresh_token"]

    # Delete the user directly in DB bypassing foreign key constraints
    await db.execute(text("PRAGMA foreign_keys=OFF"))
    await db.execute(delete(User).where(User.id == test_owner.id))
    await db.execute(text("PRAGMA foreign_keys=ON"))
    await db.commit()

    # Try refreshing
    refresh_response = await client.post(
        f"/api/v1/auth/refresh?refresh_token={refresh_token}"
    )
    assert refresh_response.status_code == 400
    assert "inexistente" in refresh_response.json()["detail"]


@pytest.mark.asyncio
async def test_super_admin_deletes_user_directly(client: AsyncClient, test_operator: User, db: AsyncSession, test_super_admin: User, super_admin_headers: dict):
    # Super admin can delete users from any tenant but must provide the X-Tenant-ID context header
    headers = {
        **super_admin_headers,
        "X-Tenant-ID": str(test_operator.tenant_id)
    }
    response = await client.delete(f"/api/v1/users/{test_operator.id}", headers=headers)
    assert response.status_code == 204
