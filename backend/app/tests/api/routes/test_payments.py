"""Tests for payment API routes — /prepare, /confirm, /callback, /webhook, /refund."""

import uuid
import datetime
from decimal import Decimal
from unittest.mock import AsyncMock, patch, MagicMock

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, select

from app.core.config import settings
from app.models.payment import Payment, PaymentStatus, PaymentMethod
from app.models.provider import Provider
from app.models.trip import Trip
from app.models.trip_package import TripPackage
from app.models.trip_registration import TripRegistration
from app.models.user import User
from app.tests.utils.user import create_random_user


# ── Fixtures ──────────────────────────────────────────────────────────────────

@pytest.fixture
def test_user(session: Session) -> User:
    return create_random_user(session)


@pytest.fixture
def test_trip(session: Session) -> Trip:
    provider = Provider(
        company_name="Test Provider",
        company_email="test@provider.com",
        company_phone="0501234567",
        bio_en="Test bio",
        bio_ar="Test bio AR",
    )
    session.add(provider)
    session.commit()
    session.refresh(provider)

    trip = Trip(
        name_en="Test Trip",
        description_en="Test Description",
        start_date=datetime.datetime.utcnow() + datetime.timedelta(days=30),
        end_date=datetime.datetime.utcnow() + datetime.timedelta(days=35),
        max_participants=10,
        provider_id=provider.id,
    )
    session.add(trip)
    session.commit()
    session.refresh(trip)

    package = TripPackage(
        trip_id=trip.id,
        name_en="Standard Package",
        description_en="Standard package",
        price=100.0,
        currency="SAR",
    )
    session.add(package)
    session.commit()
    return trip


@pytest.fixture
def auth_headers(client: TestClient, test_user: User) -> dict:
    response = client.post(
        f"{settings.API_V1_STR}/login/access-token",
        data={"username": test_user.email, "password": "password123"},
        headers={"X-Source": "mobile_app"},
    )
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}", "X-Source": "mobile_app"}


@pytest.fixture
def pending_registration(session: Session, test_user: User, test_trip: Trip) -> TripRegistration:
    """A registration in pending_payment status with an active spot reservation."""
    reg = TripRegistration(
        trip_id=test_trip.id,
        user_id=test_user.id,
        total_participants=1,
        total_amount=Decimal("100.00"),
        status="pending_payment",
        spot_reserved_until=datetime.datetime.utcnow() + datetime.timedelta(minutes=15),
    )
    session.add(reg)
    session.commit()
    session.refresh(reg)
    return reg


@pytest.fixture
def test_payment(session: Session, pending_registration: TripRegistration) -> Payment:
    """An INITIATED payment linked to a pending_payment registration."""
    payment = Payment(
        registration_id=pending_registration.id,
        amount=Decimal("100.00"),
        currency="SAR",
        status=PaymentStatus.INITIATED,
        payment_method=PaymentMethod.CREDITCARD,
        description="Test payment",
        moyasar_payment_id="pay_test_123",
        callback_url="rihlaapp://payment-callback",
    )
    session.add(payment)
    session.commit()
    session.refresh(payment)
    return payment


# ── POST /payments/prepare ────────────────────────────────────────────────────

def test_prepare_payment_success(
    client: TestClient,
    session: Session,
    pending_registration: TripRegistration,
    auth_headers: dict,
):
    """prepare returns payment_db_id, amount_halalas, and a callback_url."""
    response = client.post(
        "/api/v1/payments/prepare",
        json={
            "registration_id": str(pending_registration.id),
            "payment_method": "creditcard",
            "redirect_url": "rihlaapp://payment-callback",
        },
        headers=auth_headers,
    )

    assert response.status_code == 201
    data = response.json()
    assert "payment_db_id" in data
    assert data["amount_halalas"] == 10000  # 100.00 SAR * 100
    assert data["currency"] == "SAR"
    assert "callback_url" in data

    # Stale INITIATED payments should be cancelled; a new one created
    payments = session.exec(
        select(Payment).where(Payment.registration_id == pending_registration.id)
    ).all()
    assert any(p.status == PaymentStatus.INITIATED for p in payments)


def test_prepare_payment_registration_not_found(client: TestClient, auth_headers: dict):
    response = client.post(
        "/api/v1/payments/prepare",
        json={"registration_id": str(uuid.uuid4()), "payment_method": "creditcard"},
        headers=auth_headers,
    )
    assert response.status_code == 404


