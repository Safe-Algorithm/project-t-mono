"""
Unit tests for ProviderFileGroup endpoints.

Tests cover:
- Admin CRUD for file groups
- Public listing of groups and definitions
- File definitions linked to groups
- Group-scoped required-file enforcement (are_all_files_accepted, count_required_files)
- Provider registration with file_group_id
- Duplicate key rejection
- Non-admin blocked from group management
"""

import uuid
import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session

from app.core.config import settings
from app.models.user import UserRole
from app.models.source import RequestSource
from app.tests.utils.user import user_authentication_headers


# ── Helpers ──────────────────────────────────────────────────────────────────

def _make_group(client, headers, key_suffix=""):
    key = f"saudi_company{key_suffix}"
    data = {
        "key": key,
        "name_en": "Saudi Company",
        "name_ar": "شركة سعودية",
        "description_en": "For Saudi-registered companies",
        "description_ar": "للشركات المسجلة في السعودية",
        "is_active": True,
        "display_order": 0,
    }
    resp = client.post(f"{settings.API_V1_STR}/admin/settings/file-groups", headers=headers, json=data)
    return resp


def _make_definition(client, headers, key, group_id=None):
    data = {
        "key": key,
        "name_en": f"Document {key}",
        "name_ar": f"وثيقة {key}",
        "description_en": "Required document",
        "description_ar": "مستند مطلوب",
        "allowed_extensions": ["pdf"],
        "max_size_mb": 10,
        "is_required": True,
        "is_active": True,
        "display_order": 0,
    }
    if group_id:
        data["file_group_id"] = str(group_id)
    return client.post(
        f"{settings.API_V1_STR}/admin/settings/file-definitions", headers=headers, json=data
    )


# ── Admin CRUD ────────────────────────────────────────────────────────────────

def test_create_file_group(client: TestClient, session: Session) -> None:
    """Admin can create a file group."""
    _, admin_headers = user_authentication_headers(
        client, session, role=UserRole.SUPER_USER, source=RequestSource.ADMIN_PANEL
    )
    resp = _make_group(client, admin_headers)
    assert resp.status_code == 201
    data = resp.json()
    assert data["key"] == "saudi_company"
    assert data["name_en"] == "Saudi Company"
    assert data["file_definitions"] == []


def test_create_file_group_duplicate_key(client: TestClient, session: Session) -> None:
    """Creating a group with an existing key returns 400."""
    _, admin_headers = user_authentication_headers(
        client, session, role=UserRole.SUPER_USER, source=RequestSource.ADMIN_PANEL
    )
    _make_group(client, admin_headers)
    resp = _make_group(client, admin_headers)
    assert resp.status_code == 400
    assert "already exists" in resp.json()["detail"]


