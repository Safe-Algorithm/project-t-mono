from fastapi.testclient import TestClient
from sqlmodel import Session
from app.core.config import settings
from app.models.user import UserRole
from app.tests.utils.user import user_authentication_headers
from app.tests.utils.provider import create_random_provider_request

def test_list_provider_requests(client: TestClient, session: Session) -> None:
    create_random_provider_request(session)
    user, headers = user_authentication_headers(client, session, role=UserRole.ADMIN)
    response = client.get(f"{settings.API_V1_STR}/admin/provider-requests", headers=headers)
    assert response.status_code == 200
    requests = response.json()
    assert len(requests) > 0

def test_approve_provider_request(client: TestClient, session: Session) -> None:
    provider_request = create_random_provider_request(session)
    user, headers = user_authentication_headers(client, session, role=UserRole.ADMIN)
    data = {"status": "approved"}
    response = client.put(
        f"{settings.API_V1_STR}/admin/provider-requests/{provider_request.id}",
        headers=headers,
        json=data,
    )
    assert response.status_code == 200
    updated_request = response.json()
    assert updated_request["status"] == "approved"

def test_deny_provider_request(client: TestClient, session: Session) -> None:
    provider_request = create_random_provider_request(session)
    user, headers = user_authentication_headers(client, session, role=UserRole.ADMIN)
    data = {"status": "denied", "denial_reason": "Test reason"}
    response = client.put(
        f"{settings.API_V1_STR}/admin/provider-requests/{provider_request.id}",
        headers=headers,
        json=data,
    )
    assert response.status_code == 200
    updated_request = response.json()
    assert updated_request["status"] == "denied"
    assert updated_request["denial_reason"] == "Test reason"

def test_list_providers(client: TestClient, session: Session) -> None:
    create_random_provider_request(session)
    user, headers = user_authentication_headers(client, session, role=UserRole.ADMIN)
    response = client.get(f"{settings.API_V1_STR}/admin/providers", headers=headers)
    assert response.status_code == 200

def test_list_users(client: TestClient, session: Session) -> None:
    user, headers = user_authentication_headers(client, session, role=UserRole.ADMIN)
    response = client.get(f"{settings.API_V1_STR}/admin/users", headers=headers)
    assert response.status_code == 200

def test_list_all_trips(client: TestClient, session: Session) -> None:
    user, headers = user_authentication_headers(client, session, role=UserRole.ADMIN)
    response = client.get(f"{settings.API_V1_STR}/admin/trips", headers=headers)
    assert response.status_code == 200
