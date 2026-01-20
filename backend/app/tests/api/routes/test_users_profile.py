"""
Unit tests for user profile update endpoints with re-verification.
"""

import json
from fastapi.testclient import TestClient
from sqlmodel import Session

from app.core.config import settings
from app.core.redis import redis_client
from app.tests.utils.user import create_random_user


def test_update_user_name(
    client: TestClient,
    session: Session,
    user_authentication_headers: dict
) -> None:
    """Test updating user name without verification."""
    response = client.patch(
        f"{settings.API_V1_STR}/users/me",
        json={"name": "Updated Name"},
        headers=user_authentication_headers
    )
    
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "Updated Name"


def test_update_user_password(
    client: TestClient,
    session: Session,
    user_authentication_headers: dict
) -> None:
    """Test updating user password."""
    response = client.patch(
        f"{settings.API_V1_STR}/users/me",
        json={"password": "newpassword123"},
        headers=user_authentication_headers
    )
    
    assert response.status_code == 200


def test_update_email_without_token(
    client: TestClient,
    session: Session,
    user_authentication_headers: dict
) -> None:
    """Test that updating email without verification token fails."""
    response = client.patch(
        f"{settings.API_V1_STR}/users/me",
        json={"email": "newemail@example.com"},
        headers=user_authentication_headers
    )
    
    assert response.status_code == 400
    assert "verification token required" in response.json()["detail"].lower()


def test_update_phone_without_token(
    client: TestClient,
    session: Session,
    user_authentication_headers: dict
) -> None:
    """Test that updating phone without verification token fails."""
    response = client.patch(
        f"{settings.API_V1_STR}/users/me",
        json={"phone": "+966501234567"},
        headers=user_authentication_headers
    )
    
    assert response.status_code == 400
    assert "verification token required" in response.json()["detail"].lower()


def test_update_email_with_valid_token(
    client: TestClient,
    session: Session,
    normal_user,
    user_authentication_headers: dict
) -> None:
    """Test updating email with valid verification token."""
    new_email = "verified@example.com"
    verification_token = "test_email_token_123"
    
    # Store verification token in Redis
    verification_key = f"email_verified:{verification_token}"
    verification_data = {
        "email": new_email,
        "verified_at": "2024-01-01T00:00:00"
    }
    redis_client.setex(verification_key, 600, json.dumps(verification_data))
    
    # Update email with token
    response = client.patch(
        f"{settings.API_V1_STR}/users/me",
        json={"email": new_email},
        params={"email_verification_token": verification_token},
        headers=user_authentication_headers
    )
    
    assert response.status_code == 200
    data = response.json()
    assert data["email"] == new_email
    assert data["is_email_verified"] is True
    
    # Verify token was deleted
    assert redis_client.get(verification_key) is None


def test_update_phone_with_valid_token(
    client: TestClient,
    session: Session,
    normal_user,
    user_authentication_headers: dict
) -> None:
    """Test updating phone with valid verification token."""
    new_phone = "+966501234567"
    verification_token = "test_phone_token_123"
    
    # Store verification token in Redis
    verification_key = f"phone_verified:{verification_token}"
    verification_data = {
        "phone": new_phone,
        "verified_at": "2024-01-01T00:00:00"
    }
    redis_client.setex(verification_key, 600, json.dumps(verification_data))
    
    # Update phone with token
    response = client.patch(
        f"{settings.API_V1_STR}/users/me",
        json={"phone": new_phone},
        params={"phone_verification_token": verification_token},
        headers=user_authentication_headers
    )
    
    assert response.status_code == 200
    data = response.json()
    assert data["phone"] == new_phone
    assert data["is_phone_verified"] is True
    
    # Verify token was deleted
    assert redis_client.get(verification_key) is None


def test_update_email_with_expired_token(
    client: TestClient,
    session: Session,
    user_authentication_headers: dict
) -> None:
    """Test that expired verification token fails."""
    response = client.patch(
        f"{settings.API_V1_STR}/users/me",
        json={"email": "newemail@example.com"},
        params={"email_verification_token": "expired_token"},
        headers=user_authentication_headers
    )
    
    assert response.status_code == 400
    assert "expired or invalid" in response.json()["detail"].lower()


