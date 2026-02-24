from fastapi.testclient import TestClient
from sqlmodel import Session
from app.core.config import settings
from app.models.user import UserRole
from app.tests.utils.user import random_email, random_lower_string
from app.tests.utils.user import user_authentication_headers
from io import BytesIO
from unittest.mock import patch, AsyncMock
import io
from PIL import Image as PILImage


def make_test_jpeg(width: int = 100, height: int = 100) -> bytes:
    """Return minimal valid JPEG bytes."""
    img = PILImage.new("RGB", (width, height), color=(80, 120, 200))
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    return buf.getvalue()

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


def test_upload_company_avatar(client: TestClient, session: Session) -> None:
    """Test uploading company avatar"""
    user, headers = user_authentication_headers(client, session, role=UserRole.SUPER_USER)
    
    # Mock the storage service
    with patch('app.services.storage.storage_service') as mock_storage:
        mock_storage.upload_file = AsyncMock(return_value={
            "downloadUrl": "https://example.com/avatar.jpg",
            "fileId": "test-avatar-id"
        })
        
        # Create a real minimal JPEG so Pillow processing succeeds
        avatar = BytesIO(make_test_jpeg())
        files = {"file": ("avatar.jpg", avatar, "image/jpeg")}
        
        response = client.post(
            f"{settings.API_V1_STR}/providers/upload-avatar",
            headers=headers,
            files=files
        )
        
        assert response.status_code == 200
        content = response.json()
        assert "avatar_url" in content
        assert content["avatar_url"] == "https://example.com/avatar.jpg"
        
        # Verify avatar was saved to database
        session.refresh(user.provider)
        assert user.provider.company_avatar_url == "https://example.com/avatar.jpg"


def test_upload_company_avatar_invalid_file_type(client: TestClient, session: Session) -> None:
    """Test uploading invalid file type as company avatar"""
    user, headers = user_authentication_headers(client, session, role=UserRole.SUPER_USER)
    
    # Create fake PDF file
    pdf_file = BytesIO(b"fake pdf content")
    files = {"file": ("document.pdf", pdf_file, "application/pdf")}
    
    response = client.post(
        f"{settings.API_V1_STR}/providers/upload-avatar",
        headers=headers,
        files=files
    )
    
    assert response.status_code == 400
    assert "Invalid file type" in response.json()["detail"]


def test_upload_company_avatar_file_too_large(client: TestClient, session: Session) -> None:
    """Test uploading avatar that exceeds size limit"""
    user, headers = user_authentication_headers(client, session, role=UserRole.SUPER_USER)
    
    # Create fake large file (11MB — exceeds the 10MB raw input limit)
    large_file = BytesIO(b"x" * (11 * 1024 * 1024))
    files = {"file": ("large_avatar.jpg", large_file, "image/jpeg")}
    
    response = client.post(
        f"{settings.API_V1_STR}/providers/upload-avatar",
        headers=headers,
        files=files
    )
    
    assert response.status_code == 400
    assert "too large" in response.json()["detail"]


def test_upload_company_avatar_replaces_old(client: TestClient, session: Session) -> None:
    """Test that uploading new avatar replaces the old one"""
    user, headers = user_authentication_headers(client, session, role=UserRole.SUPER_USER)
    
    # Set initial avatar
    user.provider.company_avatar_url = "https://example.com/old_avatar.jpg"
    session.add(user.provider)
    session.commit()
    
    # Mock the storage service
    with patch('app.services.storage.storage_service') as mock_storage:
        mock_storage.upload_file = AsyncMock(return_value={
            "downloadUrl": "https://example.com/new_avatar.jpg",
            "fileId": "test-new-avatar-id"
        })
        
        # Upload new avatar (real JPEG so Pillow processing succeeds)
        avatar = BytesIO(make_test_jpeg())
        files = {"file": ("new_avatar.jpg", avatar, "image/jpeg")}
        
        response = client.post(
            f"{settings.API_V1_STR}/providers/upload-avatar",
            headers=headers,
            files=files
        )
        
        assert response.status_code == 200
        content = response.json()
        assert content["avatar_url"] == "https://example.com/new_avatar.jpg"
        
        # Verify new avatar replaced old one in database
        session.refresh(user.provider)
        assert user.provider.company_avatar_url == "https://example.com/new_avatar.jpg"


def test_get_provider_profile_includes_avatar(client: TestClient, session: Session) -> None:
    """Test that getting provider profile includes avatar URL"""
    user, headers = user_authentication_headers(client, session, role=UserRole.SUPER_USER)
    
    # Set avatar
    user.provider.company_avatar_url = "https://example.com/avatar.jpg"
    session.add(user.provider)
    session.commit()
    
    response = client.get(f"{settings.API_V1_STR}/providers/profile", headers=headers)
    assert response.status_code == 200
    profile = response.json()
    assert "company_avatar_url" in profile
    assert profile["company_avatar_url"] == "https://example.com/avatar.jpg"
