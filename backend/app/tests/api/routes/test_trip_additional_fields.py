"""
Unit tests for additional trip fields: amenities, refundability, meeting place.
"""

import uuid
import datetime
from decimal import Decimal

from fastapi.testclient import TestClient
from sqlmodel import Session

from app.core.config import settings
from app.models.user import UserRole
from app.models.trip import Trip
from app.models.trip_package import TripPackage
from app.models.trip_amenity import TripAmenity
from app.tests.utils.user import user_authentication_headers
from app.schemas.trip import TripCreate
from app import crud


def _create_trip_with_package(client, session, headers, user, **trip_kwargs):
    """Helper to create a trip with a package via CRUD."""
    defaults = dict(
        name_en="Test Trip",
        description_en="Test Description",
        start_date=datetime.datetime.utcnow(),
        end_date=datetime.datetime.utcnow() + datetime.timedelta(days=5),
        max_participants=20,
    )
    defaults.update(trip_kwargs)
    trip_in = TripCreate(**defaults)
    trip = crud.trip.create_trip(session=session, trip_in=trip_in, provider=user.provider)

    package = TripPackage(
        trip_id=trip.id,
        name_en="Standard",
        description_en="Standard package",
        price=Decimal("500.00"),
        is_active=True,
    )
    session.add(package)
    session.commit()
    session.refresh(trip)
    return trip


# ===== Amenities =====


def test_create_trip_with_amenities(client: TestClient, session: Session):
    """Test creating a trip with amenities."""
    user, headers = user_authentication_headers(client, session, role=UserRole.SUPER_USER)
    trip = _create_trip_with_package(
        client, session, headers, user,
        amenities=[TripAmenity.FLIGHT_TICKETS, TripAmenity.HOTEL, TripAmenity.MEALS],
    )

    response = client.get(
        f"{settings.API_V1_STR}/trips/{trip.id}",
        headers=headers,
    )
    assert response.status_code == 200
    data = response.json()
    assert set(data["amenities"]) == {"flight_tickets", "hotel", "meals"}


def test_create_trip_without_amenities(client: TestClient, session: Session):
    """Trip created without amenities should have amenities as None or empty."""
    user, headers = user_authentication_headers(client, session, role=UserRole.SUPER_USER)
    trip = _create_trip_with_package(client, session, headers, user)

    response = client.get(
        f"{settings.API_V1_STR}/trips/{trip.id}",
        headers=headers,
    )
    assert response.status_code == 200
    data = response.json()
    assert data["amenities"] is None or data["amenities"] == []


def test_update_trip_amenities(client: TestClient, session: Session):
    """Test updating trip amenities via PUT."""
    user, headers = user_authentication_headers(client, session, role=UserRole.SUPER_USER)
    trip = _create_trip_with_package(client, session, headers, user)

    response = client.put(
        f"{settings.API_V1_STR}/trips/{trip.id}",
        headers=headers,
        json={"amenities": ["bus", "tour_guide", "insurance"]},
    )
    assert response.status_code == 200
    data = response.json()
    assert set(data["amenities"]) == {"bus", "tour_guide", "insurance"}


# ===== Refundability =====


def test_trip_default_refundable(client: TestClient, session: Session):
    """Trips should be refundable by default."""
    user, headers = user_authentication_headers(client, session, role=UserRole.SUPER_USER)
    trip = _create_trip_with_package(client, session, headers, user)

    response = client.get(
        f"{settings.API_V1_STR}/trips/{trip.id}",
        headers=headers,
    )
    assert response.status_code == 200
    assert response.json()["is_refundable"] is True


def test_create_trip_non_refundable(client: TestClient, session: Session):
    """Test creating a non-refundable trip."""
    user, headers = user_authentication_headers(client, session, role=UserRole.SUPER_USER)
    trip = _create_trip_with_package(
        client, session, headers, user,
        is_refundable=False,
    )

    response = client.get(
        f"{settings.API_V1_STR}/trips/{trip.id}",
        headers=headers,
    )
    assert response.status_code == 200
    assert response.json()["is_refundable"] is False


