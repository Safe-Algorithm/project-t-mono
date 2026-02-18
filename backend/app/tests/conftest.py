import pytest
from typing import Generator
from unittest.mock import patch

from fastapi.testclient import TestClient
from sqlmodel import Session, SQLModel, create_engine
from sqlmodel.pool import StaticPool

from app.api import deps
from app.core.config import settings
from app.main import app
from app.models.source import RequestSource

# Speed up tests: replace bcrypt with a trivial hash so user creation is fast
_FAKE_HASH_PREFIX = "fakehash:"

def _fast_hash(password: str) -> str:
    return f"{_FAKE_HASH_PREFIX}{password}"

def _fast_verify(plain: str, hashed: str) -> bool:
    if hashed.startswith(_FAKE_HASH_PREFIX):
        return plain == hashed[len(_FAKE_HASH_PREFIX):]
    return False

# Patch the CryptContext methods directly - this is what actually calls bcrypt
from app.core.security import pwd_context
patch.object(pwd_context, "hash", side_effect=_fast_hash).start()
patch.object(pwd_context, "verify", side_effect=_fast_verify).start()


@pytest.fixture(name="session")
def session_fixture() -> Generator[Session, None, None]:
    engine = create_engine(
        "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
    )
    SQLModel.metadata.create_all(engine)
    with Session(engine) as session:
        yield session
    SQLModel.metadata.drop_all(engine)


class FakeRedis:
    """In-memory Redis fake that actually stores/retrieves data for tests."""
    def __init__(self):
        self._store = {}

    def setex(self, key, ttl, value):
        self._store[key] = value
        return True

    def set(self, key, value, ex=None):
        self._store[key] = value
        return True

    def get(self, key):
        return self._store.get(key)

    def delete(self, *keys):
        for key in keys:
            self._store.pop(key, None)
        return len(keys)

    def exists(self, key):
        return 1 if key in self._store else 0

    def incr(self, key):
        val = int(self._store.get(key, 0)) + 1
        self._store[key] = str(val)
        return val

    def expire(self, key, ttl):
        return True

    def ttl(self, key):
        return 300 if key in self._store else -2

    def clear(self):
        self._store.clear()


@pytest.fixture(autouse=True)
def mock_redis():
    """Provide a real in-memory Redis fake for all tests."""
    fake = FakeRedis()

    patches = [
        patch('app.core.redis.redis_client', fake),
        patch('app.core.redis.is_token_blacklisted', return_value=False),
        patch('app.core.redis.add_token_to_blacklist', return_value=None),
        patch('app.api.routes.auth.redis_client', fake),
        patch('app.api.routes.users.redis_client', fake),
        patch('app.api.routes.team.redis_client', fake),
        patch('app.api.routes.admin.redis_client', fake),
        patch('app.api.routes.otp.redis_client', fake),
        patch('app.api.deps.is_token_blacklisted', return_value=False),
    ]
    for p in patches:
        p.start()
    yield fake
    for p in patches:
        p.stop()



@pytest.fixture(name="client")
def client_fixture(session: Session) -> Generator[TestClient, None, None]:
    def get_session_override() -> Generator[Session, None, None]:
        yield session

    app.dependency_overrides[deps.get_session] = get_session_override
    client = TestClient(app)
    yield client
    app.dependency_overrides.clear()
