"""
CRUD operations for destinations, places, and trip destinations
"""

import uuid
import re
from datetime import datetime
from typing import Optional, List
from sqlmodel import Session, select, and_
from fastapi import HTTPException

from app.models.destination import Destination, DestinationType
from app.models.place import Place
from app.models.trip_destination import TripDestination
from app.models.trip import Trip
from app.schemas.destination import (
    DestinationCreate,
    DestinationUpdate,
    PlaceCreate,
    PlaceUpdate,
    TripDestinationCreate,
)


def slugify(text: str) -> str:
    """Convert text to URL-friendly slug"""
    text = text.lower().strip()
    text = re.sub(r'[^\w\s-]', '', text)
    text = re.sub(r'[\s_]+', '-', text)
    text = re.sub(r'-+', '-', text)
    return text.strip('-')


# ===== Destination CRUD =====


def create_destination(
    session: Session,
    data: DestinationCreate,
) -> Destination:
    """Create a new destination (country or city)."""
    # If city, parent must exist and be a country
    if data.type == DestinationType.CITY:
        if not data.parent_id:
            raise HTTPException(status_code=400, detail="City must have a parent country")
        parent = session.get(Destination, data.parent_id)
        if not parent:
            raise HTTPException(status_code=404, detail="Parent destination not found")
        if parent.type != DestinationType.COUNTRY:
            raise HTTPException(status_code=400, detail="Parent must be a country")
        full_slug = f"{parent.slug}/{data.slug}"
        country_code = parent.country_code
    else:
        # Country
        if data.parent_id:
            raise HTTPException(status_code=400, detail="Country cannot have a parent")
        full_slug = data.slug
        country_code = data.country_code

    destination = Destination(
        type=data.type,
        parent_id=data.parent_id,
        country_code=country_code,
        slug=data.slug,
        full_slug=full_slug,
        name_en=data.name_en,
        name_ar=data.name_ar,
        timezone=data.timezone,
        currency_code=data.currency_code,
        google_place_id=data.google_place_id,
        is_active=data.is_active,
        display_order=data.display_order,
    )

    session.add(destination)
    session.commit()
    session.refresh(destination)
    return destination


def get_destination(
    session: Session,
    destination_id: uuid.UUID,
) -> Optional[Destination]:
    """Get a destination by ID."""
    return session.get(Destination, destination_id)


def get_all_destinations(
    session: Session,
    type_filter: Optional[DestinationType] = None,
    active_only: bool = False,
) -> List[Destination]:
    """Get all destinations, optionally filtered."""
    statement = select(Destination)
    if type_filter:
        statement = statement.where(Destination.type == type_filter)
    if active_only:
        statement = statement.where(Destination.is_active == True)
    statement = statement.order_by(Destination.display_order, Destination.name_en)
    return list(session.exec(statement).all())


def get_countries(
    session: Session,
    active_only: bool = False,
) -> List[Destination]:
    """Get all country-level destinations."""
    return get_all_destinations(session, type_filter=DestinationType.COUNTRY, active_only=active_only)


def get_children(
    session: Session,
    parent_id: uuid.UUID,
    active_only: bool = False,
) -> List[Destination]:
    """Get child destinations (cities) of a parent (country)."""
    statement = select(Destination).where(Destination.parent_id == parent_id)
    if active_only:
        statement = statement.where(Destination.is_active == True)
    statement = statement.order_by(Destination.display_order, Destination.name_en)
    return list(session.exec(statement).all())


def update_destination(
    session: Session,
    destination_id: uuid.UUID,
    data: DestinationUpdate,
) -> Destination:
    """Update a destination."""
    destination = session.get(Destination, destination_id)
    if not destination:
        raise HTTPException(status_code=404, detail="Destination not found")

    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(destination, key, value)

    # Rebuild full_slug if slug changed
    if "slug" in update_data:
        if destination.parent_id:
            parent = session.get(Destination, destination.parent_id)
            destination.full_slug = f"{parent.slug}/{destination.slug}"
        else:
            destination.full_slug = destination.slug

    destination.updated_at = datetime.utcnow()
    session.add(destination)
    session.commit()
    session.refresh(destination)
    return destination


def delete_destination(
    session: Session,
    destination_id: uuid.UUID,
) -> None:
    """Delete a destination and its children."""
    destination = session.get(Destination, destination_id)
    if not destination:
        raise HTTPException(status_code=404, detail="Destination not found")

    session.delete(destination)
    session.commit()


