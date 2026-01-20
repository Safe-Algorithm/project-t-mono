from fastapi.testclient import TestClient
from sqlmodel import Session
from app.core.config import settings
from app.tests.utils.user import create_random_user
from app.models.source import RequestSource
from unittest.mock import patch


def test_login(client: TestClient, session: Session) -> None:
    user = create_random_user(session)
    response = client.post(
        f"{settings.API_V1_STR}/login/access-token",
        data={"username": user.email, "password": "password123"},
        headers={"X-Source": "mobile_app"}
    )
    assert response.status_code == 200
    token = response.json()
    assert "access_token" in token
    assert "refresh_token" in token
    assert token["access_token"]
    assert token["refresh_token"]


def test_login_with_admin_source(client: TestClient, session: Session) -> None:
    user = create_random_user(session, source=RequestSource.ADMIN_PANEL)
    response = client.post(
        f"{settings.API_V1_STR}/login/access-token",
        data={"username": user.email, "password": "password123"},
        headers={"X-Source": "admin_panel"}
    )
    assert response.status_code == 200
    token = response.json()
    assert "access_token" in token
    assert "refresh_token" in token
    assert token["access_token"]
    assert token["refresh_token"]


def test_register(client: TestClient, session: Session) -> None:
    # For admin/provider users (provide both email and phone)
    user_data = {
        "email": "test@example.com",
        "password": "password123",
        "name": "Test User",
        "phone": "1234567890"
    }
    response = client.post(
        f"{settings.API_V1_STR}/register",
        json=user_data,
        headers={"X-Source": "admin_panel"}
    )
    assert response.status_code == 200
    user = response.json()
    assert user["email"] == user_data["email"]
    assert user["name"] == user_data["name"]


def test_register_duplicate_email_same_source(client: TestClient, session: Session) -> None:
    user = create_random_user(session, source=RequestSource.ADMIN_PANEL)
    user_data = {
        "email": user.email,
        "password": "password123",
        "name": "Test User",
        "phone": "9876543210"
    }
    response = client.post(
        f"{settings.API_V1_STR}/register",
        json=user_data,
        headers={"X-Source": "admin_panel"}
    )
    assert response.status_code == 400
    assert "already exists for this source" in response.json()["detail"]


def test_register_same_email_different_source(client: TestClient, session: Session) -> None:
    user = create_random_user(session, source=RequestSource.MOBILE_APP)
    user_data = {
        "email": user.email,
        "password": "password123",
        "name": "Test User",
        "phone": "9876543210"
    }
    response = client.post(
        f"{settings.API_V1_STR}/register",
        json=user_data,
        headers={"X-Source": "admin_panel"}
    )
    assert response.status_code == 200
    new_user = response.json()
    assert new_user["email"] == user_data["email"]
    assert new_user["phone"] == user_data["phone"]



def test_change_password(client: TestClient, session: Session) -> None:
    user = create_random_user(session)
    # Login first
    login_response = client.post(
        f"{settings.API_V1_STR}/login/access-token",
        data={"username": user.email, "password": "password123"},
        headers={"X-Source": "mobile_app"}
    )
    token = login_response.json()["access_token"]
    
    # Test change password
    response = client.post(
        f"{settings.API_V1_STR}/change-password?current_password=password123&new_password=newpassword123",
        headers={"Authorization": f"Bearer {token}", "X-Source": "mobile_app"}
    )
    assert response.status_code == 200
    assert response.json()["msg"] == "Password updated successfully"


@patch('app.api.routes.auth.redis_client')
def test_reset_password(mock_redis, client: TestClient, session: Session) -> None:
    # Create user with email (admin source ensures email exists)
    user = create_random_user(session, source=RequestSource.ADMIN_PANEL)
    
    # Mock Redis to return user_id and source
    mock_redis.get.return_value = f"{user.id}:{RequestSource.ADMIN_PANEL.value}".encode()
    
    # Test reset password
    response = client.post(
        f"{settings.API_V1_STR}/reset-password?token=fake_reset_token&new_password=newpassword123",
        headers={"X-Source": "admin_panel"}
    )
    assert response.status_code == 200
    assert response.json()["msg"] == "Password updated successfully"


