"""
Public API routes for trips (no authentication required)
"""

import logging
from typing import List, Optional
from datetime import datetime
from decimal import Decimal

from fastapi import APIRouter, Depends
from sqlmodel import Session

from app import crud
from app.api.deps import get_session
from app.schemas.trip import TripRead
from app.schemas.trip_package import TripPackageWithRequiredFields
from app.models.trip_package import TripPackage as TripPackageModel
from app.models.trip_package_field import TripPackageRequiredField

router = APIRouter()
logger = logging.getLogger(__name__)


@router.get("", response_model=List[TripRead])
def list_public_trips(
    session: Session = Depends(get_session),
    skip: int = 0,
    limit: int = 100,
    search: Optional[str] = None,
    provider_name: Optional[str] = None,
    start_date_from: Optional[str] = None,
    start_date_to: Optional[str] = None,
    end_date_from: Optional[str] = None,
    end_date_to: Optional[str] = None,
    min_price: Optional[float] = None,
    max_price: Optional[float] = None,
    min_participants: Optional[int] = None,
    max_participants: Optional[int] = None,
    min_rating: Optional[float] = None,
    is_active: Optional[bool] = True,
):
    """Retrieve and filter all trips (public endpoint for mobile app)."""
    start_date_from_dt = datetime.fromisoformat(start_date_from) if start_date_from else None
    start_date_to_dt = datetime.fromisoformat(start_date_to) if start_date_to else None
    end_date_from_dt = datetime.fromisoformat(end_date_from) if end_date_from else None
    end_date_to_dt = datetime.fromisoformat(end_date_to) if end_date_to else None
    
    min_price_decimal = Decimal(str(min_price)) if min_price is not None else None
    max_price_decimal = Decimal(str(max_price)) if max_price is not None else None
    
    trips = crud.trip.search_and_filter_trips(
        session=session,
        provider_id=None,
        provider_name=provider_name,
        search_query=search,
        start_date_from=start_date_from_dt,
        start_date_to=start_date_to_dt,
        end_date_from=end_date_from_dt,
        end_date_to=end_date_to_dt,
        min_price=min_price_decimal,
        max_price=max_price_decimal,
        min_participants=min_participants,
        max_participants=max_participants,
        min_rating=min_rating,
        is_active=is_active,
        skip=skip,
        limit=limit
    )
    
    trips_with_packages = []
    for trip in trips:
        packages = session.query(TripPackageModel).filter(
            TripPackageModel.trip_id == trip.id,
            TripPackageModel.is_active == True
        ).all()
        
        packages_with_fields = []
        for package in packages:
            required_fields = session.query(TripPackageRequiredField).filter(
                TripPackageRequiredField.package_id == package.id
            ).all()
            required_field_types = [rf.field_type.value for rf in required_fields]
            
            packages_with_fields.append(TripPackageWithRequiredFields(
                id=package.id,
                trip_id=package.trip_id,
                name_en=package.name_en,
                name_ar=package.name_ar,
                description_en=package.description_en,
                description_ar=package.description_ar,
                price=package.price,
                currency=package.currency,
                is_active=package.is_active,
                required_fields=required_field_types
            ))
        
        from app.crud import provider as provider_crud
        provider = provider_crud.get_provider(session=session, provider_id=trip.provider_id)
        provider_info = {
            "id": provider.id,
            "company_name": provider.company_name
        } if provider else {"id": trip.provider_id, "company_name": "Unknown"}
        
        trips_with_packages.append(TripRead(
            id=trip.id,
            provider_id=trip.provider_id,
            provider=provider_info,
            name_en=trip.name_en,
            name_ar=trip.name_ar,
            description_en=trip.description_en,
            description_ar=trip.description_ar,
            start_date=trip.start_date,
            end_date=trip.end_date,
            max_participants=trip.max_participants,
            trip_metadata=trip.trip_metadata,
            is_active=trip.is_active,
            packages=packages_with_fields
        ))
    
    return trips_with_packages


@router.get("/{trip_id}", response_model=TripRead)
def get_public_trip(
    trip_id: str,
    session: Session = Depends(get_session)
):
    """
    Get a single trip by ID (public endpoint for mobile app).
    
    No authentication required.
    """
    import uuid
    from fastapi import HTTPException
    
    try:
        trip_uuid = uuid.UUID(trip_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid trip ID format")
    
    trip = crud.trip.get_trip(session=session, trip_id=trip_uuid)
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    
    # Get packages with required fields
    packages = session.query(TripPackageModel).filter(
        TripPackageModel.trip_id == trip_uuid,
        TripPackageModel.is_active == True
    ).all()
    
    packages_with_fields = []
    for package in packages:
        required_fields = session.query(TripPackageRequiredField).filter(
            TripPackageRequiredField.package_id == package.id
        ).all()
        required_field_types = [rf.field_type.value for rf in required_fields]
        
        packages_with_fields.append(TripPackageWithRequiredFields(
            id=package.id,
            trip_id=package.trip_id,
            name=package.name,
            description=package.description,
            price=package.price,
            currency=package.currency,
            is_active=package.is_active,
            required_fields=required_field_types
        ))
    
    # Get provider info
    from app.crud import provider as provider_crud
    provider = provider_crud.get_provider(session=session, provider_id=trip.provider_id)
    provider_info = {
        "id": provider.id,
        "company_name": provider.company_name
    } if provider else {"id": trip.provider_id, "company_name": "Unknown"}
    
    return TripRead(
        id=trip.id,
        provider_id=trip.provider_id,
        provider=provider_info,
        name=trip.name,
        description=trip.description,
        start_date=trip.start_date,
        end_date=trip.end_date,
        max_participants=trip.max_participants,
        trip_metadata=trip.trip_metadata,
        is_active=trip.is_active,
        packages=packages_with_fields
    )
