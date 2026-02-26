"""
Tests for the RBAC (Roles & Permissions) system.

Covers:
- Provider: list permissions, create/read/update/delete roles
- Provider: attach/detach permissions to/from roles
- Provider: assign/remove users from roles
- Admin: same set for admin roles
- Enforcement: SUPER_USER bypasses check, NORMAL user without role gets 403,
  NORMAL user with correct role gets through
"""
import uuid
from datetime import datetime, timedelta

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session

from app.core.config import settings
from app.core.rbac_seed import seed_permissions
from app.crud import rbac as rbac_crud
from app.models.rbac import RoleSource
from app.models.source import RequestSource
from app.models.user import UserRole
from app.tests.utils.user import user_authentication_headers

API = settings.API_V1_STR


# ── Fixtures ──────────────────────────────────────────────────────────────────

@pytest.fixture()
def seeded(session: Session):
    """Seed permissions once per test that needs them."""
    seed_permissions(session)


@pytest.fixture()
def super_provider(client: TestClient, session: Session):
    user, headers = user_authentication_headers(
        client, session, UserRole.SUPER_USER, RequestSource.PROVIDERS_PANEL
    )
    return user, headers


@pytest.fixture()
def normal_provider(client: TestClient, session: Session, super_provider):
    """A normal team member under the same provider as super_provider."""
    from app.tests.utils.user import create_random_user
    super_user, _ = super_provider
    member = create_random_user(
        session,
        source=RequestSource.PROVIDERS_PANEL,
        role=UserRole.NORMAL,
        provider_id=super_user.provider_id,
    )
    login_data = {"username": member.email, "password": "password123"}
    r = client.post(
        f"{API}/login/access-token",
        data=login_data,
        headers={"X-Source": "providers_panel"},
    )
    token = r.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    return member, headers


@pytest.fixture()
def super_admin(client: TestClient, session: Session):
    user, headers = user_authentication_headers(
        client, session, UserRole.SUPER_USER, RequestSource.ADMIN_PANEL
    )
    return user, headers


# ═══════════════════════════════════════════════════════════════════════════════
# Provider Roles
# ═══════════════════════════════════════════════════════════════════════════════

class TestProviderPermissionsCatalogue:
    def test_list_permissions_returns_seeded(
        self, client: TestClient, session: Session, seeded, super_provider
    ):
        _, headers = super_provider
        r = client.get(f"{API}/provider/roles/permissions", headers=headers)
        assert r.status_code == 200
        data = r.json()
        assert len(data) > 0
        names = [p["name"] for p in data]
        assert "Create Trips" in names
        assert "Send Trip Updates" in names

    def test_list_permissions_requires_super_provider(
        self, client: TestClient, session: Session, seeded, normal_provider
    ):
        _, headers = normal_provider
        r = client.get(f"{API}/provider/roles/permissions", headers=headers)
        assert r.status_code == 403

    def test_permission_has_rules(
        self, client: TestClient, session: Session, seeded, super_provider
    ):
        _, headers = super_provider
        r = client.get(f"{API}/provider/roles/permissions", headers=headers)
        perms = {p["name"]: p for p in r.json()}
        create_trips = perms["Create Trips"]
        assert len(create_trips["rules"]) >= 1
        methods = [rule["http_method"] for rule in create_trips["rules"]]
        assert "POST" in methods