def test_forgot_password(client: TestClient, session: Session) -> None:
    # Create user with email (admin source ensures email exists)
    user = create_random_user(session, source=RequestSource.ADMIN_PANEL)
    
    response = client.post(
        f"{settings.API_V1_STR}/forgot-password?email={user.email}",
        headers={"X-Source": "admin_panel"}
    )
    assert response.status_code == 200
    assert "password reset link has been sent" in response.json()["msg"]


def test_forgot_password_user_not_found(client: TestClient, session: Session) -> None:
    response = client.post(
        f"{settings.API_V1_STR}/forgot-password?email=nonexistent@example.com",
        headers={"X-Source": "admin_panel"}
    )
    assert response.status_code == 200  # Returns 200 for security (don't reveal if user exists)
    assert "password reset link has been sent" in response.json()["msg"]


def test_refresh_token(client: TestClient, session: Session) -> None:
    user = create_random_user(session)
    # Login first to get refresh token cookie
    login_response = client.post(
        f"{settings.API_V1_STR}/login/access-token",
        data={"username": user.email, "password": "password123"},
        headers={"X-Source": "mobile_app"}
    )
    assert login_response.status_code == 200
    tokens = login_response.json()
    
    # Check that refresh token cookie was set
    cookies = login_response.cookies
    assert "refresh_token_mobile_app" in cookies
    
    # Add a small delay to ensure different timestamps
    import time
    time.sleep(1)
    
    # Create a new client with the cookies to simulate persistent session
    from fastapi.testclient import TestClient
    from app.main import app
    
    client_with_cookies = TestClient(app, cookies=dict(cookies))
    
    # Use refresh token cookie to get new access token
    response = client_with_cookies.post(
        f"{settings.API_V1_STR}/refresh",
        headers={"X-Source": "mobile_app"}
    )
    assert response.status_code == 200
    new_tokens = response.json()
    assert "access_token" in new_tokens
    assert "refresh_token" in new_tokens
    assert new_tokens["access_token"]
    assert new_tokens["refresh_token"]
    # New tokens should be different from original due to different timestamps
    assert new_tokens["access_token"] != tokens["access_token"]


def test_refresh_token_invalid(client: TestClient, session: Session) -> None:
    response = client.post(
        f"{settings.API_V1_STR}/refresh",
        headers={"X-Source": "mobile_app"}
    )
    assert response.status_code == 401
    assert "Refresh token not found" in response.json()["detail"]


def test_refresh_token_expired(client: TestClient, session: Session) -> None:
    # Create an expired refresh token
    from datetime import datetime, timedelta, timezone
    import jwt
    from app.core.config import settings
    
    user = create_random_user(session)
    # Create token that expired 1 day ago
    expired_token_data = {
        "sub": user.email,
        "exp": datetime.now(timezone.utc) - timedelta(days=1),
        "type": "refresh"
    }
    expired_token = jwt.encode(expired_token_data, settings.SECRET_KEY, algorithm="HS256")
    
    # Set expired token as cookie
    response = client.post(
        f"{settings.API_V1_STR}/refresh",
        headers={"X-Source": "mobile_app"},
        cookies={"refresh_token_mobile_app": expired_token}
    )
    assert response.status_code == 401
    assert "Invalid refresh token" in response.json()["detail"]


def test_logout(client: TestClient, session: Session) -> None:
    user = create_random_user(session)
    # Login first to get refresh token cookie
    login_response = client.post(
        f"{settings.API_V1_STR}/login/access-token",
        data={"username": user.email, "password": "password123"},
        headers={"X-Source": "mobile_app"}
    )
    assert login_response.status_code == 200
    
    # Check that refresh token cookie was set
    cookies = login_response.cookies
    assert "refresh_token_mobile_app" in cookies
    
    # Logout to clear cookie
    logout_response = client.post(
        f"{settings.API_V1_STR}/logout",
        headers={"X-Source": "mobile_app"}
    )
    assert logout_response.status_code == 200
    assert logout_response.json()["msg"] == "Successfully logged out"
