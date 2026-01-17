from fastapi.testclient import TestClient
from sqlmodel import Session
from app.core.config import settings
from app.models.user import UserRole
from app.tests.utils.user import user_authentication_headers
from app.models.source import RequestSource
from app.tests.utils.provider import create_random_provider_request

def test_list_provider_requests(client: TestClient, session: Session) -> None:
    create_random_provider_request(session)
    user, headers = user_authentication_headers(client, session, role=UserRole.SUPER_USER, source=RequestSource.ADMIN_PANEL)
    response = client.get(f"{settings.API_V1_STR}/admin/provider-requests", headers=headers)
    assert response.status_code == 200
    requests = response.json()
    assert len(requests) > 0

def test_approve_provider_request(client: TestClient, session: Session) -> None:
    provider_request = create_random_provider_request(session)
    user, headers = user_authentication_headers(client, session, role=UserRole.SUPER_USER, source=RequestSource.ADMIN_PANEL)
    response = client.put(
        f"{settings.API_V1_STR}/admin/provider-requests/{provider_request.id}/approve",
        headers=headers,
    )
    assert response.status_code == 200
    updated_request = response.json()
    assert updated_request["status"] == "approved"

def test_deny_provider_request(client: TestClient, session: Session) -> None:
    provider_request = create_random_provider_request(session)
    user, headers = user_authentication_headers(client, session, role=UserRole.SUPER_USER, source=RequestSource.ADMIN_PANEL)
    data = {"denial_reason": "Test reason"}
    response = client.put(
        f"{settings.API_V1_STR}/admin/provider-requests/{provider_request.id}/deny",
        headers=headers,
        json=data,
    )
    assert response.status_code == 200
    updated_request = response.json()
    assert updated_request["status"] == "denied"
    assert updated_request["denial_reason"] == "Test reason"

def test_list_providers(client: TestClient, session: Session) -> None:
    create_random_provider_request(session)
    user, headers = user_authentication_headers(client, session, role=UserRole.SUPER_USER, source=RequestSource.ADMIN_PANEL)
    response = client.get(f"{settings.API_V1_STR}/admin/providers", headers=headers)
    assert response.status_code == 200

def test_list_users(client: TestClient, session: Session) -> None:
    user, headers = user_authentication_headers(client, session, role=UserRole.SUPER_USER, source=RequestSource.ADMIN_PANEL)
    response = client.get(f"{settings.API_V1_STR}/admin/users", headers=headers)
    assert response.status_code == 200

def test_list_all_trips(client: TestClient, session: Session) -> None:
    user, headers = user_authentication_headers(client, session, role=UserRole.SUPER_USER, source=RequestSource.ADMIN_PANEL)
    response = client.get(f"{settings.API_V1_STR}/admin/trips", headers=headers)
    assert response.status_code == 200

def test_get_available_fields_admin(client: TestClient, session: Session) -> None:
    user, headers = user_authentication_headers(client, session, role=UserRole.SUPER_USER, source=RequestSource.ADMIN_PANEL)
    response = client.get(f"{settings.API_V1_STR}/admin/available-fields", headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert "fields" in data
    assert len(data["fields"]) > 0
    # Verify field structure
    field = data["fields"][0]
    assert "field_name" in field
    assert "display_name" in field
    assert "ui_type" in field
    assert "available_validations" in field
