"""Tests for Provider Image Collection and Trip Duplication."""

import datetime
import uuid
from io import BytesIO
from unittest.mock import AsyncMock, patch

import pytest
from fastapi.testclient import TestClient
from PIL import Image as PILImage
from sqlmodel import Session

from app import crud
from app.core.config import settings
from app.models.user import UserRole
from app.schemas.trip import TripCreate
from app.schemas.trip_package import TripPackageCreate
from app.tests.utils.user import user_authentication_headers


def make_test_jpeg(width: int = 800, height: int = 600) -> BytesIO:
    img = PILImage.new("RGB", (width, height), color=(100, 150, 200))
    buf = BytesIO()
    img.save(buf, format="JPEG")
    buf.seek(0)
    return buf


def _create_trip(session, provider):
    return crud.trip.create_trip(
        session=session,
        trip_in=TripCreate(
            name_en="Image Test Trip",
            name_ar="رحلة اختبار الصور",
            description_en="desc",
            start_date=datetime.datetime.utcnow() + datetime.timedelta(days=10),
            end_date=datetime.datetime.utcnow() + datetime.timedelta(days=11),
            max_participants=10,
        ),
        provider=provider,
    )


# ─── Image Collection ─────────────────────────────────────────────────────────

def test_upload_saves_to_collection(client: TestClient, session: Session) -> None:
    """Uploading trip images should auto-populate the provider's image collection."""
    user, headers = user_authentication_headers(client, session, role=UserRole.SUPER_USER)
    trip = _create_trip(session, user.provider)

    with patch("app.services.storage.storage_service") as mock_storage:
        mock_storage.upload_file = AsyncMock(return_value={
            "downloadUrl": "https://example.com/img1.jpg",
            "fileId": "b2-id-001",
            "fileName": "trip_images/img1.jpg",
        })
        files = [("files", ("img1.jpg", make_test_jpeg(), "image/jpeg"))]
        resp = client.post(
            f"{settings.API_V1_STR}/trips/{trip.id}/upload-images",
            headers=headers,
            files=files,
        )
    assert resp.status_code == 200

    # Check it landed in the collection
    coll_resp = client.get(f"{settings.API_V1_STR}/provider/images", headers=headers)
    assert coll_resp.status_code == 200
    data = coll_resp.json()
    assert data["total"] >= 1
    urls = [item["url"] for item in data["items"]]
    assert "https://example.com/img1.jpg" in urls


def test_list_collection_empty(client: TestClient, session: Session) -> None:
    """A fresh provider has an empty image collection."""
    _, headers = user_authentication_headers(client, session, role=UserRole.SUPER_USER)
    resp = client.get(f"{settings.API_V1_STR}/provider/images", headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] == 0
    assert data["items"] == []


def test_delete_collection_image(client: TestClient, session: Session) -> None:
    """DELETE /provider/images/{id} removes the image from the collection."""
    user, headers = user_authentication_headers(client, session, role=UserRole.SUPER_USER)

    # Seed the collection directly via CRUD
    img = crud.provider_image.add_image(
        session=session,
        provider_id=user.provider_id,
        url="https://example.com/to-delete.jpg",
        b2_file_id="del-id-001",
        b2_file_name="trip_images/to-delete.jpg",
        original_filename="to-delete.jpg",
    )

    with patch("app.services.storage.storage_service") as mock_storage:
        mock_storage.delete_file = AsyncMock(return_value={})
        resp = client.delete(
            f"{settings.API_V1_STR}/provider/images/{img.id}",
            headers=headers,
        )
    assert resp.status_code == 200

    # Confirm gone
    assert crud.provider_image.get_image(session=session, image_id=img.id) is None


def test_delete_collection_image_forbidden(client: TestClient, session: Session) -> None:
    """Provider A cannot delete Provider B's image."""
    user_a, headers_a = user_authentication_headers(client, session, role=UserRole.SUPER_USER)
    user_b, headers_b = user_authentication_headers(client, session, role=UserRole.SUPER_USER)

    img = crud.provider_image.add_image(
        session=session,
        provider_id=user_b.provider_id,
        url="https://example.com/b-image.jpg",
        b2_file_id="b-id",
        b2_file_name="trip_images/b-image.jpg",
    )

    with patch("app.services.storage.storage_service") as mock_storage:
        mock_storage.delete_file = AsyncMock(return_value={})
        resp = client.delete(
            f"{settings.API_V1_STR}/provider/images/{img.id}",
            headers=headers_a,
        )
    assert resp.status_code == 403


