"""
Unit tests for destinations, places, and trip destinations API
"""

import uuid
from datetime import datetime, timedelta

from fastapi.testclient import TestClient
from sqlmodel import Session

from app.core.config import settings
from app.models.user import UserRole
from app.models.source import RequestSource
from app.models.destination import Destination, DestinationType
from app.models.place import Place, PlaceType
from app.models.trip_destination import TripDestination
from app.models.trip import Trip
from app.tests.utils.user import user_authentication_headers


def _create_country(session: Session, **kwargs) -> Destination:
    """Helper to create a country destination."""
    defaults = dict(
        type=DestinationType.COUNTRY,
        country_code="SA",
        slug="saudi-arabia",
        full_slug="saudi-arabia",
        name_en="Saudi Arabia",
        name_ar="المملكة العربية السعودية",
        timezone="Asia/Riyadh",
        currency_code="SAR",
        is_active=True,
        display_order=0,
    )
    defaults.update(kwargs)
    country = Destination(**defaults)
    session.add(country)
    session.commit()
    session.refresh(country)
    return country


def _create_city(session: Session, parent: Destination, **kwargs) -> Destination:
    """Helper to create a city destination."""
    defaults = dict(
        type=DestinationType.CITY,
        parent_id=parent.id,
        country_code=parent.country_code,
        slug="riyadh",
        full_slug=f"{parent.slug}/riyadh",
        name_en="Riyadh",
        name_ar="الرياض",
        timezone=parent.timezone,
        currency_code=parent.currency_code,
        is_active=True,
        display_order=0,
    )
    defaults.update(kwargs)
    city = Destination(**defaults)
    session.add(city)
    session.commit()
    session.refresh(city)
    return city


def _create_place(session: Session, destination: Destination, **kwargs) -> Place:
    """Helper to create a place."""
    defaults = dict(
        destination_id=destination.id,
        type=PlaceType.ATTRACTION,
        slug="diriyah",
        name_en="Diriyah",
        name_ar="الدرعية",
        is_active=True,
        display_order=0,
    )
    defaults.update(kwargs)
    place = Place(**defaults)
    session.add(place)
    session.commit()
    session.refresh(place)
    return place


def _get_admin_headers(client, session):
    """Get admin authentication headers."""
    _, headers = user_authentication_headers(
        client, session, role=UserRole.SUPER_USER, source=RequestSource.ADMIN_PANEL
    )
    return headers


def _get_provider_headers(client, session):
    """Get provider authentication headers."""
    user, headers = user_authentication_headers(
        client, session, role=UserRole.SUPER_USER, source=RequestSource.PROVIDERS_PANEL
    )
    return user, headers


def _create_trip_for_provider(session: Session, provider_id) -> Trip:
    """Helper to create a trip owned by a specific provider."""
    trip = Trip(
        name_en="Test Trip",
        description_en="A test trip",
        start_date=datetime.utcnow(),
        end_date=datetime.utcnow() + timedelta(days=5),
        max_participants=20,
        provider_id=provider_id,
        is_active=True,
    )
    session.add(trip)
    session.commit()
    session.refresh(trip)
    return trip


# ===== Admin - Create Destination =====


def test_admin_create_country(client: TestClient, session: Session):
    """Test admin creating a country destination"""
    headers = _get_admin_headers(client, session)

    data = {
        "type": "country",
        "country_code": "TR",
        "slug": "turkey",
        "name_en": "Turkey",
        "name_ar": "تركيا",
        "timezone": "Europe/Istanbul",
        "currency_code": "TRY",
        "is_active": False,
        "display_order": 1,
    }

    response = client.post(
        f"{settings.API_V1_STR}/admin/destinations",
        headers=headers,
        json=data,
    )

    assert response.status_code == 200
    result = response.json()
    assert result["type"] == "country"
    assert result["country_code"] == "TR"
    assert result["slug"] == "turkey"
    assert result["full_slug"] == "turkey"
    assert result["name_en"] == "Turkey"
    assert result["name_ar"] == "تركيا"
    assert result["is_active"] is False


