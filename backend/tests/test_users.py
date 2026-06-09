import pytest
import uuid
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.tenant import Tenant
from app.models.user import User
from app.crud import get_user_by_email


@pytest.mark.asyncio
async def test_read_user_me(client: AsyncClient, test_operator: User, operator_headers: dict):
    response = await client.get("/api/v1/users/me", headers=operator_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == str(test_operator.id)
    assert data["email"] == test_operator.email
    assert data["role"] == "OPERATOR"


@pytest.mark.asyncio
async def test_list_users_owner(client: AsyncClient, test_owner: User, test_operator: User, owner_headers: dict):
    response = await client.get("/api/v1/users/", headers=owner_headers)
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 2
    emails = [u["email"] for u in data]
    assert test_owner.email in emails
    assert test_operator.email in emails


@pytest.mark.asyncio
async def test_list_users_operator_forbidden(client: AsyncClient, operator_headers: dict):
    response = await client.get("/api/v1/users/", headers=operator_headers)
    assert response.status_code == 403
    assert "insuficiente" in response.json()["detail"]


@pytest.mark.asyncio
async def test_register_new_user_owner(client: AsyncClient, owner_headers: dict, db: AsyncSession):
    payload = {
        "name": "New Supervisor",
        "email": "supervisor@test.com",
        "password": "password123",
        "role": "SUPERVISOR"
    }
    
    response = await client.post("/api/v1/users/", json=payload, headers=owner_headers)
    assert response.status_code == 201
    data = response.json()
    assert data["email"] == payload["email"]
    assert data["role"] == "SUPERVISOR"
    
    # Check db
    user = await get_user_by_email(db, payload["email"])
    assert user is not None
    assert user.name == payload["name"]


@pytest.mark.asyncio
async def test_register_new_user_duplicate_email(client: AsyncClient, test_operator: User, owner_headers: dict):
    payload = {
        "name": "Duplicate User",
        "email": test_operator.email, # Duplicate
        "password": "password123",
        "role": "OPERATOR"
    }
    
    response = await client.post("/api/v1/users/", json=payload, headers=owner_headers)
    assert response.status_code == 400
    assert "já está cadastrado" in response.json()["detail"]


@pytest.mark.asyncio
async def test_register_new_user_manager_unauthorized_role(client: AsyncClient, manager_headers: dict):
    payload = {
        "name": "New Owner?",
        "email": "owner2@test.com",
        "password": "password123",
        "role": "OWNER" # A manager cannot register an owner
    }
    
    response = await client.post("/api/v1/users/", json=payload, headers=manager_headers)
    assert response.status_code == 403
    assert "não tem permissão para cadastrar" in response.json()["detail"]


@pytest.mark.asyncio
async def test_read_user_isolated_tenant(
    client: AsyncClient, db: AsyncSession, owner_headers: dict, test_owner: User
):
    # Create another tenant and user
    other_tenant = Tenant(name="Other Corp", slug="other-corp")
    db.add(other_tenant)
    await db.commit()
    
    from app.core.security import get_password_hash
    other_user = User(
        tenant_id=other_tenant.id,
        name="Other Guy",
        email="other@corp.com",
        hashed_password=get_password_hash("password123"),
        role="OWNER"
    )
    db.add(other_user)
    await db.commit()

    # Try reading other user (should return 404/403 due to logical isolation)
    response = await client.get(f"/api/v1/users/{other_user.id}", headers=owner_headers)
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_update_user_self(client: AsyncClient, test_operator: User, operator_headers: dict):
    payload = {
        "name": "Updated Bob"
    }
    
    response = await client.put(f"/api/v1/users/{test_operator.id}", json=payload, headers=operator_headers)
    assert response.status_code == 200
    assert response.json()["name"] == "Updated Bob"


@pytest.mark.asyncio
async def test_update_user_role_self_forbidden(client: AsyncClient, test_operator: User, operator_headers: dict):
    payload = {
        "role": "OWNER" # Cannot update own role to OWNER if operator
    }
    
    response = await client.put(f"/api/v1/users/{test_operator.id}", json=payload, headers=operator_headers)
    assert response.status_code == 403
    assert "próprio perfil/cargo" in response.json()["detail"]


@pytest.mark.asyncio
async def test_update_user_manager_unauthorized_role(
    client: AsyncClient, test_operator: User, manager_headers: dict
):
    payload = {
        "role": "OWNER" # Manager cannot upgrade operator to OWNER
    }
    
    response = await client.put(f"/api/v1/users/{test_operator.id}", json=payload, headers=manager_headers)
    assert response.status_code == 403
    assert "atribuir este perfil" in response.json()["detail"]


@pytest.mark.asyncio
async def test_delete_user_owner(client: AsyncClient, test_operator: User, owner_headers: dict):
    response = await client.delete(f"/api/v1/users/{test_operator.id}", headers=owner_headers)
    assert response.status_code == 204


@pytest.mark.asyncio
async def test_delete_user_self_forbidden(client: AsyncClient, test_owner: User, owner_headers: dict):
    response = await client.delete(f"/api/v1/users/{test_owner.id}", headers=owner_headers)
    assert response.status_code == 400
    assert "própria conta" in response.json()["detail"]


@pytest.mark.asyncio
async def test_delete_user_manager_forbidden_to_delete_owner(
    client: AsyncClient, test_owner: User, manager_headers: dict
):
    response = await client.delete(f"/api/v1/users/{test_owner.id}", headers=manager_headers)
    assert response.status_code == 403
    assert "insuficiente para excluir" in response.json()["detail"]
