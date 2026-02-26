"""
Unit tests for Trip Updates / Notifications system.
"""
import uuid
from datetime import datetime, timedelta
from decimal import Decimal

from fastapi.testclient import TestClient
from sqlmodel import Session

from app.core.config import settings
from app.models.user import UserRole
from app.models.source import RequestSource
from app.models.trip import Trip
from app.models.trip_registration import TripRegistration
from app.tests.utils.user import user_authentication_headers, create_random_user

API = settings.API_V1_STR


def _create_trip_for_provider(session: Session, provider_id: str) -> Trip:
    trip = Trip(
        name_en="Test Trip", description_en="Desc",
        start_date=datetime.utcnow(), end_date=datetime.utcnow() + timedelta(days=5),
        max_participants=20, provider_id=provider_id, is_active=True,
    )
    session.add(trip)
    session.commit()
    session.refresh(trip)
    return trip


def _create_registration(session: Session, trip_id, user_id) -> TripRegistration:
    reg = TripRegistration(
        trip_id=trip_id, user_id=user_id,
        total_participants=1, total_amount=Decimal("100.00"), status="confirmed",
    )
    session.add(reg)
    session.commit()
    session.refresh(reg)
    return reg


# ===== Provider Endpoints =====


class TestProviderTripUpdates:
    def test_provider_send_update_to_all(self, client: TestClient, session: Session):
        provider, ph = user_authentication_headers(client, session, UserRole.SUPER_USER, RequestSource.PROVIDERS_PANEL)
        trip = _create_trip_for_provider(session, provider.provider_id)
        r = client.post(f"{API}/provider/trips/{trip.id}/updates", data={
            "title": "Flight tickets ready",
            "message": "Your flight tickets are attached.",
            "is_important": "true",
        }, headers=ph)
        assert r.status_code == 200
        data = r.json()
        assert data["title"] == "Flight tickets ready"
        assert data["is_important"] is True
        assert data["registration_id"] is None

    def test_provider_send_update_to_registration(self, client: TestClient, session: Session):
        provider, ph = user_authentication_headers(client, session, UserRole.SUPER_USER, RequestSource.PROVIDERS_PANEL)
        trip = _create_trip_for_provider(session, provider.provider_id)
        user, uh = user_authentication_headers(client, session, UserRole.NORMAL, RequestSource.MOBILE_APP)
        reg = _create_registration(session, trip.id, user.id)
        r = client.post(f"{API}/provider/registrations/{reg.id}/updates", data={
            "title": "Your docs", "message": "Please check your documents.",
        }, headers=ph)
        assert r.status_code == 200
        assert r.json()["registration_id"] == str(reg.id)

    def test_other_provider_cannot_send_update(self, client: TestClient, session: Session):
        provider1, ph1 = user_authentication_headers(client, session, UserRole.SUPER_USER, RequestSource.PROVIDERS_PANEL)
        trip = _create_trip_for_provider(session, provider1.provider_id)
        provider2, ph2 = user_authentication_headers(client, session, UserRole.SUPER_USER, RequestSource.PROVIDERS_PANEL)
        r = client.post(f"{API}/provider/trips/{trip.id}/updates", data={
            "title": "X", "message": "Y",
        }, headers=ph2)
        assert r.status_code == 403

    def test_provider_list_updates_with_receipts(self, client: TestClient, session: Session):
        provider, ph = user_authentication_headers(client, session, UserRole.SUPER_USER, RequestSource.PROVIDERS_PANEL)
        trip = _create_trip_for_provider(session, provider.provider_id)
        client.post(f"{API}/provider/trips/{trip.id}/updates", data={
            "title": "U1", "message": "M1",
        }, headers=ph)
        client.post(f"{API}/provider/trips/{trip.id}/updates", data={
            "title": "U2", "message": "M2",
        }, headers=ph)
        r = client.get(f"{API}/provider/trips/{trip.id}/updates", headers=ph)
        assert r.status_code == 200
        assert len(r.json()) == 2

    def test_provider_get_receipts(self, client: TestClient, session: Session):
        provider, ph = user_authentication_headers(client, session, UserRole.SUPER_USER, RequestSource.PROVIDERS_PANEL)
        trip = _create_trip_for_provider(session, provider.provider_id)
        r = client.post(f"{API}/provider/trips/{trip.id}/updates", data={
            "title": "U1", "message": "M1",
        }, headers=ph)
        update_id = r.json()["id"]
        # Mark as read by a user
        user, uh = user_authentication_headers(client, session, UserRole.NORMAL, RequestSource.MOBILE_APP)
        _create_registration(session, trip.id, user.id)
        client.post(f"{API}/updates/{update_id}/mark-read", headers=uh)
        # Provider checks receipts
        r2 = client.get(f"{API}/provider/updates/{update_id}/receipts", headers=ph)
        assert r2.status_code == 200
        assert len(r2.json()) == 1


# ===== User Endpoints =====


