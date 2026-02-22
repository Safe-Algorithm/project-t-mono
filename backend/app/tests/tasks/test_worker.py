"""
Unit tests for Taskiq worker scheduled tasks.
"""

import pytest
from datetime import datetime, timedelta
from decimal import Decimal
from unittest.mock import patch, AsyncMock, MagicMock
from freezegun import freeze_time
from sqlmodel import Session

from app.tasks.worker import send_trip_reminders, send_review_reminders, cancel_expired_spot_reservations
from app.models.trip import Trip
from app.models.trip_registration import TripRegistration
from app.models.links import TripRating
from app.models.user import User, UserRole
from app.models.provider import Provider
from app.models.source import RequestSource
from app.tests.utils.user import create_random_user


def _create_provider(session: Session) -> Provider:
    """Helper to create a valid provider."""
    import uuid
    provider = Provider(
        company_name="Test Provider",
        company_email=f"provider_{uuid.uuid4().hex[:8]}@test.com",
        company_phone="0501234567",
    )
    session.add(provider)
    session.commit()
    session.refresh(provider)
    return provider


def _create_trip(session: Session, provider: Provider, **kwargs) -> Trip:
    """Helper to create a valid trip with bilingual fields."""
    defaults = dict(
        name_en="Test Trip",
        description_en="Test trip description",
        start_date=datetime.utcnow() + timedelta(days=7),
        end_date=datetime.utcnow() + timedelta(days=9),
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


@pytest.mark.asyncio
async def test_send_trip_reminders_no_trips(session: Session):
    """Test trip reminders when no trips are starting tomorrow"""
    with patch('app.tasks.worker.Session') as mock_session_class:
        mock_session_class.return_value.__enter__.return_value = session
        
        # No trips starting tomorrow
        await send_trip_reminders()
        
        # Should complete without errors
        assert True


@pytest.mark.asyncio
async def test_send_trip_reminders_with_upcoming_trip(session: Session):
    """Test sending trip reminders for trips starting tomorrow"""
    provider = _create_provider(session)
    
    # Create trip starting tomorrow
    tomorrow = datetime.utcnow() + timedelta(days=1)
    trip = _create_trip(
        session, provider,
        name_en="Tomorrow's Trip",
        start_date=tomorrow.replace(hour=10, minute=0, second=0, microsecond=0),
        end_date=tomorrow + timedelta(days=2),
    )
    
    # Create user with verified phone
    user = create_random_user(session)
    user.phone = "+966501234567"
    user.is_phone_verified = True
    session.add(user)
    session.commit()
    
    # Create confirmed registration
    registration = TripRegistration(
        trip_id=trip.id,
        user_id=user.id,
        status="confirmed",
        total_participants=1,
        total_amount=Decimal("1000.00"),
    )
    session.add(registration)
    session.commit()
    
    with patch('app.tasks.worker.Session') as mock_session_class, \
         patch('app.tasks.worker.NotificationService') as mock_notification:
        
        mock_session_class.return_value.__enter__.return_value = session
        mock_notification_instance = MagicMock()
        mock_notification_instance.send_trip_reminder = AsyncMock()
        mock_notification.return_value = mock_notification_instance
        
        await send_trip_reminders()
        
        # Verify notification was sent
        mock_notification_instance.send_trip_reminder.assert_called_once()


@pytest.mark.asyncio
async def test_send_review_reminders_no_completed_trips(session: Session):
    """Test review reminders when no trips ended yesterday"""
    with patch('app.tasks.worker.Session') as mock_session_class:
        mock_session_class.return_value.__enter__.return_value = session
        
        await send_review_reminders()
        
        # Should complete without errors
        assert True


@pytest.mark.asyncio
async def test_send_review_reminders_with_completed_trip(session: Session):
    """Test sending review reminders for trips that ended yesterday"""
    provider = _create_provider(session)
    
    # Create trip that ended yesterday
    yesterday = datetime.utcnow() - timedelta(days=1)
    trip = _create_trip(
        session, provider,
        name_en="Yesterday's Trip",
        start_date=yesterday - timedelta(days=2),
        end_date=yesterday.replace(hour=18, minute=0, second=0, microsecond=0),
    )
    
    # Create user with verified phone
    user = create_random_user(session)
    user.phone = "+966501234567"
    user.is_phone_verified = True
    session.add(user)
    session.commit()
    
    # Create confirmed registration
    registration = TripRegistration(
        trip_id=trip.id,
        user_id=user.id,
        status="confirmed",
        total_participants=1,
        total_amount=Decimal("1000.00"),
    )
    session.add(registration)
    session.commit()
    
    with patch('app.tasks.worker.Session') as mock_session_class, \
         patch('app.services.sms.sms_service') as mock_sms:
        
        mock_session_class.return_value.__enter__.return_value = session
        mock_sms.send_sms = AsyncMock()
        
        await send_review_reminders()
        
        # Verify SMS was sent
        mock_sms.send_sms.assert_called_once()
        call_args = mock_sms.send_sms.call_args
        assert call_args[1]['to_phone'] == user.phone
        assert 'review' in call_args[1]['message'].lower()


@pytest.mark.asyncio
async def test_send_review_reminders_skips_existing_reviews(session: Session):
    """Test that review reminders are not sent if user already reviewed"""
    provider = _create_provider(session)
    
    # Create trip that ended yesterday
    yesterday = datetime.utcnow() - timedelta(days=1)
    trip = _create_trip(
        session, provider,
        name_en="Yesterday's Trip",
        start_date=yesterday - timedelta(days=2),
        end_date=yesterday.replace(hour=18, minute=0, second=0, microsecond=0),
    )
    
    # Create user
    user = create_random_user(session)
    user.phone = "+966501234567"
    user.is_phone_verified = True
    session.add(user)
    session.commit()
    
    # Create confirmed registration
    registration = TripRegistration(
        trip_id=trip.id,
        user_id=user.id,
        status="confirmed",
        total_participants=1,
        total_amount=Decimal("1000.00"),
    )
    session.add(registration)
    session.commit()
    
    # Create existing review (TripRating)
    review = TripRating(
        trip_id=trip.id,
        user_id=user.id,
        rating=5,
        comment="Great trip!",
    )
    session.add(review)
    session.commit()
    
    with patch('app.tasks.worker.Session') as mock_session_class, \
         patch('app.services.sms.sms_service') as mock_sms:
        
        mock_session_class.return_value.__enter__.return_value = session
        mock_sms.send_sms = AsyncMock()
        
        await send_review_reminders()
        
        # Verify SMS was NOT sent (user already reviewed)
        mock_sms.send_sms.assert_not_called()


@pytest.mark.asyncio
async def test_worker_handles_errors_gracefully(session: Session):
    """Test that worker tasks handle errors without crashing"""
    with patch('app.tasks.worker.Session') as mock_session_class:
        mock_session_class.return_value.__enter__.side_effect = Exception("Database error")
        
        with pytest.raises(Exception, match="Database error"):
            await send_trip_reminders()
        
        with pytest.raises(Exception, match="Database error"):
            await send_review_reminders()


# ──────────────────────────────────────────────────────────────────────────────
# Tests for cancel_expired_spot_reservations
# ──────────────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
@freeze_time("2025-01-01 12:00:00")
async def test_cancel_expired_spot_reservations_cancels_expired(session: Session):
    """Registrations with status=pending_payment and expired spot_reserved_until are cancelled."""
    provider = _create_provider(session)
    trip = _create_trip(session, provider)
    user = create_random_user(session)

    # Frozen at 12:00 — reservation expired 1 minute ago
    expired_reg = TripRegistration(
        trip_id=trip.id,
        user_id=user.id,
        status="pending_payment",
        total_participants=1,
        total_amount=Decimal("500.00"),
        spot_reserved_until=datetime(2025, 1, 1, 11, 59, 0),  # 1 min before frozen now
    )
    session.add(expired_reg)
    session.commit()
    session.refresh(expired_reg)

    with patch("app.tasks.worker.Session") as mock_session_class:
        mock_session_class.return_value.__enter__.return_value = session

        await cancel_expired_spot_reservations()

    session.refresh(expired_reg)
    assert expired_reg.status == "cancelled"


@pytest.mark.asyncio
@freeze_time("2025-01-01 12:00:00")
async def test_cancel_expired_spot_reservations_leaves_valid_reservations(session: Session):
    """Registrations whose spot_reserved_until is still in the future must not be cancelled."""
    provider = _create_provider(session)
    trip = _create_trip(session, provider)
    user = create_random_user(session)

    # Frozen at 12:00 — reservation expires at 12:10, still 10 minutes away
    valid_reg = TripRegistration(
        trip_id=trip.id,
        user_id=user.id,
        status="pending_payment",
        total_participants=1,
        total_amount=Decimal("500.00"),
        spot_reserved_until=datetime(2025, 1, 1, 12, 10, 0),  # 10 min after frozen now
    )
    session.add(valid_reg)
    session.commit()
    session.refresh(valid_reg)

    with patch("app.tasks.worker.Session") as mock_session_class:
        mock_session_class.return_value.__enter__.return_value = session

        await cancel_expired_spot_reservations()

    session.refresh(valid_reg)
    assert valid_reg.status == "pending_payment"


@pytest.mark.asyncio
@freeze_time("2025-01-01 12:00:00")
async def test_cancel_expired_spot_reservations_ignores_confirmed(session: Session):
    """Already-confirmed registrations must never be cancelled by the task."""
    provider = _create_provider(session)
    trip = _create_trip(session, provider)
    user = create_random_user(session)

    # Confirmed registration whose spot window has long expired — must stay confirmed
    confirmed_reg = TripRegistration(
        trip_id=trip.id,
        user_id=user.id,
        status="confirmed",
        total_participants=1,
        total_amount=Decimal("500.00"),
        spot_reserved_until=datetime(2025, 1, 1, 11, 0, 0),  # 1 hour before frozen now
    )
    session.add(confirmed_reg)
    session.commit()
    session.refresh(confirmed_reg)

    with patch("app.tasks.worker.Session") as mock_session_class:
        mock_session_class.return_value.__enter__.return_value = session

        await cancel_expired_spot_reservations()

    session.refresh(confirmed_reg)
    assert confirmed_reg.status == "confirmed"


@pytest.mark.asyncio
@freeze_time("2025-01-01 12:00:00")
async def test_cancel_expired_spot_reservations_ignores_no_reservation(session: Session):
    """pending_payment registrations with no spot_reserved_until must not be cancelled."""
    provider = _create_provider(session)
    trip = _create_trip(session, provider)
    user = create_random_user(session)

    reg_no_expiry = TripRegistration(
        trip_id=trip.id,
        user_id=user.id,
        status="pending_payment",
        total_participants=1,
        total_amount=Decimal("500.00"),
        spot_reserved_until=None,
    )
    session.add(reg_no_expiry)
    session.commit()
    session.refresh(reg_no_expiry)

    with patch("app.tasks.worker.Session") as mock_session_class:
        mock_session_class.return_value.__enter__.return_value = session

        await cancel_expired_spot_reservations()

    session.refresh(reg_no_expiry)
    assert reg_no_expiry.status == "pending_payment"


@pytest.mark.asyncio
async def test_cancel_expired_spot_reservations_handles_error_gracefully(session: Session):
    """Task must raise on database error (so Taskiq can log/retry it)."""
    with patch("app.tasks.worker.Session") as mock_session_class:
        mock_session_class.return_value.__enter__.side_effect = Exception("DB down")

        with pytest.raises(Exception, match="DB down"):
            await cancel_expired_spot_reservations()


@pytest.mark.asyncio
@freeze_time("2025-01-01 12:00:00")
async def test_cancel_expired_spot_reservations_voids_moyasar_payment(session: Session):
    """When a spot expires, any INITIATED payment with a Moyasar ID must be voided."""
    from app.models.payment import Payment, PaymentStatus, PaymentMethod

    provider = _create_provider(session)
    trip = _create_trip(session, provider)
    user = create_random_user(session)

    expired_reg = TripRegistration(
        trip_id=trip.id,
        user_id=user.id,
        status="pending_payment",
        total_participants=1,
        total_amount=Decimal("500.00"),
        spot_reserved_until=datetime(2025, 1, 1, 11, 59, 0),
    )
    session.add(expired_reg)
    session.commit()
    session.refresh(expired_reg)

    payment = Payment(
        registration_id=expired_reg.id,
        amount=Decimal("500.00"),
        currency="SAR",
        status=PaymentStatus.INITIATED,
        payment_method=PaymentMethod.CREDITCARD,
        description="Test",
        moyasar_payment_id="moy_test_void_123",
    )
    session.add(payment)
    session.commit()
    session.refresh(payment)

    with patch("app.tasks.worker.Session") as mock_session_class, \
         patch("app.services.moyasar.MoyasarPaymentService.void_payment", new_callable=AsyncMock) as mock_void:
        mock_session_class.return_value.__enter__.return_value = session
        mock_void.return_value = {"payment_id": "moy_test_void_123", "status": "voided"}

        await cancel_expired_spot_reservations()

    mock_void.assert_called_once_with("moy_test_void_123")
    session.refresh(payment)
    assert payment.status == PaymentStatus.FAILED
    session.refresh(expired_reg)
    assert expired_reg.status == "cancelled"


@pytest.mark.asyncio
@freeze_time("2025-01-01 12:00:00")
async def test_cancel_expired_spot_reservations_void_failure_still_cancels(session: Session):
    """If Moyasar void fails, the payment is marked FAILED locally and the registration is still cancelled."""
    from app.models.payment import Payment, PaymentStatus, PaymentMethod

    provider = _create_provider(session)
    trip = _create_trip(session, provider)
    user = create_random_user(session)

    expired_reg = TripRegistration(
        trip_id=trip.id,
        user_id=user.id,
        status="pending_payment",
        total_participants=1,
        total_amount=Decimal("500.00"),
        spot_reserved_until=datetime(2025, 1, 1, 11, 59, 0),
    )
    session.add(expired_reg)
    session.commit()
    session.refresh(expired_reg)

    payment = Payment(
        registration_id=expired_reg.id,
        amount=Decimal("500.00"),
        currency="SAR",
        status=PaymentStatus.INITIATED,
        payment_method=PaymentMethod.CREDITCARD,
        description="Test",
        moyasar_payment_id="moy_never_authorised",
    )
    session.add(payment)
    session.commit()
    session.refresh(payment)

    with patch("app.tasks.worker.Session") as mock_session_class, \
         patch("app.services.moyasar.MoyasarPaymentService.void_payment", new_callable=AsyncMock) as mock_void:
        mock_session_class.return_value.__enter__.return_value = session
        mock_void.side_effect = Exception("Payment not authorised on Moyasar")

        await cancel_expired_spot_reservations()

    session.refresh(payment)
    assert payment.status == PaymentStatus.FAILED
    session.refresh(expired_reg)
    assert expired_reg.status == "cancelled"
