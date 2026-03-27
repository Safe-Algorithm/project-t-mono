import hashlib
import json
import uuid
from typing import List, Optional
from datetime import datetime, timezone as _tz
from decimal import Decimal

from sqlmodel import Session, select, or_, and_, func
from sqlalchemy.orm import selectinload

from app.models.trip import Trip, TripRating, TripType
from app.schemas.trip import TripCreate, TripUpdate, TripRatingCreate
from app.models.provider import Provider
from app.models.user import User
from app.models.trip_package import TripPackage
from app.models.links import TripRating as TripRatingModel
from app.models.provider_rating import ProviderRating as ProviderRatingModel
from app.models.trip_destination import TripDestination
from app.models.destination import Destination


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

# Fields that are booking-relevant and user-visible — changes to these bump content_hash.
_HASH_FIELDS = (
    "name_en", "name_ar", "description_en", "description_ar",
    "start_date", "end_date", "registration_deadline", "max_participants",
    "trip_type", "is_packaged_trip", "timezone",
    "has_meeting_place", "meeting_place_name", "meeting_place_name_ar",
    "meeting_location", "meeting_time",
    "starting_city_id", "is_international",
    "trip_metadata",
)


def _compute_content_hash(trip: Trip) -> str:
    """Return a stable SHA-256 hex digest of all booking-relevant trip fields."""
    def _ser(v):
        if isinstance(v, datetime):
            return v.isoformat()
        if isinstance(v, uuid.UUID):
            return str(v)
        return v

    payload = {f: _ser(getattr(trip, f, None)) for f in _HASH_FIELDS}
    # Also fold in the packages' own booking-relevant fields and required fields
    # so package changes invalidate cached trips on the client.
    try:
        pkgs = sorted(
            [
                {
                    "id": str(p.id),
                    "name_en": p.name_en,
                    "name_ar": p.name_ar,
                    "description_en": p.description_en,
                    "description_ar": p.description_ar,
                    "price": str(p.price),
                    "currency": p.currency.value if hasattr(p.currency, "value") else str(p.currency),
                    "is_refundable": p.is_refundable,
                    "is_active": p.is_active,
                    "amenities": sorted(p.amenities or []),
                    "max_participants": p.max_participants,
                    "required_fields": sorted(
                        [
                            {
                                "field_type": rf.field_type.value if hasattr(rf.field_type, "value") else str(rf.field_type),
                                "is_required": rf.is_required,
                                "validation_config": rf.validation_config or {},
                            }
                            for rf in (p.required_fields or [])
                        ],
                        key=lambda item: item["field_type"],
                    ),
                    "use_flexible_pricing": getattr(p, "use_flexible_pricing", False),
                    "pricing_tiers": sorted(
                        [
                            {
                                "from_participant": t.from_participant,
                                "price_per_person": str(t.price_per_person),
                            }
                            for t in (getattr(p, "pricing_tiers", None) or [])
                        ],
                        key=lambda item: item["from_participant"],
                    ),
                }
                for p in (trip.packages or [])
            ],
            key=lambda x: x["id"],
        )
        payload["packages"] = pkgs
    except Exception:
        pass  # packages may not be loaded yet on first create
    raw = json.dumps(payload, sort_keys=True, default=str)
    return hashlib.sha256(raw.encode()).hexdigest()


def _derive_timezone_from_city(session: Session, city_id) -> Optional[str]:
    """Return the IANA timezone of the starting city, or None if not set or invalid."""
    if not city_id:
        return None
    from app.models.destination import Destination
    city = session.get(Destination, city_id)
    if not city or not city.timezone:
        return None
    tz = city.timezone
    # Reject UTC offset strings (e.g. "UTC+03:00") — they are not valid IANA names
    # and will cause Intl.DateTimeFormat to throw a RangeError in the frontend.
    try:
        import zoneinfo
        zoneinfo.ZoneInfo(tz)
        return tz
    except (KeyError, Exception):
        return None


