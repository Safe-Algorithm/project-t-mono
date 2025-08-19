import random
import string
from typing import Dict, Tuple

from fastapi.testclient import TestClient
from sqlmodel import Session

from app import crud
from app.models.user import User, UserRole
from app.schemas.user import UserCreate
from app.core.config import settings
from app.tests.utils.provider import create_random_provider

def random_lower_string() -> str:
    return "".join(random.choices(string.ascii_lowercase, k=32))

def random_email() -> str:
    return f"{random_lower_string()}@{random_lower_string()}.com"

def create_random_user(session: Session, **kwargs) -> User:
    email = kwargs.get("email", random_email())
    password = kwargs.get("password", "password123")
    name = kwargs.get("name", "Test User")
    phone = kwargs.get("phone", "1234567890")
    user_in = UserCreate(email=email, password=password, name=name, phone=phone, **kwargs)
    return crud.user.create_user(session=session, user_in=user_in)

def user_authentication_headers(
    client: TestClient, session: Session, role: UserRole
) -> Tuple[User, Dict[str, str]]:
    provider = None
    if role in [UserRole.NORMAL, UserRole.SUPER_PROVIDER]:
        provider = create_random_provider(session)

    user = create_random_user(
        session,
        role=role,
        provider_id=provider.id if provider else None,
        is_superuser=role == UserRole.ADMIN,
    )

    login_data = {"username": user.email, "password": "password123"}
    r = client.post(f"{settings.API_V1_STR}/login/access-token", data=login_data)
    response = r.json()
    auth_token = response["access_token"]
    headers = {"Authorization": f"Bearer {auth_token}"}
    return user, headers