def test_admin_create_city(client: TestClient, session: Session):
    """Test admin creating a city under a country"""
    headers = _get_admin_headers(client, session)
    country = _create_country(session)

    data = {
        "type": "city",
        "parent_id": str(country.id),
        "country_code": "SA",
        "slug": "riyadh",
        "name_en": "Riyadh",
        "name_ar": "الرياض",
    }

    response = client.post(
        f"{settings.API_V1_STR}/admin/destinations",
        headers=headers,
        json=data,
    )

    assert response.status_code == 200
    result = response.json()
    assert result["type"] == "city"
    assert result["parent_id"] == str(country.id)
    assert result["full_slug"] == "saudi-arabia/riyadh"


def test_admin_create_city_without_parent(client: TestClient, session: Session):
    """Test that creating a city without a parent fails"""
    headers = _get_admin_headers(client, session)

    data = {
        "type": "city",
        "country_code": "SA",
        "slug": "riyadh",
        "name_en": "Riyadh",
        "name_ar": "الرياض",
    }

    response = client.post(
        f"{settings.API_V1_STR}/admin/destinations",
        headers=headers,
        json=data,
    )

    assert response.status_code == 400
    assert "parent" in response.json()["detail"].lower()


def test_admin_create_country_with_parent(client: TestClient, session: Session):
    """Test that creating a country with a parent fails"""
    headers = _get_admin_headers(client, session)
    country = _create_country(session)

    data = {
        "type": "country",
        "parent_id": str(country.id),
        "country_code": "TR",
        "slug": "turkey",
        "name_en": "Turkey",
        "name_ar": "تركيا",
    }

    response = client.post(
        f"{settings.API_V1_STR}/admin/destinations",
        headers=headers,
        json=data,
    )

    assert response.status_code == 400
    assert "parent" in response.json()["detail"].lower()


def test_admin_create_destination_non_admin(client: TestClient, session: Session):
    """Test that non-admin users cannot create destinations"""
    _, headers = user_authentication_headers(
        client, session, role=UserRole.NORMAL, source=RequestSource.MOBILE_APP
    )

    data = {
        "type": "country",
        "country_code": "TR",
        "slug": "turkey",
        "name_en": "Turkey",
        "name_ar": "تركيا",
    }

    response = client.post(
        f"{settings.API_V1_STR}/admin/destinations",
        headers=headers,
        json=data,
    )

    assert response.status_code == 403


# ===== Admin - List Destinations =====


def test_admin_list_destinations(client: TestClient, session: Session):
    """Test listing all destinations with hierarchy"""
    headers = _get_admin_headers(client, session)
    country = _create_country(session)
    city = _create_city(session, country)

    response = client.get(
        f"{settings.API_V1_STR}/admin/destinations",
        headers=headers,
    )

    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 1
    # Find our country
    sa = next((d for d in data if d["country_code"] == "SA"), None)
    assert sa is not None
    assert len(sa["children"]) >= 1
    assert sa["children"][0]["name_en"] == "Riyadh"


def test_admin_list_destinations_by_type(client: TestClient, session: Session):
    """Test listing destinations filtered by type"""
    headers = _get_admin_headers(client, session)
    country = _create_country(session)
    _create_city(session, country)

    response = client.get(
        f"{settings.API_V1_STR}/admin/destinations?type=city",
        headers=headers,
    )

    assert response.status_code == 200
    data = response.json()
    for d in data:
        assert d["type"] == "city"


# ===== Admin - Get Single Destination =====


def test_admin_get_destination(client: TestClient, session: Session):
    """Test getting a single destination"""
    headers = _get_admin_headers(client, session)
    country = _create_country(session)
    city = _create_city(session, country)
    place = _create_place(session, city)

    response = client.get(
        f"{settings.API_V1_STR}/admin/destinations/{country.id}",
        headers=headers,
    )

    assert response.status_code == 200
    data = response.json()
    assert data["id"] == str(country.id)
    assert len(data["children"]) == 1
    assert data["children"][0]["id"] == str(city.id)


def test_admin_get_destination_not_found(client: TestClient, session: Session):
    """Test getting a non-existent destination"""
    headers = _get_admin_headers(client, session)

    response = client.get(
        f"{settings.API_V1_STR}/admin/destinations/{uuid.uuid4()}",
        headers=headers,
    )

    assert response.status_code == 404