def test_update_trip_refundability(client: TestClient, session: Session):
    """Test toggling refundability via update."""
    user, headers = user_authentication_headers(client, session, role=UserRole.SUPER_USER)
    trip = _create_trip_with_package(client, session, headers, user)

    # Set to non-refundable
    response = client.put(
        f"{settings.API_V1_STR}/trips/{trip.id}",
        headers=headers,
        json={"is_refundable": False},
    )
    assert response.status_code == 200
    assert response.json()["is_refundable"] is False

    # Set back to refundable
    response = client.put(
        f"{settings.API_V1_STR}/trips/{trip.id}",
        headers=headers,
        json={"is_refundable": True},
    )
    assert response.status_code == 200
    assert response.json()["is_refundable"] is True


# ===== Meeting Place =====


def test_trip_default_no_meeting_place(client: TestClient, session: Session):
    """Trips should have no meeting place by default."""
    user, headers = user_authentication_headers(client, session, role=UserRole.SUPER_USER)
    trip = _create_trip_with_package(client, session, headers, user)

    response = client.get(
        f"{settings.API_V1_STR}/trips/{trip.id}",
        headers=headers,
    )
    assert response.status_code == 200
    data = response.json()
    assert data["has_meeting_place"] is False
    assert data["meeting_location"] is None
    assert data["meeting_time"] is None


def test_create_trip_with_meeting_place(client: TestClient, session: Session):
    """Test creating a trip with meeting place info."""
    meeting_time = (datetime.datetime.utcnow() + datetime.timedelta(days=5)).isoformat()
    user, headers = user_authentication_headers(client, session, role=UserRole.SUPER_USER)
    trip = _create_trip_with_package(
        client, session, headers, user,
        has_meeting_place=True,
        meeting_location="Riyadh Airport Terminal 1",
        meeting_time=meeting_time,
    )

    response = client.get(
        f"{settings.API_V1_STR}/trips/{trip.id}",
        headers=headers,
    )
    assert response.status_code == 200
    data = response.json()
    assert data["has_meeting_place"] is True
    assert data["meeting_location"] == "Riyadh Airport Terminal 1"
    assert data["meeting_time"] is not None


def test_update_trip_meeting_place(client: TestClient, session: Session):
    """Test updating meeting place via PUT."""
    user, headers = user_authentication_headers(client, session, role=UserRole.SUPER_USER)
    trip = _create_trip_with_package(client, session, headers, user)

    meeting_time = (datetime.datetime.utcnow() + datetime.timedelta(days=3)).isoformat()
    response = client.put(
        f"{settings.API_V1_STR}/trips/{trip.id}",
        headers=headers,
        json={
            "has_meeting_place": True,
            "meeting_location": "Jeddah Bus Station",
            "meeting_time": meeting_time,
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert data["has_meeting_place"] is True
    assert data["meeting_location"] == "Jeddah Bus Station"
    assert data["meeting_time"] is not None


# ===== Combined Fields =====


def test_create_trip_with_all_additional_fields(client: TestClient, session: Session):
    """Test creating a trip with all additional fields at once."""
    meeting_time = (datetime.datetime.utcnow() + datetime.timedelta(days=7)).isoformat()
    user, headers = user_authentication_headers(client, session, role=UserRole.SUPER_USER)
    trip = _create_trip_with_package(
        client, session, headers, user,
        is_refundable=False,
        amenities=[TripAmenity.VISA_ASSISTANCE, TripAmenity.TOURS],
        has_meeting_place=True,
        meeting_location="Hotel Lobby",
        meeting_time=meeting_time,
    )

    response = client.get(
        f"{settings.API_V1_STR}/trips/{trip.id}",
        headers=headers,
    )
    assert response.status_code == 200
    data = response.json()
    assert data["is_refundable"] is False
    assert set(data["amenities"]) == {"visa_assistance", "tours"}
    assert data["has_meeting_place"] is True
    assert data["meeting_location"] == "Hotel Lobby"
    assert data["meeting_time"] is not None
