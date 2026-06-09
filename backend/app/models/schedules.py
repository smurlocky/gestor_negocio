import uuid
from datetime import datetime, date
from sqlalchemy import String, DateTime, ForeignKey, Date, Integer
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base
from app.models.tenant import get_utc_now


class EmployeeSchedule(Base):
    __tablename__ = "employee_schedules"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("tenants.id", ondelete="CASCADE"), 
        nullable=False
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), 
        nullable=False
    )
    shift_date: Mapped[date] = mapped_column(Date, nullable=False)  # python datetime.date
    start_time: Mapped[str] = mapped_column(String(10), nullable=False)  # e.g., "08:00"
    end_time: Mapped[str] = mapped_column(String(10), nullable=False)  # e.g., "16:00"
    notes: Mapped[str | None] = mapped_column(String(255), nullable=True)

    user = relationship("User", foreign_keys=[user_id])


class ShiftTrade(Base):
    __tablename__ = "shift_trades"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("tenants.id", ondelete="CASCADE"), 
        nullable=False
    )
    requesting_user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="RESTRICT"), 
        nullable=False
    )
    target_user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="RESTRICT"), 
        nullable=True
    )
    requesting_schedule_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("employee_schedules.id", ondelete="CASCADE"), 
        nullable=False
    )
    target_schedule_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("employee_schedules.id", ondelete="CASCADE"), 
        nullable=True
    )
    status: Mapped[str] = mapped_column(String(50), default="PENDING", nullable=False)  # PENDING, APPROVED, REJECTED
    approved_by_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), 
        nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), 
        default=get_utc_now
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), 
        default=get_utc_now, 
        onupdate=get_utc_now
    )

    requesting_user = relationship("User", foreign_keys=[requesting_user_id])
    target_user = relationship("User", foreign_keys=[target_user_id])
    requesting_schedule = relationship("EmployeeSchedule", foreign_keys=[requesting_schedule_id])
    target_schedule = relationship("EmployeeSchedule", foreign_keys=[target_schedule_id])
    approved_by = relationship("User", foreign_keys=[approved_by_id])


class Absence(Base):
    __tablename__ = "absences"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("tenants.id", ondelete="CASCADE"), 
        nullable=False
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), 
        nullable=False
    )
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[date] = mapped_column(Date, nullable=False)
    type: Mapped[str] = mapped_column(String(50), nullable=False)  # VACATION, MEDICAL_LEAVE, ABSENCE, OTHER
    reason: Mapped[str | None] = mapped_column(String(255), nullable=True)
    status: Mapped[str] = mapped_column(String(50), default="PENDING", nullable=False)  # PENDING, APPROVED, REJECTED
    approved_by_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), 
        nullable=True
    )

    user = relationship("User", foreign_keys=[user_id])
    approved_by = relationship("User", foreign_keys=[approved_by_id])
