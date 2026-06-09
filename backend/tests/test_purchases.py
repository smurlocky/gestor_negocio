import pytest
import uuid
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.tenant import Tenant
from app.models.user import User
from app.models.insumo import Insumo
from app.models.supplier import Supplier
from app.models.purchase import PurchaseOrder
from app.crud import get_insumo_by_id, get_supplier_by_id, get_purchase_order_by_id
from app.core import security


@pytest.mark.asyncio
async def test_crud_suppliers(client: AsyncClient, owner_headers: dict):
    # 1. Create Supplier
    payload = {
        "name": "Distribuidora Massa Leve",
        "document": "12345678000199",
        "phone": "(11) 5555-4321",
        "email": "contato@massaleve.com",
        "contact_name": "Marcos Vendedor"
    }
    response = await client.post("/api/v1/suppliers/", json=payload, headers=owner_headers)
    assert response.status_code == 201
    data = response.json()
    supplier_id = data["id"]
    assert data["name"] == "Distribuidora Massa Leve"
    assert data["contact_name"] == "Marcos Vendedor"

    # 2. Get Supplier
    response = await client.get(f"/api/v1/suppliers/{supplier_id}", headers=owner_headers)
    assert response.status_code == 200
    assert response.json()["email"] == "contato@massaleve.com"

    # 3. Update Supplier
    update_payload = {"name": "Massa Leve S/A", "contact_name": "Marcos Silva"}
    response = await client.put(f"/api/v1/suppliers/{supplier_id}", json=update_payload, headers=owner_headers)
    assert response.status_code == 200
    assert response.json()["name"] == "Massa Leve S/A"
    assert response.json()["contact_name"] == "Marcos Silva"

    # 4. List Suppliers
    list_response = await client.get("/api/v1/suppliers/", headers=owner_headers)
    assert list_response.status_code == 200
    assert len(list_response.json()) >= 1
    assert any(s["id"] == supplier_id for s in list_response.json())

    # 5. Delete Supplier
    delete_response = await client.delete(f"/api/v1/suppliers/{supplier_id}", headers=owner_headers)
    assert delete_response.status_code == 204

    # 6. Verify Delete
    get_deleted = await client.get(f"/api/v1/suppliers/{supplier_id}", headers=owner_headers)
    assert get_deleted.status_code == 404


@pytest.mark.asyncio
async def test_purchase_order_flow_and_stock_integration(
    client: AsyncClient, db: AsyncSession, owner_headers: dict, test_tenant: Tenant
):
    # 1. Create Insumo (initial stock: 100g, unit cost: 0.10)
    payload_insumo = {
        "name": "Molho Especial",
        "unit": "g",
        "minimum_stock": 500.0,
        "current_stock": 100.0,
        "unit_cost": 0.10
    }
    response_insumo = await client.post("/api/v1/insumos/", json=payload_insumo, headers=owner_headers)
    assert response_insumo.status_code == 201
    insumo_id = response_insumo.json()["id"]

    # 2. Create Supplier
    payload_supplier = {
        "name": "Tomates do Sul",
        "document": "98765432000188",
        "phone": "(51) 9999-8888",
        "email": "sul@tomates.com",
        "contact_name": "Rita Tomate"
    }
    response_supplier = await client.post("/api/v1/suppliers/", json=payload_supplier, headers=owner_headers)
    assert response_supplier.status_code == 201
    supplier_id = response_supplier.json()["id"]

    # 3. Create Purchase Order (PENDING, buying 400g at R$ 0.15)
    payload_purchase = {
        "supplier_id": supplier_id,
        "items": [
            {
                "insumo_id": insumo_id,
                "quantity": 400.0,
                "unit_cost": 0.15
            }
        ]
    }
    response_purchase = await client.post("/api/v1/purchases/", json=payload_purchase, headers=owner_headers)
    assert response_purchase.status_code == 201
    purchase_id = response_purchase.json()["id"]
    assert response_purchase.json()["status"] == "PENDING"
    assert response_purchase.json()["total_price"] == 400.0 * 0.15

    # Verify that stock did NOT increase yet since order is PENDING
    await db.commit() # Flush setup
    insumo = await get_insumo_by_id(db, uuid.UUID(insumo_id))
    assert insumo.current_stock == 100.0
    assert insumo.unit_cost == 0.10

    # 4. Transition status to COMPLETED and rate supplier
    payload_complete = {
        "status": "COMPLETED",
        "delivery_days": 3,
        "quality_rating": 5,
        "price_rating": 4
    }
    response_complete = await client.put(f"/api/v1/purchases/{purchase_id}", json=payload_complete, headers=owner_headers)
    assert response_complete.status_code == 200
    assert response_complete.json()["status"] == "COMPLETED"
    assert response_complete.json()["quality_rating"] == 5

    # 5. Check Stock Feeding and Weighted Average Cost Recalculation
    # Formula:
    # current_stock = 100.0, unit_cost = 0.10 (old total cost = 10.0)
    # quantity = 400.0, unit_cost_input = 0.15 (new total cost = 60.0)
    # new_stock = 500.0
    # expected average cost = (10.0 + 60.0) / 500.0 = 70.0 / 500.0 = R$ 0.14
    await db.commit()
    insumo_updated = await get_insumo_by_id(db, uuid.UUID(insumo_id))
    assert insumo_updated.current_stock == 500.0
    assert insumo_updated.unit_cost == 0.14

    # 6. Verify Supplier Performance Scorecard
    perf_response = await client.get(f"/api/v1/suppliers/{supplier_id}/performance", headers=owner_headers)
    assert perf_response.status_code == 200
    perf_data = perf_response.json()
    assert perf_data["purchase_orders_count"] == 1
    assert perf_data["total_purchases_value"] == 60.0
    assert perf_data["average_delivery_days"] == 3.0
    assert perf_data["average_quality_rating"] == 5.0
    assert perf_data["average_price_rating"] == 4.0


@pytest.mark.asyncio
async def test_supplier_tenant_isolation(
    client: AsyncClient, db: AsyncSession, owner_headers: dict, test_tenant: Tenant
):
    # 1. Create Supplier in Tenant A
    payload = {"name": "Fornecedor Isolado A"}
    response = await client.post("/api/v1/suppliers/", json=payload, headers=owner_headers)
    assert response.status_code == 201
    supplier_a_id = response.json()["id"]

    # 2. Create Tenant B and Owner B
    other_tenant = Tenant(name="SaaS B", slug="saasb")
    db.add(other_tenant)
    await db.commit()

    from app.core.security import get_password_hash
    other_owner = User(
        tenant_id=other_tenant.id,
        name="Boss B",
        email="boss@saasb.com",
        hashed_password=get_password_hash("password123"),
        role="OWNER"
    )
    db.add(other_owner)
    await db.commit()

    token_b = security.create_access_token(subject=other_owner.id)
    headers_b = {
        "Authorization": f"Bearer {token_b}",
        "X-Tenant-ID": str(other_tenant.id)
    }

    # 3. Try to access Tenant A's supplier with Tenant B headers (should return 404)
    response_b = await client.get(f"/api/v1/suppliers/{supplier_a_id}", headers=headers_b)
    assert response_b.status_code == 404

    # 4. List suppliers of Tenant B (should be empty)
    list_b = await client.get("/api/v1/suppliers/", headers=headers_b)
    assert list_b.status_code == 200
    assert len(list_b.json()) == 0