def create_trip(*, session: Session, trip_in: TripCreate, provider: Provider) -> Trip:
    trip_data = {k: v for k, v in trip_in.model_dump().items() if k not in _PACKAGE_ONLY_FIELDS}
    # Default registration_deadline to start_date if not explicitly provided
    if trip_data.get("registration_deadline") is None:
        trip_data["registration_deadline"] = trip_data.get("start_date")
    # Derive meeting_time from start_date when a meeting place is configured
    if trip_data.get("has_meeting_place"):
        trip_data["meeting_time"] = trip_data.get("start_date")
    else:
        trip_data["meeting_time"] = None
    # Auto-derive timezone from starting city (overrides whatever was submitted)
    city_tz = _derive_timezone_from_city(session, trip_data.get("starting_city_id"))
    if city_tz:
        trip_data["timezone"] = city_tz
    trip = Trip(**trip_data, provider_id=provider.id)
    session.add(trip)
    session.commit()
    session.refresh(trip)
    trip.content_hash = _compute_content_hash(trip)
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
    starting_country_code: Optional[str] = None,
    is_international: Optional[bool] = None,
    trip_type: Optional[TripType] = None,
    destination_ids: Optional[List[uuid.UUID]] = None,
    destination_country_codes: Optional[List[str]] = None,
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

    if starting_country_code is not None:
        sc_subq = (
            select(Destination.id)
            .where(Destination.country_code == starting_country_code.upper())
            .subquery()
        )
        conditions.append(Trip.starting_city_id.in_(select(sc_subq.c.id)))

    if destination_country_codes:
        codes_upper = [c.upper() for c in destination_country_codes]
        dest_country_subq = (
            select(TripDestination.trip_id)
            .join(Destination, TripDestination.destination_id == Destination.id)
            .where(Destination.country_code.in_(codes_upper))
            .distinct()
            .subquery()
        )
        conditions.append(Trip.id.in_(select(dest_country_subq.c.trip_id)))

    if is_international is not None:
        conditions.append(Trip.is_international == is_international)

    if trip_type is not None:
        conditions.append(Trip.trip_type == trip_type)

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
        rated_trip_ids = (
            select(TripRatingModel.trip_id)
            .group_by(TripRatingModel.trip_id)
            .having(func.avg(TripRatingModel.rating) >= min_rating)
            .subquery()
        )
        statement = statement.where(Trip.id.in_(select(rated_trip_ids.c.trip_id)))

    # Deduplicate rows that may arise from joins (portable across all DBs)
    if needs_package_join or needs_provider_join:
        statement = statement.group_by(Trip.id)

    statement = statement.order_by(Trip.created_at.desc())
    statement = statement.offset(skip).limit(limit)

    return session.exec(statement).all()


def update_trip(*, session: Session, db_trip: Trip, trip_in: TripUpdate) -> Trip:
    trip_data = trip_in.model_dump(exclude_unset=True)
    for key, value in trip_data.items():
        if key in _PACKAGE_ONLY_FIELDS:
            continue  # handled by _sync_hidden_package in the route layer
        setattr(db_trip, key, value)
    # Re-derive meeting_time from start_date whenever either start_date or
    # has_meeting_place is touched, so the column stays in sync automatically.
    if "start_date" in trip_data or "has_meeting_place" in trip_data:
        if db_trip.has_meeting_place:
            db_trip.meeting_time = db_trip.start_date
        else:
            db_trip.meeting_time = None
    # If starting_city changed, re-derive timezone from the new city
    if "starting_city_id" in trip_data:
        city_tz = _derive_timezone_from_city(session, trip_data["starting_city_id"])
        if city_tz:
            db_trip.timezone = city_tz
    db_trip.updated_at = datetime.now(_tz.utc).replace(tzinfo=None)
    db_trip.content_hash = _compute_content_hash(db_trip)
    session.add(db_trip)
    session.commit()
    session.refresh(db_trip)
    return db_trip


