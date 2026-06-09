import uuid
from datetime import date
from typing import Annotated, List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api import deps
from app.core.database import get_db
from app.models.tenant import Tenant
from app.models.user import User
from app.schemas.schedules import (
    EmployeeScheduleCreate, EmployeeScheduleUpdate, EmployeeScheduleOut,
    ShiftTradeCreate, ShiftTradeUpdate, ShiftTradeOut,
    AbsenceCreate, AbsenceUpdate, AbsenceOut
)
from app.crud import (
    get_schedule_by_id, get_schedules_by_tenant, create_schedule, update_schedule, delete_schedule,
    get_trade_by_id, get_trades_by_tenant, create_shift_trade, update_shift_trade_status,
    get_absence_by_id, get_absences_by_tenant, create_absence, update_absence_status, delete_absence,
    create_audit_log, get_user_by_id
)

router = APIRouter()


# ==========================================
# EMPLOYEE SCHEDULES ENDPOINTS
# ==========================================

@router.get("/", response_model=List[EmployeeScheduleOut])
async def list_schedules(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_tenant: Annotated[Tenant, Depends(deps.get_current_tenant)],
    current_user: Annotated[User, Depends(deps.get_current_tenant_user)],
    start_date: str | None = None,
    end_date: str | None = None
):
    """
    List all work shifts in active tenant. Supports filtering by start_date and end_date (YYYY-MM-DD).
    """
    s_date = None
    e_date = None
    if start_date:
        try:
            s_date = date.fromisoformat(start_date)
        except ValueError:
            raise HTTPException(status_code=400, detail="Data de início em formato inválido (use AAAA-MM-DD).")
    if end_date:
        try:
            e_date = date.fromisoformat(end_date)
        except ValueError:
            raise HTTPException(status_code=400, detail="Data de término em formato inválido (use AAAA-MM-DD).")

    schedules = await get_schedules_by_tenant(db, current_tenant.id, s_date, e_date)
    return schedules


@router.post("/", response_model=EmployeeScheduleOut, status_code=status.HTTP_201_CREATED)
async def create_new_schedule(
    obj_in: EmployeeScheduleCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_tenant: Annotated[Tenant, Depends(deps.get_current_tenant)],
    current_user: Annotated[User, Depends(deps.get_current_tenant_user)],
    _: Annotated[User, Depends(deps.RoleChecker(["OWNER", "MANAGER", "SUPERVISOR"]))]
):
    """
    Assign a shift to an employee. Restricted to OWNER, MANAGER or SUPERVISOR.
    Checks that coworker belongs to tenant and isn't absent.
    """
    # Validate employee tenant ownership
    emp = await get_user_by_id(db, obj_in.user_id)
    if not emp or emp.tenant_id != current_tenant.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="O colaborador informado é inválido ou não pertence a esta empresa."
        )

    try:
        sched = await create_schedule(db, obj_in, tenant_id=current_tenant.id)
        
        # Audit
        await create_audit_log(
            db,
            tenant_id=current_tenant.id,
            user_id=current_user.id,
            action="SCHEDULE_CREATE",
            table_name="employee_schedules",
            record_id=str(sched.id),
            after_state={
                "employee_name": emp.name,
                "shift_date": str(sched.shift_date),
                "time": f"{sched.start_time}-{sched.end_time}"
            }
        )
        return sched
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.put("/{schedule_id}", response_model=EmployeeScheduleOut)
async def update_existing_schedule(
    schedule_id: uuid.UUID,
    obj_in: EmployeeScheduleUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_tenant: Annotated[Tenant, Depends(deps.get_current_tenant)],
    current_user: Annotated[User, Depends(deps.get_current_tenant_user)],
    _: Annotated[User, Depends(deps.RoleChecker(["OWNER", "MANAGER", "SUPERVISOR"]))]
):
    """
    Update a work shift assignment. Restricted to OWNER, MANAGER or SUPERVISOR.
    """
    sched = await get_schedule_by_id(db, schedule_id)
    if not sched or sched.tenant_id != current_tenant.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Escala de turno não encontrada.")

    # Validate employee if changing user
    if obj_in.user_id:
        emp = await get_user_by_id(db, obj_in.user_id)
        if not emp or emp.tenant_id != current_tenant.id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Colaborador inválido.")

    before_state = {
        "user_id": str(sched.user_id),
        "shift_date": str(sched.shift_date),
        "start_time": sched.start_time,
        "end_time": sched.end_time
    }

    try:
        updated = await update_schedule(db, sched, obj_in)
        
        # Audit
        await create_audit_log(
            db,
            tenant_id=current_tenant.id,
            user_id=current_user.id,
            action="SCHEDULE_UPDATE",
            table_name="employee_schedules",
            record_id=str(schedule_id),
            before_state=before_state,
            after_state={
                "user_id": str(updated.user_id),
                "shift_date": str(updated.shift_date),
                "start_time": updated.start_time,
                "end_time": updated.end_time
            }
        )
        return updated
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.delete("/{schedule_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_existing_schedule(
    schedule_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_tenant: Annotated[Tenant, Depends(deps.get_current_tenant)],
    current_user: Annotated[User, Depends(deps.get_current_tenant_user)],
    _: Annotated[User, Depends(deps.RoleChecker(["OWNER", "MANAGER", "SUPERVISOR"]))]
):
    """
    Remove a shift assignment. Restricted to OWNER, MANAGER or SUPERVISOR.
    """
    sched = await get_schedule_by_id(db, schedule_id)
    if not sched or sched.tenant_id != current_tenant.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Escala de turno não encontrada.")

    before_state = {
        "user_id": str(sched.user_id),
        "shift_date": str(sched.shift_date),
        "time": f"{sched.start_time}-{sched.end_time}"
    }

    await delete_schedule(db, sched)
    
    # Audit
    await create_audit_log(
        db,
        tenant_id=current_tenant.id,
        user_id=current_user.id,
        action="SCHEDULE_DELETE",
        table_name="employee_schedules",
        record_id=str(schedule_id),
        before_state=before_state
    )


