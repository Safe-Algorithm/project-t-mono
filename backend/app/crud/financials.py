"""CRUD helpers for the financials / payouts system."""

import uuid
from datetime import datetime
from decimal import Decimal
from typing import List, Optional

from sqlmodel import Session, select, func

from app.models.earning_line import EarningLine
from app.models.provider_payout import ProviderPayout, PayoutStatus
from app.models.provider import Provider
from app.models.trip_registration import TripRegistration
from app.models.payment import Payment, PaymentStatus
from app.models.trip import Trip
from app.models.user import User
from app.schemas.financials import (
    EarningLineRead,
    ProviderPayoutRead,
    ProviderPayoutDetail,
    ProviderFinancialSummary,
    AdminFinancialsOverview,
    TripFinancialDetail,
    TripFinancialSummary,
    TripEarningStatus,
    ProviderFinancialsSelf,
)
from app.services.financials import (
    get_or_create_earning_lines_for_provider,
    _is_owed,
)
from app.utils.localization import get_name


def _enrich_earning_line(line: EarningLine, session: Session) -> EarningLineRead:
    """Add booking_reference, trip_name, booking_date to an EarningLine read schema."""
    reg = session.get(TripRegistration, line.registration_id)
    trip = session.get(Trip, line.trip_id)
    trip_name = get_name(trip) if trip else ""
    return EarningLineRead(
        id=line.id,
        registration_id=line.registration_id,
        provider_id=line.provider_id,
        trip_id=line.trip_id,
        gross_amount=line.gross_amount,
        platform_cut_pct=line.platform_cut_pct,
        platform_cut_amount=line.platform_cut_amount,
        provider_amount=line.provider_amount,
        payout_id=line.payout_id,
        became_owed_at=line.became_owed_at,
        created_at=line.created_at,
        booking_reference=reg.booking_reference if reg else None,
        trip_name=trip_name,
        booking_date=reg.registration_date if reg else None,
    )


# ─── Provider owed lines ──────────────────────────────────────────────────────

def get_owed_earning_lines(
    session: Session,
    provider_id: uuid.UUID,
) -> List[EarningLineRead]:
    """Materialise + return all unpaid owed earning lines for a provider."""
    lines = get_or_create_earning_lines_for_provider(session, provider_id)
    return [_enrich_earning_line(line, session) for line in lines]


def get_all_earning_lines(
    session: Session,
    provider_id: uuid.UUID,
    status_filter: Optional[str] = None,
    trip_id: Optional[uuid.UUID] = None,
) -> List[EarningLineRead]:
    """
    Return all earning lines for a provider.
    Materialises owed lines first, then optionally filters.
    status_filter: 'owed' | 'paid' | None (all)
    """
    # Ensure owed lines are materialised
    get_or_create_earning_lines_for_provider(session, provider_id)

    stmt = select(EarningLine).where(EarningLine.provider_id == provider_id)
    if status_filter == "owed":
        stmt = stmt.where(EarningLine.payout_id == None)  # noqa: E711
    elif status_filter == "paid":
        stmt = stmt.where(EarningLine.payout_id != None)  # noqa: E711
    if trip_id:
        stmt = stmt.where(EarningLine.trip_id == trip_id)

    lines = session.exec(stmt).all()
    return [_enrich_earning_line(line, session) for line in lines]


# ─── Payout creation ──────────────────────────────────────────────────────────

