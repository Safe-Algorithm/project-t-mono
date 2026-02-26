import uuid
from typing import List, Optional
from datetime import datetime, timezone as _tz
from decimal import Decimal

from sqlmodel import Session, select, or_, and_, func
from sqlalchemy.orm import selectinload

from app.models.trip import Trip, TripRating
from app.schemas.trip import TripCreate, TripUpdate, TripRatingCreate
from app.models.provider import Provider
from app.models.user import User
from app.models.trip_package import TripPackage
from app.models.links import TripRating as TripRatingModel
from app.models.trip_destination import TripDestination


def _compute_is_international(session: Session, trip: Trip) -> bool:
    """Return True if starting city country != any destination country."""
    if not trip.starting_city_id:
        return False
    from app.models.destination import Destination
    from app.models.trip_destination import TripDestination
    starting_city = session.get(Destination, trip.starting_city_id)
    if not starting_city:
        return False
    from_country = starting_city.country_code
    dest_links = session.exec(
        select(TripDestination).where(TripDestination.trip_id == trip.id)
    ).all()
    for link in dest_links:
        dest = session.get(Destination, link.destination_id)
        if dest and dest.country_code != from_country:
            return True
    return False


_PACKAGE_ONLY_FIELDS = {"price", "is_refundable", "amenities"}


def create_trip(*, session: Session, trip_in: TripCreate, provider: Provider) -> Trip:
    trip_data = {k: v for k, v in trip_in.model_dump().items() if k not in _PACKAGE_ONLY_FIELDS}
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
    # New filters
    starting_city_id: Optional[uuid.UUID] = None,
    is_international: Optional[bool] = None,
    destination_ids: Optional[List[uuid.UUID]] = None,
    single_destination: Optional[bool] = None,
    amenities: Optional[List[str]] = None,
    only_future: bool = False,
    only_open_registration: bool = False,
    skip: int = 0,
    limit: int = 100,
) -> List[Trip]:
    """
    Search and filter trips. By default returns all matching trips ordered by
    newest (created_at desc). Public feed uses only_future=True and
    only_open_registration=True to exclude past/closed trips.
    """
    now = datetime.now(_tz.utc).replace(tzinfo=None)

    statement = select(Trip)

    needs_provider_join = provider_name is not None
    needs_package_join = min_price is not None or max_price is not None or bool(amenities)
    needs_rating_join = min_rating is not None

    if needs_provider_join:
        statement = statement.join(Provider, Trip.provider_id == Provider.id)

    conditions = []

    if provider_id is not None:
        conditions.append(Trip.provider_id == provider_id)

    if provider_name:
        conditions.append(Provider.company_name.ilike(f"%{provider_name}%"))

    if is_active is not None:
        conditions.append(Trip.is_active == is_active)

    # Only show trips whose start_date is in the future
    if only_future:
        conditions.append(Trip.start_date > now)

    # Only show trips whose registration deadline hasn't passed
    # (if deadline is NULL, fall back to start_date > now)
    if only_open_registration:
        conditions.append(
            or_(
                and_(Trip.registration_deadline.isnot(None), Trip.registration_deadline >= now),
                and_(Trip.registration_deadline.is_(None), Trip.start_date > now),
            )
        )

    if starting_city_id is not None:
        conditions.append(Trip.starting_city_id == starting_city_id)

    if is_international is not None:
        conditions.append(Trip.is_international == is_international)

    # Filter by destination_ids (OR: trip must have at least one of these destinations)
    if destination_ids:
        dest_subq = (
            select(TripDestination.trip_id)
            .where(TripDestination.destination_id.in_(destination_ids))
            .distinct()
            .subquery()
        )
        conditions.append(Trip.id.in_(select(dest_subq.c.trip_id)))

    # Filter by number of destinations (single = 1, multiple = >1)
    if single_destination is not None:
        count_subq = (
            select(TripDestination.trip_id, func.count(TripDestination.id).label('dest_count'))
            .group_by(TripDestination.trip_id)
            .subquery()
        )
        if single_destination:
            conditions.append(
                or_(
                    Trip.id.in_(select(count_subq.c.trip_id).where(count_subq.c.dest_count == 1)),
                    Trip.id.notin_(select(count_subq.c.trip_id)),  # no destinations = treat as single
                )
            )
        else:
            conditions.append(
                Trip.id.in_(select(count_subq.c.trip_id).where(count_subq.c.dest_count > 1))
            )

    if search_query:
        search_pattern = f"%{search_query}%"
        conditions.append(or_(
            Trip.name_en.ilike(search_pattern),
            Trip.name_ar.ilike(search_pattern),
            Trip.description_en.ilike(search_pattern),
            Trip.description_ar.ilike(search_pattern),
        ))

    if start_date_from:
        conditions.append(Trip.start_date >= start_date_from)
    if start_date_to:
        conditions.append(Trip.start_date <= start_date_to)
    if end_date_from:
        conditions.append(Trip.end_date >= end_date_from)
    if end_date_to:
        conditions.append(Trip.end_date <= end_date_to)

    if min_participants is not None:
        conditions.append(Trip.max_participants >= min_participants)
    if max_participants is not None:
        conditions.append(Trip.max_participants <= max_participants)

    if conditions:
        statement = statement.where(and_(*conditions))

    if needs_package_join:
        statement = statement.join(TripPackage, Trip.id == TripPackage.trip_id)
        statement = statement.where(TripPackage.is_active == True)
        if min_price is not None:
            statement = statement.where(TripPackage.price >= min_price)
        if max_price is not None:
            statement = statement.where(TripPackage.price <= max_price)
        if amenities:
            import json
            from sqlalchemy import text
            # Use a raw SQL expression for the JSONB containment check.
            # CAST(col AS jsonb) @> CAST(:val AS jsonb) returns rows where the
            # package amenities array contains ALL selected amenities.
            # This works regardless of whether the column is stored as json or jsonb.
            amenities_json = json.dumps(amenities)
            statement = statement.where(
                text("CAST(trippackage.amenities AS jsonb) @> CAST(:amenities AS jsonb)")
                .bindparams(amenities=amenities_json)
            )

    if needs_rating_join:
        rating_subquery = (
            select(
                TripRatingModel.trip_id,
                func.avg(TripRatingModel.rating).label('avg_rating')
            )
            .group_by(TripRatingModel.trip_id)
            .having(func.avg(TripRatingModel.rating) >= min_rating)
            .subquery()
        )
        statement = statement.join(rating_subquery, Trip.id == rating_subquery.c.trip_id)

    # Newest trips first (created_at desc)
    if needs_package_join or needs_provider_join or needs_rating_join:
        statement = statement.distinct(Trip.id, Trip.created_at)

    statement = statement.order_by(Trip.created_at.desc())
    statement = statement.offset(skip).limit(limit)

    return session.exec(statement).all()


def update_trip(*, session: Session, db_trip: Trip, trip_in: TripUpdate) -> Trip:
    trip_data = trip_in.model_dump(exclude_unset=True)
    for key, value in trip_data.items():
        if key in _PACKAGE_ONLY_FIELDS:
            continue  # handled by _sync_hidden_package in the route layer
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
