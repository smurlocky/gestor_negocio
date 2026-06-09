import asyncio
import pytest
import pytest_asyncio
from typing import AsyncGenerator, Generator
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from httpx import AsyncClient, ASGITransport

from app.main import app
from app.core.database import Base, get_db
from app.core.config import settings
from app.core.security import create_access_token
from app.models.tenant import Tenant
from app.models.user import User

# Use an in-memory SQLite database for testing
TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"

engine = create_async_engine(
    TEST_DATABASE_URL,
    connect_args={"check_same_thread": False}
)

TestingSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False
)


@pytest.fixture(scope="session")
def event_loop() -> Generator:
    """Create an instance of the default event loop for the test session."""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


@pytest_asyncio.fixture(scope="function", autouse=True)
async def init_db() -> AsyncGenerator[None, None]:
    """Initialize the test database by creating all tables."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest_asyncio.fixture
async def db() -> AsyncGenerator[AsyncSession, None]:
    """Provide an async database session for a test."""
    async with TestingSessionLocal() as session:
        yield session
        await session.rollback()


@pytest_asyncio.fixture
async def client(db: AsyncSession) -> AsyncGenerator[AsyncClient, None]:
    """Provide an async test client that overrides get_db dependency."""
    async def override_get_db():
        yield db

    app.dependency_overrides[get_db] = override_get_db
    
    # Use ASGITransport for newer HTTPX compatibility
    async with AsyncClient(
        transport=ASGITransport(app=app), 
        base_url="http://testserver"
    ) as ac:
        yield ac
        
    app.dependency_overrides.clear()


@pytest_asyncio.fixture
async def test_tenant(db: AsyncSession) -> Tenant:
    """Create a dummy active tenant for testing."""
    tenant = Tenant(name="Test Company", slug="test-company", status="active")
    db.add(tenant)
    await db.commit()
    await db.refresh(tenant)
    return tenant


@pytest_asyncio.fixture
async def test_inactive_tenant(db: AsyncSession) -> Tenant:
    """Create an inactive tenant for testing."""
    tenant = Tenant(name="Suspended Company", slug="suspended", status="suspended")
    db.add(tenant)
    await db.commit()
    await db.refresh(tenant)
    return tenant


@pytest_asyncio.fixture
async def test_owner(db: AsyncSession, test_tenant: Tenant) -> User:
    """Create a test user with OWNER role."""
    from app.core.security import get_password_hash
    user = User(
        tenant_id=test_tenant.id,
        name="John Owner",
        email="owner@test.com",
        hashed_password=get_password_hash("password123"),
        role="OWNER",
        is_active=True
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


@pytest_asyncio.fixture
async def test_manager(db: AsyncSession, test_tenant: Tenant) -> User:
    """Create a test user with MANAGER role."""
    from app.core.security import get_password_hash
    user = User(
        tenant_id=test_tenant.id,
        name="Mary Manager",
        email="manager@test.com",
        hashed_password=get_password_hash("password123"),
        role="MANAGER",
        is_active=True
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


@pytest_asyncio.fixture
async def test_operator(db: AsyncSession, test_tenant: Tenant) -> User:
    """Create a test user with OPERATOR role."""
    from app.core.security import get_password_hash
    user = User(
        tenant_id=test_tenant.id,
        name="Bob Operator",
        email="operator@test.com",
        hashed_password=get_password_hash("password123"),
        role="OPERATOR",
        is_active=True
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


@pytest_asyncio.fixture
async def test_super_admin(db: AsyncSession) -> User:
    """Create a SUPER_ADMIN user without tenant."""
    from app.core.security import get_password_hash
    user = User(
        tenant_id=None,
        name="Super Admin",
        email="super@admin.com",
        hashed_password=get_password_hash("password123"),
        role="SUPER_ADMIN",
        is_active=True
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


@pytest.fixture
def owner_headers(test_tenant: Tenant, test_owner: User) -> dict:
    """Provide authentication headers for the OWNER user."""
    token = create_access_token(subject=test_owner.id)
    return {
        "Authorization": f"Bearer {token}",
        "X-Tenant-ID": str(test_tenant.id)
    }


@pytest.fixture
def manager_headers(test_tenant: Tenant, test_manager: User) -> dict:
    """Provide authentication headers for the MANAGER user."""
    token = create_access_token(subject=test_manager.id)
    return {
        "Authorization": f"Bearer {token}",
        "X-Tenant-ID": str(test_tenant.id)
    }


@pytest.fixture
def operator_headers(test_tenant: Tenant, test_operator: User) -> dict:
    """Provide authentication headers for the OPERATOR user."""
    token = create_access_token(subject=test_operator.id)
    return {
        "Authorization": f"Bearer {token}",
        "X-Tenant-ID": str(test_tenant.id)
    }


@pytest.fixture
def super_admin_headers(test_super_admin: User) -> dict:
    """Provide authentication headers for SUPER_ADMIN user."""
    token = create_access_token(subject=test_super_admin.id)
    return {
        "Authorization": f"Bearer {token}"
    }
