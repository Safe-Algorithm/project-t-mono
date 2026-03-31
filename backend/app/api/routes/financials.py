"""Financial API routes — admin payout management and provider earnings views."""

import uuid
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session

from app.api.deps import get_current_active_provider, get_current_active_admin, get_session
from app.api.rbac_deps import require_provider_permission, require_admin_permission
from app.models.provider import Provider
from app.models.user import User
from app.crud import financials as fin_crud
from app.schemas.financials import (
    AdminFinancialsOverview,
    CommissionUpdate,
    EarningLineRead,
    PayoutComplete,
    PayoutCreate,
    ProviderFinancialsSelf,
    ProviderFinancialSummary,
    ProviderPayoutDetail,
    ProviderPayoutRead,
    TripFinancialDetail,
    TripFinancialSummary,
)

router = APIRouter()


# ══════════════════════════════════════════════════════════════════════════════
# ADMIN ENDPOINTS
# ══════════════════════════════════════════════════════════════════════════════

@router.get(
    "/admin/financials/overview",
    response_model=AdminFinancialsOverview,
    dependencies=[Depends(require_admin_permission)],
)
def admin_financials_overview(
    *,
    session: Session = Depends(get_session),
    current_admin: User = Depends(get_current_active_admin),
):
    """Platform-wide overview: how much is owed to each provider."""
    return fin_crud.get_admin_overview(session)


@router.get(
    "/admin/financials/providers/{provider_id}/owed",
    response_model=List[EarningLineRead],
    dependencies=[Depends(require_admin_permission)],
)
def admin_provider_owed_lines(
    provider_id: uuid.UUID,
    session: Session = Depends(get_session),
    current_admin: User = Depends(get_current_active_admin),
):
    """All unpaid owed earning lines for a provider, grouped by booking."""
    return fin_crud.get_owed_earning_lines(session, provider_id)


@router.get(
    "/admin/financials/providers/{provider_id}/summary",
    response_model=ProviderFinancialSummary,
    dependencies=[Depends(require_admin_permission)],
)
def admin_provider_summary(
    provider_id: uuid.UUID,
    session: Session = Depends(get_session),
    current_admin: User = Depends(get_current_active_admin),
):
    """Financial summary for a single provider."""
    from sqlmodel import select
    from app.models.provider import Provider as ProviderModel
    provider = session.get(ProviderModel, provider_id)
    if not provider:
        raise HTTPException(status_code=404, detail="Provider not found")
    return fin_crud.get_provider_financial_summary(session, provider)


