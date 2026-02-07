"""
API routes for destinations, places, and trip destinations
"""

import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session

from app.api.deps import get_session, get_current_active_admin, get_current_active_provider
from app.models.user import User
from app.models.destination import DestinationType
from app.schemas.destination import (
    DestinationCreate,
    DestinationUpdate,
    DestinationRead,
    DestinationReadWithChildren,
    PlaceCreate,
    PlaceUpdate,
    PlaceRead,
    TripDestinationCreate,
    TripDestinationRead,
)
from app import crud

router = APIRouter()


# ===== Admin - Destination Management =====


@router.post("/admin/destinations", response_model=DestinationRead)
def admin_create_destination(
    data: DestinationCreate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_active_admin),
):
    """Create a new destination (country or city). Admin only."""
    destination = crud.destination.create_destination(session=session, data=data)
    return DestinationRead.model_validate(destination)


@router.get("/admin/destinations", response_model=List[DestinationReadWithChildren])
def admin_list_destinations(
    type: Optional[DestinationType] = None,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_active_admin),
):
    """List all destinations with hierarchy. Admin only."""
    if type:
        destinations = crud.destination.get_all_destinations(session=session, type_filter=type)
        return [_build_destination_tree(d, session) for d in destinations]

    # Return full tree: countries with their cities
    countries = crud.destination.get_countries(session=session)
    result = []
    for country in countries:
        result.append(_build_destination_tree(country, session))
    return result


@router.get("/admin/destinations/{destination_id}", response_model=DestinationReadWithChildren)
def admin_get_destination(
    destination_id: uuid.UUID,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_active_admin),
):
    """Get a single destination with children. Admin only."""
    destination = crud.destination.get_destination(session=session, destination_id=destination_id)
    if not destination:
        raise HTTPException(status_code=404, detail="Destination not found")
    return _build_destination_tree(destination, session)


@router.patch("/admin/destinations/{destination_id}", response_model=DestinationRead)
def admin_update_destination(
    destination_id: uuid.UUID,
    data: DestinationUpdate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_active_admin),
):
    """Update a destination. Admin only."""
    destination = crud.destination.update_destination(
        session=session, destination_id=destination_id, data=data
    )
    return DestinationRead.model_validate(destination)


@router.delete("/admin/destinations/{destination_id}", status_code=204)
def admin_delete_destination(
    destination_id: uuid.UUID,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_active_admin),
):
    """Delete a destination. Admin only."""
    crud.destination.delete_destination(session=session, destination_id=destination_id)
    return None


@router.patch("/admin/destinations/{destination_id}/activate", response_model=DestinationRead)
def admin_activate_destination(
    destination_id: uuid.UUID,
    is_active: bool = True,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_active_admin),
):
    """Activate or deactivate a destination. Admin only."""
    destination = crud.destination.activate_destination(
        session=session, destination_id=destination_id, is_active=is_active
    )
    return DestinationRead.model_validate(destination)


# ===== Admin - Place Management =====


@router.post("/admin/destinations/{destination_id}/places", response_model=PlaceRead)
def admin_create_place(
    destination_id: uuid.UUID,
    data: PlaceCreate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_active_admin),
):
    """Create a place within a destination. Admin only."""
    place = crud.destination.create_place(
        session=session, destination_id=destination_id, data=data
    )
    return PlaceRead.model_validate(place)


@router.get("/admin/destinations/{destination_id}/places", response_model=List[PlaceRead])
def admin_list_places(
    destination_id: uuid.UUID,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_active_admin),
):
    """List all places for a destination. Admin only."""
    places = crud.destination.get_places_for_destination(
        session=session, destination_id=destination_id
    )
    return [PlaceRead.model_validate(p) for p in places]


@router.patch("/admin/places/{place_id}", response_model=PlaceRead)
def admin_update_place(
    place_id: uuid.UUID,
    data: PlaceUpdate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_active_admin),
):
    """Update a place. Admin only."""
    place = crud.destination.update_place(session=session, place_id=place_id, data=data)
    return PlaceRead.model_validate(place)


@router.delete("/admin/places/{place_id}", status_code=204)
def admin_delete_place(
    place_id: uuid.UUID,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_active_admin),
):
    """Delete a place. Admin only."""
    crud.destination.delete_place(session=session, place_id=place_id)
    return None


