"""
Financial service — determines which bookings are currently "owed" to providers.

Reuses compute_refund() from refund.py so the definition of "non-refundable"
is always consistent with the cancellation policy.
"""

from datetime import datetime
from decimal import Decimal
from typing import List

from sqlmodel import Session, select

from app.models.trip_registration import TripRegistration
from app.models.payment import Payment, PaymentStatus
from app.models.earning_line import EarningLine
from app.models.trip import Trip
from app.models.trip_package import TripPackage
from app.models.provider import Provider
from app.services.refund import compute_refund


def _get_is_refundable(session: Session, registration: TripRegistration) -> bool:
    """
    Determine refundability from the first participant's package.
    Falls back to True (refundable) if no package info is available.
    """
    if registration.participants:
        first = registration.participants[0]
        if first.package_id:
            pkg = session.get(TripPackage, first.package_id)
            if pkg and pkg.is_refundable is not None:
                return pkg.is_refundable
    return True  # default: refundable (more conservative — don't mark as owed too early)


def _is_owed(
    session: Session,
    registration: TripRegistration,
    payment: Payment,
    trip: Trip,
) -> bool:
    """
    Return True when the provider share for this booking is 'owed' —
    i.e. the user can no longer get a refund.
    """
    if payment.status != PaymentStatus.PAID:
        return False

    # Cancelled bookings are never owed (refund already issued or trip cancelled)
    if registration.status == "cancelled":
        return False

    # Need a registration deadline to run the refund logic
    deadline = trip.registration_deadline or trip.start_date
    if deadline is None:
        return False

    trip_type = trip.trip_type.value if trip.trip_type else "guided"
    is_refundable = _get_is_refundable(session, registration)

    decision = compute_refund(
        total_amount=registration.total_amount,
        is_refundable=is_refundable,
        trip_type=trip_type,
        registration_status=registration.status,
        registration_deadline=deadline,
        paid_at=payment.paid_at,
        cancelled_by="user",  # simulate worst-case user cancel
    )

    return decision.refund_percentage == 0


def materialize_earning_line(
    session: Session,
    registration: TripRegistration,
    payment: Payment,
    trip: Trip,
    provider: Provider,
) -> EarningLine:
    """
    Create (or return existing) EarningLine for a registration.
    Should only be called once _is_owed() returns True.
    """
    existing = session.exec(
        select(EarningLine).where(EarningLine.registration_id == registration.id)
    ).first()
    if existing:
        return existing

    gross = registration.total_amount
    cut_pct = provider.commission_rate
    cut_amount = (gross * cut_pct / Decimal("100")).quantize(Decimal("0.01"))
    provider_amount = (gross - cut_amount).quantize(Decimal("0.01"))

    line = EarningLine(
        registration_id=registration.id,
        provider_id=provider.id,
        trip_id=trip.id,
        gross_amount=gross,
        platform_cut_pct=cut_pct,
        platform_cut_amount=cut_amount,
        provider_amount=provider_amount,
        became_owed_at=datetime.utcnow(),
    )
    session.add(line)
    session.flush()
    return line


def get_or_create_earning_lines_for_provider(
    session: Session,
    provider_id: str,
) -> List[EarningLine]:
    """
    Materialise all owed earning lines for a provider and return the full list
    of lines not yet included in a payout.
    """
    from app.models.trip import Trip as TripModel

    # Load all confirmed/processing/awaiting_provider paid registrations for this provider
    paid_payments = session.exec(
        select(Payment, TripRegistration, Trip, Provider)
        .join(TripRegistration, Payment.registration_id == TripRegistration.id)
        .join(TripModel, TripRegistration.trip_id == TripModel.id)
        .join(Provider, TripModel.provider_id == Provider.id)
        .where(
            Provider.id == provider_id,
            Payment.status == PaymentStatus.PAID,
            TripRegistration.status != "cancelled",
        )
    ).all()

    for payment, registration, trip, provider in paid_payments:
        # Skip if already has an earning line
        existing = session.exec(
            select(EarningLine).where(EarningLine.registration_id == registration.id)
        ).first()
        if existing:
            continue
        if _is_owed(session, registration, payment, trip):
            materialize_earning_line(session, registration, payment, trip, provider)

    session.commit()

    # Return all unpaid lines for this provider
    return session.exec(
        select(EarningLine).where(
            EarningLine.provider_id == provider_id,
            EarningLine.payout_id == None,  # noqa: E711
        )
    ).all()
