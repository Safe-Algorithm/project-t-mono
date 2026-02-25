"""
CRUD operations for the Trip Updates / Notifications system.
"""

import uuid
from typing import Optional, List

from sqlmodel import Session, select

from app.models.trip_update import TripUpdate, TripUpdateReceipt
from app.schemas.trip_update import TripUpdateCreate


def create_trip_update(
    session: Session,
    *,
    trip_id: uuid.UUID,
    provider_id: uuid.UUID,
    data: TripUpdateCreate,
    registration_id: Optional[uuid.UUID] = None,
) -> TripUpdate:
    update = TripUpdate(
        trip_id=trip_id,
        provider_id=provider_id,
        registration_id=registration_id,
        title=data.title,
        message=data.message,
        attachments=data.attachments,
        is_important=data.is_important,
    )
    session.add(update)
    session.commit()
    session.refresh(update)
    return update


def get_trip_update(
    session: Session, *, update_id: uuid.UUID
) -> Optional[TripUpdate]:
    return session.get(TripUpdate, update_id)


def list_updates_for_trip(
    session: Session, *, trip_id: uuid.UUID
) -> List[TripUpdate]:
    stmt = (
        select(TripUpdate)
        .where(TripUpdate.trip_id == trip_id)
        .order_by(TripUpdate.created_at.desc())
    )
    return list(session.exec(stmt).all())


def list_updates_for_user_trip(
    session: Session,
    *,
    trip_id: uuid.UUID,
    registration_id: uuid.UUID,
) -> List[TripUpdate]:
    """Get updates visible to a specific user registration.
    
    Includes broadcast updates (registration_id is None) and
    updates targeted at this specific registration.
    """
    from sqlalchemy import or_

    stmt = (
        select(TripUpdate)
        .where(
            TripUpdate.trip_id == trip_id,
            or_(
                TripUpdate.registration_id == None,  # noqa: E711
                TripUpdate.registration_id == registration_id,
            ),
        )
        .order_by(TripUpdate.created_at.desc())
    )
    return list(session.exec(stmt).all())


def list_all_updates(
    session: Session,
    *,
    skip: int = 0,
    limit: int = 50,
) -> List[TripUpdate]:
    stmt = select(TripUpdate).order_by(TripUpdate.created_at.desc()).offset(skip).limit(limit)
    return list(session.exec(stmt).all())


def list_updates_by_provider(
    session: Session, *, provider_id: uuid.UUID, trip_id: Optional[uuid.UUID] = None
) -> List[TripUpdate]:
    stmt = (
        select(TripUpdate)
        .where(TripUpdate.provider_id == provider_id)
        .order_by(TripUpdate.created_at.desc())
    )
    if trip_id:
        stmt = stmt.where(TripUpdate.trip_id == trip_id)
    return list(session.exec(stmt).all())


# ===== Read Receipts =====


def mark_as_read(
    session: Session, *, update_id: uuid.UUID, user_id: uuid.UUID
) -> TripUpdateReceipt:
    # Check if already read
    stmt = select(TripUpdateReceipt).where(
        TripUpdateReceipt.update_id == update_id,
        TripUpdateReceipt.user_id == user_id,
    )
    existing = session.exec(stmt).first()
    if existing:
        return existing

    receipt = TripUpdateReceipt(update_id=update_id, user_id=user_id)
    session.add(receipt)
    session.commit()
    session.refresh(receipt)
    return receipt


def has_user_read(
    session: Session, *, update_id: uuid.UUID, user_id: uuid.UUID
) -> bool:
    stmt = select(TripUpdateReceipt).where(
        TripUpdateReceipt.update_id == update_id,
        TripUpdateReceipt.user_id == user_id,
    )
    return session.exec(stmt).first() is not None


def get_read_count(session: Session, *, update_id: uuid.UUID) -> int:
    stmt = select(TripUpdateReceipt).where(
        TripUpdateReceipt.update_id == update_id
    )
    return len(list(session.exec(stmt).all()))


def get_receipts_for_update(
    session: Session, *, update_id: uuid.UUID
) -> List[TripUpdateReceipt]:
    stmt = (
        select(TripUpdateReceipt)
        .where(TripUpdateReceipt.update_id == update_id)
        .order_by(TripUpdateReceipt.read_at.asc())
    )
    return list(session.exec(stmt).all())
