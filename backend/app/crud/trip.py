import uuid
from typing import List, Optional

from sqlmodel import Session, select

from app.models.trip import Trip, TripRating
from app.schemas.trip import TripCreate, TripUpdate, TripRatingCreate
from app.models.provider import Provider
from app.models.user import User


def create_trip(*, session: Session, trip_in: TripCreate, provider: Provider) -> Trip:
    trip_data = trip_in.model_dump()
    trip = Trip(**trip_data, provider_id=provider.id)
    session.add(trip)
    session.commit()
    session.refresh(trip)
    return trip


def get_trip(*, session: Session, trip_id: uuid.UUID) -> Optional[Trip]:
    return session.get(Trip, trip_id)


def get_trips_by_provider(*, session: Session, provider_id: uuid.UUID, skip: int = 0, limit: int = 100) -> List[Trip]:
    statement = select(Trip).where(Trip.provider_id == provider_id).offset(skip).limit(limit)
    return session.exec(statement).all()

def get_all_trips(*, session: Session, skip: int = 0, limit: int = 100) -> List[Trip]:
    statement = select(Trip).offset(skip).limit(limit)
    return session.exec(statement).all()


def update_trip(*, session: Session, db_trip: Trip, trip_in: TripUpdate) -> Trip:
    trip_data = trip_in.dict(exclude_unset=True)
    for key, value in trip_data.items():
        setattr(db_trip, key, value)
    session.add(db_trip)
    session.commit()
    session.refresh(db_trip)
    return db_trip


def delete_trip(*, session: Session, db_trip: Trip):
    session.delete(db_trip)
    session.commit()


def add_user_to_trip(*, session: Session, db_trip: Trip, user: User) -> Trip:
    db_trip.participants.append(user)
    session.add(db_trip)
    session.commit()
    session.refresh(db_trip)
    return db_trip


def remove_user_from_trip(*, session: Session, db_trip: Trip, user: User) -> Trip:
    db_trip.participants.remove(user)
    session.add(db_trip)
    session.commit()
    session.refresh(db_trip)
    return db_trip


def rate_trip(*, session: Session, db_trip: Trip, rating_in: TripRatingCreate, user: User) -> Trip:
    rating_data = rating_in.model_dump()
    rating = TripRating(**rating_data, user_id=user.id, trip_id=db_trip.id)
    session.add(rating)
    session.commit()
    session.refresh(db_trip)
    return db_trip
