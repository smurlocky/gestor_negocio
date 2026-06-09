from fastapi import APIRouter
from app.api.endpoints import auth, users, audit, categories, insumos, products, orders, dashboard, suppliers, purchases, schedules, ai

api_router = APIRouter()
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(users.router, prefix="/users", tags=["users"])
api_router.include_router(audit.router, prefix="/audit", tags=["audit"])
api_router.include_router(categories.router, prefix="/categories", tags=["categories"])
api_router.include_router(insumos.router, prefix="/insumos", tags=["insumos"])
api_router.include_router(products.router, prefix="/products", tags=["products"])
api_router.include_router(orders.router, prefix="/orders", tags=["orders"])
api_router.include_router(dashboard.router, prefix="/dashboard", tags=["dashboard"])
api_router.include_router(suppliers.router, prefix="/suppliers", tags=["suppliers"])
api_router.include_router(purchases.router, prefix="/purchases", tags=["purchases"])
api_router.include_router(schedules.router, prefix="/schedules", tags=["schedules"])
api_router.include_router(ai.router, prefix="/ai", tags=["ai"])
