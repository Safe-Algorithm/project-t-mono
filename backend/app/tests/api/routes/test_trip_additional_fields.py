"""
Unit tests for additional trip fields: amenities, refundability, meeting place.

NOTE: amenities and is_refundable are stored on TripPackage (hidden package for
non-packaged trips). They are surfaced in the TripRead response but NOT stored
on the Trip model. Tests use the API endpoint so _sync_hidden_package runs.
"""

import datetime

from fastapi.testclient import TestClient
from sqlmodel import Session

from app.core.config import settings
from app.models.user import UserRole
from app.tests.utils.user import user_authentication_headers


def _create_trip_via_api(client, headers, **extra):
    """Create a non-packaged trip via API (triggers hidden package creation)."""
    payload = {
        "name_en": "Test Trip",
        "description_en": "Test Description",
        "start_date": (datetime.datetime.utcnow() + datetime.timedelta(days=10)).isoformat(),
        "end_date": (datetime.datetime.utcnow() + datetime.timedelta(days=15)).isoformat(),
        "max_participants": 20,
        "is_packaged_trip": False,
    }
    payload.update(extra)
    response = client.post(f"{settings.API_V1_STR}/trips", headers=headers, json=payload)
    assert response.status_code == 200, response.text
    return response.json()


# ===== Amenities =====


def test_create_trip_with_amenities(client: TestClient, session: Session):
    """Creating a non-packaged trip with amenities stores them on the hidden package."""
    user, headers = user_authentication_headers(client, session, role=UserRole.SUPER_USER)
    trip = _create_trip_via_api(
        client, headers,
        amenities=["flight_tickets", "hotel", "meals"],
    )
    assert set(trip["amenities"]) == {"flight_tickets", "hotel", "meals"}

    # Verify via GET
    resp = client.get(f"{settings.API_V1_STR}/trips/{trip['id']}", headers=headers)
    assert resp.status_code == 200
    assert set(resp.json()["amenities"]) == {"flight_tickets", "hotel", "meals"}


