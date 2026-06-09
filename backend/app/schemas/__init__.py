from app.schemas.tenant import TenantBase, TenantCreate, TenantUpdate, TenantOut
from app.schemas.user import UserBase, UserCreate, UserUpdate, UserOut, UserLogin, UserRegisterTenant
from app.schemas.token import Token, TokenPayload
from app.schemas.audit import AuditLogOut

# New schemas
from app.schemas.category import CategoryCreate, CategoryUpdate, CategoryOut
from app.schemas.insumo import InsumoCreate, InsumoUpdate, InsumoOut, StockMovementManual
from app.schemas.product import ProductIngredientCreate, ProductIngredientOut, ProductCreate, ProductUpdate, ProductOut
from app.schemas.order import OrderItemCreate, OrderItemOut, OrderCreate, OrderOut
from app.schemas.stock_movement import StockMovementOut
from app.schemas.supplier import SupplierCreate, SupplierUpdate, SupplierOut, SupplierPerformanceOut
from app.schemas.purchase import PurchaseItemCreate, PurchaseItemOut, PurchaseOrderCreate, PurchaseOrderUpdate, PurchaseOrderOut
from app.schemas.schedules import (
    EmployeeScheduleCreate, EmployeeScheduleUpdate, EmployeeScheduleOut,
    ShiftTradeCreate, ShiftTradeUpdate, ShiftTradeOut,
    AbsenceCreate, AbsenceUpdate, AbsenceOut
)
from app.schemas.ai import (
    DemandForecastOut, AIRecommendationOut, AIRecommendationApplyOut,
    CopilotRequest, CopilotResponse
)
