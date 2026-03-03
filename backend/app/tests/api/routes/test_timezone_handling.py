"""
Tests for timezone handling across the trip pipeline:

1. _to_utc schema normalizer  — TripCreate/TripUpdate strip tz info
2. trip.timezone field         — default, create, persist, round-trip
3. _parse_search_date          — provider /trips search endpoint
4. _parse_search_date          — public /public-trips search endpoint
5. Booking guard               — rejects registrations for already-started trips (UTC)
6. Worker UTC comparisons      — reminder & review tasks use naive UTC
"""
import datetime
from datetime import timezone as tz
from decimal import Decimal
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi.testclient import TestClient
from freezegun import freeze_time
from sqlmodel import Session

from app import crud
from app.core.config import settings
from app.models.trip import Trip
from app.models.trip_registration import TripRegistration
from app.models.user import UserRole
from app.schemas.trip import TripCreate, TripUpdate
from app.schemas.trip import _to_utc
from app.tasks.worker import send_review_reminders, send_trip_reminders
from app.tests.utils.user import create_random_user, user_authentication_headers


# ─────────────────────────────────────────────────────────────────────────────
# Helper
# ─────────────────────────────────────────────────────────────────────────────

def _utcnow_naive() -> datetime.datetime:
    return datetime.datetime.now(tz.utc).replace(tzinfo=None)


def _provider_helper(session: Session):
    from app.models.provider import Provider
    import uuid
    p = Provider(
        company_name="TZ Test Provider",
        company_email=f"tz_{uuid.uuid4().hex[:8]}@test.com",
        company_phone="0509999999",
    )
    session.add(p)
    session.commit()
    session.refresh(p)
    return p


def _trip_helper(session, provider, **kwargs):
    now = _utcnow_naive()
    defaults = dict(
        name_en="TZ Test Trip",
        description_en="desc",
        start_date=now + datetime.timedelta(days=7),
        end_date=now + datetime.timedelta(days=9),
        max_participants=20,
        provider_id=provider.id,
        is_active=True,
    )
    defaults.update(kwargs)
    trip = Trip(**defaults)
    session.add(trip)
    session.commit()
    session.refresh(trip)
    return trip


# ═════════════════════════════════════════════════════════════════════════════
# 1. _to_utc — schema-level normalization helper
# ═════════════════════════════════════════════════════════════════════════════

class TestToUtcHelper:
    """Unit tests for the _to_utc() helper in app/schemas/trip.py."""

    def test_naive_datetime_returned_unchanged(self):
        """A naive datetime is assumed to already be UTC — returned as-is."""
        naive = datetime.datetime(2025, 6, 1, 10, 0, 0)
        result = _to_utc(naive)
        assert result == naive
        assert result.tzinfo is None

    def test_utc_aware_datetime_stripped_to_naive(self):
        """An offset-aware UTC datetime is stripped of tzinfo."""
        aware_utc = datetime.datetime(2025, 6, 1, 10, 0, 0, tzinfo=tz.utc)
        result = _to_utc(aware_utc)
        assert result == datetime.datetime(2025, 6, 1, 10, 0, 0)
        assert result.tzinfo is None

    def test_positive_offset_converted_to_utc(self):
        """UTC+3 datetime (e.g. Riyadh) is shifted back to UTC then stripped."""
        riyadh = tz(datetime.timedelta(hours=3))
        local_noon = datetime.datetime(2025, 6, 1, 12, 0, 0, tzinfo=riyadh)  # 09:00 UTC
        result = _to_utc(local_noon)
        assert result == datetime.datetime(2025, 6, 1, 9, 0, 0)
        assert result.tzinfo is None

    def test_negative_offset_converted_to_utc(self):
        """UTC-5 datetime is shifted forward to UTC then stripped."""
        eastern = tz(datetime.timedelta(hours=-5))
        local_noon = datetime.datetime(2025, 6, 1, 12, 0, 0, tzinfo=eastern)  # 17:00 UTC
        result = _to_utc(local_noon)
        assert result == datetime.datetime(2025, 6, 1, 17, 0, 0)
        assert result.tzinfo is None

    def test_result_is_always_naive(self):
        """Whatever the input, _to_utc must never return an aware datetime."""
        for dt in [
            datetime.datetime(2025, 1, 1, tzinfo=tz.utc),
            datetime.datetime(2025, 1, 1, tzinfo=tz(datetime.timedelta(hours=5, minutes=30))),
            datetime.datetime(2025, 1, 1),  # naive
        ]:
            assert _to_utc(dt).tzinfo is None


