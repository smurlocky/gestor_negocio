import pytest
import uuid
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.models.tenant import Tenant
from app.models.user import User
from app.models.insumo import Insumo
from app.models.product import Product, ProductIngredient
from app.models.order import Order
from app.models.stock_movement import StockMovement
from app.crud import get_insumo_by_id, get_product_by_id
from app.core import security


@pytest.mark.asyncio
async def test_create_list_categories(client: AsyncClient, owner_headers: dict):
    # Create INSUMO category
    payload = {"name": "Ingredientes Frescos", "type": "INSUMO"}
    response = await client.post("/api/v1/categories/", json=payload, headers=owner_headers)
    assert response.status_code == 201
    cat1_id = response.json()["id"]

    # Create PRODUCT category
    payload = {"name": "Pizzas de Forno", "type": "PRODUCT"}
    response = await client.post("/api/v1/categories/", json=payload, headers=owner_headers)
    assert response.status_code == 201

    # List categories
    list_response = await client.get("/api/v1/categories/", headers=owner_headers)
    assert list_response.status_code == 200
    assert len(list_response.json()) >= 2
    
    # Filter list
    filtered = await client.get("/api/v1/categories/?cat_type=INSUMO", headers=owner_headers)
    assert filtered.status_code == 200
    assert all(c["type"] == "INSUMO" for c in filtered.json())


@pytest.mark.asyncio
async def test_crud_insumos_and_manual_movements(
    client: AsyncClient, db: AsyncSession, owner_headers: dict, test_tenant: Tenant
):
    # 1. Create Insumo
    payload = {
        "name": "Massa de Pizza",
        "unit": "g",
        "minimum_stock": 5000.0,
        "current_stock": 1000.0,
        "unit_cost": 0.05
    }
    response = await client.post("/api/v1/insumos/", json=payload, headers=owner_headers)
    assert response.status_code == 201
    data = response.json()
    insumo_id = data["id"]
    assert data["name"] == "Massa de Pizza"
    assert data["current_stock"] == 1000.0

    # 2. Check automatic initial stock movement
    await db.commit() # Flush transactions
    result = await db.execute(select(StockMovement).filter(StockMovement.insumo_id == uuid.UUID(insumo_id)))
    movements = result.scalars().all()
    assert len(movements) == 1
    assert movements[0].type == "INPUT"
    assert movements[0].quantity == 1000.0

    # 3. Register manual INPUT with unit cost (Weighted average cost calculation)
    # Buy 2000g of Massa at 0.08 cost.
    # New Cost = ((1000 * 0.05) + (2000 * 0.08)) / 3000 = (50 + 160) / 3000 = 210 / 3000 = 0.07!
    mv_payload = {
        "quantity": 2000.0,
        "type": "INPUT",
        "reason": "Compra de farinha premium"
    }
    mv_response = await client.post(
        f"/api/v1/insumos/{insumo_id}/movement?unit_cost_input=0.08",
        json=mv_payload,
        headers=owner_headers
    )
    assert mv_response.status_code == 201
    
    # Reload insumo and check
    insumo = await get_insumo_by_id(db, uuid.UUID(insumo_id))
    assert insumo.current_stock == 3000.0
    assert insumo.unit_cost == 0.07

    # 4. Register manual ADJUSTMENT (loss)
    adj_payload = {
        "quantity": 500.0,
        "type": "ADJUSTMENT",
        "reason": "Massa estragada descartada"
    }
    await client.post(f"/api/v1/insumos/{insumo_id}/movement", json=adj_payload, headers=owner_headers)
    
    await db.refresh(insumo)
    assert insumo.current_stock == 2500.0


@pytest.mark.asyncio
async def test_crud_products_with_technical_sheets(
    client: AsyncClient, db: AsyncSession, owner_headers: dict
):
    # 1. Create ingredients first
    massa_payload = {"name": "Massa", "unit": "g", "minimum_stock": 100.0, "current_stock": 1000.0, "unit_cost": 0.01}
    massa_res = await client.post("/api/v1/insumos/", json=massa_payload, headers=owner_headers)
    massa_id = massa_res.json()["id"]

    queijo_payload = {"name": "Queijo", "unit": "g", "minimum_stock": 100.0, "current_stock": 2000.0, "unit_cost": 0.04}
    queijo_res = await client.post("/api/v1/insumos/", json=queijo_payload, headers=owner_headers)
    queijo_id = queijo_res.json()["id"]

    # 2. Create Product with recipe Ficha Técnica
    # Recipe: Pizza Marguerita uses 300g Massa and 150g Queijo.
    # Calculated cost = (300 * 0.01) + (150 * 0.04) = 3.00 + 6.00 = 9.00 cost!
    prod_payload = {
        "name": "Pizza Marguerita",
        "price": 35.00,
        "is_active": True,
        "ingredients": [
            {"insumo_id": massa_id, "quantity": 300.0},
            {"insumo_id": queijo_id, "quantity": 150.0}
        ]
    }
    response = await client.post("/api/v1/products/", json=prod_payload, headers=owner_headers)
    assert response.status_code == 201
    data = response.json()
    prod_id = data["id"]
    assert data["name"] == "Pizza Marguerita"
    assert len(data["ingredients"]) == 2

    # 3. Check calculated total cost in database
    product = await get_product_by_id(db, uuid.UUID(prod_id))
    # We can check cost manually since we verified the CRUD logic holds it
    recipe_cost = sum(i.quantity * i.insumo.unit_cost for i in product.ingredients)
    assert recipe_cost == 9.00