def create_payout(
    session: Session,
    provider_id: uuid.UUID,
    earning_line_ids: List[uuid.UUID],
    admin_id: uuid.UUID,
    note: Optional[str] = None,
    bank_transfer_reference: Optional[str] = None,
) -> ProviderPayout:
    """
    Create a ProviderPayout, link the selected earning lines, and
    mark those lines as included in this payout.
    """
    # Validate lines belong to this provider and are unpaid
    lines = []
    for line_id in earning_line_ids:
        line = session.get(EarningLine, line_id)
        if not line or str(line.provider_id) != str(provider_id):
            raise ValueError(f"EarningLine {line_id} not found or wrong provider")
        if line.payout_id is not None:
            raise ValueError(f"EarningLine {line_id} is already included in a payout")
        lines.append(line)

    if not lines:
        raise ValueError("No valid earning lines provided")

    total_gross = sum(l.gross_amount for l in lines)
    total_cut = sum(l.platform_cut_amount for l in lines)
    total_provider = sum(l.provider_amount for l in lines)

    payout = ProviderPayout(
        provider_id=provider_id,
        total_gross=total_gross,
        total_platform_cut=total_cut,
        total_provider_amount=total_provider,
        booking_count=len(lines),
        status=PayoutStatus.PENDING,
        note=note,
        bank_transfer_reference=bank_transfer_reference,
        paid_by_admin_id=admin_id,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )
    session.add(payout)
    session.flush()

    for line in lines:
        line.payout_id = payout.id
        session.add(line)

    session.commit()
    session.refresh(payout)
    return payout


def complete_payout(
    session: Session,
    payout_id: uuid.UUID,
    admin_id: uuid.UUID,
    receipt_file_url: Optional[str] = None,
    note: Optional[str] = None,
    bank_transfer_reference: Optional[str] = None,
) -> ProviderPayout:
    payout = session.get(ProviderPayout, payout_id)
    if not payout:
        raise ValueError("Payout not found")

    payout.status = PayoutStatus.COMPLETED
    payout.paid_at = datetime.utcnow()
    payout.paid_by_admin_id = admin_id
    if receipt_file_url is not None:
        payout.receipt_file_url = receipt_file_url
    if note is not None:
        payout.note = note
    if bank_transfer_reference is not None:
        payout.bank_transfer_reference = bank_transfer_reference
    payout.updated_at = datetime.utcnow()
    session.add(payout)
    session.commit()
    session.refresh(payout)
    return payout


def _payout_to_read(payout: ProviderPayout, session: Session) -> ProviderPayoutRead:
    provider = session.get(Provider, payout.provider_id)
    admin = session.get(User, payout.paid_by_admin_id) if payout.paid_by_admin_id else None
    return ProviderPayoutRead(
        id=payout.id,
        provider_id=payout.provider_id,
        total_gross=payout.total_gross,
        total_platform_cut=payout.total_platform_cut,
        total_provider_amount=payout.total_provider_amount,
        booking_count=payout.booking_count,
        status=payout.status,
        note=payout.note,
        bank_transfer_reference=payout.bank_transfer_reference,
        receipt_file_url=payout.receipt_file_url,
        paid_by_admin_id=payout.paid_by_admin_id,
        paid_at=payout.paid_at,
        created_at=payout.created_at,
        updated_at=payout.updated_at,
        provider_name=provider.company_name if provider else None,
        paid_by_admin_name=admin.name if admin else None,
    )


def _payout_to_detail(payout: ProviderPayout, session: Session) -> ProviderPayoutDetail:
    base = _payout_to_read(payout, session)
    lines = session.exec(
        select(EarningLine).where(EarningLine.payout_id == payout.id)
    ).all()
    return ProviderPayoutDetail(
        **base.model_dump(),
        earning_lines=[_enrich_earning_line(l, session) for l in lines],
    )


def get_payouts_for_provider(
    session: Session,
    provider_id: uuid.UUID,
) -> List[ProviderPayoutRead]:
    payouts = session.exec(
        select(ProviderPayout)
        .where(ProviderPayout.provider_id == provider_id)
        .order_by(ProviderPayout.created_at.desc())
    ).all()
    return [_payout_to_read(p, session) for p in payouts]


def get_payout_detail(
    session: Session,
    payout_id: uuid.UUID,
) -> Optional[ProviderPayoutDetail]:
    payout = session.get(ProviderPayout, payout_id)
    if not payout:
        return None
    return _payout_to_detail(payout, session)


