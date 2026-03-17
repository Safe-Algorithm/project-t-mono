"""
Tests for admin invitation email flows
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


def test_invite_admin_sends_email(client: TestClient, session: Session) -> None:
    """Test inviting admin sends invitation email"""
    # Create super admin user
    user, headers = user_authentication_headers(client, session, role=UserRole.SUPER_USER, source=RequestSource.ADMIN_PANEL)
    
    with patch('app.api.routes.admin.email_service.send_team_invitation_email') as mock_send:
        response = client.post(
            f"{settings.API_V1_STR}/admin/invite-admin",
            headers=headers,
            json={
                "email": "newadmin@example.com",
                "name": "New Admin",
                "phone": "+966501234567",
                "password": "TestPass1!"
            }
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["email"] == "newadmin@example.com"
        assert data["is_active"] is False  # Should be inactive until invitation accepted
        assert data["role"] == "normal"  # Should be normal user
        
        # Verify email was sent
        mock_send.assert_called_once()


def test_invite_existing_admin_fails(client: TestClient, session: Session) -> None:
    """Test inviting admin that already exists"""
    user, headers = user_authentication_headers(client, session, role=UserRole.SUPER_USER, source=RequestSource.ADMIN_PANEL)
    
    # Try to invite admin with same email
    response = client.post(
        f"{settings.API_V1_STR}/admin/invite-admin",
        headers=headers,
        json={
            "email": user.email,
            "name": "Duplicate Admin",
            "phone": "+966501234568",
            "password": "TestPass1!"
        }
    )
    
    assert response.status_code == 400
    assert "already exists" in response.json()["detail"]


def test_accept_admin_invitation_success(client: TestClient, session: Session) -> None:
    """Test accepting admin invitation"""
    # Create inactive admin user (invited)
    from app.core.security import get_password_hash
    
    admin_user = User(
        email="invitedadmin@example.com",
        name="Invited Admin",
        phone="+966501234567",
        hashed_password=get_password_hash("TestPass1!"),
        role=UserRole.NORMAL,
        source=RequestSource.ADMIN_PANEL,
        is_active=False
    )
    session.add(admin_user)
    session.commit()
    session.refresh(admin_user)
    
    # Mock Redis to return invitation data
    import json
    invitation_data = {
        "email": admin_user.email,
        "name": admin_user.name,
        "phone": admin_user.phone,
        "password": "TestPass1!",
        "role": "normal",
        "inviter_name": "Super Admin",
        "source": RequestSource.ADMIN_PANEL.value
    }
    
    with patch('app.api.routes.admin.redis_client') as mock_redis:
        mock_redis.get.return_value = json.dumps(invitation_data).encode()
        
        response = client.post(
            f"{settings.API_V1_STR}/admin/accept-admin-invitation",
            params={"token": "admin_invitation_token_123"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["email"] == admin_user.email
        
        # Verify user is now active
        session.refresh(admin_user)
        assert admin_user.is_active is True


def test_accept_admin_invitation_invalid_token(client: TestClient, session: Session) -> None:
    """Test accepting admin invitation with invalid token"""
    with patch('app.api.routes.admin.redis_client') as mock_redis:
        mock_redis.get.return_value = None
        
        response = client.post(
            f"{settings.API_V1_STR}/admin/accept-admin-invitation",
            params={"token": "invalid_token"}
        )
        
        assert response.status_code == 400
        assert "Invalid or expired" in response.json()["detail"]


def test_only_super_admin_can_invite(client: TestClient, session: Session) -> None:
    """Test that only super admin users can invite other admins"""
    # Create normal user (not super admin)
    user, headers = user_authentication_headers(client, session, role=UserRole.NORMAL, source=RequestSource.ADMIN_PANEL)
    
    response = client.post(
        f"{settings.API_V1_STR}/admin/invite-admin",
        headers=headers,
        json={
            "email": "newadmin@example.com",
            "name": "New Admin",
            "phone": "+966501234567",
            "password": "TestPass1!"
        }
    )
    
    # Should fail with 403 Forbidden
    assert response.status_code == 403


def test_admin_invitation_creates_correct_user_type(client: TestClient, session: Session) -> None:
    """Test that admin invitation creates user with correct source and role"""
    user, headers = user_authentication_headers(client, session, role=UserRole.SUPER_USER, source=RequestSource.ADMIN_PANEL)
    
    with patch('app.api.routes.admin.email_service.send_team_invitation_email'):
        response = client.post(
            f"{settings.API_V1_STR}/admin/invite-admin",
            headers=headers,
            json={
                "email": "testadmin@example.com",
                "name": "Test Admin",
                "phone": "+966501234569",
                "password": "TestPass1!"
            }
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify user was created with correct attributes
        created_user = crud.user.get_user_by_email_and_source(
            session, 
            email="testadmin@example.com", 
            source=RequestSource.ADMIN_PANEL
        )
        assert created_user is not None
        assert created_user.role == UserRole.NORMAL
        assert created_user.source == RequestSource.ADMIN_PANEL
        assert created_user.is_active is False
        assert created_user.provider_id is None


def test_invite_admin_duplicate_phone_fails(client: TestClient, session: Session) -> None:
    """Test inviting admin with duplicate phone number"""
    user, headers = user_authentication_headers(client, session, role=UserRole.SUPER_USER, source=RequestSource.ADMIN_PANEL)
    
    # Try to invite admin with same phone number
    response = client.post(
        f"{settings.API_V1_STR}/admin/invite-admin",
        headers=headers,
        json={
            "email": "differentemail@example.com",
            "name": "Different Admin",
            "phone": user.phone,  # Same phone as existing user
            "password": "TestPass1!"
        }
    )
    
    assert response.status_code == 400
    assert "phone number already exists" in response.json()["detail"]


def test_provider_invitation_creates_correct_user_type(client: TestClient, session: Session) -> None:
    """Test that provider invitation creates user with correct source and role"""
    user, headers = user_authentication_headers(client, session, role=UserRole.SUPER_USER, source=RequestSource.PROVIDERS_PANEL)
    
    with patch('app.api.routes.team.email_service.send_team_invitation_email'):
        response = client.post(
            f"{settings.API_V1_STR}/team/invite",
            headers=headers,
            json={
                "email": "testprovider@example.com",
                "name": "Test Provider",
                "phone": "+966501234570",
                "password": "TestPass1!"
            }
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify user was created with correct attributes
        created_user = crud.user.get_user_by_email(session, email="testprovider@example.com")
        assert created_user is not None
        assert created_user.role == UserRole.NORMAL
        assert created_user.source == RequestSource.PROVIDERS_PANEL
        assert created_user.is_active is False
        assert created_user.provider_id == user.provider_id
