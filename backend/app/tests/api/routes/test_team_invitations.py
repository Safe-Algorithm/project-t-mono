"""
Tests for team invitation email flows
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


def test_invite_team_member_sends_email(client: TestClient, session: Session) -> None:
    """Test inviting team member sends invitation email"""
    user, headers = user_authentication_headers(client, session, role=UserRole.SUPER_USER)
    
    with patch('app.api.routes.team.email_service.send_team_invitation_email') as mock_send:
        response = client.post(
            f"{settings.API_V1_STR}/team/invite",
            headers=headers,
            json={
                "email": "newmember@example.com",
                "name": "New Member",
                "phone": "+966501234567",
                "password": "password123"
            }
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["email"] == "newmember@example.com"
        assert data["is_active"] is False  # Should be inactive until invitation accepted
        
        # Verify email was sent
        mock_send.assert_called_once()


def test_invite_existing_user_fails(client: TestClient, session: Session) -> None:
    """Test inviting user that already exists in PROVIDERS_PANEL source"""
    user, headers = user_authentication_headers(client, session, role=UserRole.SUPER_USER, source=RequestSource.PROVIDERS_PANEL)
    
    # Try to invite user with same email in same source
    response = client.post(
        f"{settings.API_V1_STR}/team/invite",
        headers=headers,
        json={
            "email": user.email,
            "name": "Duplicate User",
            "phone": "+966501234568",
            "password": "password123"
        }
    )
    
    assert response.status_code == 400
    assert "already exists" in response.json()["detail"]


def test_accept_team_invitation_success(client: TestClient, session: Session) -> None:
    """Test accepting team invitation"""
    # Create inactive user (invited)
    user, headers = user_authentication_headers(client, session, role=UserRole.NORMAL)
    user.is_active = False
    session.add(user)
    session.commit()
    
    # Mock Redis to return invitation data
    import json
    invitation_data = {
        "email": user.email,
        "name": user.name,
        "phone": user.phone,
        "password": "password",
        "provider_id": str(user.provider_id),
        "inviter_name": "Admin User"
    }
    
    with patch('app.api.routes.team.redis_client') as mock_redis:
        mock_redis.get.return_value = json.dumps(invitation_data).encode()
        
        response = client.post(
            f"{settings.API_V1_STR}/team/accept-invitation",
            params={"token": "invitation_token_123"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["email"] == user.email
        
        # Verify user is now active
        session.refresh(user)
        assert user.is_active is True


def test_accept_invitation_invalid_token(client: TestClient, session: Session) -> None:
    """Test accepting invitation with invalid token"""
    with patch('app.api.routes.team.redis_client') as mock_redis:
        mock_redis.get.return_value = None
        
        response = client.post(
            f"{settings.API_V1_STR}/team/accept-invitation",
            params={"token": "invalid_token"}
        )
        
        assert response.status_code == 400
        assert "Invalid or expired" in response.json()["detail"]


def test_only_super_provider_can_invite(client: TestClient, session: Session) -> None:
    """Test that only super provider users can invite team members"""
    # Create normal user (not super provider)
    user, headers = user_authentication_headers(client, session, role=UserRole.NORMAL)
    
    response = client.post(
        f"{settings.API_V1_STR}/team/invite",
        headers=headers,
        json={
            "email": "newmember@example.com",
            "name": "New Member",
            "phone": "+966501234567",
            "password": "password123"
        }
    )
    
    # Should fail with 403 Forbidden
    assert response.status_code == 403


def test_invite_team_member_duplicate_phone_fails(client: TestClient, session: Session) -> None:
    """Test inviting team member with duplicate phone number"""
    user, headers = user_authentication_headers(client, session, role=UserRole.SUPER_USER)
    
    # Try to invite team member with same phone number
    response = client.post(
        f"{settings.API_V1_STR}/team/invite",
        headers=headers,
        json={
            "email": "differentemail@example.com",
            "name": "Different Member",
            "phone": user.phone,  # Same phone as existing user
            "password": "password123"
        }
    )
    
    assert response.status_code == 400
    assert "phone number already exists" in response.json()["detail"]


def test_invite_user_same_email_different_source_succeeds(client: TestClient, session: Session) -> None:
    """Test that same email can be used across different sources"""
    # Create an admin user with a specific email
    from app.core.security import get_password_hash
    admin_user = User(
        email="shared@example.com",
        name="Admin User",
        phone="+966501111111",
        hashed_password=get_password_hash("password123"),
        role=UserRole.SUPER_USER,
        source=RequestSource.ADMIN_PANEL,
        is_active=True
    )
    session.add(admin_user)
    session.commit()
    session.refresh(admin_user)
    
    # Now try to invite a provider user with the same email - should succeed
    provider_user, headers = user_authentication_headers(client, session, role=UserRole.SUPER_USER, source=RequestSource.PROVIDERS_PANEL)
    
    with patch('app.api.routes.team.email_service.send_team_invitation_email'):
        response = client.post(
            f"{settings.API_V1_STR}/team/invite",
            headers=headers,
            json={
                "email": "shared@example.com",  # Same email as admin user
                "name": "Provider User",
                "phone": "+966501111111",  # Same phone as admin user
                "password": "password123"
            }
        )
        
        # Should succeed because different source
        assert response.status_code == 200
        data = response.json()
        assert data["email"] == "shared@example.com"


def test_team_invitation_creates_correct_user_type(client: TestClient, session: Session) -> None:
    """Test that team invitation creates user with correct source, role, and provider_id"""
    user, headers = user_authentication_headers(client, session, role=UserRole.SUPER_USER)
    
    with patch('app.api.routes.team.email_service.send_team_invitation_email'):
        response = client.post(
            f"{settings.API_V1_STR}/team/invite",
            headers=headers,
            json={
                "email": "teammember@example.com",
                "name": "Team Member",
                "phone": "+966501234571",
                "password": "password123"
            }
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify user was created with correct attributes
        created_user = crud.user.get_user_by_email(session, email="teammember@example.com")
        assert created_user is not None
        assert created_user.role == UserRole.NORMAL
        assert created_user.source == RequestSource.PROVIDERS_PANEL
        assert created_user.is_active is False
        assert created_user.provider_id == user.provider_id