# ═════════════════════════════════════════════════════════════════════════════
# 2. TripCreate / TripUpdate — validator normalises datetime inputs
# ═════════════════════════════════════════════════════════════════════════════

class TestTripSchemaDateNormalization:
    """TripCreate/TripUpdate must always store naive UTC."""

    def _base_data(self, **overrides):
        now = _utcnow_naive()
        base = dict(
            name_en="Schema TZ Trip",
            description_en="desc",
            start_date=now + datetime.timedelta(days=5),
            end_date=now + datetime.timedelta(days=10),
            max_participants=10,
        )
        base.update(overrides)
        return base

    def test_naive_start_date_stored_as_is(self):
        naive = datetime.datetime(2025, 8, 1, 9, 0, 0)
        schema = TripCreate(**self._base_data(start_date=naive))
        assert schema.start_date == naive
        assert schema.start_date.tzinfo is None

    def test_aware_start_date_converted_to_naive_utc(self):
        """UTC+3 '12:00' must become '09:00' naive UTC in the schema."""
        riyadh = tz(datetime.timedelta(hours=3))
        aware = datetime.datetime(2025, 8, 1, 12, 0, 0, tzinfo=riyadh)
        schema = TripCreate(**self._base_data(start_date=aware))
        assert schema.start_date == datetime.datetime(2025, 8, 1, 9, 0, 0)
        assert schema.start_date.tzinfo is None

    def test_iso_string_with_z_suffix_converted(self):
        """ISO string with 'Z' suffix should be parsed as UTC and stripped."""
        schema = TripCreate(**self._base_data(start_date="2025-08-01T09:00:00Z"))
        assert schema.start_date == datetime.datetime(2025, 8, 1, 9, 0, 0)
        assert schema.start_date.tzinfo is None

    def test_iso_string_with_positive_offset_converted(self):
        """ISO string with +03:00 offset must be shifted and stripped."""
        schema = TripCreate(**self._base_data(start_date="2025-08-01T12:00:00+03:00"))
        assert schema.start_date == datetime.datetime(2025, 8, 1, 9, 0, 0)
        assert schema.start_date.tzinfo is None

    def test_end_date_also_normalised(self):
        riyadh = tz(datetime.timedelta(hours=3))
        # Use a start_date that is clearly before the end_date in UTC so the
        # model_validator (end > start) never trips regardless of when the test runs.
        aware_start = datetime.datetime(2027, 8, 5, 12, 0, 0, tzinfo=riyadh)   # 09:00 UTC
        aware_end   = datetime.datetime(2027, 8, 6, 23, 59, 0, tzinfo=riyadh)  # 20:59 UTC
        schema = TripCreate(**self._base_data(start_date=aware_start, end_date=aware_end))
        assert schema.end_date == datetime.datetime(2027, 8, 6, 20, 59, 0)
        assert schema.end_date.tzinfo is None

    def test_registration_deadline_normalised(self):
        riyadh = tz(datetime.timedelta(hours=3))
        deadline = datetime.datetime(2025, 8, 1, 6, 0, 0, tzinfo=riyadh)  # 03:00 UTC
        schema = TripCreate(**self._base_data(registration_deadline=deadline))
        assert schema.registration_deadline == datetime.datetime(2025, 8, 1, 3, 0, 0)
        assert schema.registration_deadline.tzinfo is None

    def test_trip_update_normalises_aware_start_date(self):
        riyadh = tz(datetime.timedelta(hours=3))
        aware = datetime.datetime(2025, 9, 1, 15, 0, 0, tzinfo=riyadh)
        update = TripUpdate(start_date=aware)
        assert update.start_date == datetime.datetime(2025, 9, 1, 12, 0, 0)
        assert update.start_date.tzinfo is None


