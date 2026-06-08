"""
Integration test fixtures.

Database priority:
  1. TEST_DATABASE_URL env var  → use as-is (PostgreSQL in CI)
  2. Fallback                   → SQLite in-memory (local dev / no DB)

The UUID monkeypatch at the top ensures postgresql.UUID works with SQLite.
It must run before any app module is imported.
"""

import os
import uuid
import pytest
import sqlalchemy.dialects.postgresql as _pg
from sqlalchemy.types import TypeDecorator, String


# ─── UUID compatibility shim for SQLite ──────────────────────────────────────
class _CompatUUID(TypeDecorator):
    """postgresql.UUID replacement that works with both PostgreSQL and SQLite."""
    impl = String(36)
    cache_ok = True

    def __init__(self, *args, as_uuid: bool = True, **kwargs):
        super().__init__()
        self._as_uuid = as_uuid

    def process_bind_param(self, value, dialect):
        if value is None:
            return None
        return str(value) if isinstance(value, uuid.UUID) else str(uuid.UUID(str(value)))

    def process_result_value(self, value, dialect):
        if value is None:
            return None
        return uuid.UUID(str(value)) if self._as_uuid else str(value)


# Patch BEFORE any app import so models pick up the shim
_pg.UUID = _CompatUUID

# ─── Now it is safe to import app modules ────────────────────────────────────
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from fastapi.testclient import TestClient

from app.main import app
from app.api.v1.deps import get_db
from app.db.base import Base
from app.models.models import User, UserRole, RolePermission, PERMISSION_KEYS
from app.core.security import get_password_hash

# ─── Test database ────────────────────────────────────────────────────────────
_TEST_DB_URL = os.environ.get(
    "TEST_DATABASE_URL",
    "sqlite:///./test_asset_inventory.db",
)
_IS_SQLITE = _TEST_DB_URL.startswith("sqlite")

_engine = create_engine(
    _TEST_DB_URL,
    connect_args={"check_same_thread": False} if _IS_SQLITE else {},
)
_Session = sessionmaker(autocommit=False, autoflush=False, bind=_engine)


# ─── Schema management ────────────────────────────────────────────────────────
@pytest.fixture(scope="session", autouse=True)
def _create_schema():
    Base.metadata.create_all(bind=_engine)
    yield
    Base.metadata.drop_all(bind=_engine)
    if _IS_SQLITE:
        db_file = _TEST_DB_URL.replace("sqlite:///", "")
        if db_file != "/:memory:" and os.path.exists(db_file):
            os.remove(db_file)


# ─── Dependency override ──────────────────────────────────────────────────────
def _get_test_db():
    db = _Session()
    try:
        yield db
    finally:
        db.close()


# ─── Seed helpers ─────────────────────────────────────────────────────────────
def _get_or_create_user(email: str, role: UserRole, name: str, password: str) -> User:
    session = _Session()
    try:
        user = session.query(User).filter(User.email == email).first()
        if not user:
            user = User(
                full_name=name,
                email=email,
                hashed_password=get_password_hash(password),
                role=role,
                is_active=True,
            )
            session.add(user)
            session.commit()
            session.refresh(user)
        return user
    finally:
        session.close()


# ─── Session-scoped user seeds ────────────────────────────────────────────────
@pytest.fixture(scope="session")
def seed_admin(_create_schema):
    return _get_or_create_user("admin@test.com", UserRole.ADMIN, "Test Admin", "AdminPass1")


@pytest.fixture(scope="session")
def seed_manager(_create_schema):
    return _get_or_create_user("manager@test.com", UserRole.MANAGER, "Test Manager", "ManagerPass1")


@pytest.fixture(scope="session")
def seed_user(_create_schema):
    return _get_or_create_user("user@test.com", UserRole.USER, "Test User", "UserPass1")


# ─── TestClient ───────────────────────────────────────────────────────────────
@pytest.fixture(scope="session")
def client(_create_schema, seed_admin, seed_manager, seed_user):
    app.dependency_overrides[get_db] = _get_test_db
    with TestClient(app, raise_server_exceptions=True) as c:
        yield c
    app.dependency_overrides.clear()


# ─── Auth token helpers ───────────────────────────────────────────────────────
def _login(client: TestClient, email: str, password: str) -> str:
    resp = client.post("/api/v1/auth/login", data={"username": email, "password": password})
    assert resp.status_code == 200, f"Login failed for {email}: {resp.text}"
    return resp.json()["access_token"]


@pytest.fixture(scope="session")
def admin_token(client):
    return _login(client, "admin@test.com", "AdminPass1")


@pytest.fixture(scope="session")
def manager_token(client):
    return _login(client, "manager@test.com", "ManagerPass1")


@pytest.fixture(scope="session")
def user_token(client):
    return _login(client, "user@test.com", "UserPass1")


@pytest.fixture
def admin_auth(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


@pytest.fixture
def manager_auth(manager_token):
    return {"Authorization": f"Bearer {manager_token}"}


@pytest.fixture
def user_auth(user_token):
    return {"Authorization": f"Bearer {user_token}"}
