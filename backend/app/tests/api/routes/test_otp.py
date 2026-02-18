"""
Tests for OTP verification endpoints
"""

import json
import pytest
from unittest.mock import patch, AsyncMock
from fastapi.testclient import TestClient
from sqlmodel import Session

from app.models.source import RequestSource


def test_send_otp_authenticated(
    client: TestClient,
    user_authentication_headers: dict,
    session: Session,
    mock_redis
):
    """Test sending OTP to authenticated user"""
    phone = "+966501234567"
    
    # Clear any existing rate limit for this phone
    mock_redis.delete(f"otp_rate_limit:{phone}")
    mock_redis.delete(f"phone_otp:{phone}")
    
    with patch('app.services.sms.sms_service.send_otp', new_callable=AsyncMock) as mock_send:
        mock_send.return_value = {"message_sid": "test_sid", "status": "queued"}
        
        response = client.post(
            "/api/v1/otp/send-otp",
            json={"phone": phone},
            headers=user_authentication_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["message"] == "OTP sent successfully"
        assert data["expires_in"] == 300
        
        # Verify OTP was stored in Redis
        otp_key = f"phone_otp:{phone}"
        otp_data = mock_redis.get(otp_key)
        assert otp_data is not None


def test_send_otp_rate_limiting(
    client: TestClient,
    user_authentication_headers: dict,
    session: Session,
    mock_redis
):
    """Test OTP rate limiting (max 3 per hour)"""
    phone = "+966501234568"
    
    # Clear any existing rate limit for this phone
    mock_redis.delete(f"otp_rate_limit:{phone}")
    mock_redis.delete(f"phone_otp:{phone}")
    
    with patch('app.services.sms.sms_service.send_otp', new_callable=AsyncMock) as mock_send:
        mock_send.return_value = {"message_sid": "test_sid", "status": "queued"}
        
        # Send 3 OTPs successfully
        for i in range(3):
            response = client.post(
                "/api/v1/otp/send-otp",
                json={"phone": phone},
                headers=user_authentication_headers
            )
            assert response.status_code == 200
        
        # 4th attempt should fail
        response = client.post(
            "/api/v1/otp/send-otp",
            json={"phone": phone},
            headers=user_authentication_headers
        )
        assert response.status_code == 429
        assert "Too many OTP requests" in response.json()["detail"]


def test_send_otp_invalid_format(
    client: TestClient,
    user_authentication_headers: dict,
    session: Session
):
    """Test sending OTP with invalid phone format"""
    response = client.post(
        "/api/v1/otp/send-otp",
        json={"phone": "0501234567"},  # Missing country code
        headers=user_authentication_headers
    )
    
    assert response.status_code == 400
    assert "E.164 format" in response.json()["detail"]


def test_verify_otp_success(
    client: TestClient,
    session: Session,
    normal_user,
    mock_redis
):
    """Test successful OTP verification"""
    from app.tests.utils.user import user_authentication_headers as create_auth
    from app.models.user import UserRole
    from app.models.source import RequestSource
    
    # Create user and get auth headers
    user, headers = create_auth(client, session, UserRole.NORMAL, RequestSource.MOBILE_APP)
    
    phone = "+966501234569"
    otp = "123456"
    
    # Store OTP in Redis with the correct user_id
    otp_key = f"phone_otp:{phone}"
    otp_data = {
        "otp": otp,
        "user_id": str(user.id),
        "created_at": "2024-01-01T00:00:00"
    }
    mock_redis.setex(otp_key, 300, json.dumps(otp_data))
    
    response = client.post(
        "/api/v1/otp/verify-otp",
        json={"phone": phone, "otp": otp},
        headers=headers
    )
    
    assert response.status_code == 200
    data = response.json()
    assert data["message"] == "Phone number verified successfully"
    assert data["phone"] == phone
    assert data["is_phone_verified"] is True
    
    # Verify OTP was deleted from Redis
    assert mock_redis.get(otp_key) is None


def test_verify_otp_invalid_code(
    client: TestClient,
    user_authentication_headers: dict,
    session: Session,
    normal_user,
    mock_redis
):
    """Test OTP verification with wrong code"""
    phone = "+966501234570"
    correct_otp = "123456"
    wrong_otp = "654321"
    
    # Store OTP in Redis
    otp_key = f"phone_otp:{phone}"
    otp_data = {
        "otp": correct_otp,
        "user_id": str(normal_user.id),
        "created_at": "2024-01-01T00:00:00"
    }
    mock_redis.setex(otp_key, 300, json.dumps(otp_data))
    
    response = client.post(
        "/api/v1/otp/verify-otp",
        json={"phone": phone, "otp": wrong_otp},
        headers=user_authentication_headers
    )
    
    assert response.status_code == 400
    assert "Invalid OTP" in response.json()["detail"]


def test_verify_otp_expired(
    client: TestClient,
    user_authentication_headers: dict,
    session: Session
):
    """Test OTP verification with expired OTP"""
    phone = "+966501234571"
    otp = "123456"
    
    response = client.post(
        "/api/v1/otp/verify-otp",
        json={"phone": phone, "otp": otp},
        headers=user_authentication_headers
    )
    
    assert response.status_code == 400
    assert "expired or not found" in response.json()["detail"]


def test_send_otp_registration(
    client: TestClient,
    session: Session,
    mock_redis
):
    """Test sending OTP for registration (no auth required)"""
    phone = "+966501234572"
    
    with patch('app.services.sms.sms_service.send_otp', new_callable=AsyncMock) as mock_send:
        mock_send.return_value = {"message_sid": "test_sid", "status": "queued"}
        
        response = client.post(
            "/api/v1/otp/send-otp-registration",
            json={"phone": phone}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["message"] == "OTP sent successfully"
        assert data["expires_in"] == 300
        
        # Verify OTP was stored in Redis
        otp_key = f"phone_otp_registration:{phone}"
        otp_data = mock_redis.get(otp_key)
        assert otp_data is not None


def test_verify_otp_registration_success(
    client: TestClient,
    session: Session,
    mock_redis
):
    """Test successful OTP verification for registration"""
    phone = "+966501234573"
    otp = "123456"
    
    # Store OTP in Redis
    otp_key = f"phone_otp_registration:{phone}"
    otp_data = {
        "otp": otp,
        "created_at": "2024-01-01T00:00:00"
    }
    mock_redis.setex(otp_key, 300, json.dumps(otp_data))
    
    response = client.post(
        "/api/v1/otp/verify-otp-registration",
        json={"phone": phone, "otp": otp}
    )
    
    assert response.status_code == 200
    data = response.json()
    assert data["message"] == "Phone number verified successfully"
    assert data["phone"] == phone
    assert "verification_token" in data
    assert data["expires_in"] == 600
    
    # Verify OTP was deleted from Redis
    assert mock_redis.get(otp_key) is None
    
    # Verify verification token was created
    verification_key = f"phone_verified:{data['verification_token']}"
    verification_data = mock_redis.get(verification_key)
    assert verification_data is not None


def test_verify_otp_registration_invalid_code(
    client: TestClient,
    session: Session,
    mock_redis
):
    """Test OTP verification for registration with wrong code"""
    phone = "+966501234574"
    correct_otp = "123456"
    wrong_otp = "654321"
    
    # Store OTP in Redis
    otp_key = f"phone_otp_registration:{phone}"
    otp_data = {
        "otp": correct_otp,
        "created_at": "2024-01-01T00:00:00"
    }
    mock_redis.setex(otp_key, 300, json.dumps(otp_data))
    
    response = client.post(
        "/api/v1/otp/verify-otp-registration",
        json={"phone": phone, "otp": wrong_otp}
    )
    
    assert response.status_code == 400
    assert "Invalid OTP" in response.json()["detail"]


def test_register_with_phone_verification_token(
    client: TestClient,
    session: Session,
    mock_redis
):
    """Test registration with phone verification token"""
    phone = "+966501234575"
    verification_token = "test_verification_token"
    
    # Store verification token in Redis
    verification_key = f"phone_verified:{verification_token}"
    verification_data = {
        "phone": phone,
        "verified_at": "2024-01-01T00:00:00"
    }
    mock_redis.setex(verification_key, 600, json.dumps(verification_data))
    
    # Register with verification token (phone only for mobile users)
    response = client.post(
        "/api/v1/register",
        json={
            "name": "New User",
            "phone": phone,
            "password": "testpassword123"
        },
        params={"verification_token": verification_token},
        headers={"X-Source": "mobile_app"}
    )
    
    assert response.status_code == 200
    data = response.json()
    assert data["phone"] == phone
    assert data["is_phone_verified"] is True
    
    # Verify token was deleted
    assert mock_redis.get(verification_key) is None


def test_register_with_invalid_verification_token(
    client: TestClient,
    session: Session
):
    """Test registration with invalid verification token"""
    response = client.post(
        "/api/v1/register",
        json={
            "name": "New User 2",
            "phone": "+966501234576",
            "password": "testpassword123"
        },
        params={"verification_token": "invalid_token"},
        headers={"X-Source": "mobile_app"}
    )
    
    assert response.status_code == 400
    assert "expired or invalid" in response.json()["detail"].lower()


def test_register_with_mismatched_phone(
    client: TestClient,
    session: Session,
    mock_redis
):
    """Test registration with phone that doesn't match verification token"""
    phone1 = "+966501234577"
    phone2 = "+966501234578"
    verification_token = "test_verification_token2"
    
    # Store verification token for phone1
    verification_key = f"phone_verified:{verification_token}"
    verification_data = {
        "phone": phone1,
        "verified_at": "2024-01-01T00:00:00"
    }
    mock_redis.setex(verification_key, 600, json.dumps(verification_data))
    
    # Try to register with phone2
    response = client.post(
        "/api/v1/register",
        json={
            "name": "New User 3",
            "phone": phone2,  # Different phone
            "password": "testpassword123"
        },
        params={"verification_token": verification_token},
        headers={"X-Source": "mobile_app"}
    )
    
    assert response.status_code == 400
    assert "does not match" in response.json()["detail"].lower()
