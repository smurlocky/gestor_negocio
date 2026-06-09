import asyncio
import sys
from app.core.database import engine, Base
# Import all models to register them on Base.metadata
from app.models import Tenant, User, RefreshToken, AuditLog


async def init_models():
    async with engine.begin() as conn:
        # For local dev / testing simplicity, create all tables
        await conn.run_sync(Base.metadata.create_all)
    print("Database tables created successfully!")


if __name__ == "__main__":
    asyncio.run(init_models())