def test_prepare_payment_wrong_user(
    client: TestClient,
    session: Session,
    test_trip: Trip,
    auth_headers: dict,
):
    """Cannot prepare payment for another user's registration."""
    other = User(
        email="other2@example.com",
        phone="+966501234568",
        hashed_password="hashed",
        name="Other",
        source="mobile_app",
    )
    session.add(other)
    session.commit()

    reg = TripRegistration(
        trip_id=test_trip.id,
        user_id=other.id,
        total_participants=1,
        total_amount=Decimal("100.00"),
        status="pending_payment",
        spot_reserved_until=datetime.datetime.utcnow() + datetime.timedelta(minutes=15),
    )
    session.add(reg)
    session.commit()

    response = client.post(
        "/api/v1/payments/prepare",
        json={"registration_id": str(reg.id), "payment_method": "creditcard"},
        headers=auth_headers,
    )
    assert response.status_code == 403


def test_prepare_payment_not_pending(
    client: TestClient,
    session: Session,
    test_user: User,
    test_trip: Trip,
    auth_headers: dict,
):
    """prepare rejects registrations that are not in pending_payment status."""
    reg = TripRegistration(
        trip_id=test_trip.id,
        user_id=test_user.id,
        total_participants=1,
        total_amount=Decimal("100.00"),
        status="confirmed",
    )
    session.add(reg)
    session.commit()

    response = client.post(
        "/api/v1/payments/prepare",
        json={"registration_id": str(reg.id), "payment_method": "creditcard"},
        headers=auth_headers,
    )
    assert response.status_code == 400
    assert "not pending payment" in response.json()["detail"].lower()


def test_prepare_payment_already_paid(
    client: TestClient,
    session: Session,
    pending_registration: TripRegistration,
    auth_headers: dict,
):
    """prepare rejects if a PAID payment already exists for the registration."""
    paid = Payment(
        registration_id=pending_registration.id,
        amount=Decimal("100.00"),
        currency="SAR",
        status=PaymentStatus.PAID,
        description="Already paid",
    )
    session.add(paid)
    session.commit()

    response = client.post(
        "/api/v1/payments/prepare",
        json={"registration_id": str(pending_registration.id), "payment_method": "creditcard"},
        headers=auth_headers,
    )
    assert response.status_code == 400
    assert "already completed" in response.json()["detail"].lower()


def test_prepare_payment_cancels_stale_initiated(
    client: TestClient,
    session: Session,
    pending_registration: TripRegistration,
    auth_headers: dict,
):
    """prepare cancels any stale INITIATED payments before creating a new one."""
    stale = Payment(
        registration_id=pending_registration.id,
        amount=Decimal("100.00"),
        currency="SAR",
        status=PaymentStatus.INITIATED,
        description="Stale attempt",
    )
    session.add(stale)
    session.commit()

    response = client.post(
        "/api/v1/payments/prepare",
        json={"registration_id": str(pending_registration.id), "payment_method": "creditcard"},
        headers=auth_headers,
    )
    assert response.status_code == 201

    session.refresh(stale)
    assert stale.status == PaymentStatus.FAILED


def test_prepare_payment_requires_auth(client: TestClient):
    response = client.post(
        "/api/v1/payments/prepare",
        json={"registration_id": str(uuid.uuid4()), "payment_method": "creditcard"},
    )
    assert response.status_code == 401


# ── POST /payments/confirm ────────────────────────────────────────────────────

def test_confirm_payment_success(
    client: TestClient,
    session: Session,
    test_payment: Payment,
    auth_headers: dict,
):
    """confirm stores the Moyasar payment ID on the payment record."""
    moyasar_id = "moy_abc123"
    response = client.post(
        "/api/v1/payments/confirm",
        params={"payment_db_id": str(test_payment.id), "moyasar_payment_id": moyasar_id},
        headers=auth_headers,
    )
    assert response.status_code == 200
    assert response.json()["ok"] is True

    session.refresh(test_payment)
    assert test_payment.moyasar_payment_id == moyasar_id


def test_confirm_payment_not_found(client: TestClient, auth_headers: dict):
    response = client.post(
        "/api/v1/payments/confirm",
        params={"payment_db_id": str(uuid.uuid4()), "moyasar_payment_id": "moy_x"},
        headers=auth_headers,
    )
    assert response.status_code == 404


# ── GET /payments/callback ────────────────────────────────────────────────────