# ═════════════════════════════════════════════════════════════════════════════
# 3. Trip.timezone field
# ═════════════════════════════════════════════════════════════════════════════

class TestTripTimezoneField:
    """Trip.timezone stores an IANA timezone string."""

    def test_default_timezone_is_riyadh(self, client: TestClient, session: Session):
        """A trip created without explicit timezone defaults to Asia/Riyadh."""
        user, headers = user_authentication_headers(client, session, role=UserRole.SUPER_USER)
        now = _utcnow_naive()
        data = {
            "name_en": "Default TZ Trip",
            "description_en": "desc",
            "start_date": (now + datetime.timedelta(days=5)).isoformat(),
            "end_date": (now + datetime.timedelta(days=7)).isoformat(),
            "max_participants": 10,
        }
        resp = client.post(f"{settings.API_V1_STR}/trips", headers=headers, json=data)
        assert resp.status_code == 200
        assert resp.json()["timezone"] == "Asia/Riyadh"

    def test_custom_timezone_persisted(self, client: TestClient, session: Session):
        """A trip created with timezone=Europe/Paris should persist that value."""
        user, headers = user_authentication_headers(client, session, role=UserRole.SUPER_USER)
        now = _utcnow_naive()
        data = {
            "name_en": "Paris TZ Trip",
            "description_en": "desc",
            "start_date": (now + datetime.timedelta(days=5)).isoformat(),
            "end_date": (now + datetime.timedelta(days=7)).isoformat(),
            "max_participants": 10,
            "timezone": "Europe/Paris",
        }
        resp = client.post(f"{settings.API_V1_STR}/trips", headers=headers, json=data)
        assert resp.status_code == 200
        assert resp.json()["timezone"] == "Europe/Paris"

    def test_timezone_returned_in_read_response(self, client: TestClient, session: Session):
        """GET /trips must include the timezone field."""
        user, headers = user_authentication_headers(client, session, role=UserRole.SUPER_USER)
        now = _utcnow_naive()
        trip = crud.trip.create_trip(
            session=session,
            trip_in=TripCreate(
                name_en="TZ Read Trip",
                description_en="desc",
                start_date=now + datetime.timedelta(days=5),
                end_date=now + datetime.timedelta(days=7),
                max_participants=10,
                timezone="Asia/Tokyo",
            ),
            provider=user.provider,
        )
        resp = client.get(f"{settings.API_V1_STR}/trips", headers=headers)
        assert resp.status_code == 200
        trips = resp.json()
        found = next((t for t in trips if t["name_en"] == "TZ Read Trip"), None)
        assert found is not None
        assert found["timezone"] == "Asia/Tokyo"

    def test_timezone_returned_in_public_trips(self, client: TestClient, session: Session):
        """GET /public-trips must expose the timezone field."""
        user, _ = user_authentication_headers(client, session, role=UserRole.SUPER_USER)
        now = _utcnow_naive()
        trip = crud.trip.create_trip(
            session=session,
            trip_in=TripCreate(
                name_en="Public TZ Trip",
                description_en="desc",
                start_date=now + datetime.timedelta(days=5),
                end_date=now + datetime.timedelta(days=7),
                max_participants=10,
                timezone="America/New_York",
            ),
            provider=user.provider,
        )
        trip.is_active = True
        session.add(trip)
        session.commit()

        resp = client.get(f"{settings.API_V1_STR}/public-trips?search=Public+TZ+Trip")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 1
        assert data[0]["timezone"] == "America/New_York"

    def test_schema_default_timezone(self):
        """TripCreate schema default timezone is Asia/Riyadh."""
        now = _utcnow_naive()
        schema = TripCreate(
            name_en="Schema Default",
            description_en="d",
            start_date=now + datetime.timedelta(days=1),
            end_date=now + datetime.timedelta(days=2),
            max_participants=5,
        )
        assert schema.timezone == "Asia/Riyadh"


