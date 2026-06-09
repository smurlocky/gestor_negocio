import pytest
import uuid
from datetime import date, timedelta
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.tenant import Tenant
from app.models.user import User
from app.models.schedules import EmployeeSchedule, ShiftTrade, Absence
from app.crud import get_schedule_by_id, get_trade_by_id, get_absence_by_id
from app.core import security


@pytest.mark.asyncio
async def test_crud_schedules_and_leave_conflicts(
    client: AsyncClient, db: AsyncSession, owner_headers: dict, operator_headers: dict, test_operator: User
):
    # 1. Schedule a shift for test_operator (today)
    today_str = date.today().isoformat()
    payload = {
        "user_id": str(test_operator.id),
        "shift_date": today_str,
        "start_time": "08:00",
        "end_time": "16:00",
        "notes": "Plantão de suporte"
    }
    
    # Operators cannot schedule shifts (RoleChecker test)
    response = await client.post("/api/v1/schedules/", json=payload, headers=operator_headers)
    assert response.status_code == 403

    # Owner can schedule shifts
    response = await client.post("/api/v1/schedules/", json=payload, headers=owner_headers)
    assert response.status_code == 201
    sched_data = response.json()
    schedule_id = sched_data["id"]
    assert sched_data["start_time"] == "08:00"
    assert sched_data["notes"] == "Plantão de suporte"

    # 2. Try to get schedules
    get_res = await client.get("/api/v1/schedules/", headers=owner_headers)
    assert get_res.status_code == 200
    assert len(get_res.json()) >= 1
    assert any(s["id"] == schedule_id for s in get_res.json())

    # Try listing schedules with date filters
    filter_res = await client.get(
        f"/api/v1/schedules/?start_date={today_str}&end_date={today_str}", headers=owner_headers
    )
    assert filter_res.status_code == 200
    assert len(filter_res.json()) == 1

    # 3. Create approved absence for operator today
    # (Since it's an Owner request, it's APPROVED directly)
    absence_payload = {
        "user_id": str(test_operator.id),
        "start_date": today_str,
        "end_date": today_str,
        "type": "MEDICAL_LEAVE",
        "reason": "Dor de dente"
    }
    abs_res = await client.post("/api/v1/schedules/absences", json=absence_payload, headers=owner_headers)
    assert abs_res.status_code == 201
    assert abs_res.json()["status"] == "APPROVED"

    # Since the absence is APPROVED and overlaps with the schedule on `today`,
    # the scheduler should have wiped/deleted the existing schedule!
    await db.commit()
    deleted_sched = await get_schedule_by_id(db, uuid.UUID(schedule_id))
    assert deleted_sched is None

    # Try to assign a shift to test_operator during their absence (should fail with 400)
    response_fail = await client.post("/api/v1/schedules/", json=payload, headers=owner_headers)
    assert response_fail.status_code == 400
    assert "afastado" in response_fail.json()["detail"].lower()


@pytest.mark.asyncio
async def test_shift_trades_swapping(
    client: AsyncClient, db: AsyncSession, owner_headers: dict, test_owner: User, test_tenant: Tenant
):
    # Setup: Create two operators in same tenant
    from app.core.security import get_password_hash
    op_a = User(
        tenant_id=test_tenant.id,
        name="Operator A",
        email="opa@test.com",
        hashed_password=get_password_hash("password123"),
        role="OPERATOR",
        is_active=True
    )
    op_b = User(
        tenant_id=test_tenant.id,
        name="Operator B",
        email="opb@test.com",
        hashed_password=get_password_hash("password123"),
        role="OPERATOR",
        is_active=True
    )
    db.add_all([op_a, op_b])
    await db.commit()

    # Create two shifts for them
    today = date.today()
    tomorrow = today + timedelta(days=1)

    sched_a = EmployeeSchedule(
        tenant_id=test_tenant.id,
        user_id=op_a.id,
        shift_date=today,
        start_time="08:00",
        end_time="16:00",
        notes="Shift A"
    )
    sched_b = EmployeeSchedule(
        tenant_id=test_tenant.id,
        user_id=op_b.id,
        shift_date=tomorrow,
        start_time="16:00",
        end_time="23:00",
        notes="Shift B"
    )
    db.add_all([sched_a, sched_b])
    await db.commit()

    # Operator A headers
    token_a = security.create_access_token(subject=op_a.id)
    headers_a = {
        "Authorization": f"Bearer {token_a}",
        "X-Tenant-ID": str(test_tenant.id)
    }

    # 1. Operator A submits a trade request proposing to swap sched_a with op_b's sched_b
    trade_payload = {
        "requesting_schedule_id": str(sched_a.id),
        "target_user_id": str(op_b.id),
        "target_schedule_id": str(sched_b.id)
    }
    trade_res = await client.post("/api/v1/schedules/trades", json=trade_payload, headers=headers_a)
    assert trade_res.status_code == 201
    trade_id = trade_res.json()["id"]
    assert trade_res.json()["status"] == "PENDING"

    # Try listing trades
    list_trades = await client.get("/api/v1/schedules/trades", headers=headers_a)
    assert list_trades.status_code == 200
    assert any(t["id"] == trade_id for t in list_trades.json())

    # 2. Owner approves the trade request
    decision_payload = {"status": "APPROVED"}
    decision_res = await client.put(f"/api/v1/schedules/trades/{trade_id}", json=decision_payload, headers=owner_headers)
    assert decision_res.status_code == 200
    assert decision_res.json()["status"] == "APPROVED"

    # Assert database changes: User IDs on schedules should be swapped!
    await db.commit()
    # sched_a should now belong to op_b
    # sched_b should now belong to op_a
    refreshed_sched_a = await get_schedule_by_id(db, sched_a.id)
    refreshed_sched_b = await get_schedule_by_id(db, sched_b.id)
    assert refreshed_sched_a.user_id == op_b.id
    assert refreshed_sched_b.user_id == op_a.id