def test_callback_paid_updates_db_and_returns_html(
    client: TestClient,
    session: Session,
    test_payment: Payment,
):
    """Callback for a paid payment updates DB and returns HTML with deep link."""
    mock_details = {
        "payment_id": test_payment.moyasar_payment_id,
        "status": "paid",
        "amount": 10000,
        "currency": "SAR",
        "fee": 300,
    }

    with patch(
        "app.api.routes.payments.payment_service.get_payment_details",
        new_callable=AsyncMock,
    ) as mock_get:
        mock_get.return_value = mock_details
        response = client.get(
            f"/api/v1/payments/callback?id={test_payment.moyasar_payment_id}"
        )

    assert response.status_code == 200
    assert "text/html" in response.headers["content-type"]
    assert "rihlaapp://payment-callback" in response.text
    assert "paid" in response.text

    session.refresh(test_payment)
    assert test_payment.status == PaymentStatus.PAID
    assert test_payment.paid_at is not None
    assert test_payment.fee == Decimal("3.00")  # 300 halalas / 100

    reg = session.get(TripRegistration, test_payment.registration_id)
    assert reg.status == "confirmed"


def test_callback_failed_updates_db(
    client: TestClient,
    session: Session,
    test_payment: Payment,
):
    """Callback for a failed payment marks it FAILED."""
    mock_details = {
        "payment_id": test_payment.moyasar_payment_id,
        "status": "failed",
        "amount": 10000,
        "currency": "SAR",
    }

    with patch(
        "app.api.routes.payments.payment_service.get_payment_details",
        new_callable=AsyncMock,
    ) as mock_get:
        mock_get.return_value = mock_details
        response = client.get(
            f"/api/v1/payments/callback?id={test_payment.moyasar_payment_id}"
        )

    assert response.status_code == 200
    session.refresh(test_payment)
    assert test_payment.status == PaymentStatus.FAILED
    assert test_payment.failed_at is not None


def test_callback_uses_stored_redirect_url(
    client: TestClient,
    session: Session,
    test_payment: Payment,
):
    """The HTML deep link uses the redirect_url stored at /prepare time."""
    custom_redirect = "myapp://custom-callback"
    test_payment.callback_url = custom_redirect
    session.add(test_payment)
    session.commit()

    mock_details = {
        "payment_id": test_payment.moyasar_payment_id,
        "status": "paid",
        "amount": 10000,
        "currency": "SAR",
    }

    with patch(
        "app.api.routes.payments.payment_service.get_payment_details",
        new_callable=AsyncMock,
    ) as mock_get:
        mock_get.return_value = mock_details
        response = client.get(
            f"/api/v1/payments/callback?id={test_payment.moyasar_payment_id}"
        )

    assert response.status_code == 200
    assert custom_redirect in response.text


def test_callback_payment_not_found(client: TestClient):
    with patch(
        "app.api.routes.payments.payment_service.get_payment_details",
        new_callable=AsyncMock,
    ) as mock_get:
        mock_get.return_value = {"payment_id": "unknown", "status": "paid"}
        response = client.get("/api/v1/payments/callback?id=unknown_id")

    assert response.status_code == 404


# ── POST /payments/webhook ────────────────────────────────────────────────────

def test_webhook_paid_updates_registration(
    client: TestClient,
    session: Session,
    test_payment: Payment,
):
    payload = {
        "id": test_payment.moyasar_payment_id,
        "status": "paid",
        "amount": 10000,
        "fee": 300,
        "currency": "SAR",
        "description": "Test",
        "created_at": "2024-01-01T00:00:00Z",
        "updated_at": "2024-01-01T00:00:00Z",
        "source": {"type": "creditcard"},
    }

    with patch(
        "app.api.routes.payments.payment_service.verify_webhook_signature",
        return_value=True,
    ):
        response = client.post(
            "/api/v1/payments/webhook",
            json=payload,
            headers={"X-Moyasar-Signature": "valid"},
        )

    assert response.status_code == 200
    session.refresh(test_payment)
    assert test_payment.status == PaymentStatus.PAID

    reg = session.get(TripRegistration, test_payment.registration_id)
    assert reg.status == "confirmed"


