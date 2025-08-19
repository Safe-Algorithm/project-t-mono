from fastapi.testclient import TestClient
from sqlmodel import Session
from app.core.config import settings
from app.tests.utils.user import create_random_user


def test_create_user(client: TestClient, session: Session) -> None:
    data = {"email": "test@example.com", "password": "password", "name": "Test User", "phone": "1234567890"}
    response = client.post(
        f"{settings.API_V1_STR}/users/",
        json=data,
    )
    assert response.status_code == 200
    created_user = response.json()
    assert created_user["email"] == data["email"]
    assert "id" in created_user

def test_get_current_user(client: TestClient, session: Session) -> None:
    user = create_random_user(session)
    login_data = {"username": user.email, "password": "password123"}
    r = client.post(f"{settings.API_V1_STR}/login/access-token", data=login_data)
    token = r.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    response = client.get(f"{settings.API_V1_STR}/users/me", headers=headers)
    assert response.status_code == 200
    current_user = response.json()
    assert current_user["email"] == user.email
