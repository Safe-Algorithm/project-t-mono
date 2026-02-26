"""
Unit tests for Customer Support Ticketing System.
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
from app.models.support_ticket import SupportTicket, TripSupportTicket, TicketMessage, TicketStatus, SenderType, TicketCategory, TicketPriority
from app.tests.utils.user import user_authentication_headers, create_random_user

API = settings.API_V1_STR


def _create_trip_for_provider(session: Session, provider_id) -> Trip:
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


# ===== Admin Support Tickets (User → Admin) =====


class TestAdminSupportTickets:
    def test_user_create_ticket(self, client: TestClient, session: Session):
        user, headers = user_authentication_headers(client, session, UserRole.NORMAL, RequestSource.MOBILE_APP)
        r = client.post(f"{API}/support/tickets", json={
            "subject": "Help me", "description": "I have an issue", "category": "technical",
        }, headers=headers)
        assert r.status_code == 200
        data = r.json()
        assert data["subject"] == "Help me"
        assert data["status"] == "open"
        assert data["category"] == "technical"

    def test_user_list_tickets(self, client: TestClient, session: Session):
        user, headers = user_authentication_headers(client, session, UserRole.NORMAL, RequestSource.MOBILE_APP)
        client.post(f"{API}/support/tickets", json={"subject": "T1", "description": "D1"}, headers=headers)
        client.post(f"{API}/support/tickets", json={"subject": "T2", "description": "D2"}, headers=headers)
        r = client.get(f"{API}/support/tickets", headers=headers)
        assert r.status_code == 200
        assert len(r.json()) == 2

    def test_user_get_ticket_with_messages(self, client: TestClient, session: Session):
        user, headers = user_authentication_headers(client, session, UserRole.NORMAL, RequestSource.MOBILE_APP)
        r = client.post(f"{API}/support/tickets", json={"subject": "S", "description": "D"}, headers=headers)
        tid = r.json()["id"]
        r2 = client.get(f"{API}/support/tickets/{tid}", headers=headers)
        assert r2.status_code == 200
        assert r2.json()["messages"] == []

    def test_user_reply_ticket(self, client: TestClient, session: Session):
        user, headers = user_authentication_headers(client, session, UserRole.NORMAL, RequestSource.MOBILE_APP)
        r = client.post(f"{API}/support/tickets", json={"subject": "S", "description": "D"}, headers=headers)
        tid = r.json()["id"]
        r2 = client.post(f"{API}/support/tickets/{tid}/messages", json={"message": "Hello"}, headers=headers)
        assert r2.status_code == 200
        assert r2.json()["message"] == "Hello"
        assert r2.json()["sender_type"] == "user"

    def test_user_cannot_see_others_ticket(self, client: TestClient, session: Session):
        user1, h1 = user_authentication_headers(client, session, UserRole.NORMAL, RequestSource.MOBILE_APP)
        r = client.post(f"{API}/support/tickets", json={"subject": "S", "description": "D"}, headers=h1)
        tid = r.json()["id"]
        user2, h2 = user_authentication_headers(client, session, UserRole.NORMAL, RequestSource.MOBILE_APP)
        r2 = client.get(f"{API}/support/tickets/{tid}", headers=h2)
        assert r2.status_code == 403

    def test_admin_list_all_tickets(self, client: TestClient, session: Session):
        user, uh = user_authentication_headers(client, session, UserRole.NORMAL, RequestSource.MOBILE_APP)
        client.post(f"{API}/support/tickets", json={"subject": "S", "description": "D"}, headers=uh)
        admin, ah = user_authentication_headers(client, session, UserRole.SUPER_USER, RequestSource.ADMIN_PANEL)
        r = client.get(f"{API}/admin/support/tickets", headers=ah)
        assert r.status_code == 200
        assert len(r.json()) >= 1

    def test_admin_update_ticket(self, client: TestClient, session: Session):
        user, uh = user_authentication_headers(client, session, UserRole.NORMAL, RequestSource.MOBILE_APP)
        r = client.post(f"{API}/support/tickets", json={"subject": "S", "description": "D"}, headers=uh)
        tid = r.json()["id"]
        admin, ah = user_authentication_headers(client, session, UserRole.SUPER_USER, RequestSource.ADMIN_PANEL)
        r2 = client.patch(f"{API}/admin/support/tickets/{tid}", json={"status": "in_progress"}, headers=ah)
        assert r2.status_code == 200
        assert r2.json()["status"] == "in_progress"

    def test_admin_reply_ticket(self, client: TestClient, session: Session):
        user, uh = user_authentication_headers(client, session, UserRole.NORMAL, RequestSource.MOBILE_APP)
        r = client.post(f"{API}/support/tickets", json={"subject": "S", "description": "D"}, headers=uh)
        tid = r.json()["id"]
        admin, ah = user_authentication_headers(client, session, UserRole.SUPER_USER, RequestSource.ADMIN_PANEL)
        r2 = client.post(f"{API}/admin/support/tickets/{tid}/messages", json={"message": "Admin reply"}, headers=ah)
        assert r2.status_code == 200
        assert r2.json()["sender_type"] == "admin"

    def test_admin_get_ticket_with_messages(self, client: TestClient, session: Session):
        user, uh = user_authentication_headers(client, session, UserRole.NORMAL, RequestSource.MOBILE_APP)
        r = client.post(f"{API}/support/tickets", json={"subject": "S", "description": "D"}, headers=uh)
        tid = r.json()["id"]
        client.post(f"{API}/support/tickets/{tid}/messages", json={"message": "User msg"}, headers=uh)
        admin, ah = user_authentication_headers(client, session, UserRole.SUPER_USER, RequestSource.ADMIN_PANEL)
        client.post(f"{API}/admin/support/tickets/{tid}/messages", json={"message": "Admin msg"}, headers=ah)
        r2 = client.get(f"{API}/admin/support/tickets/{tid}", headers=ah)
        assert r2.status_code == 200
        assert len(r2.json()["messages"]) == 2

    def test_reply_closed_ticket_fails(self, client: TestClient, session: Session):
        user, uh = user_authentication_headers(client, session, UserRole.NORMAL, RequestSource.MOBILE_APP)
        r = client.post(f"{API}/support/tickets", json={"subject": "S", "description": "D"}, headers=uh)
        tid = r.json()["id"]
        admin, ah = user_authentication_headers(client, session, UserRole.SUPER_USER, RequestSource.ADMIN_PANEL)
        client.patch(f"{API}/admin/support/tickets/{tid}", json={"status": "closed"}, headers=ah)
        r2 = client.post(f"{API}/support/tickets/{tid}/messages", json={"message": "X"}, headers=uh)
        assert r2.status_code == 400

    def test_admin_filter_by_status(self, client: TestClient, session: Session):
        user, uh = user_authentication_headers(client, session, UserRole.NORMAL, RequestSource.MOBILE_APP)
        client.post(f"{API}/support/tickets", json={"subject": "S", "description": "D"}, headers=uh)
        admin, ah = user_authentication_headers(client, session, UserRole.SUPER_USER, RequestSource.ADMIN_PANEL)
        r = client.get(f"{API}/admin/support/tickets?status=open", headers=ah)
        assert r.status_code == 200
        for t in r.json():
            assert t["status"] == "open"


# ===== Trip Support Tickets (User → Provider) =====


class TestTripSupportTickets:
    def test_user_create_trip_ticket(self, client: TestClient, session: Session):
        provider, ph = user_authentication_headers(client, session, UserRole.SUPER_USER, RequestSource.PROVIDERS_PANEL)
        trip = _create_trip_for_provider(session, provider.id)
        user, uh = user_authentication_headers(client, session, UserRole.NORMAL, RequestSource.MOBILE_APP)
        _create_registration(session, trip.id, user.id)
        r = client.post(f"{API}/trips/{trip.id}/support", json={
            "subject": "Trip issue", "description": "Problem with trip",
        }, headers=uh)
        assert r.status_code == 200
        assert r.json()["subject"] == "Trip issue"
        assert r.json()["provider_id"] == str(provider.id)

    def test_unregistered_user_cannot_create_trip_ticket(self, client: TestClient, session: Session):
        provider, ph = user_authentication_headers(client, session, UserRole.SUPER_USER, RequestSource.PROVIDERS_PANEL)
        trip = _create_trip_for_provider(session, provider.id)
        user, uh = user_authentication_headers(client, session, UserRole.NORMAL, RequestSource.MOBILE_APP)
        r = client.post(f"{API}/trips/{trip.id}/support", json={
            "subject": "X", "description": "Y",
        }, headers=uh)
        assert r.status_code == 403

    def test_user_list_trip_tickets(self, client: TestClient, session: Session):
        provider, ph = user_authentication_headers(client, session, UserRole.SUPER_USER, RequestSource.PROVIDERS_PANEL)
        trip = _create_trip_for_provider(session, provider.id)
        user, uh = user_authentication_headers(client, session, UserRole.NORMAL, RequestSource.MOBILE_APP)
        _create_registration(session, trip.id, user.id)
        client.post(f"{API}/trips/{trip.id}/support", json={"subject": "T1", "description": "D1"}, headers=uh)
        r = client.get(f"{API}/trips/{trip.id}/support", headers=uh)
        assert r.status_code == 200
        assert len(r.json()) == 1

    def test_user_reply_trip_ticket(self, client: TestClient, session: Session):
        provider, ph = user_authentication_headers(client, session, UserRole.SUPER_USER, RequestSource.PROVIDERS_PANEL)
        trip = _create_trip_for_provider(session, provider.id)
        user, uh = user_authentication_headers(client, session, UserRole.NORMAL, RequestSource.MOBILE_APP)
        _create_registration(session, trip.id, user.id)
        r = client.post(f"{API}/trips/{trip.id}/support", json={"subject": "S", "description": "D"}, headers=uh)
        tid = r.json()["id"]
        r2 = client.post(f"{API}/support/trip-tickets/{tid}/messages", json={"message": "User msg"}, headers=uh)
        assert r2.status_code == 200

    def test_provider_list_tickets(self, client: TestClient, session: Session):
        provider, ph = user_authentication_headers(client, session, UserRole.SUPER_USER, RequestSource.PROVIDERS_PANEL)
        trip = _create_trip_for_provider(session, provider.id)
        user, uh = user_authentication_headers(client, session, UserRole.NORMAL, RequestSource.MOBILE_APP)
        _create_registration(session, trip.id, user.id)
        client.post(f"{API}/trips/{trip.id}/support", json={"subject": "S", "description": "D"}, headers=uh)
        r = client.get(f"{API}/provider/support/tickets", headers=ph)
        assert r.status_code == 200
        assert len(r.json()) >= 1

    def test_provider_get_ticket_detail(self, client: TestClient, session: Session):
        provider, ph = user_authentication_headers(client, session, UserRole.SUPER_USER, RequestSource.PROVIDERS_PANEL)
        trip = _create_trip_for_provider(session, provider.id)
        user, uh = user_authentication_headers(client, session, UserRole.NORMAL, RequestSource.MOBILE_APP)
        _create_registration(session, trip.id, user.id)
        r = client.post(f"{API}/trips/{trip.id}/support", json={"subject": "S", "description": "D"}, headers=uh)
        tid = r.json()["id"]
        r2 = client.get(f"{API}/provider/support/tickets/{tid}", headers=ph)
        assert r2.status_code == 200
        assert r2.json()["id"] == tid

    def test_provider_update_ticket(self, client: TestClient, session: Session):
        provider, ph = user_authentication_headers(client, session, UserRole.SUPER_USER, RequestSource.PROVIDERS_PANEL)
        trip = _create_trip_for_provider(session, provider.id)
        user, uh = user_authentication_headers(client, session, UserRole.NORMAL, RequestSource.MOBILE_APP)
        _create_registration(session, trip.id, user.id)
        r = client.post(f"{API}/trips/{trip.id}/support", json={"subject": "S", "description": "D"}, headers=uh)
        tid = r.json()["id"]
        r2 = client.patch(f"{API}/provider/support/tickets/{tid}", json={"status": "resolved"}, headers=ph)
        assert r2.status_code == 200
        assert r2.json()["status"] == "resolved"

    def test_provider_reply_ticket(self, client: TestClient, session: Session):
        provider, ph = user_authentication_headers(client, session, UserRole.SUPER_USER, RequestSource.PROVIDERS_PANEL)
        trip = _create_trip_for_provider(session, provider.id)
        user, uh = user_authentication_headers(client, session, UserRole.NORMAL, RequestSource.MOBILE_APP)
        _create_registration(session, trip.id, user.id)
        r = client.post(f"{API}/trips/{trip.id}/support", json={"subject": "S", "description": "D"}, headers=uh)
        tid = r.json()["id"]
        r2 = client.post(f"{API}/provider/support/tickets/{tid}/messages", json={"message": "Provider reply"}, headers=ph)
        assert r2.status_code == 200
        assert r2.json()["sender_type"] == "provider"

    def test_other_provider_cannot_see_ticket(self, client: TestClient, session: Session):
        provider1, ph1 = user_authentication_headers(client, session, UserRole.SUPER_USER, RequestSource.PROVIDERS_PANEL)
        trip = _create_trip_for_provider(session, provider1.id)
        user, uh = user_authentication_headers(client, session, UserRole.NORMAL, RequestSource.MOBILE_APP)
        _create_registration(session, trip.id, user.id)
        r = client.post(f"{API}/trips/{trip.id}/support", json={"subject": "S", "description": "D"}, headers=uh)
        tid = r.json()["id"]
        provider2, ph2 = user_authentication_headers(client, session, UserRole.SUPER_USER, RequestSource.PROVIDERS_PANEL)
        r2 = client.get(f"{API}/provider/support/tickets/{tid}", headers=ph2)
        assert r2.status_code == 403

    def test_provider_reply_closed_ticket_fails(self, client: TestClient, session: Session):
        provider, ph = user_authentication_headers(client, session, UserRole.SUPER_USER, RequestSource.PROVIDERS_PANEL)
        trip = _create_trip_for_provider(session, provider.id)
        user, uh = user_authentication_headers(client, session, UserRole.NORMAL, RequestSource.MOBILE_APP)
        _create_registration(session, trip.id, user.id)
        r = client.post(f"{API}/trips/{trip.id}/support", json={"subject": "S", "description": "D"}, headers=uh)
        tid = r.json()["id"]
        client.patch(f"{API}/provider/support/tickets/{tid}", json={"status": "closed"}, headers=ph)
        r2 = client.post(f"{API}/provider/support/tickets/{tid}/messages", json={"message": "X"}, headers=ph)
        assert r2.status_code == 400
