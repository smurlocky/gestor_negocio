import uuid
from datetime import datetime
from sqlalchemy import String, DateTime, ForeignKey, Numeric, Boolean
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base
from app.models.tenant import get_utc_now


class Product(Base):
    __tablename__ = "products"

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
    price: Mapped[float] = mapped_column(
        Numeric(10, 2, asdecimal=False), 
        default=0.0
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), 
        default=get_utc_now
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), 
        default=get_utc_now, 
        onupdate=get_utc_now
    )

    category = relationship("Category", back_populates="products")
    ingredients = relationship(
        "ProductIngredient", 
        back_populates="product", 
        cascade="all, delete-orphan"
    )
    order_items = relationship("OrderItem", back_populates="product")


class ProductIngredient(Base):
    __tablename__ = "product_ingredients"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    product_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("products.id", ondelete="CASCADE"), 
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

    product = relationship("Product", back_populates="ingredients")
    insumo = relationship("Insumo", back_populates="product_ingredients")