# ===== Admin - Update Destination =====


def test_admin_update_destination(client: TestClient, session: Session):
    """Test updating a destination"""
    headers = _get_admin_headers(client, session)
    country = _create_country(session)

    response = client.patch(
        f"{settings.API_V1_STR}/admin/destinations/{country.id}",
        headers=headers,
        json={"name_en": "Kingdom of Saudi Arabia", "display_order": 5},
    )

    assert response.status_code == 200
    data = response.json()
    assert data["name_en"] == "Kingdom of Saudi Arabia"
    assert data["display_order"] == 5


# ===== Admin - Delete Destination =====


def test_admin_delete_destination(client: TestClient, session: Session):
    """Test deleting a destination"""
    headers = _get_admin_headers(client, session)
    country = _create_country(
        session, country_code="XX", slug="test-delete", full_slug="test-delete",
        name_en="Test Delete", name_ar="اختبار"
    )

    response = client.delete(
        f"{settings.API_V1_STR}/admin/destinations/{country.id}",
        headers=headers,
    )

    assert response.status_code == 204

    # Verify it's gone
    response = client.get(
        f"{settings.API_V1_STR}/admin/destinations/{country.id}",
        headers=headers,
    )
    assert response.status_code == 404


# ===== Admin - Activate/Deactivate =====


def test_admin_activate_destination(client: TestClient, session: Session):
    """Test activating a destination"""
    headers = _get_admin_headers(client, session)
    country = _create_country(
        session, is_active=False, country_code="YY", slug="inactive-test",
        full_slug="inactive-test", name_en="Inactive", name_ar="غير نشط"
    )

    response = client.patch(
        f"{settings.API_V1_STR}/admin/destinations/{country.id}/activate?is_active=true",
        headers=headers,
    )

    assert response.status_code == 200
    assert response.json()["is_active"] is True


def test_admin_deactivate_destination(client: TestClient, session: Session):
    """Test deactivating a destination"""
    headers = _get_admin_headers(client, session)
    country = _create_country(session)

    response = client.patch(
        f"{settings.API_V1_STR}/admin/destinations/{country.id}/activate?is_active=false",
        headers=headers,
    )

    assert response.status_code == 200
    assert response.json()["is_active"] is False


# ===== Admin - Place Management =====


def test_admin_create_place(client: TestClient, session: Session):
    """Test creating a place within a destination"""
    headers = _get_admin_headers(client, session)
    country = _create_country(session)
    city = _create_city(session, country)

    data = {
        "type": "attraction",
        "slug": "diriyah",
        "name_en": "Diriyah",
        "name_ar": "الدرعية",
        "latitude": 24.7341,
        "longitude": 46.5729,
    }

    response = client.post(
        f"{settings.API_V1_STR}/admin/destinations/{city.id}/places",
        headers=headers,
        json=data,
    )

    assert response.status_code == 200
    result = response.json()
    assert result["type"] == "attraction"
    assert result["name_en"] == "Diriyah"
    assert result["destination_id"] == str(city.id)


def test_admin_list_places(client: TestClient, session: Session):
    """Test listing places for a destination"""
    headers = _get_admin_headers(client, session)
    country = _create_country(session)
    city = _create_city(session, country)
    place = _create_place(session, city)

    response = client.get(
        f"{settings.API_V1_STR}/admin/destinations/{city.id}/places",
        headers=headers,
    )

    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 1
    assert data[0]["name_en"] == "Diriyah"


def test_admin_update_place(client: TestClient, session: Session):
    """Test updating a place"""
    headers = _get_admin_headers(client, session)
    country = _create_country(session)
    city = _create_city(session, country)
    place = _create_place(session, city)

    response = client.patch(
        f"{settings.API_V1_STR}/admin/places/{place.id}",
        headers=headers,
        json={"name_en": "Historic Diriyah", "type": "landmark"},
    )

    assert response.status_code == 200
    data = response.json()
    assert data["name_en"] == "Historic Diriyah"
    assert data["type"] == "landmark"


