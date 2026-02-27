from fastapi.testclient import TestClient
from sqlmodel import Session
from unittest.mock import patch

from app.models.user import User, UserRole
from app.models.provider import Provider
from app.models.source import RequestSource
from app.tests.utils.user import create_random_user, user_authentication_headers
from app.tests.utils.provider import create_random_provider
from app.core.config import settings

API = settings.API_V1_STR


@patch('app.services.email.email_service.send_team_invitation_email')
def test_invite_team_member(mock_email, client: TestClient, session: Session) -> None:
    super_provider_user, super_provider_headers = user_authentication_headers(
        client=client, session=session, role=UserRole.SUPER_USER
    )
    data = {"email": "test.new.member@example.com", "name": "Test New Member", "phone": "1234567890", "password": "password123"}
    response = client.post(f"{API}/team/invite", headers=super_provider_headers, json=data)
    assert response.status_code == 200
    content = response.json()
    assert content["email"] == data["email"]
    assert content["name"] == data["name"]
    assert "id" in content


def test_list_team_members_super_user(client: TestClient, session: Session) -> None:
    super_provider_user, super_provider_headers = user_authentication_headers(
        client=client, session=session, role=UserRole.SUPER_USER
    )
    response = client.get(f"{API}/team/", headers=super_provider_headers)
    assert response.status_code == 200
    content = response.json()
    assert isinstance(content, list)
    assert len(content) > 0


def test_list_team_members_normal_user(client: TestClient, session: Session) -> None:
    """Normal (non-SUPER_USER) providers can also list team members."""
    super_user, _ = user_authentication_headers(client=client, session=session, role=UserRole.SUPER_USER)
    normal_user = create_random_user(
        session=session,
        source=RequestSource.PROVIDERS_PANEL,
        role=UserRole.NORMAL,
        provider_id=super_user.provider_id,
    )
    login = client.post(
        f"{API}/login/access-token",
        data={"username": normal_user.email, "password": "password123"},
        headers={"X-Source": "providers_panel"},
    )
    normal_headers = {"Authorization": f"Bearer {login.json()['access_token']}"}

    response = client.get(f"{API}/team/", headers=normal_headers)
    assert response.status_code == 200
    assert isinstance(response.json(), list)


def test_delete_team_member(client: TestClient, session: Session) -> None:
    super_provider_user, super_provider_headers = user_authentication_headers(
        client=client, session=session, role=UserRole.SUPER_USER
    )
    user_to_delete = create_random_user(
        session=session,
        source=RequestSource.PROVIDERS_PANEL,
        provider_id=super_provider_user.provider_id,
    )
    response = client.delete(f"{API}/team/{user_to_delete.id}", headers=super_provider_headers)
    assert response.status_code == 204


def test_cannot_delete_super_user(client: TestClient, session: Session) -> None:
    """A SUPER_USER cannot be deleted by anyone."""
    super_user, super_headers = user_authentication_headers(
        client=client, session=session, role=UserRole.SUPER_USER
    )
    another_super = create_random_user(
        session=session,
        source=RequestSource.PROVIDERS_PANEL,
        role=UserRole.SUPER_USER,
        provider_id=super_user.provider_id,
    )
    response = client.delete(f"{API}/team/{another_super.id}", headers=super_headers)
    assert response.status_code == 403
    assert "workspace owner" in response.json()["detail"].lower()


def test_cannot_delete_yourself(client: TestClient, session: Session) -> None:
    super_user, super_headers = user_authentication_headers(
        client=client, session=session, role=UserRole.SUPER_USER
    )
    response = client.delete(f"{API}/team/{super_user.id}", headers=super_headers)
    assert response.status_code == 400
    assert "yourself" in response.json()["detail"].lower()


def test_update_team_member_role(client: TestClient, session: Session) -> None:
    super_user, super_headers = user_authentication_headers(
        client=client, session=session, role=UserRole.SUPER_USER
    )
    normal_user = create_random_user(
        session=session,
        source=RequestSource.PROVIDERS_PANEL,
        role=UserRole.NORMAL,
        provider_id=super_user.provider_id,
    )
    response = client.put(
        f"{API}/team/{normal_user.id}/role",
        headers=super_headers,
        json={"role": "normal"},
    )
    assert response.status_code == 200


def test_cannot_promote_to_super_user(client: TestClient, session: Session) -> None:
    """No one can promote a normal user to SUPER_USER via the role endpoint."""
    super_user, super_headers = user_authentication_headers(
        client=client, session=session, role=UserRole.SUPER_USER
    )
    normal_user = create_random_user(
        session=session,
        source=RequestSource.PROVIDERS_PANEL,
        role=UserRole.NORMAL,
        provider_id=super_user.provider_id,
    )
    response = client.put(
        f"{API}/team/{normal_user.id}/role",
        headers=super_headers,
        json={"role": "super_user"},
    )
    assert response.status_code == 403
    assert "promote" in response.json()["detail"].lower()


def test_cannot_demote_super_user(client: TestClient, session: Session) -> None:
    """A SUPER_USER's system role cannot be changed to normal."""
    super_user, super_headers = user_authentication_headers(
        client=client, session=session, role=UserRole.SUPER_USER
    )
    another_super = create_random_user(
        session=session,
        source=RequestSource.PROVIDERS_PANEL,
        role=UserRole.SUPER_USER,
        provider_id=super_user.provider_id,
    )
    response = client.put(
        f"{API}/team/{another_super.id}/role",
        headers=super_headers,
        json={"role": "normal"},
    )
    assert response.status_code == 403
    assert "demote" in response.json()["detail"].lower()


def test_cannot_change_own_role(client: TestClient, session: Session) -> None:
    super_user, super_headers = user_authentication_headers(
        client=client, session=session, role=UserRole.SUPER_USER
    )
    response = client.put(
        f"{API}/team/{super_user.id}/role",
        headers=super_headers,
        json={"role": "normal"},
    )
    assert response.status_code == 400
    assert "own role" in response.json()["detail"].lower()
