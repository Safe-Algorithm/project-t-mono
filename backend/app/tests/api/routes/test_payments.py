"""Tests for payment API routes."""

import pytest
import uuid
import datetime
from decimal import Decimal
from unittest.mock import AsyncMock, patch, MagicMock
from fastapi.testclient import TestClient
from sqlmodel import Session, select

from app.models.payment import Payment, PaymentStatus, PaymentMethod
from app.models.trip_registration import TripRegistration
from app.models.trip import Trip
from app.models.trip_package import TripPackage
from app.models.user import User, UserRole
from app.models.provider import Provider
from app.tests.utils.user import create_random_user
from app.core.config import settings


@pytest.fixture
def test_user(session: Session) -> User:
    """Create a test user."""
    return create_random_user(session)


@pytest.fixture
def test_trip(session: Session) -> Trip:
    """Create a test trip with package."""
    # Create provider first
    provider = Provider(
        company_name="Test Provider",
        company_email="test@provider.com",
        company_phone="0501234567",
        bio_en="Test bio",
        bio_ar="Test bio AR"
    )
    session.add(provider)
    session.commit()
    session.refresh(provider)
    
    # Create trip
    trip = Trip(
        name_en="Test Trip",
        description_en="Test Description",
        start_date=datetime.datetime.utcnow() + datetime.timedelta(days=30),
        end_date=datetime.datetime.utcnow() + datetime.timedelta(days=35),
        max_participants=10,
        provider_id=provider.id
    )
    session.add(trip)
    session.commit()
    session.refresh(trip)
    
    # Add a package
    package = TripPackage(
        trip_id=trip.id,
        name_en="Standard Package",
        description_en="Standard package",
        price=100.0,
        currency="SAR"
    )
    session.add(package)
    session.commit()
    
    return trip


@pytest.fixture
def auth_headers(client: TestClient, session: Session, test_user: User) -> dict:
    """Create authentication headers for test user."""
    response = client.post(
        f"{settings.API_V1_STR}/login/access-token",
        data={"username": test_user.email, "password": "password123"},
        headers={"X-Source": "mobile_app"}
    )
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}", "X-Source": "mobile_app"}


@pytest.fixture
def test_payment(session: Session, test_user: User, test_trip: Trip) -> Payment:
    """Create a test payment."""
    # First create a registration
    registration = TripRegistration(
        trip_id=test_trip.id,
        user_id=test_user.id,
        total_participants=1,
        total_amount=Decimal("100.00"),
        status="pending_payment"
    )
    session.add(registration)
    session.commit()
    session.refresh(registration)
    
    # Create payment
    payment = Payment(
        registration_id=registration.id,
        amount=Decimal("100.00"),
        currency="SAR",
        status=PaymentStatus.INITIATED,
        payment_method=PaymentMethod.CREDITCARD,
        description="Test payment",
        moyasar_payment_id="pay_test_123"
    )
    session.add(payment)
    session.commit()
    session.refresh(payment)
    return payment


def test_create_payment_success(
    client: TestClient,
    session: Session,
    test_user: User,
    test_trip: Trip,
    auth_headers: dict
):
    """Test successful payment creation."""
    # Create a registration
    registration = TripRegistration(
        trip_id=test_trip.id,
        user_id=test_user.id,
        total_participants=1,
        total_amount=Decimal("100.00"),
        status="pending_payment"
    )
    session.add(registration)
    session.commit()
    session.refresh(registration)
    
    # Mock Moyasar API response
    mock_moyasar_response = {
        "payment_id": "pay_moyasar_123",
        "status": "initiated",
        "amount": 10000,
        "currency": "SAR",
        "source": {
            "type": "creditcard",
            "transaction_url": "https://moyasar.com/pay/123"
        },
        "callback_url": "https://example.com/callback",
        "metadata": {}
    }
    
    with patch('app.api.routes.payments.payment_service.create_payment', new_callable=AsyncMock) as mock_create:
        mock_create.return_value = mock_moyasar_response
        
        response = client.post(
            "/api/v1/payments/create",
            json={
                "registration_id": str(registration.id),
                "payment_method": "creditcard"
            },
            headers=auth_headers
        )
    
    assert response.status_code == 201
    data = response.json()
    assert data["moyasar_payment_id"] == "pay_moyasar_123"
    assert data["status"] == "initiated"
    assert float(data["amount"]) == 100.0
    
    # Verify payment was created in database
    payment = session.exec(
        select(Payment).where(Payment.registration_id == registration.id)
    ).first()
    assert payment is not None
    assert payment.moyasar_payment_id == "pay_moyasar_123"