def test_update_email_with_mismatched_token(
    client: TestClient,
    session: Session,
    user_authentication_headers: dict
) -> None:
    """Test that token for different email fails."""
    verification_token = "test_token_mismatch"
    
    # Store verification token for different email
    verification_key = f"email_verified:{verification_token}"
    verification_data = {
        "email": "different@example.com",
        "verified_at": "2024-01-01T00:00:00"
    }
    redis_client.setex(verification_key, 600, json.dumps(verification_data))
    
    # Try to update with different email
    response = client.patch(
        f"{settings.API_V1_STR}/users/me",
        json={"email": "newemail@example.com"},
        params={"email_verification_token": verification_token},
        headers=user_authentication_headers
    )
    
    assert response.status_code == 400
    assert "does not match" in response.json()["detail"].lower()
    
    # Cleanup
    redis_client.delete(verification_key)


def test_update_phone_with_mismatched_token(
    client: TestClient,
    session: Session,
    user_authentication_headers: dict
) -> None:
    """Test that token for different phone fails."""
    verification_token = "test_token_mismatch_phone"
    
    # Store verification token for different phone
    verification_key = f"phone_verified:{verification_token}"
    verification_data = {
        "phone": "+966501111111",
        "verified_at": "2024-01-01T00:00:00"
    }
    redis_client.setex(verification_key, 600, json.dumps(verification_data))
    
    # Try to update with different phone
    response = client.patch(
        f"{settings.API_V1_STR}/users/me",
        json={"phone": "+966502222222"},
        params={"phone_verification_token": verification_token},
        headers=user_authentication_headers
    )
    
    assert response.status_code == 400
    assert "does not match" in response.json()["detail"].lower()
    
    # Cleanup
    redis_client.delete(verification_key)


def test_update_email_already_exists(
    client: TestClient,
    session: Session,
    normal_user,
    user_authentication_headers: dict
) -> None:
    """Test that updating to existing email fails."""
    # Create another user with email
    other_user = create_random_user(session)
    
    verification_token = "test_token_exists"
    verification_key = f"email_verified:{verification_token}"
    verification_data = {
        "email": other_user.email,
        "verified_at": "2024-01-01T00:00:00"
    }
    redis_client.setex(verification_key, 600, json.dumps(verification_data))
    
    # Try to update to existing email
    response = client.patch(
        f"{settings.API_V1_STR}/users/me",
        json={"email": other_user.email},
        params={"email_verification_token": verification_token},
        headers=user_authentication_headers
    )
    
    assert response.status_code == 400
    assert "already registered" in response.json()["detail"].lower()
    
    # Cleanup
    redis_client.delete(verification_key)


def test_update_phone_already_exists(
    client: TestClient,
    session: Session,
    normal_user,
    user_authentication_headers: dict
) -> None:
    """Test that updating to existing phone fails."""
    # Create another user with phone
    other_user = create_random_user(session)
    
    verification_token = "test_token_phone_exists"
    verification_key = f"phone_verified:{verification_token}"
    verification_data = {
        "phone": other_user.phone,
        "verified_at": "2024-01-01T00:00:00"
    }
    redis_client.setex(verification_key, 600, json.dumps(verification_data))
    
    # Try to update to existing phone
    response = client.patch(
        f"{settings.API_V1_STR}/users/me",
        json={"phone": other_user.phone},
        params={"phone_verification_token": verification_token},
        headers=user_authentication_headers
    )
    
    assert response.status_code == 400
    assert "already registered" in response.json()["detail"].lower()
    
    # Cleanup
    redis_client.delete(verification_key)


def test_update_multiple_fields(
    client: TestClient,
    session: Session,
    normal_user,
    user_authentication_headers: dict
) -> None:
    """Test updating multiple fields at once."""
    new_email = "multiemail@example.com"
    new_phone = "+966509999999"
    
    # Create email verification token
    email_token = "test_multi_email"
    email_key = f"email_verified:{email_token}"
    email_data = {"email": new_email, "verified_at": "2024-01-01T00:00:00"}
    redis_client.setex(email_key, 600, json.dumps(email_data))
    
    # Create phone verification token
    phone_token = "test_multi_phone"
    phone_key = f"phone_verified:{phone_token}"
    phone_data = {"phone": new_phone, "verified_at": "2024-01-01T00:00:00"}
    redis_client.setex(phone_key, 600, json.dumps(phone_data))
    
    # Update both email and phone
    response = client.patch(
        f"{settings.API_V1_STR}/users/me",
        json={
            "name": "New Name",
            "email": new_email,
            "phone": new_phone
        },
        params={
            "email_verification_token": email_token,
            "phone_verification_token": phone_token
        },
        headers=user_authentication_headers
    )
    
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "New Name"
    assert data["email"] == new_email
    assert data["phone"] == new_phone
    assert data["is_email_verified"] is True
    assert data["is_phone_verified"] is True
    
    # Verify tokens were deleted
    assert redis_client.get(email_key) is None
    assert redis_client.get(phone_key) is None
