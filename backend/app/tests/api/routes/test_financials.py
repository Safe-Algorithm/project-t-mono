"""Tests for the financials / payouts system."""

import uuid
from datetime import datetime, timedelta
from decimal import Decimal

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session

from app.core.config import settings
from app.models.payment import Payment, PaymentStatus, PaymentMethod
from app.models.provider import Provider
from app.models.trip import Trip
from app.models.trip_package import TripPackage
from app.models.trip_registration import TripRegistration
from app.models.earning_line import EarningLine
from app.models.provider_payout import ProviderPayout, PayoutStatus
from app.models.user import User, UserRole
from app.models.source import RequestSource
from app.tests.utils.user import create_random_user, random_email, random_lower_string, TEST_PASSWORD


# ─── Shared fixtures ──────────────────────────────────────────────────────────

@pytest.fixture
def provider(session: Session) -> Provider:
    p = Provider(
        company_name="Finance Test Provider",
        company_email=random_email(),
        company_phone="0501234567",
    )
    session.add(p)
    session.commit()
    session.refresh(p)
    return p


@pytest.fixture
def admin_user(session: Session) -> User:
    return create_random_user(
        session,
        source=RequestSource.ADMIN_PANEL,
        role=UserRole.SUPER_USER,
        is_superuser=True,
    )


@pytest.fixture
def admin_headers(client: TestClient, admin_user: User) -> dict:
    r = client.post(
        f"{settings.API_V1_STR}/login/access-token",
        data={"username": admin_user.email, "password": TEST_PASSWORD},
        headers={"X-Source": "admin_panel"},
    )
    return {"Authorization": f"Bearer {r.json()['access_token']}", "X-Source": "admin_panel"}


@pytest.fixture
def provider_super_user(session: Session, provider: Provider) -> User:
    u = create_random_user(
        session,
        source=RequestSource.PROVIDERS_PANEL,
        role=UserRole.SUPER_USER,
        is_superuser=False,
        provider_id=provider.id,
    )
    return u


@pytest.fixture
def provider_headers(client: TestClient, provider_super_user: User) -> dict:
    r = client.post(
        f"{settings.API_V1_STR}/login/access-token",
        data={"username": provider_super_user.email, "password": TEST_PASSWORD},
        headers={"X-Source": "providers_panel"},
    )
    return {"Authorization": f"Bearer {r.json()['access_token']}", "X-Source": "providers_panel"}


@pytest.fixture
def mobile_user(session: Session) -> User:
    return create_random_user(session)


@pytest.fixture
def trip_non_refundable(session: Session, provider: Provider) -> Trip:
    """A non-refundable guided trip with a registration deadline in the past."""
    t = Trip(
        name_en="Non-refundable Trip",
        description_en="Test trip",
        start_date=datetime.utcnow() + timedelta(days=10),
        end_date=datetime.utcnow() + timedelta(days=12),
        registration_deadline=datetime.utcnow() - timedelta(hours=24),  # deadline passed
        max_participants=50,
        provider_id=provider.id,
    )
    session.add(t)
    session.flush()
    # is_refundable lives on TripPackage, not Trip
    pkg = TripPackage(
        trip_id=t.id,
        name_en="Standard",
        description_en="Standard package",
        price=1000.0,
        currency="SAR",
        is_refundable=False,
    )
    session.add(pkg)
    session.commit()
    session.refresh(t)
    return t


def _make_paid_registration(
    session: Session,
    trip: Trip,
    user: User,
    amount: Decimal = Decimal("1000.00"),
    status: str = "confirmed",
    paid_at_offset_hours: float = -2.0,
) -> tuple:
    reg = TripRegistration(
        trip_id=trip.id,
        user_id=user.id,
        total_participants=1,
        total_amount=amount,
        status=status,
        registration_date=datetime.utcnow() - timedelta(hours=3),
    )
    session.add(reg)
    session.flush()

    paid_at = datetime.utcnow() + timedelta(hours=paid_at_offset_hours)
    payment = Payment(
        registration_id=reg.id,
        amount=amount,
        currency="SAR",
        status=PaymentStatus.PAID,
        description="test payment",
        payment_method=PaymentMethod.CREDITCARD,
        paid_at=paid_at,
    )
    session.add(payment)
    session.commit()
    session.refresh(reg)
    return reg, payment


# ─── Commission management ────────────────────────────────────────────────────

def test_update_commission_rate(
    client: TestClient, session: Session, admin_headers: dict, provider: Provider
):
    resp = client.patch(
        f"/api/v1/admin/providers/{provider.id}/commission",
        json={"commission_rate": "15.00"},
        headers=admin_headers,
    )
    assert resp.status_code == 200
    assert resp.json()["commission_rate"] == 15.0
    session.refresh(provider)
    assert provider.commission_rate == Decimal("15.00")


def test_update_commission_rate_invalid(
    client: TestClient, admin_headers: dict, provider: Provider
):
    resp = client.patch(
        f"/api/v1/admin/providers/{provider.id}/commission",
        json={"commission_rate": "150.00"},
        headers=admin_headers,
    )
    assert resp.status_code == 400


