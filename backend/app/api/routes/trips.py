import uuid
import logging
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session

from app import crud
from app.api.deps import get_current_active_provider, get_session, get_current_active_user
from app.models.user import User
from app.schemas.trip import TripCreate, TripRead, TripUpdate, TripRatingCreate

router = APIRouter()
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@router.post("", response_model=TripRead)
def create_trip(
    *,
    session: Session = Depends(get_session),
    trip_in: TripCreate,
    current_user: User = Depends(get_current_active_provider),
):
    """Create a new trip for the current provider."""
    try:
        logger.info(f"Creating trip for provider: {current_user.provider_id}")
        # The test sends a location field, but the TripCreate schema does not have it.
        # The provider object is also passed incorrectly.
        trip = crud.trip.create_trip(
            session=session, trip_in=trip_in, provider=current_user.provider
        )
        logger.info(f"Trip created successfully with ID: {trip.id}")
        return trip
    except Exception as e:
        logger.error(f"Error creating trip: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("", response_model=List[TripRead])
def read_trips(
    session: Session = Depends(get_session),
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(get_current_active_provider),
):
    """Retrieve all trips for the current provider."""
    trips = crud.trip.get_trips_by_provider(
        session=session, provider_id=current_user.provider_id, skip=skip, limit=limit
    )
    return trips


@router.get("/{trip_id}", response_model=TripRead)
def read_trip(
    *, 
    session: Session = Depends(get_session), 
    trip_id: uuid.UUID, 
    current_user: User = Depends(get_current_active_provider)
):
    """Retrieve a specific trip by ID."""
    trip = crud.trip.get_trip(session=session, trip_id=trip_id)
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    if trip.provider_id != current_user.provider_id:
        raise HTTPException(status_code=403, detail="Not enough permissions")
    return trip


@router.put("/{trip_id}", response_model=TripRead)
def update_trip(
    *, 
    session: Session = Depends(get_session), 
    trip_id: uuid.UUID, 
    trip_in: TripUpdate,
    current_user: User = Depends(get_current_active_provider),
):
    """Update a trip."""
    db_trip = crud.trip.get_trip(session=session, trip_id=trip_id)
    if not db_trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    if db_trip.provider_id != current_user.provider_id:
        raise HTTPException(status_code=403, detail="Not enough permissions")
    trip = crud.trip.update_trip(session=session, db_trip=db_trip, trip_in=trip_in)
    return trip


@router.delete("/{trip_id}")
def delete_trip(
    *,
    session: Session = Depends(get_session),
    trip_id: uuid.UUID,
    current_user: User = Depends(get_current_active_provider),
):
    """Delete a trip."""
    try:
        db_trip = crud.trip.get_trip(session=session, trip_id=trip_id)
        if not db_trip:
            raise HTTPException(status_code=404, detail="Trip not found")
        if db_trip.provider_id != current_user.provider_id:
            raise HTTPException(status_code=403, detail="Not enough permissions")
        crud.trip.delete_trip(session=session, db_trip=db_trip)
        return {"ok": True}
    except Exception as e:
        logger.error(f"Error deleting trip: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/all", response_model=List[TripRead])
def list_all_trips(
    session: Session = Depends(get_session),
    skip: int = 0,
    limit: int = 100,
):
    """Retrieve all trips."""
    trips = crud.trip.get_all_trips(session, skip=skip, limit=limit)
    return trips


@router.post("/{trip_id}/join", response_model=TripRead)
def join_trip(
    *,
    session: Session = Depends(get_session),
    trip_id: uuid.UUID,
    current_user: User = Depends(get_current_active_user),
):
    """Join a trip."""
    trip = crud.trip.get_trip(session=session, trip_id=trip_id)
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    trip = crud.trip.add_user_to_trip(session=session, db_trip=trip, user=current_user)
    return trip


@router.post("/{trip_id}/leave", response_model=TripRead)
def leave_trip(
    *,
    session: Session = Depends(get_session),
    trip_id: uuid.UUID,
    current_user: User = Depends(get_current_active_user),
):
    """Leave a trip."""
    trip = crud.trip.get_trip(session=session, trip_id=trip_id)
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    trip = crud.trip.remove_user_from_trip(session=session, db_trip=trip, user=current_user)
    return trip


@router.post("/{trip_id}/rate", response_model=TripRead)
def rate_trip(
    *,
    session: Session = Depends(get_session),
    trip_id: uuid.UUID,
    rating_in: TripRatingCreate,
    current_user: User = Depends(get_current_active_user),
):
    """Rate a trip."""
    try:
        trip = crud.trip.get_trip(session=session, trip_id=trip_id)
        if not trip:
            raise HTTPException(status_code=404, detail="Trip not found")
        trip = crud.trip.rate_trip(
            session=session, db_trip=trip, rating_in=rating_in, user=current_user
        )
        return trip
    except Exception as e:
        logger.error(f"Error rating trip: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