def recompute_content_hash(*, session: Session, trip: Trip) -> None:
    """Recompute and persist content_hash after related changes (e.g. package update)."""
    trip.content_hash = _compute_content_hash(trip)
    session.add(trip)
    session.commit()


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


def duplicate_trip(*, session: Session, source_trip: Trip) -> Trip:
    """Clone a trip (without dates, resetting reference).

    Clones:
    - All Trip scalar fields (bilingual names, descriptions, images, metadata,
      timezone, trip_type, max_participants, starting_city_id, is_international,
      is_packaged_trip, has_meeting_place, meeting_location)
    - All TripPackage rows (with their required fields)
    - All TripDestination links

    NOT cloned: registration_deadline, meeting_time
    start_date and end_date are copied as-is (column is NOT NULL); the provider
    is expected to update them before re-publishing.
    """
    from app.models.trip_package import TripPackage as TripPackageModel
    from app.models.trip_package_field import TripPackageRequiredField
    from app.models.trip_destination import TripDestination

    new_trip = Trip(
        name_en=source_trip.name_en,
        name_ar=source_trip.name_ar,
        description_en=source_trip.description_en,
        description_ar=source_trip.description_ar,
        start_date=source_trip.start_date,
        end_date=source_trip.end_date,
        max_participants=source_trip.max_participants,
        is_active=False,  # draft until provider sets dates & activates
        images=list(source_trip.images) if source_trip.images else None,
        registration_deadline=None,
        starting_city_id=source_trip.starting_city_id,
        is_international=source_trip.is_international,
        is_packaged_trip=source_trip.is_packaged_trip,
        trip_metadata=dict(source_trip.trip_metadata) if source_trip.trip_metadata else None,
        timezone=source_trip.timezone,
        trip_type=source_trip.trip_type,
        has_meeting_place=source_trip.has_meeting_place,
        meeting_place_name=source_trip.meeting_place_name,
        meeting_location=source_trip.meeting_location,
        meeting_time=None,
        provider_id=source_trip.provider_id,
    )
    session.add(new_trip)
    session.flush()  # get new_trip.id before cloning children

    # Clone packages
    source_packages = session.exec(
        select(TripPackageModel).where(TripPackageModel.trip_id == source_trip.id)
    ).all()
    for pkg in source_packages:
        new_pkg = TripPackageModel(
            trip_id=new_trip.id,
            name_en=pkg.name_en,
            name_ar=pkg.name_ar,
            description_en=pkg.description_en,
            description_ar=pkg.description_ar,
            price=pkg.price,
            currency=pkg.currency,
            is_active=pkg.is_active,
            max_participants=pkg.max_participants,
            is_refundable=pkg.is_refundable,
            amenities=list(pkg.amenities) if pkg.amenities else None,
        )
        session.add(new_pkg)
        session.flush()

        # Clone required fields for this package
        source_fields = session.exec(
            select(TripPackageRequiredField).where(TripPackageRequiredField.package_id == pkg.id)
        ).all()
        for field in source_fields:
            new_field = TripPackageRequiredField(
                package_id=new_pkg.id,
                field_type=field.field_type,
                is_required=field.is_required,
                validation_config=dict(field.validation_config) if field.validation_config else None,
            )
            session.add(new_field)

    # Clone destinations
    source_dests = session.exec(
        select(TripDestination).where(TripDestination.trip_id == source_trip.id)
    ).all()
    for dest_link in source_dests:
        new_dest = TripDestination(
            trip_id=new_trip.id,
            destination_id=dest_link.destination_id,
        )
        session.add(new_dest)

    session.commit()
    session.refresh(new_trip)
    return new_trip


def rate_trip(*, session: Session, db_trip: Trip, rating_in: TripRatingCreate, user: User) -> Trip:
    rating_data = rating_in.model_dump()
    rating = TripRating(**rating_data, user_id=user.id, trip_id=db_trip.id)
    session.add(rating)
    session.commit()
    session.refresh(db_trip)
    return db_trip