def test_webhook_refunded_cancels_registration(
    client: TestClient,
    session: Session,
    test_payment: Payment,
):
    test_payment.status = PaymentStatus.PAID
    session.add(test_payment)
    session.commit()

    payload = {
        "id": test_payment.moyasar_payment_id,
        "status": "refunded",
        "amount": 10000,
        "refunded": 10000,
        "currency": "SAR",
        "description": "Test",
        "created_at": "2024-01-01T00:00:00Z",
        "updated_at": "2024-01-01T00:00:00Z",
        "source": {"type": "creditcard"},
    }

    with patch(
        "app.api.routes.payments.payment_service.verify_webhook_signature",
        return_value=True,
    ):
        response = client.post(
            "/api/v1/payments/webhook",
            json=payload,
            headers={"X-Moyasar-Signature": "valid"},
        )

    assert response.status_code == 200
    session.refresh(test_payment)
    assert test_payment.status == PaymentStatus.REFUNDED

    reg = session.get(TripRegistration, test_payment.registration_id)
    assert reg.status == "cancelled"


def test_webhook_invalid_signature(client: TestClient, test_payment: Payment):
    with patch(
        "app.api.routes.payments.payment_service.verify_webhook_signature",
        return_value=False,
    ):
        response = client.post(
            "/api/v1/payments/webhook",
            json={"id": test_payment.moyasar_payment_id, "status": "paid"},
            headers={"X-Moyasar-Signature": "bad"},
        )
    assert response.status_code == 401


def test_webhook_missing_signature(client: TestClient, test_payment: Payment):
    response = client.post(
        "/api/v1/payments/webhook",
        json={"id": test_payment.moyasar_payment_id, "status": "paid"},
    )
    assert response.status_code == 400


def test_webhook_unknown_payment_acknowledged(client: TestClient):
    """Valid signature but unknown Moyasar ID — should return 200 and acknowledge."""
    with patch(
        "app.api.routes.payments.payment_service.verify_webhook_signature",
        return_value=True,
    ):
        response = client.post(
            "/api/v1/payments/webhook",
            json={"id": "unknown_moy_id", "status": "paid"},
            headers={"X-Moyasar-Signature": "valid"},
        )
    assert response.status_code == 200


# ── GET /payments/{payment_id} ────────────────────────────────────────────────