@pytest.mark.asyncio
async def test_approved_leave_schedule_wiping(
    client: AsyncClient, db: AsyncSession, owner_headers: dict, operator_headers: dict, test_operator: User
):
    # 1. Create a schedule for Friday
    friday = date.today() + timedelta(days=4)
    payload_sched = {
        "user_id": str(test_operator.id),
        "shift_date": friday.isoformat(),
        "start_time": "12:00",
        "end_time": "20:00"
    }
    sched_res = await client.post("/api/v1/schedules/", json=payload_sched, headers=owner_headers)
    assert sched_res.status_code == 201
    sched_id = sched_res.json()["id"]

    # 2. Operator submits a PENDING absence request covering that Friday
    absence_payload = {
        "user_id": str(test_operator.id),
        "start_date": (friday - timedelta(days=1)).isoformat(),
        "end_date": (friday + timedelta(days=1)).isoformat(),
        "type": "VACATION",
        "reason": "Viagem planejada"
    }
    abs_res = await client.post("/api/v1/schedules/absences", json=absence_payload, headers=operator_headers)
    assert abs_res.status_code == 201
    absence_id = abs_res.json()["id"]
    assert abs_res.json()["status"] == "PENDING"

    # Confirm schedule STILL exists because the absence is only PENDING
    await db.commit()
    sched = await get_schedule_by_id(db, uuid.UUID(sched_id))
    assert sched is not None

    # 3. Owner approves the absence request
    decision_payload = {"status": "APPROVED"}
    decision_res = await client.put(f"/api/v1/schedules/absences/{absence_id}", json=decision_payload, headers=owner_headers)
    assert decision_res.status_code == 200
    assert decision_res.json()["status"] == "APPROVED"

    # Confirm schedule is now WIPED / DELETED because the absence is APPROVED
    await db.commit()
    sched_wiped = await get_schedule_by_id(db, uuid.UUID(sched_id))
    assert sched_wiped is None


@pytest.mark.asyncio
async def test_tenant_isolation_and_rbac(
    client: AsyncClient, db: AsyncSession, owner_headers: dict, test_tenant: Tenant, test_operator: User
):
    # Setup Tenant B
    other_tenant = Tenant(name="Company B", slug="companyb", status="active")
    db.add(other_tenant)
    await db.commit()

    from app.core.security import get_password_hash
    other_owner = User(
        tenant_id=other_tenant.id,
        name="Boss B",
        email="bossb@test.com",
        hashed_password=get_password_hash("password123"),
        role="OWNER",
        is_active=True
    )
    db.add(other_owner)
    await db.commit()

    token_b = security.create_access_token(subject=other_owner.id)
    headers_b = {
        "Authorization": f"Bearer {token_b}",
        "X-Tenant-ID": str(other_tenant.id)
    }

    # 1. Create schedule in Tenant A
    today = date.today().isoformat()
    payload = {
        "user_id": str(test_operator.id),
        "shift_date": today,
        "start_time": "09:00",
        "end_time": "17:00"
    }
    sched_a_res = await client.post("/api/v1/schedules/", json=payload, headers=owner_headers)
    assert sched_a_res.status_code == 201
    sched_a_id = sched_a_res.json()["id"]

    # 2. Try to update or delete schedule A using Tenant B headers (should return 404)
    update_payload = {"start_time": "10:00"}
    up_res = await client.put(f"/api/v1/schedules/{sched_a_id}", json=update_payload, headers=headers_b)
    assert up_res.status_code == 404

    del_res = await client.delete(f"/api/v1/schedules/{sched_a_id}", headers=headers_b)
    assert del_res.status_code == 404
