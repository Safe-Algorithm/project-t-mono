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


@pytest.fixture(name="session")
def session_fixture() -> Generator[Session, None, None]:
    engine = create_engine(
        "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
    )
    SQLModel.metadata.create_all(engine)
    with Session(engine) as session:
        yield session
    SQLModel.metadata.drop_all(engine)


def get_session_override() -> Generator[Session, None, None]:
    engine = create_engine(
        "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
    )
    SQLModel.metadata.create_all(engine)
    with Session(engine) as session:
        yield session
    SQLModel.metadata.drop_all(engine)


app.dependency_overrides[deps.get_session] = get_session_override


@pytest.fixture(autouse=True)
def mock_redis():
    """Mock Redis functions for all tests"""
    with patch('app.core.redis.redis_client') as mock_client, \
         patch('app.core.redis.is_token_blacklisted', return_value=False), \
         patch('app.core.redis.add_token_to_blacklist', return_value=None):
        mock_client.exists.return_value = 0
        mock_client.setex.return_value = True
        yield



@pytest.fixture(name="client")
def client_fixture(session: Session) -> Generator[TestClient, None, None]:
    def get_session_override() -> Generator[Session, None, None]:
        yield session

    app.dependency_overrides[deps.get_session] = get_session_override
    with TestClient(app) as client:
        yield client
    app.dependency_overrides.clear()