def test_get_payment_success(
    client: TestClient,
    test_payment: Payment,
    auth_headers: dict,
):
    response = client.get(f"/api/v1/payments/{test_payment.id}", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == str(test_payment.id)
    assert float(data["amount"]) == 100.0


def test_get_payment_not_found(client: TestClient, auth_headers: dict):
    response = client.get(f"/api/v1/payments/{uuid.uuid4()}", headers=auth_headers)
    assert response.status_code == 404


# ── GET /payments/registration/{registration_id} ──────────────────────────────

def test_get_payments_by_registration(
    client: TestClient,
    test_payment: Payment,
    auth_headers: dict,
):
    response = client.get(
        f"/api/v1/payments/registration/{test_payment.registration_id}",
        headers=auth_headers,
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["id"] == str(test_payment.id)


# ── POST /payments/{payment_id}/refund ────────────────────────────────────────

def test_refund_payment_success(
    client: TestClient,
    session: Session,
    test_payment: Payment,
    auth_headers: dict,
):
    test_payment.status = PaymentStatus.PAID
    session.add(test_payment)
    session.commit()

    mock_refund = {
        "payment_id": test_payment.moyasar_payment_id,
        "status": "refunded",
        "amount": 10000,
        "refunded": True,
        "refunded_at": "2024-01-01T00:00:00Z",
    }

    with patch(
        "app.api.routes.payments.payment_service.refund_payment",
        new_callable=AsyncMock,
        return_value=mock_refund,
    ):
        response = client.post(
            f"/api/v1/payments/{test_payment.id}/refund",
            json={"description": "Customer request"},
            headers=auth_headers,
        )

    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "refunded"
    assert data["refunded"] is True

    reg = session.get(TripRegistration, test_payment.registration_id)
    assert reg.status == "cancelled"


def test_refund_payment_not_paid(
    client: TestClient,
    test_payment: Payment,
    auth_headers: dict,
):
    response = client.post(
        f"/api/v1/payments/{test_payment.id}/refund",
        json={},
        headers=auth_headers,
    )
    assert response.status_code == 400
    assert "paid" in response.json()["detail"].lower()


def test_refund_payment_already_refunded(
    client: TestClient,
    session: Session,
    test_payment: Payment,
    auth_headers: dict,
):
    test_payment.status = PaymentStatus.PAID
    test_payment.refunded = True
    session.add(test_payment)
    session.commit()

    response = client.post(
        f"/api/v1/payments/{test_payment.id}/refund",
        json={},
        headers=auth_headers,
    )
    assert response.status_code == 400
    assert "already refunded" in response.json()["detail"].lower()


# ── Confirmation email after payment ─────────────────────────────────────────

def test_callback_paid_triggers_confirmation_email(
    client: TestClient,
    session: Session,
    test_payment: Payment,
    test_user: User,
):
    """After a paid callback, send_booking_confirmation_email is scheduled."""
    mock_details = {
        "status": "paid",
        "amount": 10000,
        "currency": "SAR",
    }

    with patch(
        "app.api.routes.payments.payment_service.get_payment_details",
        new_callable=AsyncMock,
    ) as mock_get, patch(
        "app.services.email.email_service.send_booking_confirmation_email",
        new_callable=AsyncMock,
    ) as mock_email, patch(
        "asyncio.create_task",
        side_effect=lambda coro: coro,
    ):
        mock_get.return_value = mock_details
        response = client.get(
            f"/api/v1/payments/callback?id={test_payment.moyasar_payment_id}"
        )

    assert response.status_code == 200
    reg = session.get(TripRegistration, test_payment.registration_id)
    assert reg.status == "confirmed"
    mock_email.assert_called_once()
    call_kwargs = mock_email.call_args.kwargs
    assert call_kwargs["to_email"] == test_user.email
    assert call_kwargs["language"] in ("en", "ar")


def test_callback_failed_does_not_send_email(
    client: TestClient,
    session: Session,
    test_payment: Payment,
):
    """A failed callback must NOT send a confirmation email."""
    mock_details = {"status": "failed", "amount": 10000, "currency": "SAR"}

    with patch(
        "app.api.routes.payments.payment_service.get_payment_details",
        new_callable=AsyncMock,
    ) as mock_get, patch(
        "app.services.email.email_service.send_booking_confirmation_email",
        new_callable=AsyncMock,
    ) as mock_email, patch(
        "asyncio.create_task",
        side_effect=lambda coro: coro,
    ):
        mock_get.return_value = mock_details
        client.get(f"/api/v1/payments/callback?id={test_payment.moyasar_payment_id}")

    mock_email.assert_not_called()


def test_webhook_paid_triggers_confirmation_email(
    client: TestClient,
    session: Session,
    test_payment: Payment,
    test_user: User,
):
    """After a paid webhook, send_booking_confirmation_email is scheduled."""
    payload = {
        "id": test_payment.moyasar_payment_id,
        "status": "paid",
        "amount": 10000,
        "fee": 0,
        "currency": "SAR",
        "description": "Test",
        "created_at": "2024-01-01T00:00:00Z",
        "updated_at": "2024-01-01T00:00:00Z",
        "source": {"type": "creditcard"},
    }

    with patch(
        "app.api.routes.payments.payment_service.verify_webhook_signature",
        return_value=True,
    ), patch(
        "app.services.email.email_service.send_booking_confirmation_email",
        new_callable=AsyncMock,
    ) as mock_email, patch(
        "asyncio.create_task",
        side_effect=lambda coro: coro,
    ):
        response = client.post(
            "/api/v1/payments/webhook",
            json=payload,
            headers={"X-Moyasar-Signature": "valid"},
        )

    assert response.status_code == 200
    mock_email.assert_called_once()
    call_kwargs = mock_email.call_args.kwargs
    assert call_kwargs["to_email"] == test_user.email


def test_callback_email_uses_user_preferred_language(
    client: TestClient,
    session: Session,
    test_payment: Payment,
    test_user: User,
):
    """Confirmation email uses the user's preferred_language."""
    test_user.preferred_language = "ar"
    session.add(test_user)
    session.commit()

    mock_details = {"status": "paid", "amount": 10000, "currency": "SAR"}

    with patch(
        "app.api.routes.payments.payment_service.get_payment_details",
        new_callable=AsyncMock,
    ) as mock_get, patch(
        "app.services.email.email_service.send_booking_confirmation_email",
        new_callable=AsyncMock,
    ) as mock_email, patch(
        "asyncio.create_task",
        side_effect=lambda coro: coro,
    ):
        mock_get.return_value = mock_details
        client.get(f"/api/v1/payments/callback?id={test_payment.moyasar_payment_id}")

    mock_email.assert_called_once()
    assert mock_email.call_args.kwargs["language"] == "ar"
