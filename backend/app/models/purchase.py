import uuid
from datetime import datetime
from sqlalchemy import String, DateTime, ForeignKey, Numeric, Integer
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base
from app.models.tenant import get_utc_now


class PurchaseOrder(Base):
    __tablename__ = "purchase_orders"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("tenants.id", ondelete="CASCADE"), 
        nullable=False
    )
    supplier_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("suppliers.id", ondelete="RESTRICT"), 
        nullable=False
    )
    status: Mapped[str] = mapped_column(String(50), default="PENDING", nullable=False)  # PENDING, COMPLETED, CANCELLED
    total_price: Mapped[float] = mapped_column(
        Numeric(10, 2, asdecimal=False), 
        default=0.0
    )
    delivery_days: Mapped[int | None] = mapped_column(Integer, nullable=True)  # Days elapsed for delivery
    quality_rating: Mapped[int | None] = mapped_column(Integer, nullable=True)  # Rating 1-5 for physical quality
    price_rating: Mapped[int | None] = mapped_column(Integer, nullable=True)  # Rating 1-5 for commercial price
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), 
        default=get_utc_now
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), 
        default=get_utc_now, 
        onupdate=get_utc_now
    )

    supplier = relationship("Supplier", back_populates="purchase_orders")
    items = relationship(
        "PurchaseItem", 
        back_populates="purchase_order", 
        cascade="all, delete-orphan"
    )


class PurchaseItem(Base):
    __tablename__ = "purchase_items"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    purchase_order_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("purchase_orders.id", ondelete="CASCADE"), 
        nullable=False
    )
    insumo_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("insumos.id", ondelete="RESTRICT"), 
        nullable=False
    )
    quantity: Mapped[float] = mapped_column(
        Numeric(12, 4, asdecimal=False), 
        nullable=False
    )
    unit_cost: Mapped[float] = mapped_column(
        Numeric(10, 2, asdecimal=False), 
        nullable=False
    )

    purchase_order = relationship("PurchaseOrder", back_populates="items")
    insumo = relationship("Insumo")
