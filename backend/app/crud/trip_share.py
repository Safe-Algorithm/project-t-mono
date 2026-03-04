"""CRUD operations for trip sharing."""

import uuid
from datetime import datetime, timezone
from typing import Optional

from sqlmodel import Session, select

from app.models.trip_share import TripShare


def get_or_create_share(session: Session, trip_id: uuid.UUID) -> TripShare:
    """Return existing share token for a trip, or create a new one."""
    existing = session.exec(
        select(TripShare).where(TripShare.trip_id == trip_id)
    ).first()
    if existing:
        return existing
    share = TripShare(trip_id=trip_id)
    session.add(share)
    session.commit()
    session.refresh(share)
    return share


def get_share_by_token(session: Session, token: str) -> Optional[TripShare]:
    """Fetch a share record by its token string."""
    return session.exec(
        select(TripShare).where(TripShare.share_token == token)
    ).first()


def increment_view(session: Session, share: TripShare) -> TripShare:
    """Atomically bump view_count and record last_viewed_at."""
    share.view_count += 1
    share.last_viewed_at = datetime.now(timezone.utc)
    session.add(share)
    session.commit()
    session.refresh(share)
    return share