def list_all_payouts(
    session: Session,
    provider_id: Optional[uuid.UUID] = None,
) -> List[ProviderPayoutRead]:
    stmt = select(ProviderPayout).order_by(ProviderPayout.created_at.desc())
    if provider_id:
        stmt = stmt.where(ProviderPayout.provider_id == provider_id)
    payouts = session.exec(stmt).all()
    return [_payout_to_read(p, session) for p in payouts]


# ─── Admin overview ───────────────────────────────────────────────────────────

def get_provider_financial_summary(
    session: Session,
    provider: Provider,
) -> ProviderFinancialSummary:
    """Compute financial summary for a single provider."""
    # Materialise owed lines
    get_or_create_earning_lines_for_provider(session, provider.id)

    all_lines = session.exec(
        select(EarningLine).where(EarningLine.provider_id == provider.id)
    ).all()

    total_gross = sum(l.gross_amount for l in all_lines)
    total_cut = sum(l.platform_cut_amount for l in all_lines)
    total_provider = sum(l.provider_amount for l in all_lines)

    paid_lines = [l for l in all_lines if l.payout_id is not None]
    owed_lines = [l for l in all_lines if l.payout_id is None]

    # Only count completed payouts in paid_out total
    paid_out = Decimal("0.00")
    completed_payouts = session.exec(
        select(ProviderPayout).where(
            ProviderPayout.provider_id == provider.id,
            ProviderPayout.status == PayoutStatus.COMPLETED,
        )
    ).all()
    paid_out = sum(p.total_provider_amount for p in completed_payouts)

    last_payout = session.exec(
        select(ProviderPayout)
        .where(
            ProviderPayout.provider_id == provider.id,
            ProviderPayout.status == PayoutStatus.COMPLETED,
        )
        .order_by(ProviderPayout.paid_at.desc())
    ).first()

    return ProviderFinancialSummary(
        provider_id=provider.id,
        provider_name=provider.company_name,
        commission_rate=provider.commission_rate,
        total_gross_earned=total_gross,
        total_platform_cut=total_cut,
        total_provider_earned=total_provider,
        total_paid_out=paid_out,
        total_owed=sum(l.provider_amount for l in owed_lines),
        last_payout_date=last_payout.paid_at if last_payout else None,
        unpaid_booking_count=len(owed_lines),
    )


def get_admin_overview(session: Session) -> AdminFinancialsOverview:
    providers = session.exec(select(Provider)).all()
    summaries = [get_provider_financial_summary(session, p) for p in providers]
    grand_owed = sum(s.total_owed for s in summaries)
    grand_paid = sum(s.total_paid_out for s in summaries)
    return AdminFinancialsOverview(
        providers=summaries,
        grand_total_owed=grand_owed,
        grand_total_paid_out=grand_paid,
    )


# ─── Trip-level breakdown ─────────────────────────────────────────────────────

def _booking_status_label(
    registration: TripRegistration,
    payment: Payment,
    trip: Trip,
    earning_line: Optional[EarningLine],
) -> str:
    if registration.status == "cancelled":
        return "cancelled"
    if earning_line and earning_line.payout_id:
        return "paid_out"
    if earning_line:
        return "owed"
    # Not yet an earning line — check if still refundable
    return "refundable"


