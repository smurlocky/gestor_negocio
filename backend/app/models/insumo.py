import uuid
from datetime import datetime
from sqlalchemy import String, DateTime, ForeignKey, Numeric
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base
from app.models.tenant import get_utc_now


class Insumo(Base):
    __tablename__ = "insumos"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("tenants.id", ondelete="CASCADE"), 
        nullable=False
    )
    category_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("categories.id", ondelete="SET NULL"), 
        nullable=True
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    unit: Mapped[str] = mapped_column(String(50), nullable=False)  # kg, g, l, ml, un
    current_stock: Mapped[float] = mapped_column(
        Numeric(12, 4, asdecimal=False), 
        default=0.0
    )
    minimum_stock: Mapped[float] = mapped_column(
        Numeric(12, 4, asdecimal=False), 
        default=0.0
    )
    unit_cost: Mapped[float] = mapped_column(
        Numeric(10, 2, asdecimal=False), 
        default=0.0
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

    category = relationship("Category", back_populates="insumos")
    stock_movements = relationship(
        "StockMovement", 
        back_populates="insumo", 
        cascade="all, delete-orphan"
    )
    product_ingredients = relationship(
        "ProductIngredient", 
        back_populates="insumo", 
        cascade="all, delete-orphan"
    )
