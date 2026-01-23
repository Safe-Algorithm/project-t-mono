"""
Unit tests for file definition endpoints.
"""

from fastapi.testclient import TestClient
from sqlmodel import Session
from app.core.config import settings
from app.models.user import UserRole
from app.tests.utils.user import user_authentication_headers


def test_create_file_definition(client: TestClient, session: Session) -> None:
    """Test creating a file definition as admin."""
    admin_user, admin_headers = user_authentication_headers(client, session, role=UserRole.SUPER_USER)
    
    data = {
        "key": "test_certificate",
        "name_en": "Test Certificate",
        "name_ar": "شهادة اختبار",
        "description_en": "Test description",
        "description_ar": "وصف الاختبار",
        "allowed_extensions": ["pdf", "jpg"],
        "max_size_mb": 50,
        "is_required": True,
        "is_active": True,
        "display_order": 1
    }
    
    response = client.post(
        f"{settings.API_V1_STR}/admin/settings/file-definitions",
        headers=admin_headers,
        json=data
    )
    
    assert response.status_code == 201
    content = response.json()
    assert content["key"] == data["key"]
    assert content["name_en"] == data["name_en"]
    assert content["name_ar"] == data["name_ar"]
    assert content["allowed_extensions"] == data["allowed_extensions"]
    assert content["max_size_mb"] == data["max_size_mb"]
    assert content["is_required"] == data["is_required"]
    assert content["is_active"] == data["is_active"]


def test_create_file_definition_duplicate_key(client: TestClient, session: Session) -> None:
    """Test creating a file definition with duplicate key fails."""
    admin_user, admin_headers = user_authentication_headers(client, session, role=UserRole.SUPER_USER)
    
    data = {
        "key": "duplicate_key",
        "name_en": "First",
        "name_ar": "الأول",
        "description_en": "First description",
        "description_ar": "الوصف الأول",
        "allowed_extensions": ["pdf"],
        "max_size_mb": 10,
        "is_required": True,
        "is_active": True,
        "display_order": 1
    }
    
    # Create first
    response = client.post(
        f"{settings.API_V1_STR}/admin/settings/file-definitions",
        headers=admin_headers,
        json=data
    )
    assert response.status_code == 201
    
    # Try to create duplicate
    response = client.post(
        f"{settings.API_V1_STR}/admin/settings/file-definitions",
        headers=admin_headers,
        json=data
    )
    assert response.status_code == 400
    assert "already exists" in response.json()["detail"]


def test_list_file_definitions(client: TestClient, session: Session) -> None:
    """Test listing file definitions."""
    admin_user, admin_headers = user_authentication_headers(client, session, role=UserRole.SUPER_USER)
    
    # Create a few file definitions
    for i in range(3):
        data = {
            "key": f"test_file_{i}",
            "name_en": f"Test File {i}",
            "name_ar": f"ملف اختبار {i}",
            "description_en": f"Description {i}",
            "description_ar": f"وصف {i}",
            "allowed_extensions": ["pdf"],
            "max_size_mb": 10,
            "is_required": True,
            "is_active": i % 2 == 0,  # Alternate active/inactive
            "display_order": i
        }
        client.post(
            f"{settings.API_V1_STR}/admin/settings/file-definitions",
            headers=admin_headers,
            json=data
        )
    
    # List all
    response = client.get(
        f"{settings.API_V1_STR}/admin/settings/file-definitions",
        headers=admin_headers
    )
    assert response.status_code == 200
    content = response.json()
    assert content["total"] >= 3
    assert len(content["items"]) >= 3
    
    # List active only
    response = client.get(
        f"{settings.API_V1_STR}/admin/settings/file-definitions?active_only=true",
        headers=admin_headers
    )
    assert response.status_code == 200
    content = response.json()
    for item in content["items"]:
        assert item["is_active"] is True


def test_get_file_definition(client: TestClient, session: Session) -> None:
    """Test getting a single file definition."""
    admin_user, admin_headers = user_authentication_headers(client, session, role=UserRole.SUPER_USER)
    
    # Create
    data = {
        "key": "get_test",
        "name_en": "Get Test",
        "name_ar": "اختبار الحصول",
        "description_en": "Get test description",
        "description_ar": "وصف اختبار الحصول",
        "allowed_extensions": ["pdf", "jpg"],
        "max_size_mb": 25,
        "is_required": False,
        "is_active": True,
        "display_order": 5
    }
    
    create_response = client.post(
        f"{settings.API_V1_STR}/admin/settings/file-definitions",
        headers=admin_headers,
        json=data
    )
    assert create_response.status_code == 201
    created_id = create_response.json()["id"]
    
    # Get
    response = client.get(
        f"{settings.API_V1_STR}/admin/settings/file-definitions/{created_id}",
        headers=admin_headers
    )
    assert response.status_code == 200
    content = response.json()
    assert content["id"] == created_id
    assert content["key"] == data["key"]