def test_create_trip_without_amenities(client: TestClient, session: Session):
    """Trip created without amenities should have amenities as None or empty."""
    user, headers = user_authentication_headers(client, session, role=UserRole.SUPER_USER)
    trip = _create_trip_via_api(client, headers)

    resp = client.get(f"{settings.API_V1_STR}/trips/{trip['id']}", headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["amenities"] is None or data["amenities"] == []


def test_update_trip_amenities(client: TestClient, session: Session):
    """Updating amenities via PUT updates the hidden package."""
    user, headers = user_authentication_headers(client, session, role=UserRole.SUPER_USER)
    trip = _create_trip_via_api(client, headers)

    resp = client.put(
        f"{settings.API_V1_STR}/trips/{trip['id']}",
        headers=headers,
        json={"amenities": ["bus", "tour_guide", "insurance"]},
    )
    assert resp.status_code == 200
    assert set(resp.json()["amenities"]) == {"bus", "tour_guide", "insurance"}


# ===== Refundability =====


def test_trip_default_refundable(client: TestClient, session: Session):
    """Non-packaged trips created without is_refundable should default to True."""
    user, headers = user_authentication_headers(client, session, role=UserRole.SUPER_USER)
    trip = _create_trip_via_api(client, headers)

    resp = client.get(f"{settings.API_V1_STR}/trips/{trip['id']}", headers=headers)
    assert resp.status_code == 200
    # is_refundable defaults to True when not explicitly set
    assert resp.json()["is_refundable"] is True


def test_create_trip_non_refundable(client: TestClient, session: Session):
    """Test creating a non-refundable non-packaged trip."""
    user, headers = user_authentication_headers(client, session, role=UserRole.SUPER_USER)
    trip = _create_trip_via_api(client, headers, is_refundable=False)

    resp = client.get(f"{settings.API_V1_STR}/trips/{trip['id']}", headers=headers)
    assert resp.status_code == 200
    assert resp.json()["is_refundable"] is False


def test_create_trip_refundable(client: TestClient, session: Session):
    """Test creating an explicitly refundable non-packaged trip."""
    user, headers = user_authentication_headers(client, session, role=UserRole.SUPER_USER)
    trip = _create_trip_via_api(client, headers, is_refundable=True)

    resp = client.get(f"{settings.API_V1_STR}/trips/{trip['id']}", headers=headers)
    assert resp.status_code == 200
    assert resp.json()["is_refundable"] is True


def test_update_trip_refundability(client: TestClient, session: Session):
    """Refundability is frozen after trip creation — changing the value returns 400,
    but re-submitting the same value (no-op) is allowed."""
    user, headers = user_authentication_headers(client, session, role=UserRole.SUPER_USER)
    trip = _create_trip_via_api(client, headers, is_refundable=True)

    # Attempting to change to non-refundable must be blocked
    resp = client.put(
        f"{settings.API_V1_STR}/trips/{trip['id']}",
        headers=headers,
        json={"is_refundable": False},
    )
    assert resp.status_code == 400
    assert "Refundability cannot be changed" in resp.json()["detail"]

    # Re-submitting the same value (True → True) is a no-op and must succeed
    resp = client.put(
        f"{settings.API_V1_STR}/trips/{trip['id']}",
        headers=headers,
        json={"is_refundable": True},
    )
    assert resp.status_code == 200
    assert resp.json()["is_refundable"] is True


# ===== Meeting Place =====


def test_trip_default_no_meeting_place(client: TestClient, session: Session):
    """Trips should have no meeting place by default."""
    user, headers = user_authentication_headers(client, session, role=UserRole.SUPER_USER)
    trip = _create_trip_via_api(client, headers)

    resp = client.get(f"{settings.API_V1_STR}/trips/{trip['id']}", headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["has_meeting_place"] is False
    assert data["meeting_location"] is None
    assert data["meeting_time"] is None


def test_create_trip_with_meeting_place(client: TestClient, session: Session):
    """Test creating a trip with meeting place info."""
    user, headers = user_authentication_headers(client, session, role=UserRole.SUPER_USER)
    trip = _create_trip_via_api(
        client, headers,
        has_meeting_place=True,
        meeting_location="https://maps.app.goo.gl/RiyadhAirport1",
    )

    resp = client.get(f"{settings.API_V1_STR}/trips/{trip['id']}", headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["has_meeting_place"] is True
    assert data["meeting_location"] == "https://maps.app.goo.gl/RiyadhAirport1"
    assert data["meeting_time"] is not None


def test_update_trip_meeting_place(client: TestClient, session: Session):
    """Test updating meeting place via PUT."""
    user, headers = user_authentication_headers(client, session, role=UserRole.SUPER_USER)
    trip = _create_trip_via_api(client, headers)

    resp = client.put(
        f"{settings.API_V1_STR}/trips/{trip['id']}",
        headers=headers,
        json={
            "has_meeting_place": True,
            "meeting_location": "https://maps.app.goo.gl/JeddahBusStation",
        },
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["has_meeting_place"] is True
    assert data["meeting_location"] == "https://maps.app.goo.gl/JeddahBusStation"
    assert data["meeting_time"] is not None


# ===== Combined Fields =====


def test_create_trip_with_all_additional_fields(client: TestClient, session: Session):
    """Test creating a trip with all additional fields at once."""
    user, headers = user_authentication_headers(client, session, role=UserRole.SUPER_USER)
    trip = _create_trip_via_api(
        client, headers,
        is_refundable=False,
        amenities=["visa_assistance", "tours"],
        has_meeting_place=True,
        meeting_location="https://maps.app.goo.gl/HotelLobby",
    )

    resp = client.get(f"{settings.API_V1_STR}/trips/{trip['id']}", headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["is_refundable"] is False
    assert set(data["amenities"]) == {"visa_assistance", "tours"}
    assert data["has_meeting_place"] is True
    assert data["meeting_location"] == "https://maps.app.goo.gl/HotelLobby"
    assert data["meeting_time"] is not None
