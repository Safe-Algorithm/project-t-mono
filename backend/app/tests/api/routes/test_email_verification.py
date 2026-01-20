"""
Tests for email verification and password reset flows
"""

import pytest
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient
from sqlmodel import Session

from app.core.config import settings
from app.models.user import User, UserRole
from app.models.source import RequestSource
from app.schemas.user import UserCreate
from app import crud
from app.tests.utils.user import user_authentication_headers


def test_send_verification_email(client: TestClient, session: Session) -> None:
    """Test sending verification email to authenticated user"""
    user, headers = user_authentication_headers(client, session, role=UserRole.NORMAL)
    
    # Mock email service
    with patch('app.api.routes.auth.email_service.send_verification_email') as mock_send:
        response = client.post(
            f"{settings.API_V1_STR}/send-verification-email",
            headers=headers
        )
        
        assert response.status_code == 200
        assert response.json()["msg"] == "Verification email sent"


def test_send_verification_email_already_verified(client: TestClient, session: Session) -> None:
    """Test sending verification email when already verified"""
    user, headers = user_authentication_headers(client, session, role=UserRole.NORMAL)
    
    # Mark user as verified
    user.is_email_verified = True
    session.add(user)
    session.commit()
    
    response = client.post(
        f"{settings.API_V1_STR}/send-verification-email",
        headers=headers
    )
    
    assert response.status_code == 400
    assert "already verified" in response.json()["detail"]


def test_verify_email_success(client: TestClient, session: Session) -> None:
    """Test successful email verification"""
    user, headers = user_authentication_headers(client, session, role=UserRole.NORMAL)
    
    # Mock Redis to return user ID
    with patch('app.api.routes.auth.redis_client') as mock_redis:
        mock_redis.get.return_value = str(user.id).encode()
        
        response = client.post(
            f"{settings.API_V1_STR}/verify-email",
            params={"token": "test_token_123"}
        )
        
        assert response.status_code == 200
        assert response.json()["msg"] == "Email verified successfully"
        
        # Verify user is marked as verified
        session.refresh(user)
        assert user.is_email_verified is True


def test_verify_email_invalid_token(client: TestClient, session: Session) -> None:
    """Test email verification with invalid token"""
    with patch('app.api.routes.auth.redis_client') as mock_redis:
        mock_redis.get.return_value = None
        
        response = client.post(
            f"{settings.API_V1_STR}/verify-email",
            params={"token": "invalid_token"}
        )
        
        assert response.status_code == 400
        assert "Invalid or expired" in response.json()["detail"]


def test_forgot_password_sends_email(client: TestClient, session: Session) -> None:
    """Test forgot password sends reset email"""
    user, _ = user_authentication_headers(client, session, role=UserRole.NORMAL, source=RequestSource.ADMIN_PANEL)
    
    with patch('app.api.routes.auth.email_service.send_password_reset_email') as mock_send:
        response = client.post(
            f"{settings.API_V1_STR}/forgot-password",
            params={"email": user.email},
            headers={"X-Source": "admin_panel"}
        )
        
        assert response.status_code == 200
        assert "password reset link has been sent" in response.json()["msg"]


def test_forgot_password_nonexistent_user(client: TestClient, session: Session) -> None:
    """Test forgot password with nonexistent user (should not reveal)"""
    with patch('app.api.routes.auth.email_service.send_password_reset_email') as mock_send:
        response = client.post(
            f"{settings.API_V1_STR}/forgot-password",
            params={"email": "nonexistent@example.com"},
            headers={"X-Source": "admin_panel"}
        )
        
        # Should return 200 for security (don't reveal if user exists)
        assert response.status_code == 200
        assert "password reset link has been sent" in response.json()["msg"]
        
        # Email should not be sent
        mock_send.assert_not_called()


def test_reset_password_success(client: TestClient, session: Session) -> None:
    """Test successful password reset"""
    user, _ = user_authentication_headers(client, session, role=UserRole.NORMAL, source=RequestSource.ADMIN_PANEL)
    old_password_hash = user.hashed_password
    
    # Mock Redis to return user data
    with patch('app.api.routes.auth.redis_client') as mock_redis:
        mock_redis.get.return_value = f"{user.id}:{RequestSource.ADMIN_PANEL.value}".encode()
        
        response = client.post(
            f"{settings.API_V1_STR}/reset-password",
            params={
                "token": "reset_token_123",
                "new_password": "NewPassword123!"
            },
            headers={"X-Source": "admin_panel"}
        )
        
        assert response.status_code == 200
        assert response.json()["msg"] == "Password updated successfully"
        
        # Verify password was changed
        session.refresh(user)
        assert user.hashed_password != old_password_hash


def test_reset_password_invalid_token(client: TestClient, session: Session) -> None:
    """Test password reset with invalid token"""
    with patch('app.api.routes.auth.redis_client') as mock_redis:
        mock_redis.get.return_value = None
        
        response = client.post(
            f"{settings.API_V1_STR}/reset-password",
            params={
                "token": "invalid_token",
                "new_password": "NewPassword123!"
            }
        )
        
        assert response.status_code == 400
        assert "Invalid or expired" in response.json()["detail"]


def test_change_password_success(client: TestClient, session: Session) -> None:
    """Test successful password change"""
    user, headers = user_authentication_headers(client, session, role=UserRole.NORMAL)
    old_password_hash = user.hashed_password
    
    response = client.post(
        f"{settings.API_V1_STR}/change-password",
        headers=headers,
        params={
            "current_password": "password123",  # Default password from create_random_user
            "new_password": "NewPassword123!"
        }
    )
    
    assert response.status_code == 200
    assert response.json()["msg"] == "Password updated successfully"
    
    # Verify password was changed
    session.refresh(user)
    assert user.hashed_password != old_password_hash


def test_change_password_wrong_current(client: TestClient, session: Session) -> None:
    """Test password change with wrong current password"""
    user, headers = user_authentication_headers(client, session, role=UserRole.NORMAL)
    
    response = client.post(
        f"{settings.API_V1_STR}/change-password",
        headers=headers,
        params={
            "current_password": "wrong_password",
            "new_password": "NewPassword123!"
        }
    )
    
    assert response.status_code == 400
    assert "Incorrect password" in response.json()["detail"]
