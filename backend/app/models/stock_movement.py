import uuid
from datetime import datetime
from sqlalchemy import String, DateTime, ForeignKey, Numeric
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base
from app.models.tenant import get_utc_now


class StockMovement(Base):
    __tablename__ = "stock_movements"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("tenants.id", ondelete="CASCADE"), 
        nullable=False
    )
    insumo_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("insumos.id", ondelete="CASCADE"), 
        nullable=False
    )
    quantity: Mapped[float] = mapped_column(
        Numeric(12, 4, asdecimal=False), 
        nullable=False
    )  # Positive for input, negative for output
    type: Mapped[str] = mapped_column(
        String(50), 
        nullable=False
    )  # INPUT, OUTPUT, ADJUSTMENT, AUTOMATIC_CONSUMPTION
    reason: Mapped[str] = mapped_column(String(255), nullable=True)
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), 
        nullable=True
    )
    order_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("orders.id", ondelete="CASCADE"), 
        nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), 
        default=get_utc_now
    )

    insumo = relationship("Insumo", back_populates="stock_movements")
    order = relationship("Order", back_populates="stock_movements")