def test_update_commission_requires_admin(
    client: TestClient, provider_headers: dict, provider: Provider
):
    resp = client.patch(
        f"/api/v1/admin/providers/{provider.id}/commission",
        json={"commission_rate": "5.00"},
        headers=provider_headers,
    )
    assert resp.status_code in (401, 403)


# ─── Earning line materialisation ─────────────────────────────────────────────

def test_non_refundable_booking_becomes_owed(
    client: TestClient, session: Session,
    admin_headers: dict, provider: Provider,
    trip_non_refundable: Trip, mobile_user: User,
):
    """A non-refundable booking paid > 1 hour ago should appear as owed."""
    _make_paid_registration(
        session, trip_non_refundable, mobile_user,
        amount=Decimal("1000.00"), paid_at_offset_hours=-2.0,
    )
    resp = client.get(
        f"/api/v1/admin/financials/providers/{provider.id}/owed",
        headers=admin_headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) >= 1
    assert data[0]["payout_id"] is None
    assert Decimal(data[0]["gross_amount"]) == Decimal("1000.00")


def test_recently_paid_non_refundable_not_owed(
    client: TestClient, session: Session,
    admin_headers: dict, provider: Provider,
    mobile_user: User,
):
    """Non-refundable booking paid only 5 min ago + deadline far away → cooling-off active → not owed."""
    # Need deadline > 24h away so cooling-off rule can fire
    trip_future_deadline = Trip(
        name_en="Future Deadline Trip",
        description_en="Test",
        start_date=datetime.utcnow() + timedelta(days=10),
        end_date=datetime.utcnow() + timedelta(days=12),
        registration_deadline=datetime.utcnow() + timedelta(days=5),  # far future
        max_participants=50,
        provider_id=provider.id,
    )
    session.add(trip_future_deadline)
    session.flush()
    pkg2 = TripPackage(
        trip_id=trip_future_deadline.id,
        name_en="Standard",
        description_en="pkg",
        price=500.0,
        currency="SAR",
        is_refundable=False,
    )
    session.add(pkg2)
    session.commit()
    session.refresh(trip_future_deadline)

    _make_paid_registration(
        session, trip_future_deadline, mobile_user,
        amount=Decimal("500.00"), paid_at_offset_hours=-0.08,  # 5 min ago
    )
    resp = client.get(
        f"/api/v1/admin/financials/providers/{provider.id}/owed",
        headers=admin_headers,
    )
    assert resp.status_code == 200
    # Booking paid 5 min ago with deadline 5 days away → cooling-off still active → NOT owed
    data = resp.json()
    for line in data:
        assert Decimal(line["gross_amount"]) != Decimal("500.00")


# ─── Admin overview ───────────────────────────────────────────────────────────

