import uuid
from datetime import datetime, date
from typing import List, Optional
from pydantic import BaseModel, Field
from app.schemas.user import UserOut


# ==========================================
# EMPLOYEE SCHEDULES SCHEMAS
# ==========================================

class EmployeeScheduleBase(BaseModel):
    user_id: uuid.UUID
    shift_date: date
    start_time: str = Field(..., pattern="^[0-2][0-9]:[0-5][0-9]$", description="Format HH:MM")
    end_time: str = Field(..., pattern="^[0-2][0-9]:[0-5][0-9]$", description="Format HH:MM")
    notes: Optional[str] = Field(None, max_length=255)


class EmployeeScheduleCreate(EmployeeScheduleBase):
    pass


class EmployeeScheduleUpdate(BaseModel):
    user_id: Optional[uuid.UUID] = None
    shift_date: Optional[date] = None
    start_time: Optional[str] = Field(None, pattern="^[0-2][0-9]:[0-5][0-9]$")
    end_time: Optional[str] = Field(None, pattern="^[0-2][0-9]:[0-5][0-9]$")
    notes: Optional[str] = Field(None, max_length=255)


class EmployeeScheduleOut(EmployeeScheduleBase):
    id: uuid.UUID
    tenant_id: uuid.UUID
    user: Optional[UserOut] = None

    class Config:
        from_attributes = True


# ==========================================
# SHIFT TRADES SCHEMAS
# ==========================================

class ShiftTradeBase(BaseModel):
    requesting_schedule_id: uuid.UUID
    target_user_id: Optional[uuid.UUID] = None
    target_schedule_id: Optional[uuid.UUID] = None


class ShiftTradeCreate(ShiftTradeBase):
    pass


class ShiftTradeUpdate(BaseModel):
    status: str = Field(..., pattern="^(APPROVED|REJECTED)$")


class ShiftTradeOut(ShiftTradeBase):
    id: uuid.UUID
    tenant_id: uuid.UUID
    requesting_user_id: uuid.UUID
    status: str
    approved_by_id: Optional[uuid.UUID] = None
    created_at: datetime
    updated_at: datetime

    requesting_user: Optional[UserOut] = None
    target_user: Optional[UserOut] = None
    requesting_schedule: Optional[EmployeeScheduleOut] = None
    target_schedule: Optional[EmployeeScheduleOut] = None

    class Config:
        from_attributes = True


# ==========================================
# ABSENCES & VACATION SCHEMAS
# ==========================================

class AbsenceBase(BaseModel):
    user_id: uuid.UUID
    start_date: date
    end_date: date
    type: str = Field(..., pattern="^(VACATION|MEDICAL_LEAVE|ABSENCE|OTHER)$")
    reason: Optional[str] = Field(None, max_length=255)


class AbsenceCreate(AbsenceBase):
    pass


class AbsenceUpdate(BaseModel):
    status: str = Field(..., pattern="^(APPROVED|REJECTED)$")
    reason: Optional[str] = Field(None, max_length=255)


class AbsenceOut(AbsenceBase):
    id: uuid.UUID
    tenant_id: uuid.UUID
    status: str
    approved_by_id: Optional[uuid.UUID] = None
    user: Optional[UserOut] = None

    class Config:
        from_attributes = True