class TestProviderRoleCRUD:
    def test_create_role(
        self, client: TestClient, session: Session, super_provider
    ):
        _, headers = super_provider
        r = client.post(
            f"{API}/provider/roles",
            json={"name": "Trip Manager", "description": "Can manage trips"},
            headers=headers,
        )
        assert r.status_code == 201
        data = r.json()
        assert data["name"] == "Trip Manager"
        assert data["source"] == "provider"
        assert data["is_system"] is False

    def test_list_roles(
        self, client: TestClient, session: Session, super_provider
    ):
        _, headers = super_provider
        client.post(f"{API}/provider/roles", json={"name": "Role A"}, headers=headers)
        client.post(f"{API}/provider/roles", json={"name": "Role B"}, headers=headers)
        r = client.get(f"{API}/provider/roles", headers=headers)
        assert r.status_code == 200
        names = [role["name"] for role in r.json()]
        assert "Role A" in names
        assert "Role B" in names

    def test_get_role(
        self, client: TestClient, session: Session, super_provider
    ):
        _, headers = super_provider
        created = client.post(
            f"{API}/provider/roles", json={"name": "Viewer"}, headers=headers
        ).json()
        r = client.get(f"{API}/provider/roles/{created['id']}", headers=headers)
        assert r.status_code == 200
        assert r.json()["name"] == "Viewer"

    def test_update_role(
        self, client: TestClient, session: Session, super_provider
    ):
        _, headers = super_provider
        role = client.post(
            f"{API}/provider/roles", json={"name": "Old Name"}, headers=headers
        ).json()
        r = client.patch(
            f"{API}/provider/roles/{role['id']}",
            json={"name": "New Name"},
            headers=headers,
        )
        assert r.status_code == 200
        assert r.json()["name"] == "New Name"

    def test_delete_role(
        self, client: TestClient, session: Session, super_provider
    ):
        _, headers = super_provider
        role = client.post(
            f"{API}/provider/roles", json={"name": "To Delete"}, headers=headers
        ).json()
        r = client.delete(f"{API}/provider/roles/{role['id']}", headers=headers)
        assert r.status_code == 204
        r2 = client.get(f"{API}/provider/roles/{role['id']}", headers=headers)
        assert r2.status_code == 404

    def test_cannot_see_other_providers_role(
        self, client: TestClient, session: Session, super_provider
    ):
        """A provider cannot access roles belonging to a different provider."""
        _, headers = super_provider
        # Create a second provider + super user
        user2, headers2 = user_authentication_headers(
            client, session, UserRole.SUPER_USER, RequestSource.PROVIDERS_PANEL
        )
        role2 = client.post(
            f"{API}/provider/roles", json={"name": "Other Role"}, headers=headers2
        ).json()
        # Try to access it with provider 1
        r = client.get(f"{API}/provider/roles/{role2['id']}", headers=headers)
        assert r.status_code == 404

    def test_only_super_provider_can_create_role(
        self, client: TestClient, session: Session, normal_provider
    ):
        _, headers = normal_provider
        r = client.post(
            f"{API}/provider/roles", json={"name": "Forbidden"}, headers=headers
        )
        assert r.status_code == 403


class TestProviderRolePermissions:
    def test_add_and_list_permissions(
        self, client: TestClient, session: Session, seeded, super_provider
    ):
        _, headers = super_provider
        # Get a real permission id
        perms = client.get(f"{API}/provider/roles/permissions", headers=headers).json()
        perm_id = perms[0]["id"]

        role = client.post(
            f"{API}/provider/roles", json={"name": "Custom Role"}, headers=headers
        ).json()

        r = client.post(
            f"{API}/provider/roles/{role['id']}/permissions",
            json={"permission_ids": [perm_id]},
            headers=headers,
        )
        assert r.status_code == 204

        role_detail = client.get(
            f"{API}/provider/roles/{role['id']}", headers=headers
        ).json()
        perm_ids = [p["id"] for p in role_detail["permissions"]]
        assert perm_id in perm_ids

    def test_remove_permission(
        self, client: TestClient, session: Session, seeded, super_provider
    ):
        _, headers = super_provider
        perms = client.get(f"{API}/provider/roles/permissions", headers=headers).json()
        perm_id = perms[0]["id"]
        role = client.post(
            f"{API}/provider/roles", json={"name": "R"}, headers=headers
        ).json()
        client.post(
            f"{API}/provider/roles/{role['id']}/permissions",
            json={"permission_ids": [perm_id]},
            headers=headers,
        )
        r = client.delete(
            f"{API}/provider/roles/{role['id']}/permissions/{perm_id}",
            headers=headers,
        )
        assert r.status_code == 204
        role_detail = client.get(
            f"{API}/provider/roles/{role['id']}", headers=headers
        ).json()
        assert perm_id not in [p["id"] for p in role_detail["permissions"]]

    def test_cannot_add_admin_permission_to_provider_role(
        self, client: TestClient, session: Session, seeded, super_provider, super_admin
    ):
        _, p_headers = super_provider
        _, a_headers = super_admin
        # Get an admin permission
        admin_perms = client.get(
            f"{API}/admin/roles/permissions", headers=a_headers
        ).json()
        admin_perm_id = admin_perms[0]["id"]

        role = client.post(
            f"{API}/provider/roles", json={"name": "Sneaky Role"}, headers=p_headers
        ).json()
        r = client.post(
            f"{API}/provider/roles/{role['id']}/permissions",
            json={"permission_ids": [admin_perm_id]},
            headers=p_headers,
        )
        assert r.status_code == 400