class TestUserTripUpdates:
    def test_user_list_updates(self, client: TestClient, session: Session):
        provider, ph = user_authentication_headers(client, session, UserRole.SUPER_USER, RequestSource.PROVIDERS_PANEL)
        trip = _create_trip_for_provider(session, provider.provider_id)
        user, uh = user_authentication_headers(client, session, UserRole.NORMAL, RequestSource.MOBILE_APP)
        _create_registration(session, trip.id, user.id)
        client.post(f"{API}/provider/trips/{trip.id}/updates", data={
            "title": "Broadcast", "message": "For everyone",
        }, headers=ph)
        r = client.get(f"{API}/trips/{trip.id}/updates", headers=uh)
        assert r.status_code == 200
        assert len(r.json()) == 1
        assert r.json()[0]["read"] is False

    def test_user_sees_targeted_update(self, client: TestClient, session: Session):
        provider, ph = user_authentication_headers(client, session, UserRole.SUPER_USER, RequestSource.PROVIDERS_PANEL)
        trip = _create_trip_for_provider(session, provider.provider_id)
        user1, uh1 = user_authentication_headers(client, session, UserRole.NORMAL, RequestSource.MOBILE_APP)
        reg1 = _create_registration(session, trip.id, user1.id)
        user2, uh2 = user_authentication_headers(client, session, UserRole.NORMAL, RequestSource.MOBILE_APP)
        reg2 = _create_registration(session, trip.id, user2.id)
        # Send targeted update to user1 only
        client.post(f"{API}/provider/registrations/{reg1.id}/updates", data={
            "title": "For you", "message": "Only for user1",
        }, headers=ph)
        # User1 sees it
        r1 = client.get(f"{API}/trips/{trip.id}/updates", headers=uh1)
        assert len(r1.json()) == 1
        # User2 does not see it
        r2 = client.get(f"{API}/trips/{trip.id}/updates", headers=uh2)
        assert len(r2.json()) == 0

    def test_unregistered_user_cannot_see_updates(self, client: TestClient, session: Session):
        provider, ph = user_authentication_headers(client, session, UserRole.SUPER_USER, RequestSource.PROVIDERS_PANEL)
        trip = _create_trip_for_provider(session, provider.provider_id)
        user, uh = user_authentication_headers(client, session, UserRole.NORMAL, RequestSource.MOBILE_APP)
        r = client.get(f"{API}/trips/{trip.id}/updates", headers=uh)
        assert r.status_code == 403

    def test_mark_as_read(self, client: TestClient, session: Session):
        provider, ph = user_authentication_headers(client, session, UserRole.SUPER_USER, RequestSource.PROVIDERS_PANEL)
        trip = _create_trip_for_provider(session, provider.provider_id)
        user, uh = user_authentication_headers(client, session, UserRole.NORMAL, RequestSource.MOBILE_APP)
        _create_registration(session, trip.id, user.id)
        r = client.post(f"{API}/provider/trips/{trip.id}/updates", data={
            "title": "U", "message": "M",
        }, headers=ph)
        update_id = r.json()["id"]
        # Mark as read
        r2 = client.post(f"{API}/updates/{update_id}/mark-read", headers=uh)
        assert r2.status_code == 200
        # Verify read status
        r3 = client.get(f"{API}/trips/{trip.id}/updates", headers=uh)
        assert r3.json()[0]["read"] is True

    def test_mark_as_read_idempotent(self, client: TestClient, session: Session):
        provider, ph = user_authentication_headers(client, session, UserRole.SUPER_USER, RequestSource.PROVIDERS_PANEL)
        trip = _create_trip_for_provider(session, provider.provider_id)
        user, uh = user_authentication_headers(client, session, UserRole.NORMAL, RequestSource.MOBILE_APP)
        _create_registration(session, trip.id, user.id)
        r = client.post(f"{API}/provider/trips/{trip.id}/updates", data={
            "title": "U", "message": "M",
        }, headers=ph)
        update_id = r.json()["id"]
        client.post(f"{API}/updates/{update_id}/mark-read", headers=uh)
        r2 = client.post(f"{API}/updates/{update_id}/mark-read", headers=uh)
        assert r2.status_code == 200

    def test_user_cannot_mark_others_targeted_update(self, client: TestClient, session: Session):
        provider, ph = user_authentication_headers(client, session, UserRole.SUPER_USER, RequestSource.PROVIDERS_PANEL)
        trip = _create_trip_for_provider(session, provider.provider_id)
        user1, uh1 = user_authentication_headers(client, session, UserRole.NORMAL, RequestSource.MOBILE_APP)
        reg1 = _create_registration(session, trip.id, user1.id)
        user2, uh2 = user_authentication_headers(client, session, UserRole.NORMAL, RequestSource.MOBILE_APP)
        _create_registration(session, trip.id, user2.id)
        r = client.post(f"{API}/provider/registrations/{reg1.id}/updates", data={
            "title": "For user1", "message": "Only user1",
        }, headers=ph)
        update_id = r.json()["id"]
        r2 = client.post(f"{API}/updates/{update_id}/mark-read", headers=uh2)
        assert r2.status_code == 403


# ===== Admin Endpoints =====


class TestAdminTripUpdates:
    def test_admin_list_trip_updates(self, client: TestClient, session: Session):
        provider, ph = user_authentication_headers(client, session, UserRole.SUPER_USER, RequestSource.PROVIDERS_PANEL)
        trip = _create_trip_for_provider(session, provider.provider_id)
        client.post(f"{API}/provider/trips/{trip.id}/updates", data={
            "title": "U1", "message": "M1",
        }, headers=ph)
        admin, ah = user_authentication_headers(client, session, UserRole.SUPER_USER, RequestSource.ADMIN_PANEL)
        r = client.get(f"{API}/admin/trips/{trip.id}/updates", headers=ah)
        assert r.status_code == 200
        assert len(r.json()) >= 1