@router.post(
    "/admin/financials/providers/{provider_id}/payouts",
    response_model=ProviderPayoutDetail,
    status_code=201,
    dependencies=[Depends(require_admin_permission)],
)
def admin_create_payout(
    provider_id: uuid.UUID,
    payout_in: PayoutCreate,
    session: Session = Depends(get_session),
    current_admin: User = Depends(get_current_active_admin),
):
    """Create a payout for a provider — links selected earning lines."""
    try:
        payout = fin_crud.create_payout(
            session=session,
            provider_id=provider_id,
            earning_line_ids=payout_in.earning_line_ids,
            admin_id=current_admin.id,
            note=payout_in.note,
            bank_transfer_reference=payout_in.bank_transfer_reference,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    detail = fin_crud.get_payout_detail(session, payout.id)
    return detail


@router.patch(
    "/admin/financials/payouts/{payout_id}/complete",
    response_model=ProviderPayoutDetail,
    dependencies=[Depends(require_admin_permission)],
)
def admin_complete_payout(
    payout_id: uuid.UUID,
    complete_in: PayoutComplete,
    session: Session = Depends(get_session),
    current_admin: User = Depends(get_current_active_admin),
):
    """Mark a payout as completed (bank transfer done)."""
    try:
        payout = fin_crud.complete_payout(
            session=session,
            payout_id=payout_id,
            admin_id=current_admin.id,
            receipt_file_url=complete_in.receipt_file_url,
            note=complete_in.note,
            bank_transfer_reference=complete_in.bank_transfer_reference,
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    return fin_crud.get_payout_detail(session, payout.id)


@router.get(
    "/admin/financials/payouts",
    response_model=List[ProviderPayoutRead],
    dependencies=[Depends(require_admin_permission)],
)
def admin_list_payouts(
    provider_id: Optional[uuid.UUID] = None,
    session: Session = Depends(get_session),
    current_admin: User = Depends(get_current_active_admin),
):
    """List all payouts, optionally filtered by provider."""
    return fin_crud.list_all_payouts(session, provider_id=provider_id)


@router.get(
    "/admin/financials/payouts/{payout_id}",
    response_model=ProviderPayoutDetail,
    dependencies=[Depends(require_admin_permission)],
)
def admin_get_payout(
    payout_id: uuid.UUID,
    session: Session = Depends(get_session),
    current_admin: User = Depends(get_current_active_admin),
):
    detail = fin_crud.get_payout_detail(session, payout_id)
    if not detail:
        raise HTTPException(status_code=404, detail="Payout not found")
    return detail


@router.get(
    "/admin/financials/trips/by-provider",
    response_model=List[TripFinancialSummary],
    dependencies=[Depends(require_admin_permission)],
)
def admin_provider_trips_summary(
    provider_id: uuid.UUID,
    session: Session = Depends(get_session),
    current_admin: User = Depends(get_current_active_admin),
):
    """Per-trip financial summaries for a specific provider (admin view)."""
    return fin_crud.get_provider_trips_summary(session, provider_id)


@router.get(
    "/admin/financials/trips/{trip_id}",
    response_model=TripFinancialDetail,
    dependencies=[Depends(require_admin_permission)],
)
def admin_trip_financial_detail(
    trip_id: uuid.UUID,
    session: Session = Depends(get_session),
    current_admin: User = Depends(get_current_active_admin),
):
    """Per-trip financial breakdown across all bookings (admin view, includes user info)."""
    detail = fin_crud.get_trip_financial_detail(session, trip_id, for_admin=True)
    if not detail:
        raise HTTPException(status_code=404, detail="Trip not found")
    return detail


@router.patch(
    "/admin/providers/{provider_id}/commission",
    dependencies=[Depends(require_admin_permission)],
)
def admin_update_commission(
    provider_id: uuid.UUID,
    commission_in: CommissionUpdate,
    session: Session = Depends(get_session),
    current_admin: User = Depends(get_current_active_admin),
):
    """Update a provider's platform commission rate."""
    from app.models.provider import Provider as ProviderModel
    from app.models.commission_rate_history import CommissionRateHistory
    from datetime import datetime
    provider = session.get(ProviderModel, provider_id)
    if not provider:
        raise HTTPException(status_code=404, detail="Provider not found")
    if commission_in.commission_rate < 0 or commission_in.commission_rate > 100:
        raise HTTPException(status_code=400, detail="Commission rate must be between 0 and 100")
    now = datetime.utcnow()
    provider.commission_rate = commission_in.commission_rate
    provider.updated_at = now
    session.add(provider)
    history_row = CommissionRateHistory(
        provider_id=provider_id,
        rate=commission_in.commission_rate,
        effective_from=now,
        changed_by_admin_id=current_admin.id,
    )
    session.add(history_row)
    session.commit()
    return {"ok": True, "commission_rate": float(commission_in.commission_rate)}


# ══════════════════════════════════════════════════════════════════════════════
# PROVIDER ENDPOINTS
# ══════════════════════════════════════════════════════════════════════════════

@router.get(
    "/provider/financials/summary",
    response_model=ProviderFinancialsSelf,
    dependencies=[Depends(require_provider_permission)],
)
def provider_financials_summary(
    session: Session = Depends(get_session),
    current_provider_user: User = Depends(get_current_active_provider),
):
    """Provider's own financial summary — totals and commission rate."""
    provider = current_provider_user.provider
    if not provider:
        raise HTTPException(status_code=404, detail="Provider not found")
    return fin_crud.get_provider_self_summary(session, provider)


@router.get(
    "/provider/financials/earnings",
    response_model=List[EarningLineRead],
    dependencies=[Depends(require_provider_permission)],
)
def provider_earnings(
    status: Optional[str] = None,
    trip_id: Optional[uuid.UUID] = None,
    session: Session = Depends(get_session),
    current_provider_user: User = Depends(get_current_active_provider),
):
    """All earning lines for the current provider. status: owed|paid|all"""
    provider = current_provider_user.provider
    if not provider:
        raise HTTPException(status_code=404, detail="Provider not found")
    return fin_crud.get_all_earning_lines(session, provider.id, status_filter=status, trip_id=trip_id)


@router.get(
    "/provider/financials/trips",
    response_model=List[TripFinancialSummary],
    dependencies=[Depends(require_provider_permission)],
)
def provider_trips_financials(
    session: Session = Depends(get_session),
    current_provider_user: User = Depends(get_current_active_provider),
):
    """Per-trip financial summaries for the provider."""
    provider = current_provider_user.provider
    if not provider:
        raise HTTPException(status_code=404, detail="Provider not found")
    return fin_crud.get_provider_trips_summary(session, provider.id)


@router.get(
    "/provider/financials/trips/{trip_id}",
    response_model=TripFinancialDetail,
    dependencies=[Depends(require_provider_permission)],
)
def provider_trip_financial_detail(
    trip_id: uuid.UUID,
    session: Session = Depends(get_session),
    current_provider_user: User = Depends(get_current_active_provider),
):
    """Full per-trip financial breakdown for the provider (no user PII)."""
    provider = current_provider_user.provider
    if not provider:
        raise HTTPException(status_code=404, detail="Provider not found")
    detail = fin_crud.get_trip_financial_detail(session, trip_id, for_admin=False)
    if not detail:
        raise HTTPException(status_code=404, detail="Trip not found")
    # Ownership check
    from app.models.trip import Trip
    trip = session.get(Trip, trip_id)
    if not trip or str(trip.provider_id) != str(provider.id):
        raise HTTPException(status_code=403, detail="Not authorized")
    return detail


@router.get(
    "/provider/financials/payouts",
    response_model=List[ProviderPayoutRead],
    dependencies=[Depends(require_provider_permission)],
)
def provider_list_payouts(
    session: Session = Depends(get_session),
    current_provider_user: User = Depends(get_current_active_provider),
):
    """List all payouts the provider has received."""
    provider = current_provider_user.provider
    if not provider:
        raise HTTPException(status_code=404, detail="Provider not found")
    return fin_crud.get_payouts_for_provider(session, provider.id)


@router.get(
    "/provider/financials/payouts/{payout_id}",
    response_model=ProviderPayoutDetail,
    dependencies=[Depends(require_provider_permission)],
)
def provider_get_payout(
    payout_id: uuid.UUID,
    session: Session = Depends(get_session),
    current_provider_user: User = Depends(get_current_active_provider),
):
    """Full payout detail including earning lines and receipt."""
    provider = current_provider_user.provider
    if not provider:
        raise HTTPException(status_code=404, detail="Provider not found")
    detail = fin_crud.get_payout_detail(session, payout_id)
    if not detail:
        raise HTTPException(status_code=404, detail="Payout not found")
    if str(detail.provider_id) != str(provider.id):
        raise HTTPException(status_code=403, detail="Not authorized")
    return detail
