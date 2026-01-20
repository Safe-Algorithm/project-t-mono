"""
Fixtures for route tests
"""

import pytest
from typing import Dict
from fastapi.testclient import TestClient
from sqlmodel import Session

from app.models.user import User, UserRole
from app.models.source import RequestSource
from app.tests.utils.user import user_authentication_headers as create_auth_headers


@pytest.fixture
def normal_user(client: TestClient, session: Session) -> User:
    """Create a normal user for mobile app"""
    user, _ = create_auth_headers(client, session, UserRole.NORMAL, RequestSource.MOBILE_APP)
    return user


@pytest.fixture
def user_authentication_headers(client: TestClient, session: Session) -> Dict[str, str]:
    """Create authentication headers for a normal mobile app user"""
    _, headers = create_auth_headers(client, session, UserRole.NORMAL, RequestSource.MOBILE_APP)
    return headers


@pytest.fixture
def super_user_authentication_headers(client: TestClient, session: Session) -> Dict[str, str]:
    """Create authentication headers for a super user"""
    _, headers = create_auth_headers(client, session, UserRole.SUPER_USER, RequestSource.ADMIN_PANEL)
    return headers


@pytest.fixture
def provider_authentication_headers(client: TestClient, session: Session) -> Dict[str, str]:
    """Create authentication headers for a provider user"""
    _, headers = create_auth_headers(client, session, UserRole.NORMAL, RequestSource.PROVIDERS_PANEL)
    return headers