def activate_destination(
    session: Session,
    destination_id: uuid.UUID,
    is_active: bool = True,
) -> Destination:
    """Activate or deactivate a destination."""
    destination = session.get(Destination, destination_id)
    if not destination:
        raise HTTPException(status_code=404, detail="Destination not found")

    destination.is_active = is_active
    destination.updated_at = datetime.utcnow()
    session.add(destination)
    session.commit()
    session.refresh(destination)
    return destination


# ===== Place CRUD =====


def create_place(
    session: Session,
    destination_id: uuid.UUID,
    data: PlaceCreate,
) -> Place:
    """Create a place within a destination."""
    destination = session.get(Destination, destination_id)
    if not destination:
        raise HTTPException(status_code=404, detail="Destination not found")

    place = Place(
        destination_id=destination_id,
        type=data.type,
        slug=data.slug,
        name_en=data.name_en,
        name_ar=data.name_ar,
        latitude=data.latitude,
        longitude=data.longitude,
        google_place_id=data.google_place_id,
        is_active=data.is_active,
        display_order=data.display_order,
    )

    session.add(place)
    session.commit()
    session.refresh(place)
    return place


def get_place(
    session: Session,
    place_id: uuid.UUID,
) -> Optional[Place]:
    """Get a place by ID."""
    return session.get(Place, place_id)


def get_places_for_destination(
    session: Session,
    destination_id: uuid.UUID,
    active_only: bool = False,
) -> List[Place]:
    """Get all places for a destination."""
    statement = select(Place).where(Place.destination_id == destination_id)
    if active_only:
        statement = statement.where(Place.is_active == True)
    statement = statement.order_by(Place.display_order, Place.name_en)
    return list(session.exec(statement).all())


def update_place(
    session: Session,
    place_id: uuid.UUID,
    data: PlaceUpdate,
) -> Place:
    """Update a place."""
    place = session.get(Place, place_id)
    if not place:
        raise HTTPException(status_code=404, detail="Place not found")

    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(place, key, value)

    place.updated_at = datetime.utcnow()
    session.add(place)
    session.commit()
    session.refresh(place)
    return place


def delete_place(
    session: Session,
    place_id: uuid.UUID,
) -> None:
    """Delete a place."""
    place = session.get(Place, place_id)
    if not place:
        raise HTTPException(status_code=404, detail="Place not found")

    session.delete(place)
    session.commit()


# ===== Trip Destination CRUD =====


def add_trip_destination(
    session: Session,
    trip_id: uuid.UUID,
    data: TripDestinationCreate,
) -> TripDestination:
    """Add a destination to a trip."""
    # Verify trip exists
    trip = session.get(Trip, trip_id)
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")

    # Verify destination exists and is active
    destination = session.get(Destination, data.destination_id)
    if not destination:
        raise HTTPException(status_code=404, detail="Destination not found")
    if not destination.is_active:
        raise HTTPException(status_code=400, detail="Destination is not active")

    # Verify place if provided
    if data.place_id:
        place = session.get(Place, data.place_id)
        if not place:
            raise HTTPException(status_code=404, detail="Place not found")
        if place.destination_id != data.destination_id:
            raise HTTPException(status_code=400, detail="Place does not belong to the specified destination")

    # Check for duplicate
    existing = session.exec(
        select(TripDestination).where(
            and_(
                TripDestination.trip_id == trip_id,
                TripDestination.destination_id == data.destination_id,
            )
        )
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Destination already added to this trip")

    trip_dest = TripDestination(
        trip_id=trip_id,
        destination_id=data.destination_id,
        place_id=data.place_id,
    )

    session.add(trip_dest)
    session.commit()
    session.refresh(trip_dest)
    return trip_dest


def remove_trip_destination(
    session: Session,
    trip_id: uuid.UUID,
    trip_destination_id: uuid.UUID,
) -> None:
    """Remove a destination from a trip."""
    trip_dest = session.get(TripDestination, trip_destination_id)
    if not trip_dest:
        raise HTTPException(status_code=404, detail="Trip destination not found")
    if trip_dest.trip_id != trip_id:
        raise HTTPException(status_code=400, detail="Trip destination does not belong to this trip")

    session.delete(trip_dest)
    session.commit()


def get_trip_destinations(
    session: Session,
    trip_id: uuid.UUID,
) -> List[TripDestination]:
    """Get all destinations for a trip."""
    statement = select(TripDestination).where(
        TripDestination.trip_id == trip_id
    ).order_by(TripDestination.created_at)
    return list(session.exec(statement).all())