def test_create_payment_registration_not_found(
    client: TestClient,
    auth_headers: dict
):
    """Test payment creation with non-existent registration."""
    response = client.post(
        "/api/v1/payments/create",
        json={
            "registration_id": str(uuid.uuid4()),
            "payment_method": "creditcard"
        },
        headers=auth_headers
    )
    
    assert response.status_code == 404
    assert "not found" in response.json()["detail"].lower()


def test_create_payment_unauthorized_registration(
    client: TestClient,
    session: Session,
    test_user: User,
    test_trip: Trip,
    auth_headers: dict
):
    """Test payment creation for another user's registration."""
    # Create another user
    other_user = User(
        email="other@example.com",
        phone="+966501234567",
        hashed_password="hashed",
        name="Other User",
        source="mobile_app"
    )
    session.add(other_user)
    session.commit()
    
    # Create registration for other user
    registration = TripRegistration(
        trip_id=test_trip.id,
        user_id=other_user.id,
        total_participants=1,
        total_amount=Decimal("100.00"),
        status="pending_payment"
    )
    session.add(registration)
    session.commit()
    
    response = client.post(
        "/api/v1/payments/create",
        json={
            "registration_id": str(registration.id),
            "payment_method": "creditcard"
        },
        headers=auth_headers
    )
    
    assert response.status_code == 403


def test_create_payment_not_pending(
    client: TestClient,
    session: Session,
    test_user: User,
    test_trip: Trip,
    auth_headers: dict
):
    """Test payment creation for registration not in pending_payment status."""
    registration = TripRegistration(
        trip_id=test_trip.id,
        user_id=test_user.id,
        total_participants=1,
        total_amount=Decimal("100.00"),
        status="confirmed"  # Already confirmed
    )
    session.add(registration)
    session.commit()
    
    response = client.post(
        "/api/v1/payments/create",
        json={
            "registration_id": str(registration.id),
            "payment_method": "creditcard"
        },
        headers=auth_headers
    )
    
    assert response.status_code == 400
    assert "not pending payment" in response.json()["detail"].lower()


def test_get_payment_success(
    client: TestClient,
    test_payment: Payment,
    auth_headers: dict
):
    """Test retrieving payment details."""
    response = client.get(
        f"/api/v1/payments/{test_payment.id}",
        headers=auth_headers
    )
    
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == str(test_payment.id)
    assert float(data["amount"]) == 100.0


def test_get_payment_not_found(
    client: TestClient,
    auth_headers: dict
):
    """Test retrieving non-existent payment."""
    response = client.get(
        f"/api/v1/payments/{uuid.uuid4()}",
        headers=auth_headers
    )
    
    assert response.status_code == 404


def test_get_payments_by_registration(
    client: TestClient,
    test_payment: Payment,
    session: Session,
    auth_headers: dict
):
    """Test retrieving all payments for a registration."""
    response = client.get(
        f"/api/v1/payments/registration/{test_payment.registration_id}",
        headers=auth_headers
    )
    
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["id"] == str(test_payment.id)


def test_payment_callback_success(
    client: TestClient,
    session: Session,
    test_payment: Payment
):
    """Test payment callback processing."""
    mock_payment_details = {
        "payment_id": test_payment.moyasar_payment_id,
        "status": "paid",
        "amount": 10000,
        "currency": "SAR",
        "fee": 300
    }
    
    with patch('app.api.routes.payments.payment_service.get_payment_details', new_callable=AsyncMock) as mock_get:
        mock_get.return_value = mock_payment_details
        
        response = client.get(
            f"/api/v1/payments/callback?id={test_payment.moyasar_payment_id}"
        )
    
    assert response.status_code == 200
    assert response.json()["status"] == "paid"
    
    # Verify payment status updated
    session.refresh(test_payment)
    assert test_payment.status == PaymentStatus.PAID
    assert test_payment.paid_at is not None
    
    # Verify registration status updated
    registration = session.get(TripRegistration, test_payment.registration_id)
    assert registration.status == "confirmed"


