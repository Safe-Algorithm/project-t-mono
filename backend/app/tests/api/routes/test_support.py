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
from app.models.provider import Provider
from app.models.trip import Trip
from app.models.trip_registration import TripRegistration
from app.models.support_ticket import SupportTicket, TripSupportTicket, TicketMessage, TicketStatus, SenderType, TicketCategory, TicketPriority
from app.tests.utils.user import user_authentication_headers, create_random_user

API = settings.API_V1_STR


def _create_trip_for_provider(session: Session, provider_user) -> Trip:
    """Create a trip owned by provider_user, creating a Provider entity if needed."""
    # Ensure the user has a Provider entity and user.provider_id is set
    if provider_user.provider_id is None:
        p = Provider(
            company_name=f"Test Co {uuid.uuid4().hex[:6]}",
            company_email=f"prov_{uuid.uuid4().hex[:6]}@test.com",
            company_phone="0500000000",
        )
        session.add(p)
        session.flush()  # get p.id without full commit
        provider_user.provider_id = p.id
        session.add(provider_user)
        session.commit()
        session.refresh(provider_user)
        provider_entity_id = p.id
    else:
        provider_entity_id = provider_user.provider_id

    trip = Trip(
        name_en="Test Trip", description_en="Desc",
        start_date=datetime.utcnow(), end_date=datetime.utcnow() + timedelta(days=5),
        max_participants=20, provider_id=provider_entity_id, is_active=True,
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
        admin, ah = user_authentication_headers(client, session, UserRole.SUPER_USER, RequestSource.ADMIN_PANEL)
        r1 = client.post(f"{API}/support/tickets", json={"subject": "T1", "description": "D1"}, headers=headers)
        client.patch(f"{API}/admin/support/tickets/{r1.json()['id']}", json={"status": "closed"}, headers=ah)
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
        admin, ah = user_authentication_headers(client, session, UserRole.SUPER_USER, RequestSource.ADMIN_PANEL)
        client.patch(f"{API}/admin/support/tickets/{tid}", json={"status": "waiting_on_user"}, headers=ah)
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
        admin, ah = user_authentication_headers(client, session, UserRole.SUPER_USER, RequestSource.ADMIN_PANEL)
        client.patch(f"{API}/admin/support/tickets/{tid}", json={"status": "waiting_on_user"}, headers=ah)
        client.post(f"{API}/support/tickets/{tid}/messages", json={"message": "User msg"}, headers=uh)
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
        trip = _create_trip_for_provider(session, provider)
        user, uh = user_authentication_headers(client, session, UserRole.NORMAL, RequestSource.MOBILE_APP)
        _create_registration(session, trip.id, user.id)
        r = client.post(f"{API}/trips/{trip.id}/support", json={
            "subject": "Trip issue", "description": "Problem with trip",
        }, headers=uh)
        assert r.status_code == 200
        assert r.json()["subject"] == "Trip issue"
        # provider_id in the ticket is the Provider entity ID (not the User ID)
        session.refresh(provider)
        assert r.json()["provider_id"] == str(provider.provider_id)

    def test_unregistered_user_cannot_create_trip_ticket(self, client: TestClient, session: Session):
        provider, ph = user_authentication_headers(client, session, UserRole.SUPER_USER, RequestSource.PROVIDERS_PANEL)
        trip = _create_trip_for_provider(session, provider)
        user, uh = user_authentication_headers(client, session, UserRole.NORMAL, RequestSource.MOBILE_APP)
        r = client.post(f"{API}/trips/{trip.id}/support", json={
            "subject": "X", "description": "Y",
        }, headers=uh)
        assert r.status_code == 403

    def test_user_list_trip_tickets(self, client: TestClient, session: Session):
        provider, ph = user_authentication_headers(client, session, UserRole.SUPER_USER, RequestSource.PROVIDERS_PANEL)
        trip = _create_trip_for_provider(session, provider)
        user, uh = user_authentication_headers(client, session, UserRole.NORMAL, RequestSource.MOBILE_APP)
        _create_registration(session, trip.id, user.id)
        client.post(f"{API}/trips/{trip.id}/support", json={"subject": "T1", "description": "D1"}, headers=uh)
        r = client.get(f"{API}/trips/{trip.id}/support", headers=uh)
        assert r.status_code == 200
        assert len(r.json()) == 1

    def test_user_reply_trip_ticket(self, client: TestClient, session: Session):
        provider, ph = user_authentication_headers(client, session, UserRole.SUPER_USER, RequestSource.PROVIDERS_PANEL)
        trip = _create_trip_for_provider(session, provider)
        user, uh = user_authentication_headers(client, session, UserRole.NORMAL, RequestSource.MOBILE_APP)
        _create_registration(session, trip.id, user.id)
        r = client.post(f"{API}/trips/{trip.id}/support", json={"subject": "S", "description": "D"}, headers=uh)
        tid = r.json()["id"]
        # Provider sets waiting_on_user so user can reply
        client.patch(f"{API}/provider/support/tickets/{tid}", json={"status": "waiting_on_user"}, headers=ph)
        r2 = client.post(f"{API}/support/trip-tickets/{tid}/messages", json={"message": "User msg"}, headers=uh)
        assert r2.status_code == 200

    def test_provider_list_tickets(self, client: TestClient, session: Session):
        provider, ph = user_authentication_headers(client, session, UserRole.SUPER_USER, RequestSource.PROVIDERS_PANEL)
        trip = _create_trip_for_provider(session, provider)
        user, uh = user_authentication_headers(client, session, UserRole.NORMAL, RequestSource.MOBILE_APP)
        _create_registration(session, trip.id, user.id)
        client.post(f"{API}/trips/{trip.id}/support", json={"subject": "S", "description": "D"}, headers=uh)
        r = client.get(f"{API}/provider/support/tickets", headers=ph)
        assert r.status_code == 200
        assert len(r.json()) >= 1

    def test_provider_get_ticket_detail(self, client: TestClient, session: Session):
        provider, ph = user_authentication_headers(client, session, UserRole.SUPER_USER, RequestSource.PROVIDERS_PANEL)
        trip = _create_trip_for_provider(session, provider)
        user, uh = user_authentication_headers(client, session, UserRole.NORMAL, RequestSource.MOBILE_APP)
        _create_registration(session, trip.id, user.id)
        r = client.post(f"{API}/trips/{trip.id}/support", json={"subject": "S", "description": "D"}, headers=uh)
        tid = r.json()["id"]
        r2 = client.get(f"{API}/provider/support/tickets/{tid}", headers=ph)
        assert r2.status_code == 200
        assert r2.json()["id"] == tid

    def test_provider_update_ticket(self, client: TestClient, session: Session):
        provider, ph = user_authentication_headers(client, session, UserRole.SUPER_USER, RequestSource.PROVIDERS_PANEL)
        trip = _create_trip_for_provider(session, provider)
        user, uh = user_authentication_headers(client, session, UserRole.NORMAL, RequestSource.MOBILE_APP)
        _create_registration(session, trip.id, user.id)
        r = client.post(f"{API}/trips/{trip.id}/support", json={"subject": "S", "description": "D"}, headers=uh)
        tid = r.json()["id"]
        r2 = client.patch(f"{API}/provider/support/tickets/{tid}", json={"status": "resolved"}, headers=ph)
        assert r2.status_code == 200
        assert r2.json()["status"] == "resolved"

    def test_provider_reply_ticket(self, client: TestClient, session: Session):
        provider, ph = user_authentication_headers(client, session, UserRole.SUPER_USER, RequestSource.PROVIDERS_PANEL)
        trip = _create_trip_for_provider(session, provider)
        user, uh = user_authentication_headers(client, session, UserRole.NORMAL, RequestSource.MOBILE_APP)
        _create_registration(session, trip.id, user.id)
        r = client.post(f"{API}/trips/{trip.id}/support", json={"subject": "S", "description": "D"}, headers=uh)
        tid = r.json()["id"]
        r2 = client.post(f"{API}/provider/support/tickets/{tid}/messages", json={"message": "Provider reply"}, headers=ph)
        assert r2.status_code == 200
        assert r2.json()["sender_type"] == "provider"

    def test_other_provider_cannot_see_ticket(self, client: TestClient, session: Session):
        provider1, ph1 = user_authentication_headers(client, session, UserRole.SUPER_USER, RequestSource.PROVIDERS_PANEL)
        trip = _create_trip_for_provider(session, provider1)
        user, uh = user_authentication_headers(client, session, UserRole.NORMAL, RequestSource.MOBILE_APP)
        _create_registration(session, trip.id, user.id)
        r = client.post(f"{API}/trips/{trip.id}/support", json={"subject": "S", "description": "D"}, headers=uh)
        tid = r.json()["id"]
        provider2, ph2 = user_authentication_headers(client, session, UserRole.SUPER_USER, RequestSource.PROVIDERS_PANEL)
        r2 = client.get(f"{API}/provider/support/tickets/{tid}", headers=ph2)
        assert r2.status_code == 403

    def test_provider_reply_closed_ticket_fails(self, client: TestClient, session: Session):
        provider, ph = user_authentication_headers(client, session, UserRole.SUPER_USER, RequestSource.PROVIDERS_PANEL)
        trip = _create_trip_for_provider(session, provider)
        user, uh = user_authentication_headers(client, session, UserRole.NORMAL, RequestSource.MOBILE_APP)
        _create_registration(session, trip.id, user.id)
        r = client.post(f"{API}/trips/{trip.id}/support", json={"subject": "S", "description": "D"}, headers=uh)
        tid = r.json()["id"]
        client.patch(f"{API}/provider/support/tickets/{tid}", json={"status": "closed"}, headers=ph)
        r2 = client.post(f"{API}/provider/support/tickets/{tid}/messages", json={"message": "X"}, headers=ph)
        assert r2.status_code == 400

    def test_user_list_all_trip_tickets(self, client: TestClient, session: Session):
        """GET /support/trip-tickets — list all trip tickets for current user across all trips."""
        # Two different providers so the open-ticket-per-provider rule allows both tickets
        provider1, ph1 = user_authentication_headers(client, session, UserRole.SUPER_USER, RequestSource.PROVIDERS_PANEL)
        provider2, ph2 = user_authentication_headers(client, session, UserRole.SUPER_USER, RequestSource.PROVIDERS_PANEL)
        trip1 = _create_trip_for_provider(session, provider1)
        trip2 = _create_trip_for_provider(session, provider2)
        user, uh = user_authentication_headers(client, session, UserRole.NORMAL, RequestSource.MOBILE_APP)
        _create_registration(session, trip1.id, user.id)
        _create_registration(session, trip2.id, user.id)
        client.post(f"{API}/trips/{trip1.id}/support", json={"subject": "T1", "description": "D1"}, headers=uh)
        client.post(f"{API}/trips/{trip2.id}/support", json={"subject": "T2", "description": "D2"}, headers=uh)
        r = client.get(f"{API}/support/trip-tickets", headers=uh)
        assert r.status_code == 200
        assert len(r.json()) == 2
        subjects = {t["subject"] for t in r.json()}
        assert subjects == {"T1", "T2"}

    def test_user_list_all_trip_tickets_excludes_others(self, client: TestClient, session: Session):
        """GET /support/trip-tickets — does not return tickets from another user."""
        provider, ph = user_authentication_headers(client, session, UserRole.SUPER_USER, RequestSource.PROVIDERS_PANEL)
        trip = _create_trip_for_provider(session, provider)
        user1, uh1 = user_authentication_headers(client, session, UserRole.NORMAL, RequestSource.MOBILE_APP)
        user2, uh2 = user_authentication_headers(client, session, UserRole.NORMAL, RequestSource.MOBILE_APP)
        _create_registration(session, trip.id, user1.id)
        _create_registration(session, trip.id, user2.id)
        client.post(f"{API}/trips/{trip.id}/support", json={"subject": "User1 ticket", "description": "D"}, headers=uh1)
        r = client.get(f"{API}/support/trip-tickets", headers=uh2)
        assert r.status_code == 200
        assert len(r.json()) == 0

    def test_user_get_trip_ticket_by_id(self, client: TestClient, session: Session):
        """GET /support/trip-tickets/{id} — user can fetch their own ticket with messages."""
        provider, ph = user_authentication_headers(client, session, UserRole.SUPER_USER, RequestSource.PROVIDERS_PANEL)
        trip = _create_trip_for_provider(session, provider)
        user, uh = user_authentication_headers(client, session, UserRole.NORMAL, RequestSource.MOBILE_APP)
        _create_registration(session, trip.id, user.id)
        r = client.post(f"{API}/trips/{trip.id}/support", json={"subject": "Detail test", "description": "D"}, headers=uh)
        tid = r.json()["id"]
        # Provider sets waiting_on_user so user can reply
        client.patch(f"{API}/provider/support/tickets/{tid}", json={"status": "waiting_on_user"}, headers=ph)
        client.post(f"{API}/support/trip-tickets/{tid}/messages", json={"message": "My reply"}, headers=uh)
        r2 = client.get(f"{API}/support/trip-tickets/{tid}", headers=uh)
        assert r2.status_code == 200
        data = r2.json()
        assert data["id"] == tid
        assert data["subject"] == "Detail test"
        assert len(data["messages"]) == 1
        assert data["messages"][0]["message"] == "My reply"

    def test_user_cannot_get_others_trip_ticket(self, client: TestClient, session: Session):
        """GET /support/trip-tickets/{id} — 403 when accessing another user's ticket."""
        provider, ph = user_authentication_headers(client, session, UserRole.SUPER_USER, RequestSource.PROVIDERS_PANEL)
        trip = _create_trip_for_provider(session, provider)
        user1, uh1 = user_authentication_headers(client, session, UserRole.NORMAL, RequestSource.MOBILE_APP)
        user2, uh2 = user_authentication_headers(client, session, UserRole.NORMAL, RequestSource.MOBILE_APP)
        _create_registration(session, trip.id, user1.id)
        r = client.post(f"{API}/trips/{trip.id}/support", json={"subject": "S", "description": "D"}, headers=uh1)
        tid = r.json()["id"]
        r2 = client.get(f"{API}/support/trip-tickets/{tid}", headers=uh2)
        assert r2.status_code == 403


# ===== Provider → Admin Support Tickets =====


class TestProviderAdminTickets:
    def test_provider_create_admin_ticket(self, client: TestClient, session: Session):
        """POST /provider/support/admin-tickets — provider raises a ticket to admin."""
        provider, ph = user_authentication_headers(client, session, UserRole.SUPER_USER, RequestSource.PROVIDERS_PANEL)
        r = client.post(f"{API}/provider/support/admin-tickets", json={
            "subject": "Billing issue", "description": "Charge incorrect", "category": "billing",
        }, headers=ph)
        assert r.status_code == 200
        data = r.json()
        assert data["subject"] == "Billing issue"
        assert data["category"] == "billing"
        assert data["status"] == "open"

    def test_provider_list_admin_tickets(self, client: TestClient, session: Session):
        """GET /provider/support/admin-tickets — provider only sees their own tickets."""
        provider1, ph1 = user_authentication_headers(client, session, UserRole.SUPER_USER, RequestSource.PROVIDERS_PANEL)
        provider2, ph2 = user_authentication_headers(client, session, UserRole.SUPER_USER, RequestSource.PROVIDERS_PANEL)
        admin, ah = user_authentication_headers(client, session, UserRole.SUPER_USER, RequestSource.ADMIN_PANEL)
        r1 = client.post(f"{API}/provider/support/admin-tickets", json={"subject": "P1", "description": "D"}, headers=ph1)
        # Close first before opening second (1-open-ticket rule)
        client.patch(f"{API}/admin/support/tickets/{r1.json()['id']}", json={"status": "closed"}, headers=ah)
        client.post(f"{API}/provider/support/admin-tickets", json={"subject": "P2", "description": "D"}, headers=ph1)
        client.post(f"{API}/provider/support/admin-tickets", json={"subject": "Other", "description": "D"}, headers=ph2)
        r = client.get(f"{API}/provider/support/admin-tickets", headers=ph1)
        assert r.status_code == 200
        assert len(r.json()) == 2
        for t in r.json():
            assert t["subject"] in {"P1", "P2"}

    def test_provider_get_admin_ticket_with_messages(self, client: TestClient, session: Session):
        """GET /provider/support/admin-tickets/{id} — returns ticket + messages."""
        provider, ph = user_authentication_headers(client, session, UserRole.SUPER_USER, RequestSource.PROVIDERS_PANEL)
        r = client.post(f"{API}/provider/support/admin-tickets", json={"subject": "S", "description": "D"}, headers=ph)
        tid = r.json()["id"]
        r2 = client.get(f"{API}/provider/support/admin-tickets/{tid}", headers=ph)
        assert r2.status_code == 200
        assert r2.json()["id"] == tid
        assert r2.json()["messages"] == []

    def test_provider_cannot_see_another_providers_admin_ticket(self, client: TestClient, session: Session):
        """GET /provider/support/admin-tickets/{id} — 403 for tickets owned by another provider."""
        provider1, ph1 = user_authentication_headers(client, session, UserRole.SUPER_USER, RequestSource.PROVIDERS_PANEL)
        provider2, ph2 = user_authentication_headers(client, session, UserRole.SUPER_USER, RequestSource.PROVIDERS_PANEL)
        r = client.post(f"{API}/provider/support/admin-tickets", json={"subject": "S", "description": "D"}, headers=ph1)
        tid = r.json()["id"]
        r2 = client.get(f"{API}/provider/support/admin-tickets/{tid}", headers=ph2)
        assert r2.status_code == 403

    def test_provider_reply_admin_ticket(self, client: TestClient, session: Session):
        """POST /provider/support/admin-tickets/{id}/messages — provider can reply when waiting_on_user."""
        provider, ph = user_authentication_headers(client, session, UserRole.SUPER_USER, RequestSource.PROVIDERS_PANEL)
        r = client.post(f"{API}/provider/support/admin-tickets", json={"subject": "S", "description": "D"}, headers=ph)
        tid = r.json()["id"]
        admin, ah = user_authentication_headers(client, session, UserRole.SUPER_USER, RequestSource.ADMIN_PANEL)
        client.patch(f"{API}/admin/support/tickets/{tid}", json={"status": "waiting_on_user"}, headers=ah)
        r2 = client.post(f"{API}/provider/support/admin-tickets/{tid}/messages", json={"message": "More info"}, headers=ph)
        assert r2.status_code == 200
        assert r2.json()["message"] == "More info"
        assert r2.json()["sender_type"] == "provider"

    def test_provider_reply_appears_in_thread(self, client: TestClient, session: Session):
        """Admin can see provider reply in the ticket thread via admin endpoint."""
        provider, ph = user_authentication_headers(client, session, UserRole.SUPER_USER, RequestSource.PROVIDERS_PANEL)
        r = client.post(f"{API}/provider/support/admin-tickets", json={"subject": "S", "description": "D"}, headers=ph)
        tid = r.json()["id"]
        admin, ah = user_authentication_headers(client, session, UserRole.SUPER_USER, RequestSource.ADMIN_PANEL)
        client.patch(f"{API}/admin/support/tickets/{tid}", json={"status": "waiting_on_user"}, headers=ah)
        client.post(f"{API}/provider/support/admin-tickets/{tid}/messages", json={"message": "Provider detail"}, headers=ph)
        r2 = client.get(f"{API}/admin/support/tickets/{tid}", headers=ah)
        assert r2.status_code == 200
        assert len(r2.json()["messages"]) == 1
        assert r2.json()["messages"][0]["sender_type"] == "provider"

    def test_provider_reply_to_closed_admin_ticket_fails(self, client: TestClient, session: Session):
        """POST /provider/support/admin-tickets/{id}/messages — 400 when ticket is closed."""
        provider, ph = user_authentication_headers(client, session, UserRole.SUPER_USER, RequestSource.PROVIDERS_PANEL)
        r = client.post(f"{API}/provider/support/admin-tickets", json={"subject": "S", "description": "D"}, headers=ph)
        tid = r.json()["id"]
        admin, ah = user_authentication_headers(client, session, UserRole.SUPER_USER, RequestSource.ADMIN_PANEL)
        client.patch(f"{API}/admin/support/tickets/{tid}", json={"status": "closed"}, headers=ah)
        r2 = client.post(f"{API}/provider/support/admin-tickets/{tid}/messages", json={"message": "X"}, headers=ph)
        assert r2.status_code == 400

    def test_normal_user_cannot_access_provider_admin_endpoints(self, client: TestClient, session: Session):
        """Provider→admin endpoints require provider auth — regular users are rejected."""
        user, uh = user_authentication_headers(client, session, UserRole.NORMAL, RequestSource.MOBILE_APP)
        r = client.post(f"{API}/provider/support/admin-tickets", json={"subject": "S", "description": "D"}, headers=uh)
        assert r.status_code in {401, 403}
        r2 = client.get(f"{API}/provider/support/admin-tickets", headers=uh)
        assert r2.status_code in {401, 403}

    def test_provider_admin_ticket_visible_to_admin(self, client: TestClient, session: Session):
        """Tickets created via /provider/support/admin-tickets appear in /admin/support/tickets."""
        provider, ph = user_authentication_headers(client, session, UserRole.SUPER_USER, RequestSource.PROVIDERS_PANEL)
        r = client.post(f"{API}/provider/support/admin-tickets", json={
            "subject": "Provider complaint", "description": "Something wrong",
        }, headers=ph)
        tid = r.json()["id"]
        admin, ah = user_authentication_headers(client, session, UserRole.SUPER_USER, RequestSource.ADMIN_PANEL)
        r2 = client.get(f"{API}/admin/support/tickets", headers=ah)
        assert r2.status_code == 200
        ids = [t["id"] for t in r2.json()]
        assert tid in ids


# ===== New Business Rules =====


class TestTicketBusinessRules:
    # ── Rule 1: user/provider can only reply when status is waiting_on_user ──

    def test_user_cannot_reply_when_status_is_open(self, client: TestClient, session: Session):
        """User reply blocked unless ticket is waiting_on_user."""
        user, uh = user_authentication_headers(client, session, UserRole.NORMAL, RequestSource.MOBILE_APP)
        r = client.post(f"{API}/support/tickets", json={"subject": "S", "description": "D"}, headers=uh)
        tid = r.json()["id"]
        r2 = client.post(f"{API}/support/tickets/{tid}/messages", json={"message": "Hi"}, headers=uh)
        assert r2.status_code == 400

    def test_user_cannot_reply_when_status_is_in_progress(self, client: TestClient, session: Session):
        """User reply blocked when status is in_progress."""
        user, uh = user_authentication_headers(client, session, UserRole.NORMAL, RequestSource.MOBILE_APP)
        r = client.post(f"{API}/support/tickets", json={"subject": "S", "description": "D"}, headers=uh)
        tid = r.json()["id"]
        admin, ah = user_authentication_headers(client, session, UserRole.SUPER_USER, RequestSource.ADMIN_PANEL)
        client.patch(f"{API}/admin/support/tickets/{tid}", json={"status": "in_progress"}, headers=ah)
        r2 = client.post(f"{API}/support/tickets/{tid}/messages", json={"message": "Hi"}, headers=uh)
        assert r2.status_code == 400

    def test_user_can_reply_when_waiting_on_user(self, client: TestClient, session: Session):
        """User reply allowed when status is waiting_on_user."""
        user, uh = user_authentication_headers(client, session, UserRole.NORMAL, RequestSource.MOBILE_APP)
        r = client.post(f"{API}/support/tickets", json={"subject": "S", "description": "D"}, headers=uh)
        tid = r.json()["id"]
        admin, ah = user_authentication_headers(client, session, UserRole.SUPER_USER, RequestSource.ADMIN_PANEL)
        client.patch(f"{API}/admin/support/tickets/{tid}", json={"status": "waiting_on_user"}, headers=ah)
        r2 = client.post(f"{API}/support/tickets/{tid}/messages", json={"message": "Here is the info"}, headers=uh)
        assert r2.status_code == 200

    def test_user_cannot_reply_trip_ticket_when_open(self, client: TestClient, session: Session):
        """User reply on trip ticket blocked unless status is waiting_on_user."""
        provider, ph = user_authentication_headers(client, session, UserRole.SUPER_USER, RequestSource.PROVIDERS_PANEL)
        trip = _create_trip_for_provider(session, provider)
        user, uh = user_authentication_headers(client, session, UserRole.NORMAL, RequestSource.MOBILE_APP)
        _create_registration(session, trip.id, user.id)
        r = client.post(f"{API}/trips/{trip.id}/support", json={"subject": "S", "description": "D"}, headers=uh)
        tid = r.json()["id"]
        r2 = client.post(f"{API}/support/trip-tickets/{tid}/messages", json={"message": "Hi"}, headers=uh)
        assert r2.status_code == 400

    # ── Rule 2: 1 open admin ticket per user ──

    def test_user_cannot_open_second_admin_ticket_while_first_is_open(self, client: TestClient, session: Session):
        """Creating a second admin ticket is blocked when the first is not closed/resolved."""
        user, uh = user_authentication_headers(client, session, UserRole.NORMAL, RequestSource.MOBILE_APP)
        client.post(f"{API}/support/tickets", json={"subject": "First", "description": "D"}, headers=uh)
        r2 = client.post(f"{API}/support/tickets", json={"subject": "Second", "description": "D"}, headers=uh)
        assert r2.status_code == 400

    def test_user_can_open_new_admin_ticket_after_previous_is_resolved(self, client: TestClient, session: Session):
        """Creating a new admin ticket is allowed once the previous one is resolved."""
        user, uh = user_authentication_headers(client, session, UserRole.NORMAL, RequestSource.MOBILE_APP)
        r1 = client.post(f"{API}/support/tickets", json={"subject": "First", "description": "D"}, headers=uh)
        admin, ah = user_authentication_headers(client, session, UserRole.SUPER_USER, RequestSource.ADMIN_PANEL)
        client.patch(f"{API}/admin/support/tickets/{r1.json()['id']}", json={"status": "resolved"}, headers=ah)
        r2 = client.post(f"{API}/support/tickets", json={"subject": "Second", "description": "D"}, headers=uh)
        assert r2.status_code == 200

    # ── Rule 2: 1 open trip ticket per provider ──

    def test_user_cannot_open_second_trip_ticket_for_same_provider(self, client: TestClient, session: Session):
        """User blocked from opening a second ticket with the same provider while first is open."""
        provider, ph = user_authentication_headers(client, session, UserRole.SUPER_USER, RequestSource.PROVIDERS_PANEL)
        trip1 = _create_trip_for_provider(session, provider)
        trip2 = _create_trip_for_provider(session, provider)
        user, uh = user_authentication_headers(client, session, UserRole.NORMAL, RequestSource.MOBILE_APP)
        _create_registration(session, trip1.id, user.id)
        _create_registration(session, trip2.id, user.id)
        client.post(f"{API}/trips/{trip1.id}/support", json={"subject": "First", "description": "D"}, headers=uh)
        r2 = client.post(f"{API}/trips/{trip2.id}/support", json={"subject": "Second", "description": "D"}, headers=uh)
        assert r2.status_code == 400

    def test_user_can_open_trip_ticket_for_different_providers(self, client: TestClient, session: Session):
        """User can have 1 open ticket per provider simultaneously."""
        provider1, ph1 = user_authentication_headers(client, session, UserRole.SUPER_USER, RequestSource.PROVIDERS_PANEL)
        provider2, ph2 = user_authentication_headers(client, session, UserRole.SUPER_USER, RequestSource.PROVIDERS_PANEL)
        trip1 = _create_trip_for_provider(session, provider1)
        trip2 = _create_trip_for_provider(session, provider2)
        user, uh = user_authentication_headers(client, session, UserRole.NORMAL, RequestSource.MOBILE_APP)
        _create_registration(session, trip1.id, user.id)
        _create_registration(session, trip2.id, user.id)
        r1 = client.post(f"{API}/trips/{trip1.id}/support", json={"subject": "P1 ticket", "description": "D"}, headers=uh)
        r2 = client.post(f"{API}/trips/{trip2.id}/support", json={"subject": "P2 ticket", "description": "D"}, headers=uh)
        assert r1.status_code == 200
        assert r2.status_code == 200

    # ── Rule 3: cancelled booking — list tickets OK, create blocked ──

    def test_cancelled_booking_can_list_existing_tickets(self, client: TestClient, session: Session):
        """User with a cancelled booking can still see their existing tickets."""
        provider, ph = user_authentication_headers(client, session, UserRole.SUPER_USER, RequestSource.PROVIDERS_PANEL)
        trip = _create_trip_for_provider(session, provider)
        user, uh = user_authentication_headers(client, session, UserRole.NORMAL, RequestSource.MOBILE_APP)
        reg = _create_registration(session, trip.id, user.id)
        # Create ticket while booking is active
        client.post(f"{API}/trips/{trip.id}/support", json={"subject": "Before cancel", "description": "D"}, headers=uh)
        # Cancel the booking
        reg.status = "cancelled"
        session.add(reg)
        session.commit()
        # Listing should still work
        r = client.get(f"{API}/trips/{trip.id}/support", headers=uh)
        assert r.status_code == 200
        assert len(r.json()) == 1

    def test_cancelled_booking_cannot_open_new_ticket(self, client: TestClient, session: Session):
        """User with only a cancelled booking cannot open a new support ticket."""
        provider, ph = user_authentication_headers(client, session, UserRole.SUPER_USER, RequestSource.PROVIDERS_PANEL)
        trip = _create_trip_for_provider(session, provider)
        user, uh = user_authentication_headers(client, session, UserRole.NORMAL, RequestSource.MOBILE_APP)
        reg = _create_registration(session, trip.id, user.id)
        reg.status = "cancelled"
        session.add(reg)
        session.commit()
        r = client.post(f"{API}/trips/{trip.id}/support", json={"subject": "After cancel", "description": "D"}, headers=uh)
        assert r.status_code == 403