# ==========================================
# SHIFT TRADES ENDPOINTS
# ==========================================

@router.get("/trades", response_model=List[ShiftTradeOut])
async def list_trades(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_tenant: Annotated[Tenant, Depends(deps.get_current_tenant)],
    current_user: Annotated[User, Depends(deps.get_current_tenant_user)]
):
    """
    List all shift trade requests. Open to all roles.
    """
    trades = await get_trades_by_tenant(db, current_tenant.id)
    return trades


@router.post("/trades", response_model=ShiftTradeOut, status_code=status.HTTP_201_CREATED)
async def create_trade_request(
    obj_in: ShiftTradeCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_tenant: Annotated[Tenant, Depends(deps.get_current_tenant)],
    current_user: Annotated[User, Depends(deps.get_current_tenant_user)]
):
    """
    Submit a shift trade request. Solicitante must own the requesting shift.
    """
    try:
        trade = await create_shift_trade(db, obj_in, requesting_user_id=current_user.id, tenant_id=current_tenant.id)
        
        # Audit
        await create_audit_log(
            db,
            tenant_id=current_tenant.id,
            user_id=current_user.id,
            action="SHIFT_TRADE_CREATE",
            table_name="shift_trades",
            record_id=str(trade.id),
            after_state={
                "status": trade.status,
                "requesting_schedule_id": str(trade.requesting_schedule_id)
            }
        )
        return trade
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.put("/trades/{trade_id}", response_model=ShiftTradeOut)
async def update_trade_request_status(
    trade_id: uuid.UUID,
    obj_in: ShiftTradeUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_tenant: Annotated[Tenant, Depends(deps.get_current_tenant)],
    current_user: Annotated[User, Depends(deps.get_current_tenant_user)],
    _: Annotated[User, Depends(deps.RoleChecker(["OWNER", "MANAGER", "SUPERVISOR"]))]
):
    """
    Approve or reject a shift trade. Swaps worker IDs on schedules at APPROVE.
    Restricted to OWNER, MANAGER or SUPERVISOR.
    """
    trade = await get_trade_by_id(db, trade_id)
    if not trade or trade.tenant_id != current_tenant.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Solicitação de troca não encontrada.")

    if trade.status != "PENDING":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Esta solicitação já foi finalizada.")

    before_state = {"status": trade.status}

    updated = await update_shift_trade_status(db, db_obj=trade, obj_in=obj_in, approved_by_id=current_user.id)
    
    # Audit
    await create_audit_log(
        db,
        tenant_id=current_tenant.id,
        user_id=current_user.id,
        action="SHIFT_TRADE_DECISION",
        table_name="shift_trades",
        record_id=str(trade_id),
        before_state=before_state,
        after_state={
            "status": updated.status,
            "approved_by": current_user.name
        }
    )
    
    return updated