def test_admin_delete_place(client: TestClient, session: Session):
    """Test deleting a place"""
    headers = _get_admin_headers(client, session)
    country = _create_country(session)
    city = _create_city(session, country)
    place = _create_place(session, city)

    response = client.delete(
        f"{settings.API_V1_STR}/admin/places/{place.id}",
        headers=headers,
    )

    assert response.status_code == 204


# ===== Public - Active Destinations =====


def test_get_active_destinations(client: TestClient, session: Session):
    """Test getting active destinations tree (public)"""
    country_active = _create_country(session, is_active=True)
    city_active = _create_city(session, country_active, is_active=True)

    country_inactive = _create_country(
        session, country_code="XX", slug="inactive-country",
        full_slug="inactive-country", name_en="Inactive", name_ar="غير نشط",
        is_active=False,
    )

    response = client.get(f"{settings.API_V1_STR}/destinations")

    assert response.status_code == 200
    data = response.json()
    # Only active countries should be returned
    slugs = [d["slug"] for d in data]
    assert "saudi-arabia" in slugs
    assert "inactive-country" not in slugs


def test_get_active_destinations_empty(client: TestClient, session: Session):
    """Test getting active destinations when none are active"""
    _create_country(
        session, is_active=False, country_code="ZZ", slug="all-inactive",
        full_slug="all-inactive", name_en="All Inactive", name_ar="غير نشط"
    )

    response = client.get(f"{settings.API_V1_STR}/destinations")

    assert response.status_code == 200
    # May be empty or have other active destinations from other tests
    data = response.json()
    for d in data:
        assert d["is_active"] is True


def test_get_destination_places_public(client: TestClient, session: Session):
    """Test getting places for a destination (public)"""
    country = _create_country(session)
    city = _create_city(session, country)
    active_place = _create_place(session, city, is_active=True)
    inactive_place = _create_place(
        session, city, slug="inactive-place", name_en="Inactive Place",
        name_ar="مكان غير نشط", is_active=False,
    )

    response = client.get(f"{settings.API_V1_STR}/destinations/{city.id}/places")

    assert response.status_code == 200
    data = response.json()
    # Only active places
    slugs = [p["slug"] for p in data]
    assert "diriyah" in slugs
    assert "inactive-place" not in slugs


# ===== Provider - Trip Destinations =====


def test_provider_add_destination_to_trip(client: TestClient, session: Session):
    """Test provider adding a destination to their trip"""
    provider_user, provider_headers = _get_provider_headers(client, session)
    trip = _create_trip_for_provider(session, provider_user.provider_id)

    country = _create_country(session)
    city = _create_city(session, country)

    response = client.post(
        f"{settings.API_V1_STR}/trips/{trip.id}/destinations",
        headers=provider_headers,
        json={"destination_id": str(city.id)},
    )

    assert response.status_code == 200
    data = response.json()
    assert data["trip_id"] == str(trip.id)
    assert data["destination_id"] == str(city.id)
    assert data["destination"]["name_en"] == "Riyadh"


def test_provider_add_destination_with_place(client: TestClient, session: Session):
    """Test adding a destination with a specific place"""
    provider_user, provider_headers = _get_provider_headers(client, session)
    trip = _create_trip_for_provider(session, provider_user.provider_id)

    country = _create_country(session)
    city = _create_city(session, country)
    place = _create_place(session, city)

    response = client.post(
        f"{settings.API_V1_STR}/trips/{trip.id}/destinations",
        headers=provider_headers,
        json={"destination_id": str(city.id), "place_id": str(place.id)},
    )

    assert response.status_code == 200
    data = response.json()
    assert data["place_id"] == str(place.id)
    assert data["place"]["name_en"] == "Diriyah"


def test_provider_add_duplicate_destination(client: TestClient, session: Session):
    """Test that duplicate destinations are rejected"""
    provider_user, provider_headers = _get_provider_headers(client, session)
    trip = _create_trip_for_provider(session, provider_user.provider_id)

    country = _create_country(session)
    city = _create_city(session, country)

    # Add once
    client.post(
        f"{settings.API_V1_STR}/trips/{trip.id}/destinations",
        headers=provider_headers,
        json={"destination_id": str(city.id)},
    )

    # Add again — should fail
    response = client.post(
        f"{settings.API_V1_STR}/trips/{trip.id}/destinations",
        headers=provider_headers,
        json={"destination_id": str(city.id)},
    )

    assert response.status_code == 400
    assert "already" in response.json()["detail"].lower()