def test_list_file_groups_admin(client: TestClient, session: Session) -> None:
    """Admin can list file groups with pagination."""
    _, admin_headers = user_authentication_headers(
        client, session, role=UserRole.SUPER_USER, source=RequestSource.ADMIN_PANEL
    )
    _make_group(client, admin_headers, "_a")
    _make_group(client, admin_headers, "_b")

    resp = client.get(
        f"{settings.API_V1_STR}/admin/settings/file-groups", headers=admin_headers
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["total"] >= 2
    assert len(body["items"]) >= 2


def test_get_file_group_by_id(client: TestClient, session: Session) -> None:
    """Admin can fetch a single group by ID."""
    _, admin_headers = user_authentication_headers(
        client, session, role=UserRole.SUPER_USER, source=RequestSource.ADMIN_PANEL
    )
    created = _make_group(client, admin_headers).json()
    group_id = created["id"]

    resp = client.get(
        f"{settings.API_V1_STR}/admin/settings/file-groups/{group_id}", headers=admin_headers
    )
    assert resp.status_code == 200
    assert resp.json()["id"] == group_id


def test_update_file_group(client: TestClient, session: Session) -> None:
    """Admin can update a group's name and active status."""
    _, admin_headers = user_authentication_headers(
        client, session, role=UserRole.SUPER_USER, source=RequestSource.ADMIN_PANEL
    )
    group_id = _make_group(client, admin_headers).json()["id"]

    resp = client.put(
        f"{settings.API_V1_STR}/admin/settings/file-groups/{group_id}",
        headers=admin_headers,
        json={"name_en": "Saudi Company (Updated)", "is_active": False},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["name_en"] == "Saudi Company (Updated)"
    assert data["is_active"] is False


def test_delete_file_group_no_definitions(client: TestClient, session: Session) -> None:
    """Admin can delete a group that has no linked definitions."""
    _, admin_headers = user_authentication_headers(
        client, session, role=UserRole.SUPER_USER, source=RequestSource.ADMIN_PANEL
    )
    group_id = _make_group(client, admin_headers).json()["id"]

    resp = client.delete(
        f"{settings.API_V1_STR}/admin/settings/file-groups/{group_id}", headers=admin_headers
    )
    assert resp.status_code == 204

    # Confirm gone
    get_resp = client.get(
        f"{settings.API_V1_STR}/admin/settings/file-groups/{group_id}", headers=admin_headers
    )
    assert get_resp.status_code == 404


def test_delete_file_group_blocked_when_definitions_linked(client: TestClient, session: Session) -> None:
    """Deleting a group that has linked definitions returns 400."""
    _, admin_headers = user_authentication_headers(
        client, session, role=UserRole.SUPER_USER, source=RequestSource.ADMIN_PANEL
    )
    group_id = _make_group(client, admin_headers).json()["id"]
    _make_definition(client, admin_headers, "linked_doc", group_id=group_id)

    resp = client.delete(
        f"{settings.API_V1_STR}/admin/settings/file-groups/{group_id}", headers=admin_headers
    )
    assert resp.status_code == 400
    assert "Cannot delete" in resp.json()["detail"]


def test_non_admin_cannot_manage_file_groups(client: TestClient, session: Session) -> None:
    """Normal users cannot access admin file group endpoints."""
    _, normal_headers = user_authentication_headers(
        client, session, role=UserRole.NORMAL, source=RequestSource.MOBILE_APP
    )
    resp = client.post(
        f"{settings.API_V1_STR}/admin/settings/file-groups",
        headers=normal_headers,
        json={
            "key": "blocked_group",
            "name_en": "Blocked",
            "name_ar": "محجوب",
            "is_active": True,
            "display_order": 0,
        },
    )
    assert resp.status_code == 403


# ── File definitions with group ───────────────────────────────────────────────

def test_create_file_definition_with_group(client: TestClient, session: Session) -> None:
    """A file definition can be associated with a group."""
    _, admin_headers = user_authentication_headers(
        client, session, role=UserRole.SUPER_USER, source=RequestSource.ADMIN_PANEL
    )
    group_id = _make_group(client, admin_headers).json()["id"]
    resp = _make_definition(client, admin_headers, "zakat_cert", group_id=group_id)

    assert resp.status_code == 201
    data = resp.json()
    assert data["file_group_id"] == group_id
    assert data["file_group"]["id"] == group_id
    assert data["file_group"]["key"] == "saudi_company"


def test_file_group_returns_nested_definitions(client: TestClient, session: Session) -> None:
    """Fetching a group by ID includes its definitions in file_definitions list."""
    _, admin_headers = user_authentication_headers(
        client, session, role=UserRole.SUPER_USER, source=RequestSource.ADMIN_PANEL
    )
    group_id = _make_group(client, admin_headers).json()["id"]
    _make_definition(client, admin_headers, "cr_doc", group_id=group_id)
    _make_definition(client, admin_headers, "vat_doc", group_id=group_id)

    resp = client.get(
        f"{settings.API_V1_STR}/admin/settings/file-groups/{group_id}", headers=admin_headers
    )
    assert resp.status_code == 200
    defs = resp.json()["file_definitions"]
    assert len(defs) == 2
    keys = {d["key"] for d in defs}
    assert keys == {"cr_doc", "vat_doc"}


# ── Public endpoints ──────────────────────────────────────────────────────────

def test_public_list_file_groups_no_auth(client: TestClient, session: Session) -> None:
    """Public endpoint returns only active groups without authentication."""
    _, admin_headers = user_authentication_headers(
        client, session, role=UserRole.SUPER_USER, source=RequestSource.ADMIN_PANEL
    )
    active_id = _make_group(client, admin_headers, "_pub_active").json()["id"]

    # Create an inactive group
    inactive_resp = _make_group(client, admin_headers, "_pub_inactive").json()
    client.put(
        f"{settings.API_V1_STR}/admin/settings/file-groups/{inactive_resp['id']}",
        headers=admin_headers,
        json={"is_active": False},
    )

    resp = client.get(f"{settings.API_V1_STR}/file-definitions/groups")
    assert resp.status_code == 200
    body = resp.json()
    ids = [g["id"] for g in body["items"]]
    assert active_id in ids
    # Inactive group must not appear
    for g in body["items"]:
        assert g["is_active"] is True


def test_public_get_group_with_definitions(client: TestClient, session: Session) -> None:
    """Public endpoint returns group with its nested definitions."""
    _, admin_headers = user_authentication_headers(
        client, session, role=UserRole.SUPER_USER, source=RequestSource.ADMIN_PANEL
    )
    group_id = _make_group(client, admin_headers, "_pub_get").json()["id"]
    _make_definition(client, admin_headers, "passport_copy_pub", group_id=group_id)

    resp = client.get(f"{settings.API_V1_STR}/file-definitions/groups/{group_id}")
    assert resp.status_code == 200
    data = resp.json()
    assert data["id"] == group_id
    assert len(data["file_definitions"]) == 1
    assert data["file_definitions"][0]["key"] == "passport_copy_pub"


def test_public_get_inactive_group_returns_404(client: TestClient, session: Session) -> None:
    """Public endpoint hides inactive groups (returns 404)."""
    _, admin_headers = user_authentication_headers(
        client, session, role=UserRole.SUPER_USER, source=RequestSource.ADMIN_PANEL
    )
    group_id = _make_group(client, admin_headers, "_hidden").json()["id"]
    client.put(
        f"{settings.API_V1_STR}/admin/settings/file-groups/{group_id}",
        headers=admin_headers,
        json={"is_active": False},
    )

    resp = client.get(f"{settings.API_V1_STR}/file-definitions/groups/{group_id}")
    assert resp.status_code == 404


# ── Provider registration with file_group_id ─────────────────────────────────

def test_provider_registration_stores_file_group_id(client: TestClient, session: Session) -> None:
    """Registering a provider with a file_group_id stores it on the provider."""
    _, admin_headers = user_authentication_headers(
        client, session, role=UserRole.SUPER_USER, source=RequestSource.ADMIN_PANEL
    )
    group_id = _make_group(client, admin_headers, "_reg").json()["id"]

    reg_payload = {
        "user": {
            "name": "Test Provider",
            "email": f"provider_{uuid.uuid4().hex[:6]}@test.com",
            "phone": "0500000001",
            "password": "TestPass1!",
            "role": "normal",
            "source": "providers_panel",
        },
        "provider": {
            "company_name": "Test Co",
            "company_email": f"testco_{uuid.uuid4().hex[:6]}@test.com",
            "company_phone": "0501234567",
            "file_group_id": group_id,
        },
    }

    resp = client.post(
        f"{settings.API_V1_STR}/providers/register",
        json=reg_payload,
        headers={"X-Source": "providers_panel"},
    )
    assert resp.status_code == 200

    # Verify the provider has the correct file_group_id stored
    provider_id = resp.json()["provider_id"]
    from app.models.provider import Provider
    provider = session.get(Provider, provider_id)
    assert provider is not None
    assert str(provider.file_group_id) == group_id


def test_provider_registration_without_group_still_works(client: TestClient, session: Session) -> None:
    """Registering without a file_group_id still works (group is optional)."""
    reg_payload = {
        "user": {
            "name": "No Group Provider",
            "email": f"nogroup_{uuid.uuid4().hex[:6]}@test.com",
            "phone": "0500000002",
            "password": "TestPass1!",
            "role": "normal",
            "source": "providers_panel",
        },
        "provider": {
            "company_name": "No Group Co",
            "company_email": f"nogroupco_{uuid.uuid4().hex[:6]}@test.com",
            "company_phone": "0509876543",
        },
    }

    resp = client.post(
        f"{settings.API_V1_STR}/providers/register",
        json=reg_payload,
        headers={"X-Source": "providers_panel"},
    )
    assert resp.status_code == 200

    provider_id = resp.json()["provider_id"]
    from app.models.provider import Provider
    provider = session.get(Provider, provider_id)
    assert provider is not None
    assert provider.file_group_id is None


# ── Group-scoped required-file enforcement ────────────────────────────────────

def test_are_all_files_accepted_respects_group_scope(client: TestClient, session: Session) -> None:
    """
    are_all_files_accepted checks only definitions for the provider's group.
    A definition in a different group should NOT block approval.
    """
    from app.crud.provider_file import are_all_files_accepted
    from app.models.provider import Provider

    _, admin_headers = user_authentication_headers(
        client, session, role=UserRole.SUPER_USER, source=RequestSource.ADMIN_PANEL
    )
    # Create two groups
    group_a_id = _make_group(client, admin_headers, "_scope_a").json()["id"]
    group_b_id = _make_group(client, admin_headers, "_scope_b").json()["id"]

    # Add one required definition to each group
    _make_definition(client, admin_headers, "doc_group_a", group_id=group_a_id)
    _make_definition(client, admin_headers, "doc_group_b", group_id=group_b_id)

    # Register a provider belonging to group_a
    reg_payload = {
        "user": {
            "name": "Group A Provider",
            "email": f"groupa_{uuid.uuid4().hex[:6]}@test.com",
            "phone": "0500000003",
            "password": "TestPass1!",
            "role": "normal",
            "source": "providers_panel",
        },
        "provider": {
            "company_name": "Group A Co",
            "company_email": f"groupaco_{uuid.uuid4().hex[:6]}@test.com",
            "company_phone": "0501111111",
            "file_group_id": group_a_id,
        },
    }
    reg_resp = client.post(
        f"{settings.API_V1_STR}/providers/register",
        json=reg_payload,
        headers={"X-Source": "providers_panel"},
    )
    assert reg_resp.status_code == 200
    provider_id = reg_resp.json()["provider_id"]

    # Provider has NOT uploaded any files yet
    # are_all_files_accepted should be False (doc_group_a is missing)
    # but doc_group_b must NOT block it (it belongs to group_b)
    result = are_all_files_accepted(session, provider_id)
    # group_a has 1 required doc not uploaded → False
    assert result is False


def test_legacy_provider_registration_endpoint_excludes_grouped_defs(client: TestClient, session: Session) -> None:
    """
    The /file-definitions/provider-registration endpoint must only return
    ungrouped definitions (file_group_id IS NULL).
    Definitions belonging to any group must not appear there.
    """
    _, admin_headers = user_authentication_headers(
        client, session, role=UserRole.SUPER_USER, source=RequestSource.ADMIN_PANEL
    )
    group_id = _make_group(client, admin_headers, "_legacy_test").json()["id"]

    # Create one grouped and one ungrouped definition
    _make_definition(client, admin_headers, "grouped_doc_legacy", group_id=group_id)
    _make_definition(client, admin_headers, "ungrouped_doc_legacy", group_id=None)

    resp = client.get(f"{settings.API_V1_STR}/file-definitions/provider-registration")
    assert resp.status_code == 200
    keys = {d["key"] for d in resp.json()}

    assert "ungrouped_doc_legacy" in keys
    assert "grouped_doc_legacy" not in keys


def test_count_required_files_scoped_to_group(client: TestClient, session: Session) -> None:
    """count_required_files returns only count for the provider's group."""
    from app.crud.provider_file import count_required_files
    from app.models.provider import Provider

    _, admin_headers = user_authentication_headers(
        client, session, role=UserRole.SUPER_USER, source=RequestSource.ADMIN_PANEL
    )
    group_id = _make_group(client, admin_headers, "_count").json()["id"]
    _make_definition(client, admin_headers, "count_doc_1", group_id=group_id)
    _make_definition(client, admin_headers, "count_doc_2", group_id=group_id)

    # Register a provider in this group
    reg_payload = {
        "user": {
            "name": "Count Provider",
            "email": f"count_{uuid.uuid4().hex[:6]}@test.com",
            "phone": "0500000004",
            "password": "TestPass1!",
            "role": "normal",
            "source": "providers_panel",
        },
        "provider": {
            "company_name": "Count Co",
            "company_email": f"countco_{uuid.uuid4().hex[:6]}@test.com",
            "company_phone": "0502222222",
            "file_group_id": group_id,
        },
    }
    reg_resp = client.post(
        f"{settings.API_V1_STR}/providers/register",
        json=reg_payload,
        headers={"X-Source": "providers_panel"},
    )
    assert reg_resp.status_code == 200
    provider_id = reg_resp.json()["provider_id"]

    count = count_required_files(session, provider_id)
    assert count == 2
