import random
import string
from typing import Dict, Tuple

from fastapi.testclient import TestClient
from sqlmodel import Session

from app import crud
from app.models.user import User, UserRole
from app.models.source import RequestSource
from app.schemas.user import UserCreate
from app.core.config import settings
from app.tests.utils.provider import create_random_provider

def random_lower_string() -> str:
    return "".join(random.choices(string.ascii_lowercase, k=32))

def random_email() -> str:
    return f"{random_lower_string()}@{random_lower_string()}.com"

def random_phone() -> str:
    return "".join(random.choices(string.digits, k=10))

def create_random_user(session: Session, source: RequestSource = RequestSource.MOBILE_APP, **kwargs) -> User:
    email = kwargs.get("email", random_email())
    password = kwargs.get("password", "password123")
    name = kwargs.get("name", "Test User")
    phone = kwargs.get("phone", random_phone())
    user_in = UserCreate(email=email, password=password, name=name, phone=phone, **kwargs)
    return crud.user.create_user(session=session, user_in=user_in, source=source)

def user_authentication_headers(
    client: TestClient, session: Session, role: UserRole, source: RequestSource = RequestSource.PROVIDERS_PANEL
) -> Tuple[User, Dict[str, str]]:
    provider = None
    # Create provider for provider panel users
    if source == RequestSource.PROVIDERS_PANEL:
        provider = create_random_provider(session)

    # Determine source header
    if source == RequestSource.ADMIN_PANEL:
        source_header = "admin_panel"
    elif source == RequestSource.PROVIDERS_PANEL:
        source_header = "providers_panel"
    else:
        source_header = "mobile_app"

    user = create_random_user(
        session,
        source=source,
        role=role,
        provider_id=provider.id if provider else None,
        is_superuser=role == UserRole.SUPER_USER,
    )

    login_data = {"username": user.email, "password": "password123"}
    r = client.post(f"{settings.API_V1_STR}/login/access-token", data=login_data, headers={"X-Source": source_header})
    response = r.json()
    auth_token = response["access_token"]
    headers = {"Authorization": f"Bearer {auth_token}"}
    return user, headers


def create_provider_with_user(
    client: TestClient, session: Session, role: UserRole = UserRole.NORMAL
) -> Tuple[User, Dict[str, str]]:
    """Create a provider with a user and return authenticated headers."""
    return user_authentication_headers(client, session, role=role, source=RequestSource.PROVIDERS_PANEL)