# ═════════════════════════════════════════════════════════════════════════════
# 4. _parse_search_date — provider /trips endpoint
# ═════════════════════════════════════════════════════════════════════════════

class TestProviderSearchDateParsing:
    """Provider GET /trips correctly parses offset-aware and UTC ISO date strings."""

    def test_utc_z_suffix_date_filter_matches(self, client: TestClient, session: Session):
        """start_date_from with 'Z' suffix is parsed correctly as naive UTC."""
        user, headers = user_authentication_headers(client, session, role=UserRole.SUPER_USER)
        now = _utcnow_naive()

        # Trip starting in 5 days
        crud.trip.create_trip(
            session=session,
            trip_in=TripCreate(
                name_en="Near Future Trip TZ",
                description_en="desc",
                start_date=now + datetime.timedelta(days=5),
                end_date=now + datetime.timedelta(days=7),
                max_participants=10,
            ),
            provider=user.provider,
        )
        # Trip starting in 30 days
        crud.trip.create_trip(
            session=session,
            trip_in=TripCreate(
                name_en="Far Future Trip TZ",
                description_en="desc",
                start_date=now + datetime.timedelta(days=30),
                end_date=now + datetime.timedelta(days=32),
                max_participants=10,
            ),
            provider=user.provider,
        )

        from_str = now.strftime("%Y-%m-%dT00:00:00Z")
        to_str = (now + datetime.timedelta(days=15)).strftime("%Y-%m-%dT23:59:59Z")

        resp = client.get(
            f"{settings.API_V1_STR}/trips"
            f"?start_date_from={from_str}&start_date_to={to_str}",
            headers=headers,
        )
        assert resp.status_code == 200
        names = [t["name_en"] for t in resp.json()]
        assert "Near Future Trip TZ" in names
        assert "Far Future Trip TZ" not in names

    def test_offset_aware_date_filter_converted_to_utc(self, client: TestClient, session: Session):
        """start_date_from with +03:00 offset is converted to UTC before filtering."""
        user, headers = user_authentication_headers(client, session, role=UserRole.SUPER_USER)
        now = _utcnow_naive()

        # Trip starts 5 days from now (naive UTC stored in DB)
        crud.trip.create_trip(
            session=session,
            trip_in=TripCreate(
                name_en="Offset Filter Trip",
                description_en="desc",
                start_date=now + datetime.timedelta(days=5),
                end_date=now + datetime.timedelta(days=7),
                max_participants=10,
            ),
            provider=user.provider,
        )

        # Build valid ISO 8601 strings with +03:00 offset, URL-encode + as %2B
        from_str = (now - datetime.timedelta(days=1)).strftime("%Y-%m-%dT%H:%M:%S") + "%2B03:00"
        to_str = (now + datetime.timedelta(days=10)).strftime("%Y-%m-%dT%H:%M:%S") + "%2B03:00"

        resp = client.get(
            f"{settings.API_V1_STR}/trips"
            f"?start_date_from={from_str}&start_date_to={to_str}",
            headers=headers,
        )
        assert resp.status_code == 200
        names = [t["name_en"] for t in resp.json()]
        assert "Offset Filter Trip" in names

    def test_naive_iso_date_filter(self, client: TestClient, session: Session):
        """start_date_from as plain ISO (no offset) treated as naive UTC."""
        user, headers = user_authentication_headers(client, session, role=UserRole.SUPER_USER)
        now = _utcnow_naive()

        crud.trip.create_trip(
            session=session,
            trip_in=TripCreate(
                name_en="Naive ISO Trip",
                description_en="desc",
                start_date=now + datetime.timedelta(days=5),
                end_date=now + datetime.timedelta(days=7),
                max_participants=10,
            ),
            provider=user.provider,
        )

        from_str = now.isoformat()  # plain ISO, no offset
        to_str = (now + datetime.timedelta(days=15)).isoformat()

        resp = client.get(
            f"{settings.API_V1_STR}/trips"
            f"?start_date_from={from_str}&start_date_to={to_str}",
            headers=headers,
        )
        assert resp.status_code == 200
        names = [t["name_en"] for t in resp.json()]
        assert "Naive ISO Trip" in names

    def test_date_filter_excludes_out_of_range(self, client: TestClient, session: Session):
        """Trips outside the date range are excluded even if offset is applied."""
        user, headers = user_authentication_headers(client, session, role=UserRole.SUPER_USER)
        now = _utcnow_naive()

        crud.trip.create_trip(
            session=session,
            trip_in=TripCreate(
                name_en="Way Future Trip",
                description_en="desc",
                start_date=now + datetime.timedelta(days=60),
                end_date=now + datetime.timedelta(days=62),
                max_participants=10,
            ),
            provider=user.provider,
        )

        from_str = now.strftime("%Y-%m-%dT00:00:00Z")
        to_str = (now + datetime.timedelta(days=15)).strftime("%Y-%m-%dT23:59:59Z")

        resp = client.get(
            f"{settings.API_V1_STR}/trips"
            f"?start_date_from={from_str}&start_date_to={to_str}",
            headers=headers,
        )
        assert resp.status_code == 200
        names = [t["name_en"] for t in resp.json()]
        assert "Way Future Trip" not in names


