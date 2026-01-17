from fastapi.testclient import TestClient
from sqlmodel import Session

from app.models.user import User, UserRole
from app.models.provider import Provider
from app.tests.utils.user import create_random_user, user_authentication_headers
from app.tests.utils.provider import create_random_provider
from app.core.config import settings

def test_invite_team_member(client: TestClient, session: Session) -> None:
    super_provider_user, super_provider_headers = user_authentication_headers(
        client=client, session=session, role=UserRole.SUPER_USER
    )
    data = {"email": "test.new.member@example.com", "name": "Test New Member", "phone": "1234567890", "password": "password123"}
    response = client.post(f"{settings.API_V1_STR}/team/invite", headers=super_provider_headers, json=data)
    assert response.status_code == 200
    content = response.json()
    assert content["email"] == data["email"]
    assert content["name"] == data["name"]
    assert "id" in content

def test_list_team_members(client: TestClient, session: Session) -> None:
    super_provider_user, super_provider_headers = user_authentication_headers(
        client=client, session=session, role=UserRole.SUPER_USER
    )
    response = client.get(f"{settings.API_V1_STR}/team/", headers=super_provider_headers)
    assert response.status_code == 200
    content = response.json()
    assert isinstance(content, list)
    assert len(content) > 0 # At least the super provider user should be in the list

def test_delete_team_member(client: TestClient, session: Session) -> None:
    super_provider_user, super_provider_headers = user_authentication_headers(
        client=client, session=session, role=UserRole.SUPER_USER
    )
    # Create a user to delete
    user_to_delete = create_random_user(session=session, provider_id=super_provider_user.provider_id)

    response = client.delete(f"{settings.API_V1_STR}/team/{user_to_delete.id}", headers=super_provider_headers)
    assert response.status_code == 204