def test_provider_add_inactive_destination(client: TestClient, session: Session):
    """Test that inactive destinations cannot be added to trips"""
    provider_user, provider_headers = _get_provider_headers(client, session)
    trip = _create_trip_for_provider(session, provider_user.provider_id)

    country = _create_country(
        session, is_active=False, country_code="ZZ", slug="inactive-dest",
        full_slug="inactive-dest", name_en="Inactive", name_ar="غير نشط"
    )

    response = client.post(
        f"{settings.API_V1_STR}/trips/{trip.id}/destinations",
        headers=provider_headers,
        json={"destination_id": str(country.id)},
    )

    assert response.status_code == 400
    assert "not active" in response.json()["detail"].lower()


def test_provider_add_place_wrong_destination(client: TestClient, session: Session):
    """Test that a place from a different destination is rejected"""
    provider_user, provider_headers = _get_provider_headers(client, session)
    trip = _create_trip_for_provider(session, provider_user.provider_id)

    country = _create_country(session)
    city1 = _create_city(session, country)
    city2 = _create_city(
        session, country, slug="jeddah", full_slug="saudi-arabia/jeddah",
        name_en="Jeddah", name_ar="جدة"
    )
    place = _create_place(session, city1)  # Place belongs to city1

    response = client.post(
        f"{settings.API_V1_STR}/trips/{trip.id}/destinations",
        headers=provider_headers,
        json={"destination_id": str(city2.id), "place_id": str(place.id)},
    )

    assert response.status_code == 400
    assert "does not belong" in response.json()["detail"].lower()


def test_provider_remove_destination_from_trip(client: TestClient, session: Session):
    """Test removing a destination from a trip"""
    provider_user, provider_headers = _get_provider_headers(client, session)
    trip = _create_trip_for_provider(session, provider_user.provider_id)

    country = _create_country(session)
    city = _create_city(session, country)

    # Add destination
    add_resp = client.post(
        f"{settings.API_V1_STR}/trips/{trip.id}/destinations",
        headers=provider_headers,
        json={"destination_id": str(city.id)},
    )
    td_id = add_resp.json()["id"]

    # Remove it
    response = client.delete(
        f"{settings.API_V1_STR}/trips/{trip.id}/destinations/{td_id}",
        headers=provider_headers,
    )

    assert response.status_code == 204

    # Verify it's gone
    list_resp = client.get(f"{settings.API_V1_STR}/trips/{trip.id}/destinations")
    assert len(list_resp.json()) == 0


def test_list_trip_destinations(client: TestClient, session: Session):
    """Test listing destinations for a trip (public)"""
    provider_user, provider_headers = _get_provider_headers(client, session)
    trip = _create_trip_for_provider(session, provider_user.provider_id)

    country = _create_country(session)
    city = _create_city(session, country)

    client.post(
        f"{settings.API_V1_STR}/trips/{trip.id}/destinations",
        headers=provider_headers,
        json={"destination_id": str(city.id)},
    )

    # Public endpoint — no auth
    response = client.get(f"{settings.API_V1_STR}/trips/{trip.id}/destinations")

    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["destination"]["name_en"] == "Riyadh"


def test_provider_cannot_manage_other_trip(client: TestClient, session: Session):
    """Test that a provider cannot add destinations to another provider's trip"""
    _, provider1_headers = _get_provider_headers(client, session)
    provider2_user, _ = _get_provider_headers(client, session)

    # Trip belongs to provider2
    trip = _create_trip_for_provider(session, provider2_user.provider_id)

    country = _create_country(session)
    city = _create_city(session, country)

    # Provider1 tries to add destination
    response = client.post(
        f"{settings.API_V1_STR}/trips/{trip.id}/destinations",
        headers=provider1_headers,
        json={"destination_id": str(city.id)},
    )

    assert response.status_code == 403