# ═════════════════════════════════════════════════════════════════════════════
# 5. _parse_search_date — public /public-trips endpoint
# ═════════════════════════════════════════════════════════════════════════════

class TestPublicSearchDateParsing:
    """Public GET /public-trips correctly parses offset-aware and UTC ISO date strings."""

    def _make_active_trip(self, session, provider, name, days_offset):
        now = _utcnow_naive()
        trip = crud.trip.create_trip(
            session=session,
            trip_in=TripCreate(
                name_en=name,
                description_en="desc",
                start_date=now + datetime.timedelta(days=days_offset),
                end_date=now + datetime.timedelta(days=days_offset + 2),
                max_participants=10,
            ),
            provider=provider,
        )
        trip.is_active = True
        session.add(trip)
        session.commit()
        return trip

    def test_public_utc_z_suffix_date_filter(self, client: TestClient, session: Session):
        """Public endpoint: 'Z' suffix date strings are parsed as UTC."""
        user, _ = user_authentication_headers(client, session, role=UserRole.SUPER_USER)
        now = _utcnow_naive()

        self._make_active_trip(session, user.provider, "Public Near Future", 5)
        self._make_active_trip(session, user.provider, "Public Far Future", 30)

        from_str = now.strftime("%Y-%m-%dT00:00:00Z")
        to_str = (now + datetime.timedelta(days=15)).strftime("%Y-%m-%dT23:59:59Z")

        resp = client.get(
            f"{settings.API_V1_STR}/public-trips"
            f"?start_date_from={from_str}&start_date_to={to_str}"
            f"&search=Public+Near+Future"
        )
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) >= 1
        assert any(t["name_en"] == "Public Near Future" for t in data)

    def test_public_offset_aware_date_filter(self, client: TestClient, session: Session):
        """Public endpoint: +03:00 offset is converted to UTC before filtering."""
        user, _ = user_authentication_headers(client, session, role=UserRole.SUPER_USER)
        now = _utcnow_naive()

        self._make_active_trip(session, user.provider, "Public Offset Trip", 5)

        from_str = (now - datetime.timedelta(days=1)).strftime("%Y-%m-%dT%H:%M:%S") + "%2B03:00"
        to_str = (now + datetime.timedelta(days=10)).strftime("%Y-%m-%dT%H:%M:%S") + "%2B03:00"

        resp = client.get(
            f"{settings.API_V1_STR}/public-trips"
            f"?start_date_from={from_str}&start_date_to={to_str}"
            f"&search=Public+Offset+Trip"
        )
        assert resp.status_code == 200
        data = resp.json()
        assert any(t["name_en"] == "Public Offset Trip" for t in data)

    def test_public_excludes_past_trips_regardless_of_date_filter(
        self, client: TestClient, session: Session
    ):
        """Public endpoint never returns past trips even when date filter spans them."""
        user, _ = user_authentication_headers(client, session, role=UserRole.SUPER_USER)
        now = _utcnow_naive()

        # Create a trip that already started
        past_trip = Trip(
            name_en="Already Started Trip",
            description_en="desc",
            start_date=now - datetime.timedelta(days=2),
            end_date=now + datetime.timedelta(days=1),
            max_participants=10,
            provider_id=user.provider.id,
            is_active=True,
        )
        session.add(past_trip)
        session.commit()

        # Very wide date range that spans the past
        from_str = (now - datetime.timedelta(days=10)).strftime("%Y-%m-%dT00:00:00Z")
        to_str = (now + datetime.timedelta(days=10)).strftime("%Y-%m-%dT23:59:59Z")

        resp = client.get(
            f"{settings.API_V1_STR}/public-trips"
            f"?start_date_from={from_str}&start_date_to={to_str}"
            f"&search=Already+Started+Trip"
        )
        assert resp.status_code == 200
        data = resp.json()
        assert not any(t["name_en"] == "Already Started Trip" for t in data)

    def test_public_date_filter_no_offset_treated_as_utc(self, client: TestClient, session: Session):
        """Naive ISO string on public endpoint is treated as UTC."""
        user, _ = user_authentication_headers(client, session, role=UserRole.SUPER_USER)
        now = _utcnow_naive()

        self._make_active_trip(session, user.provider, "Public Naive ISO Trip", 5)

        from_str = now.isoformat()
        to_str = (now + datetime.timedelta(days=15)).isoformat()

        resp = client.get(
            f"{settings.API_V1_STR}/public-trips"
            f"?start_date_from={from_str}&start_date_to={to_str}"
            f"&search=Public+Naive+ISO+Trip"
        )
        assert resp.status_code == 200
        data = resp.json()
        assert any(t["name_en"] == "Public Naive ISO Trip" for t in data)