class TestProviderRoleUserAssignment:
    def test_assign_and_list_users(
        self, client: TestClient, session: Session, super_provider, normal_provider
    ):
        super_user, s_headers = super_provider
        normal_user, _ = normal_provider

        role = client.post(
            f"{API}/provider/roles", json={"name": "Assignable"}, headers=s_headers
        ).json()

        r = client.post(
            f"{API}/provider/roles/{role['id']}/users",
            json={"role_ids": [str(normal_user.id)]},
            headers=s_headers,
        )
        assert r.status_code == 204

        links = client.get(
            f"{API}/provider/roles/{role['id']}/users", headers=s_headers
        ).json()
        user_ids = [link["user_id"] for link in links]
        assert str(normal_user.id) in user_ids

    def test_remove_user_from_role(
        self, client: TestClient, session: Session, super_provider, normal_provider
    ):
        super_user, s_headers = super_provider
        normal_user, _ = normal_provider

        role = client.post(
            f"{API}/provider/roles", json={"name": "Temp Role"}, headers=s_headers
        ).json()
        client.post(
            f"{API}/provider/roles/{role['id']}/users",
            json={"role_ids": [str(normal_user.id)]},
            headers=s_headers,
        )
        r = client.delete(
            f"{API}/provider/roles/{role['id']}/users/{normal_user.id}",
            headers=s_headers,
        )
        assert r.status_code == 204

        links = client.get(
            f"{API}/provider/roles/{role['id']}/users", headers=s_headers
        ).json()
        assert str(normal_user.id) not in [link["user_id"] for link in links]

    def test_cannot_assign_user_from_other_provider(
        self, client: TestClient, session: Session, super_provider
    ):
        _, s_headers = super_provider
        # User from a different provider
        other_user, _ = user_authentication_headers(
            client, session, UserRole.NORMAL, RequestSource.PROVIDERS_PANEL
        )
        role = client.post(
            f"{API}/provider/roles", json={"name": "R"}, headers=s_headers
        ).json()
        r = client.post(
            f"{API}/provider/roles/{role['id']}/users",
            json={"role_ids": [str(other_user.id)]},
            headers=s_headers,
        )
        assert r.status_code == 400

    def test_get_user_roles(
        self, client: TestClient, session: Session, super_provider, normal_provider
    ):
        _, s_headers = super_provider
        normal_user, _ = normal_provider

        role = client.post(
            f"{API}/provider/roles", json={"name": "ViewerRole"}, headers=s_headers
        ).json()
        client.post(
            f"{API}/provider/roles/{role['id']}/users",
            json={"role_ids": [str(normal_user.id)]},
            headers=s_headers,
        )
        r = client.get(
            f"{API}/provider/roles/users/{normal_user.id}/roles", headers=s_headers
        )
        assert r.status_code == 200
        role_names = [r_["name"] for r_ in r.json()]
        assert "ViewerRole" in role_names


# ═══════════════════════════════════════════════════════════════════════════════
# Admin Roles
# ═══════════════════════════════════════════════════════════════════════════════

class TestAdminRoleCRUD:
    def test_create_admin_role(
        self, client: TestClient, session: Session, super_admin
    ):
        _, headers = super_admin
        r = client.post(
            f"{API}/admin/roles",
            json={"name": "Content Moderator", "description": "Manages content"},
            headers=headers,
        )
        assert r.status_code == 201
        data = r.json()
        assert data["name"] == "Content Moderator"
        assert data["source"] == "admin"
        assert data["provider_id"] is None

    def test_list_admin_roles(
        self, client: TestClient, session: Session, super_admin
    ):
        _, headers = super_admin
        client.post(f"{API}/admin/roles", json={"name": "A1"}, headers=headers)
        client.post(f"{API}/admin/roles", json={"name": "A2"}, headers=headers)
        r = client.get(f"{API}/admin/roles", headers=headers)
        assert r.status_code == 200
        names = [role["name"] for role in r.json()]
        assert "A1" in names
        assert "A2" in names

    def test_update_admin_role(
        self, client: TestClient, session: Session, super_admin
    ):
        _, headers = super_admin
        role = client.post(
            f"{API}/admin/roles", json={"name": "Old"}, headers=headers
        ).json()
        r = client.patch(
            f"{API}/admin/roles/{role['id']}",
            json={"name": "Updated"},
            headers=headers,
        )
        assert r.status_code == 200
        assert r.json()["name"] == "Updated"

    def test_delete_admin_role(
        self, client: TestClient, session: Session, super_admin
    ):
        _, headers = super_admin
        role = client.post(
            f"{API}/admin/roles", json={"name": "Deletable"}, headers=headers
        ).json()
        r = client.delete(f"{API}/admin/roles/{role['id']}", headers=headers)
        assert r.status_code == 204

    def test_provider_cannot_access_admin_roles(
        self, client: TestClient, session: Session, super_provider
    ):
        _, headers = super_provider
        r = client.get(f"{API}/admin/roles", headers=headers)
        assert r.status_code == 403

    def test_add_permissions_to_admin_role(
        self, client: TestClient, session: Session, seeded, super_admin
    ):
        _, headers = super_admin
        perms = client.get(f"{API}/admin/roles/permissions", headers=headers).json()
        perm_id = perms[0]["id"]

        role = client.post(
            f"{API}/admin/roles", json={"name": "Perm Role"}, headers=headers
        ).json()
        r = client.post(
            f"{API}/admin/roles/{role['id']}/permissions",
            json={"permission_ids": [perm_id]},
            headers=headers,
        )
        assert r.status_code == 204

        detail = client.get(f"{API}/admin/roles/{role['id']}", headers=headers).json()
        assert perm_id in [p["id"] for p in detail["permissions"]]

    def test_cannot_add_provider_permission_to_admin_role(
        self, client: TestClient, session: Session, seeded, super_provider, super_admin
    ):
        _, p_headers = super_provider
        _, a_headers = super_admin
        provider_perms = client.get(
            f"{API}/provider/roles/permissions", headers=p_headers
        ).json()
        provider_perm_id = provider_perms[0]["id"]

        role = client.post(
            f"{API}/admin/roles", json={"name": "Sneaky Admin Role"}, headers=a_headers
        ).json()
        r = client.post(
            f"{API}/admin/roles/{role['id']}/permissions",
            json={"permission_ids": [provider_perm_id]},
            headers=a_headers,
        )
        assert r.status_code == 400


