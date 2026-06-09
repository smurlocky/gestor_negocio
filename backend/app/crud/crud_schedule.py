import uuid
from datetime import date
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from sqlalchemy import delete

from app.models.schedules import EmployeeSchedule, ShiftTrade, Absence
from app.schemas.schedules import (
    EmployeeScheduleCreate, EmployeeScheduleUpdate,
    ShiftTradeCreate, ShiftTradeUpdate,
    AbsenceCreate, AbsenceUpdate
)


# ==========================================
# EMPLOYEE SCHEDULES CRUD
# ==========================================

async def get_schedule_by_id(db: AsyncSession, schedule_id: uuid.UUID) -> EmployeeSchedule | None:
    result = await db.execute(
        select(EmployeeSchedule)
        .filter(EmployeeSchedule.id == schedule_id)
        .options(selectinload(EmployeeSchedule.user))
    )
    return result.scalars().first()


async def get_schedules_by_tenant(
    db: AsyncSession, 
    tenant_id: uuid.UUID,
    start_date: date | None = None,
    end_date: date | None = None
) -> list[EmployeeSchedule]:
    query = select(EmployeeSchedule).filter(EmployeeSchedule.tenant_id == tenant_id)
    if start_date:
        query = query.filter(EmployeeSchedule.shift_date >= start_date)
    if end_date:
        query = query.filter(EmployeeSchedule.shift_date <= end_date)
    
    result = await db.execute(query.options(selectinload(EmployeeSchedule.user)))
    return list(result.scalars().all())


async def check_employee_absence(db: AsyncSession, tenant_id: uuid.UUID, user_id: uuid.UUID, shift_date: date) -> bool:
    """
    Returns True if the employee has an APPROVED absence/leave on this shift_date.
    """
    result = await db.execute(
        select(Absence).filter(
            Absence.tenant_id == tenant_id,
            Absence.user_id == user_id,
            Absence.status == "APPROVED",
            Absence.start_date <= shift_date,
            Absence.end_date >= shift_date
        )
    )
    return result.scalars().first() is not None


async def create_schedule(db: AsyncSession, obj_in: EmployeeScheduleCreate, tenant_id: uuid.UUID) -> EmployeeSchedule:
    # 1. Check for absence/leave conflict
    is_absent = await check_employee_absence(db, tenant_id, obj_in.user_id, obj_in.shift_date)
    if is_absent:
        raise ValueError("O colaborador está afastado (férias ou licença médica) nesta data.")

    db_obj = EmployeeSchedule(
        tenant_id=tenant_id,
        user_id=obj_in.user_id,
        shift_date=obj_in.shift_date,
        start_time=obj_in.start_time,
        end_time=obj_in.end_time,
        notes=obj_in.notes
    )
    db.add(db_obj)
    await db.flush()
    return await get_schedule_by_id(db, db_obj.id)


async def update_schedule(db: AsyncSession, db_obj: EmployeeSchedule, obj_in: EmployeeScheduleUpdate) -> EmployeeSchedule:
    target_date = obj_in.shift_date if obj_in.shift_date is not None else db_obj.shift_date
    target_user = obj_in.user_id if obj_in.user_id is not None else db_obj.user_id

    # 1. Check absence conflict if changing user or date
    if obj_in.shift_date is not None or obj_in.user_id is not None:
        is_absent = await check_employee_absence(db, db_obj.tenant_id, target_user, target_date)
        if is_absent:
            raise ValueError("O colaborador está afastado (férias ou licença médica) nesta data.")

    if obj_in.user_id is not None:
        db_obj.user_id = obj_in.user_id
    if obj_in.shift_date is not None:
        db_obj.shift_date = obj_in.shift_date
    if obj_in.start_time is not None:
        db_obj.start_time = obj_in.start_time
    if obj_in.end_time is not None:
        db_obj.end_time = obj_in.end_time
    if obj_in.notes is not None:
        db_obj.notes = obj_in.notes

    db.add(db_obj)
    await db.flush()
    return await get_schedule_by_id(db, db_obj.id)


async def delete_schedule(db: AsyncSession, db_obj: EmployeeSchedule) -> None:
    await db.delete(db_obj)
    await db.flush()


# ==========================================
# SHIFT TRADES CRUD
# ==========================================

async def get_trade_by_id(db: AsyncSession, trade_id: uuid.UUID) -> ShiftTrade | None:
    result = await db.execute(
        select(ShiftTrade)
        .filter(ShiftTrade.id == trade_id)
        .options(
            selectinload(ShiftTrade.requesting_user),
            selectinload(ShiftTrade.target_user),
            selectinload(ShiftTrade.requesting_schedule).selectinload(EmployeeSchedule.user),
            selectinload(ShiftTrade.target_schedule).selectinload(EmployeeSchedule.user),
            selectinload(ShiftTrade.approved_by)
        )
    )
    return result.scalars().first()


async def get_trades_by_tenant(db: AsyncSession, tenant_id: uuid.UUID) -> list[ShiftTrade]:
    result = await db.execute(
        select(ShiftTrade)
        .filter(ShiftTrade.tenant_id == tenant_id)
        .options(
            selectinload(ShiftTrade.requesting_user),
            selectinload(ShiftTrade.target_user),
            selectinload(ShiftTrade.requesting_schedule).selectinload(EmployeeSchedule.user),
            selectinload(ShiftTrade.target_schedule).selectinload(EmployeeSchedule.user),
            selectinload(ShiftTrade.approved_by)
        )
    )
    return list(result.scalars().all())