# ═════════════════════════════════════════════════════════════════════════════
# 6. Booking guard — rejects registrations for already-started trips
# ═════════════════════════════════════════════════════════════════════════════

class TestBookingGuardUtc:
    """POST /trips/{id}/register must reject trips that have already started (UTC)."""

    def _create_package(self, session, trip_id, price=500):
        from app.models.trip_package import TripPackage
        pkg = TripPackage(
            trip_id=trip_id,
            name_en="Standard",
            description_en="desc",
            price=price,
            is_active=True,
        )
        session.add(pkg)
        session.commit()
        session.refresh(pkg)
        return pkg

    def test_register_rejects_already_started_trip(self, client: TestClient, session: Session):
        """A trip whose start_date <= UTC now must return 400."""
        prov_user, _ = user_authentication_headers(client, session, role=UserRole.SUPER_USER)
        now = _utcnow_naive()

        # Trip started 1 hour ago (UTC naive in DB)
        trip = Trip(
            name_en="Started Trip",
            description_en="desc",
            start_date=now - datetime.timedelta(hours=1),
            end_date=now + datetime.timedelta(days=2),
            max_participants=20,
            provider_id=prov_user.provider.id,
            is_active=True,
        )
        session.add(trip)
        session.commit()
        session.refresh(trip)
        self._create_package(session, trip.id)

        # Create a regular user to attempt registration
        booker, booker_headers = user_authentication_headers(client, session, role=UserRole.NORMAL)

        pkg = self._create_package(session, trip.id)
        payload = {
            "total_participants": 1,
            "total_amount": "500.00",
            "participants": [{"package_id": str(pkg.id)}],
        }
        resp = client.post(
            f"{settings.API_V1_STR}/trips/{trip.id}/register",
            headers=booker_headers,
            json=payload,
        )
        assert resp.status_code == 400
        assert "started" in resp.json()["detail"].lower() or "passed" in resp.json()["detail"].lower()

    def test_register_accepts_future_trip(self, client: TestClient, session: Session):
        """A trip that has not yet started should not be rejected by the guard."""
        prov_user, _ = user_authentication_headers(client, session, role=UserRole.SUPER_USER)
        now = _utcnow_naive()

        trip = Trip(
            name_en="Future Trip Guard",
            description_en="desc",
            start_date=now + datetime.timedelta(days=10),
            end_date=now + datetime.timedelta(days=12),
            max_participants=20,
            provider_id=prov_user.provider.id,
            is_active=True,
        )
        session.add(trip)
        session.commit()
        session.refresh(trip)
        pkg = self._create_package(session, trip.id)

        booker, booker_headers = user_authentication_headers(client, session, role=UserRole.NORMAL)

        # We only check the guard does not fire (4xx from the guard specifically)
        # Other 4xx for unrelated reasons (e.g. package fields) are acceptable
        payload = {
            "total_participants": 1,
            "total_amount": "500.00",
            "participants": [{"package_id": str(pkg.id)}],
        }
        resp = client.post(
            f"{settings.API_V1_STR}/trips/{trip.id}/register",
            headers=booker_headers,
            json=payload,
        )
        # Must NOT be "already started"
        if resp.status_code == 400:
            detail = resp.json().get("detail", "")
            assert "started" not in detail.lower()
            assert "passed" not in detail.lower()


