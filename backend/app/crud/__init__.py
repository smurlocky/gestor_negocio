from app.crud.crud_tenant import get_tenant_by_id, get_tenant_by_slug, create_tenant, update_tenant
from app.crud.crud_user import (
    get_user_by_id, get_user_by_email, get_users_by_tenant, create_user, update_user, delete_user,
    create_refresh_token_db, get_refresh_token, revoke_refresh_token
)
from app.crud.crud_audit import create_audit_log, get_audit_logs_by_tenant

# New CRUD functions
from app.crud.crud_category import (
    get_category_by_id, get_categories_by_tenant, create_category, update_category, delete_category
)
from app.crud.crud_insumo import (
    get_insumo_by_id, get_insumos_by_tenant, create_insumo, update_insumo, delete_insumo, add_stock_movement
)
from app.crud.crud_product import (
    get_product_by_id, get_products_by_tenant, create_product, update_product, delete_product
)
from app.crud.crud_order import (
    get_order_by_id, get_orders_by_tenant, create_order_with_stock_deduction
)
from app.crud.crud_supplier import (
    get_supplier_by_id, get_suppliers_by_tenant, create_supplier, update_supplier, delete_supplier, get_supplier_performance
)
from app.crud.crud_purchase import (
    get_purchase_order_by_id, get_purchase_orders_by_tenant, create_purchase_order, update_purchase_order_status
)
from app.crud.crud_schedule import (
    get_schedule_by_id, get_schedules_by_tenant, create_schedule, update_schedule, delete_schedule,
    get_trade_by_id, get_trades_by_tenant, create_shift_trade, update_shift_trade_status,
    get_absence_by_id, get_absences_by_tenant, create_absence, update_absence_status, delete_absence
)
from app.crud.crud_ai import (
    get_demand_forecast, generate_ai_recommendations, apply_ai_recommendation, dismiss_ai_recommendation
)