async def create_shift_trade(db: AsyncSession, obj_in: ShiftTradeCreate, requesting_user_id: uuid.UUID, tenant_id: uuid.UUID) -> ShiftTrade:
    # Validate requester schedule ownership
    req_sched = await get_schedule_by_id(db, obj_in.requesting_schedule_id)
    if not req_sched or req_sched.tenant_id != tenant_id or req_sched.user_id != requesting_user_id:
        raise ValueError("A escala a ser cedida é inválida ou não pertence ao solicitante.")

    # Validate target schedule if provided
    if obj_in.target_schedule_id:
        tar_sched = await get_schedule_by_id(db, obj_in.target_schedule_id)
        if not tar_sched or tar_sched.tenant_id != tenant_id:
            raise ValueError("A escala de troca proposta do colega é inválida.")
        
        # If target user ID not supplied, auto-assign from the targeted schedule
        target_user_id = obj_in.target_user_id or tar_sched.user_id
    else:
        target_user_id = obj_in.target_user_id

    db_obj = ShiftTrade(
        tenant_id=tenant_id,
        requesting_user_id=requesting_user_id,
        target_user_id=target_user_id,
        requesting_schedule_id=obj_in.requesting_schedule_id,
        target_schedule_id=obj_in.target_schedule_id,
        status="PENDING"
    )
    db.add(db_obj)
    await db.flush()
    return await get_trade_by_id(db, db_obj.id)


async def update_shift_trade_status(
    db: AsyncSession,
    db_obj: ShiftTrade,
    obj_in: ShiftTradeUpdate,
    approved_by_id: uuid.UUID
) -> ShiftTrade:
    old_status = db_obj.status
    new_status = obj_in.status

    if new_status == "APPROVED" and old_status == "PENDING":
        # Execute Shift Swapping Business Logic
        req_sched = db_obj.requesting_schedule
        tar_sched = db_obj.target_schedule

        # Colleague taking requester's shift
        req_sched.user_id = db_obj.target_user_id
        db.add(req_sched)

        # If dual swap trade
        if tar_sched:
            tar_sched.user_id = db_obj.requesting_user_id
            db.add(tar_sched)
        
        db_obj.status = "APPROVED"
        db_obj.approved_by_id = approved_by_id

    elif new_status == "REJECTED" and old_status == "PENDING":
        db_obj.status = "REJECTED"
        db_obj.approved_by_id = approved_by_id
    
    db.add(db_obj)
    await db.flush()
    return await get_trade_by_id(db, db_obj.id)


# ==========================================
# ABSENCES / LEAVES CRUD
# ==========================================

async def get_absence_by_id(db: AsyncSession, absence_id: uuid.UUID) -> Absence | None:
    result = await db.execute(
        select(Absence)
        .filter(Absence.id == absence_id)
        .options(selectinload(Absence.user), selectinload(Absence.approved_by))
    )
    return result.scalars().first()


async def get_absences_by_tenant(db: AsyncSession, tenant_id: uuid.UUID) -> list[Absence]:
    result = await db.execute(
        select(Absence)
        .filter(Absence.tenant_id == tenant_id)
        .options(selectinload(Absence.user), selectinload(Absence.approved_by))
    )
    return list(result.scalars().all())


async def create_absence(
    db: AsyncSession, 
    obj_in: AbsenceCreate, 
    tenant_id: uuid.UUID,
    initial_status: str = "PENDING",
    approved_by_id: uuid.UUID | None = None
) -> Absence:
    if obj_in.end_date < obj_in.start_date:
        raise ValueError("A data de término não pode ser anterior à data de início.")

    db_obj = Absence(
        tenant_id=tenant_id,
        user_id=obj_in.user_id,
        start_date=obj_in.start_date,
        end_date=obj_in.end_date,
        type=obj_in.type,
        reason=obj_in.reason,
        status=initial_status,
        approved_by_id=approved_by_id
    )
    db.add(db_obj)
    await db.flush()

    # If directly created as APPROVED, trigger the shift wiping
    if initial_status == "APPROVED":
        await wipe_conflicting_schedules(db, tenant_id, obj_in.user_id, obj_in.start_date, obj_in.end_date)

    return await get_absence_by_id(db, db_obj.id)


async def update_absence_status(
    db: AsyncSession,
    db_obj: Absence,
    obj_in: AbsenceUpdate,
    approved_by_id: uuid.UUID
) -> Absence:
    old_status = db_obj.status
    new_status = obj_in.status

    if new_status == "APPROVED" and old_status != "APPROVED":
        # Trigger conflict shift wiping to avoid scheduled worker on leaves
        await wipe_conflicting_schedules(
            db, 
            tenant_id=db_obj.tenant_id, 
            user_id=db_obj.user_id, 
            start_date=db_obj.start_date, 
            end_date=db_obj.end_date
        )
    
    db_obj.status = new_status
    db_obj.approved_by_id = approved_by_id
    if obj_in.reason is not None:
        db_obj.reason = obj_in.reason

    db.add(db_obj)
    await db.flush()
    return await get_absence_by_id(db, db_obj.id)


async def delete_absence(db: AsyncSession, db_obj: Absence) -> None:
    await db.delete(db_obj)
    await db.flush()


async def wipe_conflicting_schedules(db: AsyncSession, tenant_id: uuid.UUID, user_id: uuid.UUID, start_date: date, end_date: date) -> None:
    """
    Deletes any employee shifts that conflict with the approved leave range.
    """
    await db.execute(
        delete(EmployeeSchedule).where(
            EmployeeSchedule.tenant_id == tenant_id,
            EmployeeSchedule.user_id == user_id,
            EmployeeSchedule.shift_date >= start_date,
            EmployeeSchedule.shift_date <= end_date
        )
    )
    await db.flush()