# ═════════════════════════════════════════════════════════════════════════════
# 7. Worker UTC comparisons (regression — no datetime.utcnow() without tz)
# ═════════════════════════════════════════════════════════════════════════════

class TestWorkerUtcDatetimes:
    """
    Worker tasks must use timezone-aware UTC comparisons so they're correct
    regardless of system timezone. These tests freeze time and verify that
    reminder/review tasks operate on the correct UTC window.
    """

    @pytest.mark.asyncio
    @freeze_time("2025-06-15 12:00:00")  # UTC noon
    async def test_trip_reminders_uses_utc_window(self, session: Session):
        """send_trip_reminders targets trips starting tomorrow UTC (2025-06-16)."""
        provider = _provider_helper(session)
        user = create_random_user(session)
        user.phone = "+966501112233"
        user.is_phone_verified = True
        session.add(user)
        session.commit()

        # Trip starting tomorrow 10:00 UTC — should get a reminder
        tomorrow_utc = datetime.datetime(2025, 6, 16, 10, 0, 0)
        trip = _trip_helper(
            session, provider,
            name_en="Tomorrow UTC Trip",
            start_date=tomorrow_utc,
            end_date=tomorrow_utc + datetime.timedelta(days=2),
        )

        reg = TripRegistration(
            trip_id=trip.id,
            user_id=user.id,
            status="confirmed",
            total_participants=1,
            total_amount=Decimal("500.00"),
        )
        session.add(reg)
        session.commit()

        with patch("app.tasks.worker.Session") as mock_sess, \
             patch("app.tasks.worker.NotificationService") as mock_notif:
            mock_sess.return_value.__enter__.return_value = session
            mock_notif_instance = MagicMock()
            mock_notif_instance.send_trip_reminder = AsyncMock()
            mock_notif.return_value = mock_notif_instance

            await send_trip_reminders()

        mock_notif_instance.send_trip_reminder.assert_called_once()

    @pytest.mark.asyncio
    @freeze_time("2025-06-15 12:00:00")
    async def test_trip_reminders_does_not_fire_for_day_after_tomorrow(self, session: Session):
        """send_trip_reminders must NOT send for trips starting 2+ days away."""
        provider = _provider_helper(session)
        user = create_random_user(session)
        user.phone = "+966500001111"
        user.is_phone_verified = True
        session.add(user)
        session.commit()

        # Trip starting in 2 days — NOT tomorrow
        two_days_utc = datetime.datetime(2025, 6, 17, 10, 0, 0)
        trip = _trip_helper(
            session, provider,
            name_en="Two Days Away Trip",
            start_date=two_days_utc,
            end_date=two_days_utc + datetime.timedelta(days=2),
        )

        reg = TripRegistration(
            trip_id=trip.id,
            user_id=user.id,
            status="confirmed",
            total_participants=1,
            total_amount=Decimal("500.00"),
        )
        session.add(reg)
        session.commit()

        with patch("app.tasks.worker.Session") as mock_sess, \
             patch("app.tasks.worker.NotificationService") as mock_notif:
            mock_sess.return_value.__enter__.return_value = session
            mock_notif_instance = MagicMock()
            mock_notif_instance.send_trip_reminder = AsyncMock()
            mock_notif.return_value = mock_notif_instance

            await send_trip_reminders()

        mock_notif_instance.send_trip_reminder.assert_not_called()

    @pytest.mark.asyncio
    @freeze_time("2025-06-15 12:00:00")
    async def test_review_reminders_targets_yesterday_utc(self, session: Session):
        """send_review_reminders targets trips that ended on 2025-06-14 (yesterday UTC)."""
        provider = _provider_helper(session)
        user = create_random_user(session)
        user.phone = "+966511223344"
        user.is_phone_verified = True
        session.add(user)
        session.commit()

        # Trip that ended yesterday (2025-06-14) UTC
        yesterday_end = datetime.datetime(2025, 6, 14, 18, 0, 0)
        trip = _trip_helper(
            session, provider,
            name_en="Yesterday Ended Trip",
            start_date=datetime.datetime(2025, 6, 12, 9, 0, 0),
            end_date=yesterday_end,
        )

        reg = TripRegistration(
            trip_id=trip.id,
            user_id=user.id,
            status="confirmed",
            total_participants=1,
            total_amount=Decimal("500.00"),
        )
        session.add(reg)
        session.commit()

        with patch("app.tasks.worker.Session") as mock_sess, \
             patch("app.services.sms.sms_service") as mock_sms:
            mock_sess.return_value.__enter__.return_value = session
            mock_sms.send_sms = AsyncMock()

            await send_review_reminders()

        mock_sms.send_sms.assert_called_once()

    @pytest.mark.asyncio
    @freeze_time("2025-06-15 12:00:00")
    async def test_review_reminders_ignores_trips_ending_today(self, session: Session):
        """send_review_reminders must NOT fire for trips ending today (not yesterday)."""
        provider = _provider_helper(session)
        user = create_random_user(session)
        user.phone = "+966522334455"
        user.is_phone_verified = True
        session.add(user)
        session.commit()

        # Trip ends today — should NOT trigger a review reminder yet
        today_end = datetime.datetime(2025, 6, 15, 18, 0, 0)
        trip = _trip_helper(
            session, provider,
            name_en="Today Ending Trip",
            start_date=datetime.datetime(2025, 6, 13, 9, 0, 0),
            end_date=today_end,
        )

        reg = TripRegistration(
            trip_id=trip.id,
            user_id=user.id,
            status="confirmed",
            total_participants=1,
            total_amount=Decimal("500.00"),
        )
        session.add(reg)
        session.commit()

        with patch("app.tasks.worker.Session") as mock_sess, \
             patch("app.services.sms.sms_service") as mock_sms:
            mock_sess.return_value.__enter__.return_value = session
            mock_sms.send_sms = AsyncMock()

            await send_review_reminders()

        mock_sms.send_sms.assert_not_called()