def test_update_file_definition(client: TestClient, session: Session) -> None:
    """Test updating a file definition."""
    admin_user, admin_headers = user_authentication_headers(client, session, role=UserRole.SUPER_USER)
    
    # Create
    data = {
        "key": "update_test",
        "name_en": "Original Name",
        "name_ar": "الاسم الأصلي",
        "description_en": "Original description",
        "description_ar": "الوصف الأصلي",
        "allowed_extensions": ["pdf"],
        "max_size_mb": 10,
        "is_required": True,
        "is_active": True,
        "display_order": 1
    }
    
    create_response = client.post(
        f"{settings.API_V1_STR}/admin/settings/file-definitions",
        headers=admin_headers,
        json=data
    )
    assert create_response.status_code == 201
    created_id = create_response.json()["id"]
    
    # Update
    update_data = {
        "name_en": "Updated Name",
        "max_size_mb": 50,
        "is_active": False
    }
    
    response = client.put(
        f"{settings.API_V1_STR}/admin/settings/file-definitions/{created_id}",
        headers=admin_headers,
        json=update_data
    )
    assert response.status_code == 200
    content = response.json()
    assert content["name_en"] == "Updated Name"
    assert content["max_size_mb"] == 50
    assert content["is_active"] is False
    assert content["name_ar"] == data["name_ar"]  # Unchanged


def test_delete_file_definition(client: TestClient, session: Session) -> None:
    """Test deleting a file definition."""
    admin_user, admin_headers = user_authentication_headers(client, session, role=UserRole.SUPER_USER)
    
    # Create
    data = {
        "key": "delete_test",
        "name_en": "Delete Test",
        "name_ar": "اختبار الحذف",
        "description_en": "Delete test description",
        "description_ar": "وصف اختبار الحذف",
        "allowed_extensions": ["pdf"],
        "max_size_mb": 10,
        "is_required": True,
        "is_active": True,
        "display_order": 1
    }
    
    create_response = client.post(
        f"{settings.API_V1_STR}/admin/settings/file-definitions",
        headers=admin_headers,
        json=data
    )
    assert create_response.status_code == 201
    created_id = create_response.json()["id"]
    
    # Delete
    response = client.delete(
        f"{settings.API_V1_STR}/admin/settings/file-definitions/{created_id}",
        headers=admin_headers
    )
    assert response.status_code == 204
    
    # Verify deleted
    response = client.get(
        f"{settings.API_V1_STR}/admin/settings/file-definitions/{created_id}",
        headers=admin_headers
    )
    assert response.status_code == 404


def test_get_provider_registration_requirements_public(client: TestClient, session: Session) -> None:
    """Test getting provider registration requirements without authentication."""
    admin_user, admin_headers = user_authentication_headers(client, session, role=UserRole.SUPER_USER)
    
    # Create active and inactive file definitions
    for i in range(3):
        data = {
            "key": f"public_test_{i}",
            "name_en": f"Public Test {i}",
            "name_ar": f"اختبار عام {i}",
            "description_en": f"Description {i}",
            "description_ar": f"وصف {i}",
            "allowed_extensions": ["pdf"],
            "max_size_mb": 10,
            "is_required": True,
            "is_active": i < 2,  # First 2 active, last inactive
            "display_order": i
        }
        client.post(
            f"{settings.API_V1_STR}/admin/settings/file-definitions",
            headers=admin_headers,
            json=data
        )
    
    # Get public requirements (no auth)
    response = client.get(
        f"{settings.API_V1_STR}/file-definitions/provider-registration"
    )
    assert response.status_code == 200
    content = response.json()
    
    # Should only return active definitions
    for item in content:
        assert item["is_active"] is True
    
    # Should have at least 2 items (the ones we created as active)
    active_count = sum(1 for item in content if item["key"].startswith("public_test_"))
    assert active_count == 2


def test_non_admin_cannot_create_file_definition(client: TestClient, session: Session) -> None:
    """Test that non-admin users cannot create file definitions."""
    normal_user, normal_headers = user_authentication_headers(client, session, role=UserRole.NORMAL)
    
    data = {
        "key": "unauthorized_test",
        "name_en": "Unauthorized",
        "name_ar": "غير مصرح",
        "description_en": "Should fail",
        "description_ar": "يجب أن يفشل",
        "allowed_extensions": ["pdf"],
        "max_size_mb": 10,
        "is_required": True,
        "is_active": True,
        "display_order": 1
    }
    
    response = client.post(
        f"{settings.API_V1_STR}/admin/settings/file-definitions",
        headers=normal_headers,
        json=data
    )
    assert response.status_code == 403
