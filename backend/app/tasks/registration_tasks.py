"""
Background tasks for trip registration lifecycle management.

- auto_cancel_stale_awaiting_provider: cancels self-arranged bookings that
  have been in 'awaiting_provider' for more than 3 days without the provider
  starting to process them.
"""

from datetime import datetime, timedelta
from typing import List

from sqlmodel import Session, select

from app.core.db import engine
from app.core.taskiq_app import broker


@broker.task(schedule=[{"cron": "0 * * * *"}])  # runs every hour
async def auto_cancel_stale_awaiting_provider() -> dict:
    """
    Cancel bookings stuck in 'awaiting_provider' for > 3 days.

    This protects users from providers who receive payment but never start
    processing the booking. After 3 days the booking is cancelled automatically,
    freeing the spot and triggering a refund flow.

    Returns a summary dict for observability.
    """
    cutoff = datetime.utcnow() - timedelta(days=3)

    with Session(engine) as session:
        from app.models.trip_registration import TripRegistration as TripRegistrationModel
        from app.models.trip import Trip as TripModel

        stale = session.exec(
            select(TripRegistrationModel).where(
                TripRegistrationModel.status == "awaiting_provider",
                TripRegistrationModel.registration_date <= cutoff,
            )
        ).all()

        cancelled_ids: List[str] = []
        for reg in stale:
            reg.status = "cancelled"
            session.add(reg)
            cancelled_ids.append(str(reg.id))

        if cancelled_ids:
            session.commit()

    return {
        "task": "auto_cancel_stale_awaiting_provider",
        "cancelled_count": len(cancelled_ids),
        "cancelled_ids": cancelled_ids,
        "cutoff": cutoff.isoformat(),
        "ran_at": datetime.utcnow().isoformat(),
    }