@pytest.mark.asyncio
async def test_motor_baixa_automatica_success(
    client: AsyncClient, db: AsyncSession, owner_headers: dict
):
    # Setup: Create Insumos with initial stock
    massa = {"name": "Massa", "unit": "g", "minimum_stock": 10.0, "current_stock": 1000.0, "unit_cost": 0.01}
    massa_res = await client.post("/api/v1/insumos/", json=massa, headers=owner_headers)
    massa_id = massa_res.json()["id"]

    queijo = {"name": "Queijo", "unit": "g", "minimum_stock": 10.0, "current_stock": 1000.0, "unit_cost": 0.04}
    queijo_res = await client.post("/api/v1/insumos/", json=queijo, headers=owner_headers)
    queijo_id = queijo_res.json()["id"]

    # Setup: Create product Pizza Marguerita (uses 300g Massa, 150g Queijo)
    prod_payload = {
        "name": "Pizza Marguerita",
        "price": 40.00,
        "is_active": True,
        "ingredients": [
            {"insumo_id": massa_id, "quantity": 300.0},
            {"insumo_id": queijo_id, "quantity": 150.0}
        ]
    }
    prod_res = await client.post("/api/v1/products/", json=prod_payload, headers=owner_headers)
    prod_id = prod_res.json()["id"]

    # Act: Perform a sale of 2 Pizzas Marguerita!
    # Expected consumption:
    # Massa: 2 * 300 = 600g (remaining: 1000 - 600 = 400g)
    # Queijo: 2 * 150 = 300g (remaining: 1000 - 300 = 700g)
    order_payload = {
        "items": [
            {"product_id": prod_id, "quantity": 2}
        ]
    }
    order_response = await client.post("/api/v1/orders/", json=order_payload, headers=owner_headers)
    assert order_response.status_code == 201
    order_data = order_response.json()
    order_id = order_data["id"]
    assert order_data["total_price"] == 80.00

    # Verify: Check remaining stock values of insumos
    await db.commit() # flush to physical DB
    insumo_massa = await get_insumo_by_id(db, uuid.UUID(massa_id))
    insumo_queijo = await get_insumo_by_id(db, uuid.UUID(queijo_id))
    assert insumo_massa.current_stock == 400.0
    assert insumo_queijo.current_stock == 700.0

    # Verify: Check AUTOMATIC_CONSUMPTION stock movements
    mvt_result = await db.execute(
        select(StockMovement).filter(StockMovement.order_id == uuid.UUID(order_id))
    )
    movements = mvt_result.scalars().all()
    assert len(movements) == 2
    types = [m.type for m in movements]
    assert all(t == "AUTOMATIC_CONSUMPTION" for t in types)
    qtys = [m.quantity for m in movements]
    assert -600.0 in qtys
    assert -300.0 in qtys


@pytest.mark.asyncio
async def test_motor_baixa_rollback_on_failure(
    client: AsyncClient, db: AsyncSession, owner_headers: dict
):
    # Setup: Create Insumo
    massa = {"name": "Massa", "unit": "g", "minimum_stock": 10.0, "current_stock": 1000.0, "unit_cost": 0.01}
    massa_res = await client.post("/api/v1/insumos/", json=massa, headers=owner_headers)
    massa_id = massa_res.json()["id"]

    # Setup: Create product 1 (valid)
    prod_payload = {
        "name": "Pizza Simples",
        "price": 30.00,
        "is_active": True,
        "ingredients": [
            {"insumo_id": massa_id, "quantity": 300.0}
        ]
    }
    prod_res = await client.post("/api/v1/products/", json=prod_payload, headers=owner_headers)
    prod_id = prod_res.json()["id"]

    # Commit setup so rollback only rolls back the sale request
    await db.commit()

    # Act: Register a sale containing product 1 AND a non-existent product ID
    order_payload = {
        "items": [
            {"product_id": prod_id, "quantity": 1},
            {"product_id": str(uuid.uuid4()), "quantity": 1} # Invalid product
        ]
    }
    response = await client.post("/api/v1/orders/", json=order_payload, headers=owner_headers)
    assert response.status_code == 400

    # Verify Rollback: Insumo stock should NOT be decremented (remains 1000g!)
    await db.rollback()
    insumo = await get_insumo_by_id(db, uuid.UUID(massa_id))
    assert insumo.current_stock == 1000.0


@pytest.mark.asyncio
async def test_dashboard_metrics_and_tenant_isolation(
    client: AsyncClient, db: AsyncSession, owner_headers: dict, test_tenant: Tenant
):
    # 1. Create critical stock item (current_stock: 5g < minimum_stock: 50g)
    payload = {"name": "Manjericão", "unit": "g", "minimum_stock": 50.0, "current_stock": 5.0, "unit_cost": 0.10}
    await client.post("/api/v1/insumos/", json=payload, headers=owner_headers)

    # 2. Get dashboard metrics
    dash_response = await client.get("/api/v1/dashboard/", headers=owner_headers)
    assert dash_response.status_code == 200
    data = dash_response.json()
    
    assert data["operation"]["critical_stock_count"] >= 1
    critical_names = [i["name"] for i in data["operation"]["critical_insumos"]]
    assert "Manjericão" in critical_names

    # 3. Test Tenant Isolation
    # Create Tenant B and Owner B
    other_tenant = Tenant(name="Concorrente", slug="concorrente")
    db.add(other_tenant)
    await db.commit()

    from app.core.security import get_password_hash
    other_owner = User(
        tenant_id=other_tenant.id,
        name="Boss B",
        email="boss@concorrente.com",
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

    # Query dashboard of Tenant B (should be empty/different!)
    dash_b = await client.get("/api/v1/dashboard/", headers=headers_b)
    assert dash_b.status_code == 200
    assert dash_b.json()["operation"]["total_insumos"] == 0
    assert dash_b.json()["operation"]["critical_stock_count"] == 0
