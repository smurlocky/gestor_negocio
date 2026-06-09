import uuid
from datetime import datetime, date
from sqlalchemy import String, DateTime, ForeignKey, Date, Numeric, Text, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base
from app.models.tenant import get_utc_now


class DemandForecast(Base):
    __tablename__ = "demand_forecasts"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("tenants.id", ondelete="CASCADE"), 
        nullable=False
    )
    target_date: Mapped[date] = mapped_column(Date, nullable=False)
    predicted_orders: Mapped[int] = mapped_column(nullable=False)
    predicted_revenue: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    confidence_score: Mapped[float] = mapped_column(Numeric(3, 2), default=0.90, nullable=False)
    model_version: Mapped[str] = mapped_column(String(50), default="heuristics-v1", nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), 
        default=get_utc_now
    )


class AIRecommendation(Base):
    __tablename__ = "ai_recommendations"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("tenants.id", ondelete="CASCADE"), 
        nullable=False
    )
    type: Mapped[str] = mapped_column(String(50), nullable=False)  # STOCK_REPLENISHMENT, SHIFT_OPTIMIZATION
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    impact_level: Mapped[str] = mapped_column(String(50), default="MEDIUM", nullable=False)  # HIGH, MEDIUM, LOW
    action_data: Mapped[dict | None] = mapped_column(JSON, nullable=True)  # Payload for 1-click execution
    status: Mapped[str] = mapped_column(String(50), default="PENDING", nullable=False)  # PENDING, APPLIED, DISMISSED
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), 
        default=get_utc_now
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), 
        default=get_utc_now, 
        onupdate=get_utc_now
    )