# ==========================================
# ABSENCES & LEAVES ENDPOINTS
# ==========================================

@router.get("/absences", response_model=List[AbsenceOut])
async def list_absences(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_tenant: Annotated[Tenant, Depends(deps.get_current_tenant)],
    current_user: Annotated[User, Depends(deps.get_current_tenant_user)]
):
    """
    List vacation, medical leaves and absences.
    """
    absences = await get_absences_by_tenant(db, current_tenant.id)
    return absences


@router.post("/absences", response_model=AbsenceOut, status_code=status.HTTP_201_CREATED)
async def create_new_absence(
    obj_in: AbsenceCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_tenant: Annotated[Tenant, Depends(deps.get_current_tenant)],
    current_user: Annotated[User, Depends(deps.get_current_tenant_user)]
):
    """
    Add vacation, medical leave or absence.
    Operators submit PENDING requests. Owners, Managers, and Supervisors can create APPROVED records directly.
    """
    # Validate worker tenant
    emp = await get_user_by_id(db, obj_in.user_id)
    if not emp or emp.tenant_id != current_tenant.id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Colaborador inválido.")

    # Determine status and approver
    initial_status = "PENDING"
    approved_by_id = None
    if current_user.role in ["OWNER", "MANAGER", "SUPERVISOR"]:
        initial_status = "APPROVED"
        approved_by_id = current_user.id

    try:
        abs_rec = await create_absence(
            db, 
            obj_in, 
            tenant_id=current_tenant.id, 
            initial_status=initial_status,
            approved_by_id=approved_by_id
        )
        
        # Audit
        await create_audit_log(
            db,
            tenant_id=current_tenant.id,
            user_id=current_user.id,
            action="ABSENCE_CREATE",
            table_name="absences",
            record_id=str(abs_rec.id),
            after_state={
                "employee_name": emp.name,
                "range": f"{abs_rec.start_date} até {abs_rec.end_date}",
                "status": abs_rec.status,
                "type": abs_rec.type
            }
        )
        return abs_rec
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.put("/absences/{absence_id}", response_model=AbsenceOut)
async def update_absence(
    absence_id: uuid.UUID,
    obj_in: AbsenceUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_tenant: Annotated[Tenant, Depends(deps.get_current_tenant)],
    current_user: Annotated[User, Depends(deps.get_current_tenant_user)],
    _: Annotated[User, Depends(deps.RoleChecker(["OWNER", "MANAGER", "SUPERVISOR"]))]
):
    """
    Approve or reject a leave/absence request. Restricted to OWNER, MANAGER or SUPERVISOR.
    Triggers conflict shift wipes at APPROVE.
    """
    absence = await get_absence_by_id(db, absence_id)
    if not absence or absence.tenant_id != current_tenant.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Registro de afastamento não encontrado.")

    before_state = {"status": absence.status, "reason": absence.reason}

    updated = await update_absence_status(db, db_obj=absence, obj_in=obj_in, approved_by_id=current_user.id)
    
    # Audit
    await create_audit_log(
        db,
        tenant_id=current_tenant.id,
        user_id=current_user.id,
        action="ABSENCE_STATUS_DECISION",
        table_name="absences",
        record_id=str(absence_id),
        before_state=before_state,
        after_state={"status": updated.status, "reason": updated.reason}
    )
    
    return updated