def test_payment_webhook_paid(
    client: TestClient,
    session: Session,
    test_payment: Payment
):
    """Test webhook processing for paid payment."""
    webhook_payload = {
        "id": test_payment.moyasar_payment_id,
        "status": "paid",
        "amount": 10000,
        "fee": 300,
        "currency": "SAR",
        "refunded": 0,
        "captured": 10000,
        "description": "Test payment",
        "created_at": "2024-01-01T00:00:00Z",
        "updated_at": "2024-01-01T00:00:00Z",
        "source": {"type": "creditcard"}
    }
    
    with patch('app.api.routes.payments.payment_service.verify_webhook_signature') as mock_verify:
        mock_verify.return_value = True
        
        response = client.post(
            "/api/v1/payments/webhook",
            json=webhook_payload,
            headers={"X-Moyasar-Signature": "valid_signature"}
        )
    
    assert response.status_code == 200
    
    # Verify payment status updated
    session.refresh(test_payment)
    assert test_payment.status == PaymentStatus.PAID


def test_payment_webhook_invalid_signature(
    client: TestClient,
    test_payment: Payment
):
    """Test webhook with invalid signature."""
    webhook_payload = {
        "id": test_payment.moyasar_payment_id,
        "status": "paid"
    }
    
    with patch('app.api.routes.payments.payment_service.verify_webhook_signature') as mock_verify:
        mock_verify.return_value = False
        
        response = client.post(
            "/api/v1/payments/webhook",
            json=webhook_payload,
            headers={"X-Moyasar-Signature": "invalid_signature"}
        )
    
    assert response.status_code == 401


def test_refund_payment_success(
    client: TestClient,
    session: Session,
    test_payment: Payment,
    auth_headers: dict
):
    """Test successful payment refund."""
    # Update payment to paid status
    test_payment.status = PaymentStatus.PAID
    session.add(test_payment)
    session.commit()
    
    mock_refund_response = {
        "payment_id": test_payment.moyasar_payment_id,
        "status": "refunded",
        "amount": 10000,
        "refunded": True,
        "refunded_at": "2024-01-01T00:00:00Z"
    }
    
    with patch('app.api.routes.payments.payment_service.refund_payment', new_callable=AsyncMock) as mock_refund:
        mock_refund.return_value = mock_refund_response
        
        response = client.post(
            f"/api/v1/payments/{test_payment.id}/refund",
            json={"description": "Customer request"},
            headers=auth_headers
        )
    
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "refunded"
    assert data["refunded"] is True
    
    # Verify registration status updated
    registration = session.get(TripRegistration, test_payment.registration_id)
    assert registration.status == "cancelled"


def test_refund_payment_not_paid(
    client: TestClient,
    test_payment: Payment,
    auth_headers: dict
):
    """Test refund for payment that is not paid."""
    response = client.post(
        f"/api/v1/payments/{test_payment.id}/refund",
        json={},
        headers=auth_headers
    )
    
    assert response.status_code == 400
    assert "not in paid status" in response.json()["detail"].lower()


def test_refund_payment_already_refunded(
    client: TestClient,
    session: Session,
    test_payment: Payment,
    auth_headers: dict
):
    """Test refund for already refunded payment."""
    test_payment.status = PaymentStatus.PAID
    test_payment.refunded = True
    session.add(test_payment)
    session.commit()
    
    response = client.post(
        f"/api/v1/payments/{test_payment.id}/refund",
        json={},
        headers=auth_headers
    )
    
    assert response.status_code == 400
    assert "already refunded" in response.json()["detail"].lower()


def test_create_payment_requires_authentication(client: TestClient):
    """Test that payment creation requires authentication."""
    response = client.post(
        "/api/v1/payments/create",
        json={
            "registration_id": str(uuid.uuid4()),
            "payment_method": "creditcard"
        }
    )
    
    assert response.status_code == 401
