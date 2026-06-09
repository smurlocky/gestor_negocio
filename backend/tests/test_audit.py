import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.tenant import Tenant
from app.models.user import User
from app.crud import create_audit_log


@pytest.mark.asyncio
async def test_list_audit_logs_owner(
    client: AsyncClient, test_tenant: Tenant, test_owner: User, owner_headers: dict, db: AsyncSession
):
    # Insert a fake audit log
    await create_audit_log(
        db,
        tenant_id=test_tenant.id,
        user_id=test_owner.id,
        action="TEST_ACTION",
        table_name="tenants",
        record_id=str(test_tenant.id),
        before_state={"status": "inactive"},
        after_state={"status": "active"}
    )
    await db.commit()

    response = await client.get("/api/v1/audit/", headers=owner_headers)
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 1
    
    log = data[0]
    assert log["action"] == "TEST_ACTION"
    assert log["table_name"] == "tenants"
    assert log["before_state"] == {"status": "inactive"}
    assert log["after_state"] == {"status": "active"}


@pytest.mark.asyncio
async def test_list_audit_logs_operator_forbidden(client: AsyncClient, operator_headers: dict):
    response = await client.get("/api/v1/audit/", headers=operator_headers)
    assert response.status_code == 403


@pytest.mark.asyncio
async def test_audit_logs_tenant_isolation(
    client: AsyncClient, test_tenant: Tenant, owner_headers: dict, db: AsyncSession
):
    # Create another tenant
    other_tenant = Tenant(name="Another Tenant", slug="another-tenant")
    db.add(other_tenant)
    await db.commit()

    # Create audit log for OTHER tenant
    await create_audit_log(
        db,
        tenant_id=other_tenant.id,
        user_id=None,
        action="SECRET_ACTION"
    )
    await db.commit()

    # Query with headers of test_tenant (owner_headers)
    response = await client.get("/api/v1/audit/", headers=owner_headers)
    assert response.status_code == 200
    data = response.json()
    
    # Secret action from another tenant must NOT appear! (Tenant logical isolation)
    actions = [log["action"] for log in data]
    assert "SECRET_ACTION" not in actions
