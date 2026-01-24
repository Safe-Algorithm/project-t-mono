"""
Unit tests for user profile management endpoints.
"""

import io
from fastapi.testclient import TestClient
from sqlmodel import Session
from app.core.config import settings
from app.models.user import UserRole
from app.models.source import RequestSource
from app.tests.utils.user import user_authentication_headers
from unittest.mock import patch, AsyncMock


def test_get_current_user_profile(client: TestClient, session: Session) -> None:
    """Test getting current user profile."""
    user, headers = user_authentication_headers(
        client, session, role=UserRole.NORMAL, source=RequestSource.MOBILE_APP
    )
    
    response = client.get(
        f"{settings.API_V1_STR}/users/me",
        headers=headers
    )
    
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == str(user.id)
    assert data["name"] == user.name
    assert data["email"] == user.email
    assert "hashed_password" not in data


def test_update_user_name(client: TestClient, session: Session) -> None:
    """Test updating user name."""
    user, headers = user_authentication_headers(
        client, session, role=UserRole.NORMAL, source=RequestSource.MOBILE_APP
    )
    
    new_name = "Updated Name"
    response = client.patch(
        f"{settings.API_V1_STR}/users/me",
        headers=headers,
        json={"name": new_name}
    )
    
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == new_name


def test_update_email_requires_verification(client: TestClient, session: Session) -> None:
    """Test that updating email requires verification token."""
    user, headers = user_authentication_headers(
        client, session, role=UserRole.NORMAL, source=RequestSource.MOBILE_APP
    )
    
    response = client.patch(
        f"{settings.API_V1_STR}/users/me",
        headers=headers,
        json={"email": "newemail@example.com"}
    )
    
    assert response.status_code == 400
    assert "verification token required" in response.json()["detail"].lower()


def test_update_phone_requires_verification(client: TestClient, session: Session) -> None:
    """Test that updating phone requires verification token."""
    user, headers = user_authentication_headers(
        client, session, role=UserRole.NORMAL, source=RequestSource.MOBILE_APP
    )
    
    response = client.patch(
        f"{settings.API_V1_STR}/users/me",
        headers=headers,
        json={"phone": "+966501234567"}
    )
    
    assert response.status_code == 400
    assert "verification token required" in response.json()["detail"].lower()