def get_trip_financial_detail(
    session: Session,
    trip_id: uuid.UUID,
    for_admin: bool = True,
) -> Optional[TripFinancialDetail]:
    trip = session.get(Trip, trip_id)
    if not trip:
        return None

    # Ensure earning lines are materialised
    get_or_create_earning_lines_for_provider(session, trip.provider_id)

    # Get all paid registrations for this trip
    rows = session.exec(
        select(TripRegistration, Payment)
        .join(Payment, Payment.registration_id == TripRegistration.id)
        .where(
            TripRegistration.trip_id == trip_id,
            Payment.status == PaymentStatus.PAID,
        )
    ).all()

    bookings: List[TripEarningStatus] = []
    paid_out_count = owed_count = refundable_count = cancelled_count = 0
    total_gross = total_cut = total_provider = paid_out_amt = owed_amt = Decimal("0.00")

    for registration, payment in rows:
        earning_line = session.exec(
            select(EarningLine).where(EarningLine.registration_id == registration.id)
        ).first()

        status = _booking_status_label(registration, payment, trip, earning_line)

        gross = registration.total_amount
        cut_pct = trip.provider.commission_rate if trip.provider else Decimal("10.00")
        cut = (gross * cut_pct / Decimal("100")).quantize(Decimal("0.01"))
        provider_amt = gross - cut

        if earning_line:
            cut = earning_line.platform_cut_amount
            provider_amt = earning_line.provider_amount

        total_gross += gross
        total_cut += cut
        total_provider += provider_amt

        payout_id = earning_line.payout_id if earning_line else None
        paid_out_at = None
        if payout_id:
            payout = session.get(ProviderPayout, payout_id)
            paid_out_at = payout.paid_at if payout else None

        if status == "paid_out":
            paid_out_count += 1
            paid_out_amt += provider_amt
        elif status == "owed":
            owed_count += 1
            owed_amt += provider_amt
        elif status == "refundable":
            refundable_count += 1
        else:
            cancelled_count += 1

        user = session.get(User, registration.user_id) if for_admin else None

        bookings.append(TripEarningStatus(
            registration_id=registration.id,
            booking_reference=registration.booking_reference,
            booking_date=registration.registration_date,
            gross_amount=gross,
            platform_cut_amount=cut,
            provider_amount=provider_amt,
            status=status,
            payout_id=payout_id,
            paid_out_at=paid_out_at,
            user_name=user.name if user else None,
            user_email=user.email if user else None,
        ))

    trip_name = get_name(trip)
    return TripFinancialDetail(
        trip_id=trip_id,
        trip_name=trip_name,
        total_bookings=len(bookings),
        paid_out_count=paid_out_count,
        owed_count=owed_count,
        refundable_count=refundable_count,
        cancelled_count=cancelled_count,
        total_gross=total_gross,
        total_platform_cut=total_cut,
        total_provider_amount=total_provider,
        paid_out_amount=paid_out_amt,
        owed_amount=owed_amt,
        bookings=bookings,
    )


def get_provider_trips_summary(
    session: Session,
    provider_id: uuid.UUID,
) -> List[TripFinancialSummary]:
    """Return per-trip financial summaries for a provider (no booking list)."""
    trips = session.exec(
        select(Trip).where(Trip.provider_id == provider_id)
    ).all()

    summaries = []
    for trip in trips:
        detail = get_trip_financial_detail(session, trip.id, for_admin=False)
        if detail and detail.total_bookings > 0:
            summaries.append(TripFinancialSummary(
                trip_id=detail.trip_id,
                trip_name=detail.trip_name,
                total_bookings=detail.total_bookings,
                paid_out_count=detail.paid_out_count,
                owed_count=detail.owed_count,
                refundable_count=detail.refundable_count,
                cancelled_count=detail.cancelled_count,
                total_gross=detail.total_gross,
                total_platform_cut=detail.total_platform_cut,
                total_provider_amount=detail.total_provider_amount,
                paid_out_amount=detail.paid_out_amount,
                owed_amount=detail.owed_amount,
            ))
    return summaries


def get_provider_self_summary(
    session: Session,
    provider: Provider,
) -> ProviderFinancialsSelf:
    summary = get_provider_financial_summary(session, provider)
    return ProviderFinancialsSelf(
        commission_rate=summary.commission_rate,
        total_gross_earned=summary.total_gross_earned,
        total_platform_cut=summary.total_platform_cut,
        total_provider_earned=summary.total_provider_earned,
        total_paid_out=summary.total_paid_out,
        total_owed=summary.total_owed,
        unpaid_booking_count=summary.unpaid_booking_count,
        last_payout_date=summary.last_payout_date,
    )
