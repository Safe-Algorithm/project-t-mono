"""CRUD operations for trip extra fees."""

import uuid
from typing import List, Optional
from sqlmodel import Session, select
from datetime import datetime

from app.models.trip_amenity import TripExtraFee
from app.schemas.trip_extra_fee import TripExtraFeeCreate, TripExtraFeeUpdate


def create_extra_fee(
    session: Session,
    trip_id: uuid.UUID,
    extra_fee_data: TripExtraFeeCreate
) -> TripExtraFee:
    """Create a new extra fee for a trip."""
    extra_fee = TripExtraFee(
        trip_id=trip_id,
        **extra_fee_data.model_dump()
    )
    session.add(extra_fee)
    session.commit()
    session.refresh(extra_fee)
    return extra_fee


def get_extra_fee(
    session: Session,
    extra_fee_id: uuid.UUID
) -> Optional[TripExtraFee]:
    """Get an extra fee by ID."""
    return session.get(TripExtraFee, extra_fee_id)


def get_trip_extra_fees(
    session: Session,
    trip_id: uuid.UUID
) -> List[TripExtraFee]:
    """Get all extra fees for a trip."""
    statement = select(TripExtraFee).where(TripExtraFee.trip_id == trip_id)
    return list(session.exec(statement).all())


def update_extra_fee(
    session: Session,
    extra_fee: TripExtraFee,
    extra_fee_data: TripExtraFeeUpdate
) -> TripExtraFee:
    """Update an extra fee."""
    update_data = extra_fee_data.model_dump(exclude_unset=True)
    
    for field, value in update_data.items():
        setattr(extra_fee, field, value)
    
    extra_fee.updated_at = datetime.utcnow()
    
    session.add(extra_fee)
    session.commit()
    session.refresh(extra_fee)
    return extra_fee


def delete_extra_fee(
    session: Session,
    extra_fee: TripExtraFee
) -> None:
    """Delete an extra fee."""
    session.delete(extra_fee)
    session.commit()
