from fastapi.testclient import TestClient
from sqlmodel import Session
from app.core.config import settings
from app.models.user import UserRole
from app.tests.utils.user import random_email, random_lower_string
from app.tests.utils.user import user_authentication_headers

def test_register_provider(client: TestClient, session: Session) -> None:
    user_data = {
        "name": "Test User",
        "email": random_email(),
        "phone": "1234567890",
        "password": "password",
    }
    provider_data = {
        "company_name": "Test Company",
        "company_email": random_email(),
        "company_phone": "0987654321",
    }
    data = {"user": user_data, "provider": provider_data}
    headers = {"X-Source": "providers_panel"}
    response = client.post(
        f"{settings.API_V1_STR}/providers/register",
        json=data,
        headers=headers,
    )
    assert response.status_code == 200
    created_request = response.json()
    assert created_request["user"]["email"] == user_data["email"]
    assert "id" in created_request
    assert created_request["status"] == "pending"

def test_get_provider_profile(client: TestClient, session: Session) -> None:
    user, headers = user_authentication_headers(client, session, role=UserRole.SUPER_USER)
    response = client.get(f"{settings.API_V1_STR}/providers/profile", headers=headers)
    assert response.status_code == 200
    profile = response.json()
    assert profile["id"] == str(user.provider_id)

def test_update_provider_profile(client: TestClient, session: Session) -> None:
    user, headers = user_authentication_headers(client, session, role=UserRole.SUPER_USER)
    new_name = "New Company Name"
    data = {"company_name": new_name}
    response = client.put(
        f"{settings.API_V1_STR}/providers/profile",
        headers=headers,
        json=data,
    )
    assert response.status_code == 200
    updated_profile = response.json()
    assert updated_profile["company_name"] == new_name