# ===== Public - Active Destinations =====


@router.get("/destinations", response_model=List[DestinationReadWithChildren])
def get_active_destinations(
    session: Session = Depends(get_session),
):
    """
    Get active destinations tree for trip creation and browsing.
    Public endpoint - no authentication required.
    """
    countries = crud.destination.get_countries(session=session, active_only=True)
    result = []
    for country in countries:
        result.append(_build_destination_tree(country, session, active_only=True))
    return result


@router.get("/destinations/{destination_id}/places", response_model=List[PlaceRead])
def get_destination_places(
    destination_id: uuid.UUID,
    session: Session = Depends(get_session),
):
    """
    Get active places for a destination.
    Public endpoint - no authentication required.
    """
    destination = crud.destination.get_destination(session=session, destination_id=destination_id)
    if not destination:
        raise HTTPException(status_code=404, detail="Destination not found")

    places = crud.destination.get_places_for_destination(
        session=session, destination_id=destination_id, active_only=True
    )
    return [PlaceRead.model_validate(p) for p in places]


# ===== Provider - Trip Destinations =====


@router.post("/trips/{trip_id}/destinations", response_model=TripDestinationRead)
def add_destination_to_trip(
    trip_id: uuid.UUID,
    data: TripDestinationCreate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_active_provider),
):
    """Add a destination to a trip. Provider only."""
    # Verify provider owns the trip
    trip = crud.trip.get_trip(session=session, trip_id=trip_id)
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    if trip.provider_id != current_user.provider_id:
        raise HTTPException(status_code=403, detail="You can only manage destinations for your own trips")

    trip_dest = crud.destination.add_trip_destination(
        session=session, trip_id=trip_id, data=data
    )

    return _build_trip_destination_read(trip_dest, session)


@router.delete("/trips/{trip_id}/destinations/{trip_destination_id}", status_code=204)
def remove_destination_from_trip(
    trip_id: uuid.UUID,
    trip_destination_id: uuid.UUID,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_active_provider),
):
    """Remove a destination from a trip. Provider only."""
    trip = crud.trip.get_trip(session=session, trip_id=trip_id)
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    if trip.provider_id != current_user.provider_id:
        raise HTTPException(status_code=403, detail="You can only manage destinations for your own trips")

    crud.destination.remove_trip_destination(
        session=session, trip_id=trip_id, trip_destination_id=trip_destination_id
    )
    return None


@router.get("/trips/{trip_id}/destinations", response_model=List[TripDestinationRead])
def list_trip_destinations(
    trip_id: uuid.UUID,
    session: Session = Depends(get_session),
):
    """
    List all destinations for a trip.
    Public endpoint - no authentication required.
    """
    trip_dests = crud.destination.get_trip_destinations(session=session, trip_id=trip_id)
    return [_build_trip_destination_read(td, session) for td in trip_dests]


# ===== Helpers =====


def _build_destination_tree(
    destination, session: Session, active_only: bool = False
) -> DestinationReadWithChildren:
    """Build a destination tree with children and places."""
    children = crud.destination.get_children(
        session=session, parent_id=destination.id, active_only=active_only
    )
    places = crud.destination.get_places_for_destination(
        session=session, destination_id=destination.id, active_only=active_only
    )

    return DestinationReadWithChildren(
        **DestinationRead.model_validate(destination).model_dump(),
        children=[_build_destination_tree(c, session, active_only) for c in children],
        places=[PlaceRead.model_validate(p) for p in places],
    )


def _build_trip_destination_read(
    trip_dest, session: Session
) -> TripDestinationRead:
    """Build a TripDestinationRead with nested destination and place data."""
    dest = crud.destination.get_destination(session=session, destination_id=trip_dest.destination_id)
    place = None
    if trip_dest.place_id:
        place = crud.destination.get_place(session=session, place_id=trip_dest.place_id)

    return TripDestinationRead(
        id=trip_dest.id,
        trip_id=trip_dest.trip_id,
        destination_id=trip_dest.destination_id,
        place_id=trip_dest.place_id,
        created_at=trip_dest.created_at,
        destination=DestinationRead.model_validate(dest) if dest else None,
        place=PlaceRead.model_validate(place) if place else None,
    )