def test_upload_avatar_success(client: TestClient, session: Session) -> None:
    """Test successful avatar upload."""
    user, headers = user_authentication_headers(
        client, session, role=UserRole.NORMAL, source=RequestSource.MOBILE_APP
    )
    
    with patch('app.services.storage.storage_service') as mock_storage:
        mock_storage.upload_file = AsyncMock(return_value={
            'downloadUrl': 'https://test-bucket.s3.amazonaws.com/avatars/user_123/avatar.jpg',
            'fileId': 'test-file-id'
        })
        
        # Create test image file
        image_content = b"fake image content"
        files = {
            'file': ('avatar.jpg', io.BytesIO(image_content), 'image/jpeg')
        }
        
        response = client.post(
            f"{settings.API_V1_STR}/users/me/avatar",
            headers=headers,
            files=files
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["avatar_url"] is not None
        assert "avatars" in data["avatar_url"]


def test_upload_avatar_invalid_file_type(client: TestClient, session: Session) -> None:
    """Test avatar upload with invalid file type."""
    user, headers = user_authentication_headers(
        client, session, role=UserRole.NORMAL, source=RequestSource.MOBILE_APP
    )
    
    # Create test PDF file (not allowed)
    file_content = b"fake pdf content"
    files = {
        'file': ('document.pdf', io.BytesIO(file_content), 'application/pdf')
    }
    
    response = client.post(
        f"{settings.API_V1_STR}/users/me/avatar",
        headers=headers,
        files=files
    )
    
    assert response.status_code == 400
    assert "invalid file type" in response.json()["detail"].lower()


def test_upload_avatar_file_too_large(client: TestClient, session: Session) -> None:
    """Test avatar upload with file exceeding size limit."""
    user, headers = user_authentication_headers(
        client, session, role=UserRole.NORMAL, source=RequestSource.MOBILE_APP
    )
    
    # Create file larger than 5MB
    large_content = b"x" * (6 * 1024 * 1024)  # 6MB
    files = {
        'file': ('large_avatar.jpg', io.BytesIO(large_content), 'image/jpeg')
    }
    
    response = client.post(
        f"{settings.API_V1_STR}/users/me/avatar",
        headers=headers,
        files=files
    )
    
    assert response.status_code == 400
    assert "exceeds" in response.json()["detail"].lower()


def test_upload_avatar_replaces_old_avatar(client: TestClient, session: Session) -> None:
    """Test that uploading new avatar deletes old one."""
    user, headers = user_authentication_headers(
        client, session, role=UserRole.NORMAL, source=RequestSource.MOBILE_APP
    )
    
    with patch('app.services.storage.storage_service') as mock_storage:
        # Mock both upload and delete methods
        mock_storage.upload_file = AsyncMock(return_value={
            'downloadUrl': 'https://test-bucket.s3.amazonaws.com/avatars/user_123/avatar1.jpg',
            'fileId': 'test-file-id-1'
        })
        mock_storage.delete_file = AsyncMock(return_value=True)
        
        # Upload first avatar
        files1 = {
            'file': ('avatar1.jpg', io.BytesIO(b"image1"), 'image/jpeg')
        }
        response1 = client.post(
            f"{settings.API_V1_STR}/users/me/avatar",
            headers=headers,
            files=files1
        )
        assert response1.status_code == 200
        
        # Upload second avatar - update the mock return value
        mock_storage.upload_file = AsyncMock(return_value={
            'downloadUrl': 'https://test-bucket.s3.amazonaws.com/avatars/user_123/avatar2.jpg',
            'fileId': 'test-file-id-2'
        })
        
        files2 = {
            'file': ('avatar2.jpg', io.BytesIO(b"image2"), 'image/jpeg')
        }
        response2 = client.post(
            f"{settings.API_V1_STR}/users/me/avatar",
            headers=headers,
            files=files2
        )
        
        assert response2.status_code == 200
        # Verify delete was called for old avatar
        assert mock_storage.delete_file.called


def test_profile_works_for_admin_panel_users(client: TestClient, session: Session) -> None:
    """Test profile management works for admin panel users."""
    user, headers = user_authentication_headers(
        client, session, role=UserRole.SUPER_USER, source=RequestSource.ADMIN_PANEL
    )
    
    # Get profile
    response = client.get(
        f"{settings.API_V1_STR}/users/me",
        headers=headers
    )
    assert response.status_code == 200
    
    # Update name
    response = client.patch(
        f"{settings.API_V1_STR}/users/me",
        headers=headers,
        json={"name": "Admin Updated Name"}
    )
    assert response.status_code == 200
    assert response.json()["name"] == "Admin Updated Name"


def test_profile_works_for_provider_panel_users(client: TestClient, session: Session) -> None:
    """Test profile management works for provider panel users."""
    from app.tests.utils.user import create_provider_with_user
    
    user, headers = create_provider_with_user(client, session)
    
    # Get profile
    response = client.get(
        f"{settings.API_V1_STR}/users/me",
        headers=headers
    )
    assert response.status_code == 200
    
    # Update name
    response = client.patch(
        f"{settings.API_V1_STR}/users/me",
        headers=headers,
        json={"name": "Provider Updated Name"}
    )
    assert response.status_code == 200
    assert response.json()["name"] == "Provider Updated Name"


def test_avatar_upload_works_for_all_sources(client: TestClient, session: Session) -> None:
    """Test avatar upload works for all user sources."""
    sources = [
        (RequestSource.MOBILE_APP, UserRole.NORMAL),
        (RequestSource.ADMIN_PANEL, UserRole.SUPER_USER),
    ]
    
    for source, role in sources:
        user, headers = user_authentication_headers(
            client, session, role=role, source=source
        )
        
        with patch('app.services.storage.storage_service') as mock_storage:
            mock_storage.upload_file = AsyncMock(return_value={
                'downloadUrl': f'https://test-bucket.s3.amazonaws.com/avatars/user_{user.id}/avatar.jpg',
                'fileId': 'test-file-id'
            })
            
            files = {
                'file': ('avatar.jpg', io.BytesIO(b"image"), 'image/jpeg')
            }
            
            response = client.post(
                f"{settings.API_V1_STR}/users/me/avatar",
                headers=headers,
                files=files
            )
            
            assert response.status_code == 200, f"Failed for source {source}"
            assert response.json()["avatar_url"] is not None


def test_update_password(client: TestClient, session: Session) -> None:
    """Test updating user password."""
    user, headers = user_authentication_headers(
        client, session, role=UserRole.NORMAL, source=RequestSource.MOBILE_APP
    )
    
    new_password = "NewSecurePassword123!"
    response = client.patch(
        f"{settings.API_V1_STR}/users/me",
        headers=headers,
        json={"password": new_password}
    )
    
    assert response.status_code == 200
    
    # Verify password was updated by trying to login with new password
    login_response = client.post(
        f"{settings.API_V1_STR}/login/access-token",
        headers={"X-Source": "mobile_app"},
        data={
            "username": user.email or user.phone,
            "password": new_password
        }
    )
    assert login_response.status_code == 200