def test_reuse_collection_image_on_trip(client: TestClient, session: Session) -> None:
    """POST /trips/{trip_id}/images/from-collection attaches an existing image."""
    user, headers = user_authentication_headers(client, session, role=UserRole.SUPER_USER)
    trip = _create_trip(session, user.provider)

    img = crud.provider_image.add_image(
        session=session,
        provider_id=user.provider_id,
        url="https://example.com/reuse.jpg",
        b2_file_id="reuse-id",
        b2_file_name="trip_images/reuse.jpg",
    )

    resp = client.post(
        f"{settings.API_V1_STR}/trips/{trip.id}/images/from-collection",
        headers=headers,
        params={"image_id": str(img.id)},
    )
    assert resp.status_code == 200
    session.refresh(trip)
    assert "https://example.com/reuse.jpg" in (trip.images or [])


def test_reuse_collection_image_duplicate_rejected(client: TestClient, session: Session) -> None:
    """Cannot attach the same collection image to a trip twice."""
    user, headers = user_authentication_headers(client, session, role=UserRole.SUPER_USER)
    trip = _create_trip(session, user.provider)

    img = crud.provider_image.add_image(
        session=session,
        provider_id=user.provider_id,
        url="https://example.com/dup.jpg",
        b2_file_id="dup-id",
        b2_file_name="trip_images/dup.jpg",
    )

    for _ in range(2):
        resp = client.post(
            f"{settings.API_V1_STR}/trips/{trip.id}/images/from-collection",
            headers=headers,
            params={"image_id": str(img.id)},
        )
    assert resp.status_code == 409


# ─── Trip Duplication ─────────────────────────────────────────────────────────

def test_duplicate_trip_basic(client: TestClient, session: Session) -> None:
    """POST /trips/{id}/duplicate creates a new inactive copy."""
    user, headers = user_authentication_headers(client, session, role=UserRole.SUPER_USER)
    trip = _create_trip(session, user.provider)

    resp = client.post(
        f"{settings.API_V1_STR}/trips/{trip.id}/duplicate",
        headers=headers,
    )
    assert resp.status_code == 200
    dup = resp.json()
    assert dup["id"] != str(trip.id)
    assert dup["trip_reference"] != trip.trip_reference
    assert dup["is_active"] is False
    assert dup["name_en"] == trip.name_en
    assert dup["name_ar"] == trip.name_ar


def test_duplicate_trip_copies_packages(client: TestClient, session: Session) -> None:
    """Duplicated trip should have cloned packages."""
    user, headers = user_authentication_headers(client, session, role=UserRole.SUPER_USER)
    trip = _create_trip(session, user.provider)

    # Add a package to the source trip directly via the model
    from app.models.trip_package import TripPackage
    from decimal import Decimal
    source_pkg = TripPackage(
        trip_id=trip.id,
        name_en="Standard",
        name_ar="عادي",
        price=Decimal("500.00"),
    )
    session.add(source_pkg)
    session.commit()

    resp = client.post(
        f"{settings.API_V1_STR}/trips/{trip.id}/duplicate",
        headers=headers,
    )
    assert resp.status_code == 200
    dup_id = resp.json()["id"]

    # Verify packages were cloned
    from sqlmodel import select
    from app.models.trip_package import TripPackage as TP
    cloned_pkgs = session.exec(select(TP).where(TP.trip_id == uuid.UUID(dup_id))).all()
    assert len(cloned_pkgs) == 1
    assert cloned_pkgs[0].name_en == "Standard"
    assert cloned_pkgs[0].id != source_pkg.id


def test_duplicate_trip_copies_images(client: TestClient, session: Session) -> None:
    """Duplicated trip inherits the same image URLs (no re-upload)."""
    user, headers = user_authentication_headers(client, session, role=UserRole.SUPER_USER)
    trip = _create_trip(session, user.provider)

    # Seed images on source trip
    trip.images = ["https://example.com/a.jpg", "https://example.com/b.jpg"]
    session.add(trip)
    session.commit()

    resp = client.post(
        f"{settings.API_V1_STR}/trips/{trip.id}/duplicate",
        headers=headers,
    )
    assert resp.status_code == 200
    dup = resp.json()
    assert dup["images"] == ["https://example.com/a.jpg", "https://example.com/b.jpg"]


def test_duplicate_trip_forbidden(client: TestClient, session: Session) -> None:
    """Provider B cannot duplicate Provider A's trip."""
    user_a, _ = user_authentication_headers(client, session, role=UserRole.SUPER_USER)
    _, headers_b = user_authentication_headers(client, session, role=UserRole.SUPER_USER)
    trip = _create_trip(session, user_a.provider)

    resp = client.post(
        f"{settings.API_V1_STR}/trips/{trip.id}/duplicate",
        headers=headers_b,
    )
    assert resp.status_code == 403


def test_duplicate_trip_not_found(client: TestClient, session: Session) -> None:
    """Duplicating a non-existent trip returns 404."""
    _, headers = user_authentication_headers(client, session, role=UserRole.SUPER_USER)
    resp = client.post(
        f"{settings.API_V1_STR}/trips/{uuid.uuid4()}/duplicate",
        headers=headers,
    )
    assert resp.status_code == 404
