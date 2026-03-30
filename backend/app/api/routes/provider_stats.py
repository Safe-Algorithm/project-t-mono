"""
Provider dashboard stats endpoint.
Returns actionable counts the provider needs to act on:
  - pending bookings (awaiting_provider + processing) total and per-trip
  - open support tickets (not closed)
  - upcoming trips count
  - total confirmed participants across active trips
"""

from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select, func

from app.api.deps import get_session, get_current_active_provider
from app.api.rbac_deps import require_provider_permission
from app.models.user import User
from app.models.trip import Trip
from app.models.trip_registration import TripRegistration
from app.models.support_ticket import TripSupportTicket, TicketStatus
from pydantic import BaseModel
from datetime import datetime, timezone

router = APIRouter()


def _is_future(dt: datetime, now: datetime) -> bool:
    """Compare a datetime against now regardless of whether it is tz-aware or naive."""
    if dt.tzinfo is not None:
        return dt > now
    return dt > now.replace(tzinfo=None)


class TripBookingActionCount(BaseModel):
    trip_id: str
    trip_name: str
    awaiting_provider: int
    processing: int
    total_action_needed: int


class ProviderDashboardStats(BaseModel):
    # Bookings needing action
    total_awaiting_provider: int
    total_processing: int
    total_action_needed: int          # awaiting_provider + processing

    # Other booking counts
    total_confirmed: int
    total_bookings: int               # all non-cancelled registrations

    # Support
    open_tickets: int                 # not closed

    # Trips
    total_trips: int
    active_trips: int
    upcoming_trips: int               # active + start_date in the future

    # Per-trip breakdown (only trips with actionable bookings)
    trips_needing_action: List[TripBookingActionCount]


@router.get(
    "/provider/dashboard/stats",
    response_model=ProviderDashboardStats,
    dependencies=[Depends(require_provider_permission)],
)
def get_provider_dashboard_stats(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_active_provider),
):
    """Aggregated stats for the provider dashboard."""
    provider = current_user.provider
    if not provider:
        raise HTTPException(status_code=404, detail="Provider not found")

    provider_id = provider.id
    now = datetime.now(timezone.utc)

    # ── Trips ────────────────────────────────────────────────────────────────
    trips = session.exec(
        select(Trip).where(Trip.provider_id == provider_id)
    ).all()
    total_trips = len(trips)
    active_trips = sum(1 for t in trips if t.is_active)
    upcoming_trips = sum(
        1 for t in trips
        if t.is_active and t.start_date and _is_future(t.start_date, now)
    )
    trip_ids = [t.id for t in trips]
    trip_name_map: dict = {}
    for t in trips:
        trip_name_map[str(t.id)] = t.name_en or t.name_ar or str(t.id)

    # ── Registrations ────────────────────────────────────────────────────────
    if trip_ids:
        registrations = session.exec(
            select(TripRegistration).where(
                TripRegistration.trip_id.in_(trip_ids)  # type: ignore[attr-defined]
            )
        ).all()
    else:
        registrations = []

    NON_CANCELLED = {"pending_payment", "awaiting_provider", "processing", "confirmed", "completed"}

    total_awaiting_provider = 0
    total_processing = 0
    total_confirmed = 0
    total_bookings = 0

    # Per-trip aggregation
    trip_counts: dict[str, dict] = {}

    for reg in registrations:
        tid = str(reg.trip_id)
        if reg.status not in NON_CANCELLED:
            continue
        total_bookings += 1
        if reg.status == "awaiting_provider":
            total_awaiting_provider += 1
            trip_counts.setdefault(tid, {"awaiting_provider": 0, "processing": 0})
            trip_counts[tid]["awaiting_provider"] += 1
        elif reg.status == "processing":
            total_processing += 1
            trip_counts.setdefault(tid, {"awaiting_provider": 0, "processing": 0})
            trip_counts[tid]["processing"] += 1
        elif reg.status == "confirmed":
            total_confirmed += 1

    total_action_needed = total_awaiting_provider + total_processing

    trips_needing_action: List[TripBookingActionCount] = []
    for tid, counts in trip_counts.items():
        action_total = counts["awaiting_provider"] + counts["processing"]
        if action_total > 0:
            trips_needing_action.append(TripBookingActionCount(
                trip_id=tid,
                trip_name=trip_name_map.get(tid, tid),
                awaiting_provider=counts["awaiting_provider"],
                processing=counts["processing"],
                total_action_needed=action_total,
            ))
    trips_needing_action.sort(key=lambda x: x.total_action_needed, reverse=True)

    # ── Support tickets ───────────────────────────────────────────────────────
    open_tickets: int = 0
    if trip_ids:
        open_ticket_rows = session.exec(
            select(TripSupportTicket).where(  # type: ignore[attr-defined]
                TripSupportTicket.trip_id.in_(trip_ids),  # type: ignore[attr-defined]
                TripSupportTicket.status != TicketStatus.CLOSED,
            )
        ).all()
        open_tickets = len(open_ticket_rows)

    return ProviderDashboardStats(
        total_awaiting_provider=total_awaiting_provider,
        total_processing=total_processing,
        total_action_needed=total_action_needed,
        total_confirmed=total_confirmed,
        total_bookings=total_bookings,
        open_tickets=open_tickets,
        total_trips=total_trips,
        active_trips=active_trips,
        upcoming_trips=upcoming_trips,
        trips_needing_action=trips_needing_action,
    )
