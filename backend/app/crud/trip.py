import uuid
from typing import List, Optional
from datetime import datetime
from decimal import Decimal

from sqlmodel import Session, select, or_, and_, func
from sqlalchemy.orm import selectinload

from app.models.trip import Trip, TripRating
from app.schemas.trip import TripCreate, TripUpdate, TripRatingCreate
from app.models.provider import Provider
from app.models.user import User
from app.models.trip_package import TripPackage
from app.models.links import TripRating as TripRatingModel


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


def search_and_filter_trips(
    *,
    session: Session,
    provider_id: Optional[uuid.UUID] = None,
    provider_name: Optional[str] = None,
    search_query: Optional[str] = None,
    start_date_from: Optional[datetime] = None,
    start_date_to: Optional[datetime] = None,
    end_date_from: Optional[datetime] = None,
    end_date_to: Optional[datetime] = None,
    min_price: Optional[Decimal] = None,
    max_price: Optional[Decimal] = None,
    min_participants: Optional[int] = None,
    max_participants: Optional[int] = None,
    min_rating: Optional[float] = None,
    is_active: Optional[bool] = None,
    skip: int = 0,
    limit: int = 100
) -> List[Trip]:
    """
    Search and filter trips with multiple criteria including related fields.
    
    Args:
        session: Database session
        provider_id: Filter by provider ID (optional)
        provider_name: Search by provider company name (optional)
        search_query: Search in trip name and description
        start_date_from: Filter trips starting from this date
        start_date_to: Filter trips starting before this date
        end_date_from: Filter trips ending from this date
        end_date_to: Filter trips ending before this date
        min_price: Minimum package price
        max_price: Maximum package price
        min_participants: Minimum max_participants
        max_participants: Maximum max_participants
        min_rating: Minimum average rating
        is_active: Filter by active status
        skip: Pagination offset
        limit: Pagination limit
    
    Returns:
        List of filtered trips
    """
    # Start with base query
    statement = select(Trip)
    
    # Track if we need to join with provider or packages
    needs_provider_join = provider_name is not None
    needs_package_join = min_price is not None or max_price is not None
    needs_rating_join = min_rating is not None
    
    # Join with Provider if needed for provider name search
    if needs_provider_join:
        statement = statement.join(Provider, Trip.provider_id == Provider.id)
    
    # Apply filters
    conditions = []
    
    # Provider filter by ID
    if provider_id is not None:
        conditions.append(Trip.provider_id == provider_id)
    
    # Provider filter by name (search in company_name)
    if provider_name:
        provider_pattern = f"%{provider_name}%"
        conditions.append(Provider.company_name.ilike(provider_pattern))
    
    # Active status filter
    if is_active is not None:
        conditions.append(Trip.is_active == is_active)
    
    # Search query (name or description)
    if search_query:
        search_pattern = f"%{search_query}%"
        conditions.append(
            or_(
                Trip.name.ilike(search_pattern),
                Trip.description.ilike(search_pattern)
            )
        )
    
    # Date filters
    if start_date_from:
        conditions.append(Trip.start_date >= start_date_from)
    
    if start_date_to:
        conditions.append(Trip.start_date <= start_date_to)
    
    if end_date_from:
        conditions.append(Trip.end_date >= end_date_from)
    
    if end_date_to:
        conditions.append(Trip.end_date <= end_date_to)
    
    # Participants filter
    if min_participants is not None:
        conditions.append(Trip.max_participants >= min_participants)
    
    if max_participants is not None:
        conditions.append(Trip.max_participants <= max_participants)
    
    # Apply all conditions
    if conditions:
        statement = statement.where(and_(*conditions))
    
    # Price filtering requires joining with packages
    if needs_package_join:
        statement = statement.join(TripPackage, Trip.id == TripPackage.trip_id)
        
        if min_price is not None:
            statement = statement.where(TripPackage.price >= min_price)
        
        if max_price is not None:
            statement = statement.where(TripPackage.price <= max_price)
    
    # Rating filtering - get trips with average rating >= min_rating
    if needs_rating_join:
        # Subquery to calculate average rating per trip
        rating_subquery = (
            select(
                TripRatingModel.trip_id,
                func.avg(TripRatingModel.rating).label('avg_rating')
            )
            .group_by(TripRatingModel.trip_id)
            .having(func.avg(TripRatingModel.rating) >= min_rating)
            .subquery()
        )
        
        statement = statement.join(
            rating_subquery,
            Trip.id == rating_subquery.c.trip_id
        )
    
    # Order by start_date (most recent first) - must come before distinct
    statement = statement.order_by(Trip.id, Trip.start_date.desc())
    
    # Distinct to avoid duplicate trips when joining
    # Use distinct on Trip.id to avoid issues with JSON columns
    if needs_package_join or needs_provider_join or needs_rating_join:
        statement = statement.distinct(Trip.id)
    
    # Pagination
    statement = statement.offset(skip).limit(limit)
    
    return session.exec(statement).all()


def update_trip(*, session: Session, db_trip: Trip, trip_in: TripUpdate) -> Trip:
    trip_data = trip_in.model_dump(exclude_unset=True)
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
