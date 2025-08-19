from fastapi.testclient import TestClient
from sqlmodel import Session
from app.core.config import settings
from app.tests.utils.user import create_random_user


def test_login(client: TestClient, session: Session) -> None:
    user = create_random_user(session)
    response = client.post(
        f"{settings.API_V1_STR}/login/access-token",
                data={"username": user.email, "password": "password123"},
    )
    assert response.status_code == 200
    token = response.json()
    assert "access_token" in token
    assert token["access_token"]