# ═══════════════════════════════════════════════════════════════════════════════
# Enforcement (require_provider_permission dependency)
# ═══════════════════════════════════════════════════════════════════════════════

class TestRBACEnforcement:
    def test_super_provider_always_passes(
        self, client: TestClient, session: Session, super_provider
    ):
        """SUPER_USER providers can always list their own trips."""
        _, headers = super_provider
        r = client.get(f"{API}/trips", headers=headers)
        # 200 (possibly empty list) — not 403
        assert r.status_code == 200

    def test_normal_provider_without_role_blocked_on_create_trip(
        self, client: TestClient, session: Session, seeded, normal_provider
    ):
        """A team member with no role assigned cannot create a trip."""
        _, headers = normal_provider
        r = client.post(
            f"{API}/trips",
            json={
                "name_en": "Test", "description_en": "Desc",
                "start_date": "2027-01-01T00:00:00",
                "end_date": "2027-01-10T00:00:00",
                "max_participants": 10,
            },
            headers=headers,
        )
        assert r.status_code == 403

    def test_normal_provider_with_create_trips_role_can_create(
        self, client: TestClient, session: Session, seeded, super_provider, normal_provider
    ):
        """A team member with 'Create Trips' permission can create a trip."""
        _, s_headers = super_provider
        normal_user, n_headers = normal_provider

        # Find 'Create Trips' permission
        perms = client.get(f"{API}/provider/roles/permissions", headers=s_headers).json()
        create_perm = next(p for p in perms if p["name"] == "Create Trips")

        # Create role, attach permission, assign to normal user
        role = client.post(
            f"{API}/provider/roles",
            json={"name": "Trip Creator"},
            headers=s_headers,
        ).json()
        client.post(
            f"{API}/provider/roles/{role['id']}/permissions",
            json={"permission_ids": [create_perm["id"]]},
            headers=s_headers,
        )
        client.post(
            f"{API}/provider/roles/{role['id']}/users",
            json={"role_ids": [str(normal_user.id)]},
            headers=s_headers,
        )

        # Now normal user should be able to create a trip (may fail for other
        # business reasons like missing timezone field, but must NOT be 403)
        r = client.post(
            f"{API}/trips",
            json={
                "name_en": "Authorized Trip",
                "description_en": "Desc",
                "start_date": "2027-06-01T00:00:00",
                "end_date": "2027-06-10T00:00:00",
                "max_participants": 10,
                "timezone": "Asia/Riyadh",
            },
            headers=n_headers,
        )
        assert r.status_code != 403

    def test_normal_provider_without_send_updates_role_blocked(
        self, client: TestClient, session: Session, seeded, normal_provider, super_provider
    ):
        """A team member with only 'View Trips' cannot send trip updates."""
        _, s_headers = super_provider
        normal_user, n_headers = normal_provider

        # Give them only View Trips
        perms = client.get(f"{API}/provider/roles/permissions", headers=s_headers).json()
        view_perm = next(p for p in perms if p["name"] == "View Trips")

        role = client.post(
            f"{API}/provider/roles", json={"name": "Viewer Only"}, headers=s_headers
        ).json()
        client.post(
            f"{API}/provider/roles/{role['id']}/permissions",
            json={"permission_ids": [view_perm["id"]]},
            headers=s_headers,
        )
        client.post(
            f"{API}/provider/roles/{role['id']}/users",
            json={"role_ids": [str(normal_user.id)]},
            headers=s_headers,
        )

        # Try to send a trip update — should be 403 (no Send Trip Updates permission)
        fake_trip_id = str(uuid.uuid4())
        r = client.post(
            f"{API}/provider/trips/{fake_trip_id}/updates",
            json={"title": "Update!", "message": "Hello"},
            headers=n_headers,
        )
        assert r.status_code == 403