def test_overview_returns_provider_list(client: TestClient, admin_headers: dict):
    resp = client.get("/api/v1/admin/financials/overview", headers=admin_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert "providers" in data
    assert "grand_total_owed" in data
    assert "grand_total_paid_out" in data


def test_overview_requires_admin(client: TestClient, provider_headers: dict):
    resp = client.get("/api/v1/admin/financials/overview", headers=provider_headers)
    assert resp.status_code in (401, 403)


# ─── Payout creation ──────────────────────────────────────────────────────────

def test_create_and_complete_payout(
    client: TestClient, session: Session,
    admin_headers: dict, provider: Provider,
    trip_non_refundable: Trip, mobile_user: User,
):
    """Full payout flow: materialise → create → complete."""
    _make_paid_registration(
        session, trip_non_refundable, mobile_user,
        amount=Decimal("500.00"), paid_at_offset_hours=-3.0,
    )

    owed = client.get(
        f"/api/v1/admin/financials/providers/{provider.id}/owed",
        headers=admin_headers,
    ).json()
    assert len(owed) >= 1
    line_ids = [line["id"] for line in owed]

    # Create payout
    resp = client.post(
        f"/api/v1/admin/financials/providers/{provider.id}/payouts",
        json={
            "earning_line_ids": line_ids,
            "note": "Bank transfer March 27",
            "bank_transfer_reference": "REF-001",
        },
        headers=admin_headers,
    )
    assert resp.status_code == 201
    payout = resp.json()
    payout_id = payout["id"]
    assert payout["status"] == "pending"
    assert len(payout["earning_lines"]) == len(line_ids)

    # Complete payout
    resp2 = client.patch(
        f"/api/v1/admin/financials/payouts/{payout_id}/complete",
        json={"bank_transfer_reference": "REF-001-DONE"},
        headers=admin_headers,
    )
    assert resp2.status_code == 200
    assert resp2.json()["status"] == "completed"
    assert resp2.json()["paid_at"] is not None


def test_cannot_double_include_line(
    client: TestClient, session: Session,
    admin_headers: dict, provider: Provider,
    trip_non_refundable: Trip, mobile_user: User,
):
    """An earning line already in a payout cannot be added to a second payout."""
    _make_paid_registration(
        session, trip_non_refundable, mobile_user,
        amount=Decimal("300.00"), paid_at_offset_hours=-4.0,
    )
    owed = client.get(
        f"/api/v1/admin/financials/providers/{provider.id}/owed",
        headers=admin_headers,
    ).json()
    assert len(owed) >= 1
    line_ids = [owed[0]["id"]]

    client.post(
        f"/api/v1/admin/financials/providers/{provider.id}/payouts",
        json={"earning_line_ids": line_ids},
        headers=admin_headers,
    )

    # Second payout with same line — should fail
    resp = client.post(
        f"/api/v1/admin/financials/providers/{provider.id}/payouts",
        json={"earning_line_ids": line_ids},
        headers=admin_headers,
    )
    assert resp.status_code == 400


def test_create_payout_requires_admin(
    client: TestClient, provider_headers: dict, provider: Provider
):
    resp = client.post(
        f"/api/v1/admin/financials/providers/{provider.id}/payouts",
        json={"earning_line_ids": []},
        headers=provider_headers,
    )
    assert resp.status_code in (401, 403)


def test_payout_list_all(client: TestClient, admin_headers: dict):
    resp = client.get("/api/v1/admin/financials/payouts", headers=admin_headers)
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


def test_payout_list_filterable_by_provider(
    client: TestClient, admin_headers: dict, provider: Provider
):
    resp = client.get(
        f"/api/v1/admin/financials/payouts?provider_id={provider.id}",
        headers=admin_headers,
    )
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


# ─── Provider endpoints ───────────────────────────────────────────────────────

def test_provider_summary(client: TestClient, provider_headers: dict):
    resp = client.get("/api/v1/provider/financials/summary", headers=provider_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert "commission_rate" in data
    assert "total_owed" in data
    assert "total_paid_out" in data


def test_provider_earnings(client: TestClient, provider_headers: dict):
    resp = client.get("/api/v1/provider/financials/earnings", headers=provider_headers)
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


def test_provider_trips_financials(client: TestClient, provider_headers: dict):
    resp = client.get("/api/v1/provider/financials/trips", headers=provider_headers)
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


def test_provider_payouts_list(client: TestClient, provider_headers: dict):
    resp = client.get("/api/v1/provider/financials/payouts", headers=provider_headers)
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


def test_provider_cannot_see_other_provider_payout(
    client: TestClient, session: Session, provider_headers: dict
):
    """A provider cannot read a payout belonging to a different provider."""
    other_provider = Provider(
        company_name="Other Provider",
        company_email=random_email(),
        company_phone="0501111111",
    )
    session.add(other_provider)
    session.commit()

    other_payout = ProviderPayout(
        provider_id=other_provider.id,
        total_gross=Decimal("100.00"),
        total_platform_cut=Decimal("10.00"),
        total_provider_amount=Decimal("90.00"),
        booking_count=1,
        status=PayoutStatus.COMPLETED,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )
    session.add(other_payout)
    session.commit()

    resp = client.get(
        f"/api/v1/provider/financials/payouts/{other_payout.id}",
        headers=provider_headers,
    )
    assert resp.status_code in (403, 404)


# ─── Trip financial detail ────────────────────────────────────────────────────

def test_admin_trip_detail(
    client: TestClient, session: Session,
    admin_headers: dict, provider: Provider,
    trip_non_refundable: Trip, mobile_user: User,
):
    _make_paid_registration(
        session, trip_non_refundable, mobile_user,
        amount=Decimal("800.00"), paid_at_offset_hours=-5.0,
    )
    resp = client.get(
        f"/api/v1/admin/financials/trips/{trip_non_refundable.id}",
        headers=admin_headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["trip_id"] == str(trip_non_refundable.id)
    assert data["total_bookings"] >= 1
    assert "bookings" in data
    assert len(data["bookings"]) >= 1
    booking = data["bookings"][0]
    assert "user_name" in booking


def test_provider_trip_detail(
    client: TestClient, session: Session,
    provider_headers: dict, provider: Provider,
    trip_non_refundable: Trip, mobile_user: User,
):
    _make_paid_registration(
        session, trip_non_refundable, mobile_user,
        amount=Decimal("700.00"), paid_at_offset_hours=-6.0,
    )
    resp = client.get(
        f"/api/v1/provider/financials/trips/{trip_non_refundable.id}",
        headers=provider_headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["trip_id"] == str(trip_non_refundable.id)
    # Provider view — no user PII
    for booking in data.get("bookings", []):
        assert booking.get("user_email") is None


def test_provider_summary_reflects_commission_rate(
    client: TestClient, session: Session,
    admin_headers: dict, provider_headers: dict, provider: Provider,
):
    """After updating commission, provider summary shows new rate."""
    client.patch(
        f"/api/v1/admin/providers/{provider.id}/commission",
        json={"commission_rate": "20.00"},
        headers=admin_headers,
    )
    resp = client.get("/api/v1/provider/financials/summary", headers=provider_headers)
    assert resp.status_code == 200
    assert Decimal(resp.json()["commission_rate"]) == Decimal("20.00")
