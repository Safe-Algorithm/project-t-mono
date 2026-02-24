import asyncio
import uuid
import logging
from typing import List, Dict, Any, Optional

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, UploadFile, File
from sqlmodel import Session
from pydantic import BaseModel

from app import crud
from app.api.deps import get_current_active_provider, get_session, get_current_active_user
from app.models.user import User
from app.utils.localization import get_name, get_description
from app.schemas.trip import TripCreate, TripRead, TripUpdate
from app.schemas.trip_package_field import TripPackageRequiredFieldsResponse, PackageRequiredFieldWithValidation, TripPackageRequiredFieldsSet, TripPackageRequiredFieldsSetWithValidation
from app.models.trip_field import TripFieldType, FIELD_METADATA
from app.models.field_validation import get_available_validations_for_field, validate_field_value, validate_validation_config, VALIDATION_METADATA
from app.schemas.field_metadata import AvailableFieldsResponse, FieldMetadata, FieldOption
from app.schemas.trip_package import TripPackageCreate, TripPackage, TripPackageUpdate, TripPackageWithRequiredFields
from app.schemas.trip_registration import TripRegistrationCreate, TripRegistration
from app.schemas.trip_extra_fee import TripExtraFeeCreate, TripExtraFeeUpdate, TripExtraFeeResponse
from app.crud import trip_extra_fee

router = APIRouter()
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def _get_starting_city_info(session: Session, trip) -> Optional[dict]:
    if not trip.starting_city_id:
        return None
    from app.models.destination import Destination
    sc = session.get(Destination, trip.starting_city_id)
    if not sc:
        return None
    return {"id": sc.id, "name_en": sc.name_en, "name_ar": sc.name_ar, "country_code": sc.country_code}


def _build_package_with_fields(session: Session, package) -> TripPackageWithRequiredFields:
    """Build TripPackageWithRequiredFields from a TripPackage ORM object."""
    from app.models.trip_package_field import TripPackageRequiredField
    from app.models.trip_registration import TripRegistration as TripRegistrationModel, TripRegistrationParticipant as TripParticipantModel
    required_fields = session.query(TripPackageRequiredField).filter(
        TripPackageRequiredField.package_id == package.id
    ).all()
    required_field_types = [rf.field_type.value for rf in required_fields]
    required_fields_details = [
        {"id": str(rf.id), "package_id": str(rf.package_id), "field_type": rf.field_type.value,
         "is_required": rf.is_required, "validation_config": rf.validation_config}
        for rf in required_fields
    ]
    # Compute per-package available_spots if max_participants is set
    available_spots = None
    if package.max_participants is not None:
        booked_in_pkg = (
            session.query(TripParticipantModel)
            .join(TripRegistrationModel, TripParticipantModel.registration_id == TripRegistrationModel.id)
            .filter(
                TripParticipantModel.package_id == package.id,
                TripRegistrationModel.status.in_(["confirmed", "pending_payment"]),
            )
            .count()
        )
        available_spots = max(0, package.max_participants - booked_in_pkg)
    return TripPackageWithRequiredFields(
        id=package.id, trip_id=package.trip_id,
        name_en=package.name_en, name_ar=package.name_ar,
        description_en=package.description_en, description_ar=package.description_ar,
        price=package.price, currency=package.currency, is_active=package.is_active,
        max_participants=package.max_participants,
        available_spots=available_spots,
        is_refundable=package.is_refundable,
        amenities=package.amenities,
        required_fields=required_field_types,
        required_fields_details=required_fields_details,
    )


def _sync_hidden_package(
    session: Session, trip,
    price=None, is_refundable=None, amenities=None,
    required_field_types=None,
) -> None:
    """For non-packaged trips: ensure exactly one hidden package exists and is in sync."""
    from app.models.trip_package import TripPackage as TripPackageModel
    from app.models.trip_package_field import TripPackageRequiredField
    from app.models.trip_field import TripFieldType
    from decimal import Decimal
    existing = session.query(TripPackageModel).filter(TripPackageModel.trip_id == trip.id).first()
    if existing:
        existing.max_participants = trip.max_participants
        if price is not None:
            existing.price = Decimal(str(price))
        if is_refundable is not None:
            existing.is_refundable = is_refundable
        if amenities is not None:
            existing.amenities = list(amenities)
        session.add(existing)
    else:
        hidden = TripPackageModel(
            trip_id=trip.id, name_en="Standard", name_ar="قياسي",
            description_en="Standard package", description_ar="الباقة القياسية",
            price=Decimal(str(price)) if price is not None else Decimal("0.00"),
            is_active=True,
            max_participants=trip.max_participants,
            is_refundable=is_refundable if is_refundable is not None else True,
            amenities=list(amenities) if amenities else None,
        )
        session.add(hidden)
        session.flush()
        fields_to_add = required_field_types or [TripFieldType.NAME, TripFieldType.DATE_OF_BIRTH]
        for ft in fields_to_add:
            session.add(TripPackageRequiredField(package_id=hidden.id, field_type=ft))
    session.commit()


def _build_trip_read(session: Session, trip, provider_info: dict, extra_fees: list) -> TripRead:
    """Build a TripRead response. For non-packaged trips, surfaces is_refundable/amenities
    from the hidden package into the response (not stored on Trip itself)."""
    from app.models.trip_package import TripPackage as TripPackageModel
    from app.models.trip_registration import TripRegistration as TripRegistrationModel
    from sqlmodel import select as sql_select
    all_packages = session.query(TripPackageModel).filter(
        TripPackageModel.trip_id == trip.id, TripPackageModel.is_active == True,
    ).all()
    # Computed response-only fields for non-packaged trips
    resp_price = None
    resp_is_refundable = None
    resp_amenities = None
    if trip.is_packaged_trip:
        packages_with_fields = [_build_package_with_fields(session, p) for p in all_packages]
    else:
        packages_with_fields = []
        if all_packages:
            hp = all_packages[0]
            if hp.max_participants is not None:
                trip.max_participants = hp.max_participants
            resp_price = float(hp.price) if hp.price is not None else None
            resp_is_refundable = hp.is_refundable
            resp_amenities = hp.amenities
    active_regs = session.exec(
        sql_select(TripRegistrationModel).where(
            TripRegistrationModel.trip_id == trip.id,
            TripRegistrationModel.status.in_(["confirmed", "pending_payment"]),
        )
    ).all()
    booked = sum(r.total_participants for r in active_regs)
    return TripRead(
        id=trip.id, provider_id=trip.provider_id, provider=provider_info,
        name_en=trip.name_en, name_ar=trip.name_ar,
        description_en=trip.description_en, description_ar=trip.description_ar,
        start_date=trip.start_date, end_date=trip.end_date,
        max_participants=trip.max_participants, images=trip.images,
        trip_metadata=trip.trip_metadata, is_active=trip.is_active,
        price=resp_price, is_refundable=resp_is_refundable, amenities=resp_amenities,
        has_meeting_place=trip.has_meeting_place, meeting_location=trip.meeting_location,
        meeting_time=trip.meeting_time, trip_reference=trip.trip_reference,
        registration_deadline=trip.registration_deadline,
        starting_city_id=trip.starting_city_id,
        starting_city=_get_starting_city_info(session, trip),
        is_international=trip.is_international, is_packaged_trip=trip.is_packaged_trip,
        packages=packages_with_fields, extra_fees=extra_fees,
        available_spots=max(0, trip.max_participants - booked),
    )


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
        trip = crud.trip.create_trip(
            session=session, trip_in=trip_in, provider=current_user.provider
        )
        logger.info(f"Trip created successfully with ID: {trip.id}")
        # For non-packaged trips, auto-create the hidden package
        if not trip.is_packaged_trip:
            _sync_hidden_package(
                session, trip,
                price=trip_in.price,
                is_refundable=trip_in.is_refundable,
                amenities=trip_in.amenities,
            )
            session.refresh(trip)
        from app.crud import provider as provider_crud
        provider = provider_crud.get_provider(session=session, provider_id=trip.provider_id)
        provider_info = {"id": provider.id, "company_name": provider.company_name} if provider else {"id": trip.provider_id, "company_name": "Unknown"}
        from app.models.trip_amenity import TripExtraFee
        extra_fees = session.query(TripExtraFee).filter(TripExtraFee.trip_id == trip.id).all()
        return _build_trip_read(session, trip, provider_info, extra_fees)
    except Exception as e:
        logger.error(f"Error creating trip: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("", response_model=List[TripRead])
def read_trips(
    session: Session = Depends(get_session),
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(get_current_active_provider),
    search: Optional[str] = None,
    start_date_from: Optional[str] = None,
    start_date_to: Optional[str] = None,
    end_date_from: Optional[str] = None,
    end_date_to: Optional[str] = None,
    min_price: Optional[float] = None,
    max_price: Optional[float] = None,
    min_participants: Optional[int] = None,
    max_participants: Optional[int] = None,
    min_rating: Optional[float] = None,
    is_active: Optional[bool] = None,
):
    """Retrieve and filter trips for the current provider."""
    from datetime import datetime
    from decimal import Decimal
    
    # Parse date strings to datetime objects
    start_date_from_dt = datetime.fromisoformat(start_date_from) if start_date_from else None
    start_date_to_dt = datetime.fromisoformat(start_date_to) if start_date_to else None
    end_date_from_dt = datetime.fromisoformat(end_date_from) if end_date_from else None
    end_date_to_dt = datetime.fromisoformat(end_date_to) if end_date_to else None
    
    # Convert price to Decimal
    min_price_decimal = Decimal(str(min_price)) if min_price is not None else None
    max_price_decimal = Decimal(str(max_price)) if max_price is not None else None
    
    trips = crud.trip.search_and_filter_trips(
        session=session,
        provider_id=current_user.provider_id,
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
        from app.crud import provider as provider_crud
        _prov = provider_crud.get_provider(session=session, provider_id=trip.provider_id)
        _pinfo = {"id": _prov.id, "company_name": _prov.company_name} if _prov else {"id": trip.provider_id, "company_name": "Unknown"}
        trips_with_packages.append(_build_trip_read(session, trip, _pinfo, []))
    return trips_with_packages


# Available Fields Endpoint
@router.get("/available-fields", response_model=AvailableFieldsResponse)
def get_available_package_fields(
    current_user: User = Depends(get_current_active_provider),
):
    """Get all available field types with metadata for trip package creation."""
    fields = []
    
    for field_type in TripFieldType:
        metadata = FIELD_METADATA.get(field_type, {})
        
        # Convert options if they exist
        options = None
        if "options" in metadata:
            options = [
                FieldOption(value=opt["value"], label=opt["label"], label_ar=opt.get("label_ar"))
                for opt in metadata["options"]
            ]
        
        field_metadata = FieldMetadata(
            field_name=field_type,
            display_name=metadata.get("display_name", field_type.value.replace("_", " ").title()),
            display_name_ar=metadata.get("display_name_ar"),
            ui_type=metadata.get("ui_type", "text"),
            placeholder=metadata.get("placeholder"),
            placeholder_ar=metadata.get("placeholder_ar"),
            required=metadata.get("required", True),
            options=options,
            available_validations=metadata.get("available_validations", [])
        )
        fields.append(field_metadata)
    
    return AvailableFieldsResponse(fields=fields)


@router.get("/registrations/{registration_id}", response_model=TripRegistration)
def get_my_registration(
    *,
    session: Session = Depends(get_session),
    registration_id: uuid.UUID,
    current_user: User = Depends(get_current_active_user),
):
    """Get a specific registration by ID (must belong to current user)."""
    from app.models.trip_registration import TripRegistration as TripRegistrationModel
    from app.models.trip import Trip as TripModel
    from app.models.provider import Provider as ProviderModel
    from app.schemas.trip_registration import RegistrationTripInfo

    registration = session.get(TripRegistrationModel, registration_id)
    if not registration:
        raise HTTPException(status_code=404, detail="Registration not found")
    if registration.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")

    trip = registration.trip or session.get(TripModel, registration.trip_id)
    provider = (trip.provider if trip else None) or (session.get(ProviderModel, trip.provider_id) if trip else None)

    trip_info = RegistrationTripInfo(
        id=trip.id,
        name_en=trip.name_en,
        name_ar=trip.name_ar,
        description_en=trip.description_en,
        description_ar=trip.description_ar,
        start_date=trip.start_date,
        end_date=trip.end_date,
        provider_id=trip.provider_id,
        trip_reference=trip.trip_reference,
        provider={"id": str(provider.id), "company_name": provider.company_name} if provider else {"id": str(trip.provider_id), "company_name": "Unknown"},
    )

    from app.schemas.trip_registration import TripRegistration as TripRegistrationSchema
    return TripRegistrationSchema(
        id=registration.id,
        trip_id=registration.trip_id,
        user_id=registration.user_id,
        total_participants=registration.total_participants,
        total_amount=registration.total_amount,
        status=registration.status,
        registration_date=registration.registration_date,
        spot_reserved_until=registration.spot_reserved_until,
        booking_reference=registration.booking_reference,
        participants=list(registration.participants or []),
        trip=trip_info,
    )


@router.get("/all", response_model=List[TripRead])
def list_all_trips(
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
    from datetime import datetime
    from decimal import Decimal
    
    # Parse date strings to datetime objects
    start_date_from_dt = datetime.fromisoformat(start_date_from) if start_date_from else None
    start_date_to_dt = datetime.fromisoformat(start_date_to) if start_date_to else None
    end_date_from_dt = datetime.fromisoformat(end_date_from) if end_date_from else None
    end_date_to_dt = datetime.fromisoformat(end_date_to) if end_date_to else None
    
    # Convert price to Decimal
    min_price_decimal = Decimal(str(min_price)) if min_price is not None else None
    max_price_decimal = Decimal(str(max_price)) if max_price is not None else None
    
    trips = crud.trip.search_and_filter_trips(
        session=session,
        provider_id=None,  # No provider filter for public endpoint
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
        from app.crud import provider as provider_crud
        _prov = provider_crud.get_provider(session=session, provider_id=trip.provider_id)
        _pinfo = {"id": _prov.id, "company_name": _prov.company_name} if _prov else {"id": trip.provider_id, "company_name": "Unknown"}
        trips_with_packages.append(_build_trip_read(session, trip, _pinfo, []))
    return trips_with_packages


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
    from app.crud import provider as provider_crud
    provider = provider_crud.get_provider(session=session, provider_id=trip.provider_id)
    provider_info = {"id": provider.id, "company_name": provider.company_name} if provider else {"id": trip.provider_id, "company_name": "Unknown"}
    from app.models.trip_amenity import TripExtraFee
    extra_fees = session.query(TripExtraFee).filter(TripExtraFee.trip_id == trip_id).all()
    return _build_trip_read(session, trip, provider_info, extra_fees)


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
    if not trip.name_en and not trip.name_ar:
        raise HTTPException(status_code=400, detail="At least one of name_en or name_ar must be provided")
    if not trip.description_en and not trip.description_ar:
        raise HTTPException(status_code=400, detail="At least one of description_en or description_ar must be provided")
    if not trip.is_packaged_trip:
        _sync_hidden_package(
            session, trip,
            price=trip_in.price,
            is_refundable=trip_in.is_refundable,
            amenities=trip_in.amenities,
        )
        session.refresh(trip)
    from app.crud import provider as provider_crud
    provider = provider_crud.get_provider(session=session, provider_id=trip.provider_id)
    provider_info = {"id": provider.id, "company_name": provider.company_name} if provider else {"id": trip.provider_id, "company_name": "Unknown"}
    from app.models.trip_amenity import TripExtraFee
    extra_fees = session.query(TripExtraFee).filter(TripExtraFee.trip_id == trip_id).all()
    return _build_trip_read(session, trip, provider_info, extra_fees)


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


# @router.post("/{trip_id}/rate", response_model=TripRead)
# def rate_trip(
#     *,
#     session: Session = Depends(get_session),
#     trip_id: uuid.UUID,
#     rating_in: TripRatingCreate,
#     current_user: User = Depends(get_current_active_user),
# ):
#     """Rate a trip."""
#     try:
#         trip = crud.trip.get_trip(session=session, trip_id=trip_id)
#         if not trip:
#             raise HTTPException(status_code=404, detail="Trip not found")
#         trip = crud.trip.rate_trip(
#             session=session, db_trip=trip, rating_in=rating_in, user=current_user
#         )
#         return trip
#     except Exception as e:
#         logger.error(f"Error rating trip: {e}", exc_info=True)
#         raise HTTPException(status_code=500, detail=str(e))


# Note: Required fields are now managed at the package level via TripPackageRequiredField
# See package endpoints below for field management


# Trip Packages Endpoints
@router.post("/{trip_id}/packages", response_model=TripPackageWithRequiredFields)
def create_trip_package(
    *,
    session: Session = Depends(get_session),
    trip_id: uuid.UUID,
    package_in: TripPackageCreate,
    current_user: User = Depends(get_current_active_provider),
):
    """Create a package for a trip."""
    trip = crud.trip.get_trip(session=session, trip_id=trip_id)
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    if trip.provider_id != current_user.provider_id:
        raise HTTPException(status_code=403, detail="Not enough permissions")
    
    from app.models.trip_package import TripPackage as TripPackageModel
    from app.models.trip_package_field import TripPackageRequiredField
    
    # Create package without required_fields
    package_data = package_in.model_dump(exclude={"required_fields"})
    package = TripPackageModel(trip_id=trip_id, **package_data)
    session.add(package)
    session.commit()
    session.refresh(package)
    
    # Add required fields - always include NAME and DATE_OF_BIRTH, plus any additional fields
    from app.models.trip_field import TripFieldType
    mandatory_fields = {TripFieldType.NAME, TripFieldType.DATE_OF_BIRTH}
    
    # Start with mandatory fields
    required_fields_to_add = set(mandatory_fields)
    
    # Add any additional fields provided by user
    if package_in.required_fields:
        required_fields_to_add.update(package_in.required_fields)
    
    # Convert back to list
    required_fields_to_add = list(required_fields_to_add)
    
    for field_type in required_fields_to_add:
        required_field = TripPackageRequiredField(
            package_id=package.id, 
            field_type=field_type
        )
        session.add(required_field)
    session.commit()
    
    # Get required fields for response
    required_fields = session.query(TripPackageRequiredField).filter(
        TripPackageRequiredField.package_id == package.id
    ).all()
    required_field_types = [rf.field_type.value for rf in required_fields]
    
    # Create response with required fields
    return TripPackageWithRequiredFields(
        id=package.id,
        trip_id=package.trip_id,
        name_en=package.name_en,
        name_ar=package.name_ar,
        description_en=package.description_en,
        description_ar=package.description_ar,
        price=package.price,
        is_active=package.is_active,
        required_fields=required_field_types
    )


@router.get("/{trip_id}/packages", response_model=List[TripPackageWithRequiredFields])
def get_trip_packages(
    *,
    session: Session = Depends(get_session),
    trip_id: uuid.UUID,
):
    """Get packages for a trip."""
    trip = crud.trip.get_trip(session=session, trip_id=trip_id)
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    
    from app.models.trip_package import TripPackage as TripPackageModel
    from app.models.trip_package_field import TripPackageRequiredField
    
    packages = session.query(TripPackageModel).filter(
        TripPackageModel.trip_id == trip_id,
        TripPackageModel.is_active == True
    ).all()
    
    # Create response with required_fields for each package
    response_packages = []
    for package in packages:
        required_fields = session.query(TripPackageRequiredField).filter(
            TripPackageRequiredField.package_id == package.id
        ).all()
        required_field_types = [rf.field_type.value for rf in required_fields]
        
        response_packages.append(TripPackageWithRequiredFields(
            id=package.id,
            trip_id=package.trip_id,
            name_en=package.name_en,
            name_ar=package.name_ar,
            description_en=package.description_en,
            description_ar=package.description_ar,
            price=package.price,
            is_active=package.is_active,
            required_fields=required_field_types
        ))
    
    return response_packages


@router.put("/{trip_id}/packages/{package_id}", response_model=TripPackageWithRequiredFields)
def update_trip_package(
    *,
    session: Session = Depends(get_session),
    trip_id: uuid.UUID,
    package_id: uuid.UUID,
    package_in: TripPackageUpdate,
    current_user: User = Depends(get_current_active_provider),
):
    """Update a trip package."""
    trip = crud.trip.get_trip(session=session, trip_id=trip_id)
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    if trip.provider_id != current_user.provider_id:
        raise HTTPException(status_code=403, detail="Not enough permissions")
    
    from app.models.trip_package import TripPackage as TripPackageModel
    from app.models.trip_package_field import TripPackageRequiredField
    
    package = session.query(TripPackageModel).filter(
        TripPackageModel.id == package_id,
        TripPackageModel.trip_id == trip_id
    ).first()
    
    if not package:
        raise HTTPException(status_code=404, detail="Package not found")
    
    # Update package fields (excluding required_fields)
    update_data = package_in.model_dump(exclude_unset=True, exclude={"required_fields"})
    for field, value in update_data.items():
        setattr(package, field, value)

    # Validate that at least one name and one description remain after patch
    if not package.name_en and not package.name_ar:
        raise HTTPException(status_code=400, detail="At least one of name_en or name_ar must be provided")
    if not package.description_en and not package.description_ar:
        raise HTTPException(status_code=400, detail="At least one of description_en or description_ar must be provided")
    
    # Update required fields if provided
    if package_in.required_fields is not None:
        # Clear existing required fields
        session.query(TripPackageRequiredField).filter(
            TripPackageRequiredField.package_id == package_id
        ).delete()
        
        # Always include mandatory fields
        from app.models.trip_field import TripFieldType
        mandatory_fields = {TripFieldType.NAME, TripFieldType.DATE_OF_BIRTH}
        
        # Start with mandatory fields
        required_fields_to_add = set(mandatory_fields)
        
        # Add any additional fields provided by user
        required_fields_to_add.update(package_in.required_fields)
        
        # Add new required fields
        for field_type in required_fields_to_add:
            required_field = TripPackageRequiredField(
                package_id=package_id, 
                field_type=field_type
            )
            session.add(required_field)
    
    session.commit()
    session.refresh(package)
    
    # Get required fields for response
    required_fields = session.query(TripPackageRequiredField).filter(
        TripPackageRequiredField.package_id == package.id
    ).all()
    required_field_types = [rf.field_type.value for rf in required_fields]
    
    # Create response with required fields
    return TripPackageWithRequiredFields(
        id=package.id,
        trip_id=package.trip_id,
        name_en=package.name_en,
        name_ar=package.name_ar,
        description_en=package.description_en,
        description_ar=package.description_ar,
        price=package.price,
        is_active=package.is_active,
        required_fields=required_field_types
    )


@router.delete("/{trip_id}/packages/{package_id}", status_code=204)
def delete_trip_package(
    *,
    session: Session = Depends(get_session),
    trip_id: uuid.UUID,
    package_id: uuid.UUID,
    current_user: User = Depends(get_current_active_provider),
):
    """Deactivate a trip package. Blocks if it would leave fewer than 2 active packages."""
    trip = crud.trip.get_trip(session=session, trip_id=trip_id)
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    if trip.provider_id != current_user.provider_id:
        raise HTTPException(status_code=403, detail="Not enough permissions")
    if not trip.is_packaged_trip:
        raise HTTPException(status_code=400, detail="Cannot remove packages from a non-packaged trip")

    from app.models.trip_package import TripPackage as TripPackageModel

    package = session.query(TripPackageModel).filter(
        TripPackageModel.id == package_id,
        TripPackageModel.trip_id == trip_id,
    ).first()
    if not package:
        raise HTTPException(status_code=404, detail="Package not found")

    active_count = session.query(TripPackageModel).filter(
        TripPackageModel.trip_id == trip_id,
        TripPackageModel.is_active == True,
    ).count()
    if active_count <= 2:
        raise HTTPException(
            status_code=400,
            detail="A packaged trip must have at least 2 packages. Add another package before removing this one.",
        )

    package.is_active = False
    session.add(package)
    session.commit()


# Trip Package Required Fields Endpoints
@router.post("/{trip_id}/packages/{package_id}/required-fields")
def set_package_required_fields(
    *,
    session: Session = Depends(get_session),
    trip_id: uuid.UUID,
    package_id: uuid.UUID,
    field_types: List[TripFieldType],
    current_user: User = Depends(get_current_active_provider),
):
    """Set required fields for a trip package (legacy endpoint)."""
    trip = crud.trip.get_trip(session=session, trip_id=trip_id)
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    if trip.provider_id != current_user.provider_id:
        raise HTTPException(status_code=403, detail="Not enough permissions")
    
    from app.models.trip_package import TripPackage as TripPackageModel
    from app.models.trip_package_field import TripPackageRequiredField
    
    # Verify package exists and belongs to trip
    package = session.query(TripPackageModel).filter(
        TripPackageModel.id == package_id,
        TripPackageModel.trip_id == trip_id
    ).first()
    
    if not package:
        raise HTTPException(status_code=404, detail="Package not found")
    
    # Clear existing required fields
    session.query(TripPackageRequiredField).filter(
        TripPackageRequiredField.package_id == package_id
    ).delete()
    
    # Always include mandatory fields
    from app.models.trip_field import TripFieldType
    mandatory_fields = {TripFieldType.NAME, TripFieldType.DATE_OF_BIRTH}
    
    # Start with mandatory fields
    required_fields_to_add = set(mandatory_fields)
    
    # Add any additional fields provided by user
    required_fields_to_add.update(field_types)
    
    # Add new required fields
    for field_type in required_fields_to_add:
        required_field = TripPackageRequiredField(package_id=package_id, field_type=field_type)
        session.add(required_field)
    
    session.commit()
    return {"message": "Required fields updated successfully"}


@router.post("/{trip_id}/packages/{package_id}/required-fields-with-validation")
def set_package_required_fields_with_validation(
    *,
    session: Session = Depends(get_session),
    trip_id: uuid.UUID,
    package_id: uuid.UUID,
    request: TripPackageRequiredFieldsSetWithValidation,
    current_user: User = Depends(get_current_active_provider),
):
    """Set required fields with validation configurations for a trip package."""
    trip = crud.trip.get_trip(session=session, trip_id=trip_id)
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    if trip.provider_id != current_user.provider_id:
        raise HTTPException(status_code=403, detail="Not enough permissions")
    
    from app.models.trip_package import TripPackage as TripPackageModel
    from app.models.trip_package_field import TripPackageRequiredField
    
    # Verify package exists and belongs to trip
    package = session.query(TripPackageModel).filter(
        TripPackageModel.id == package_id,
        TripPackageModel.trip_id == trip_id
    ).first()
    
    if not package:
        raise HTTPException(status_code=404, detail="Package not found")
    
    # Validate all validation configs before proceeding
    validation_errors = []
    for field_config in request.required_fields:
        if field_config.validation_config:
            errors = validate_validation_config(field_config.field_type, field_config.validation_config)
            if errors:
                validation_errors.extend([f"{field_config.field_type.value}: {error}" for error in errors])
    
    if validation_errors:
        raise HTTPException(
            status_code=400, 
            detail=f"Validation configuration errors: {'; '.join(validation_errors)}"
        )
    
    # Clear existing required fields
    session.query(TripPackageRequiredField).filter(
        TripPackageRequiredField.package_id == package_id
    ).delete()
    
    # Always include mandatory fields
    mandatory_fields = {TripFieldType.NAME, TripFieldType.DATE_OF_BIRTH}
    
    # Collect all field types to add
    fields_to_add = {}
    
    # Add mandatory fields first
    for field_type in mandatory_fields:
        fields_to_add[field_type] = {}
    
    # Add user-specified fields with their validation configs
    for field_config in request.required_fields:
        fields_to_add[field_config.field_type] = field_config.validation_config or {}
    
    # Add new required fields with validation configs
    for field_type, validation_config in fields_to_add.items():
        required_field = TripPackageRequiredField(
            package_id=package_id, 
            field_type=field_type,
            validation_config=validation_config if validation_config else None
        )
        session.add(required_field)
    
    session.commit()
    return {"message": "Required fields with validation configurations updated successfully"}


@router.get("/{trip_id}/packages/{package_id}/required-fields", response_model=TripPackageRequiredFieldsResponse)
def get_package_required_fields(
    *,
    session: Session = Depends(get_session),
    trip_id: uuid.UUID,
    package_id: uuid.UUID,
):
    """Get required fields for a trip package."""
    trip = crud.trip.get_trip(session=session, trip_id=trip_id)
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    
    from app.models.trip_package import TripPackage as TripPackageModel
    from app.models.trip_package_field import TripPackageRequiredField
    
    # Verify package exists and belongs to trip
    package = session.query(TripPackageModel).filter(
        TripPackageModel.id == package_id,
        TripPackageModel.trip_id == trip_id
    ).first()
    
    if not package:
        raise HTTPException(status_code=404, detail="Package not found")
    
    required_fields = session.query(TripPackageRequiredField).filter(
        TripPackageRequiredField.package_id == package_id
    ).all()
    
    return TripPackageRequiredFieldsResponse(package_id=package_id, required_fields=required_fields)


# Trip Registration Endpoints
@router.post("/{trip_id}/register", response_model=TripRegistration)
async def register_for_trip(
    *,
    background_tasks: BackgroundTasks,
    session: Session = Depends(get_session),
    trip_id: uuid.UUID,
    registration_in: TripRegistrationCreate,
    current_user: User = Depends(get_current_active_user),
):
    """Register for a trip with multiple participants."""
    from datetime import datetime, timedelta
    trip = crud.trip.get_trip(session=session, trip_id=trip_id)
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")

    # Guard: trip must be active
    if not trip.is_active:
        raise HTTPException(status_code=400, detail="This trip is no longer available for booking")

    # Guard: trip must not have started yet
    if trip.start_date <= datetime.utcnow():
        raise HTTPException(status_code=400, detail="This trip has already started or passed")

    # Guard: user must not already have an active registration for this trip
    from app.models.trip_registration import TripRegistration as TripRegistrationModel
    from sqlmodel import select as sql_select
    existing_user_reg_stmt = sql_select(TripRegistrationModel).where(
        TripRegistrationModel.trip_id == trip_id,
        TripRegistrationModel.user_id == current_user.id,
        TripRegistrationModel.status.in_(["confirmed", "pending_payment"]),
    )
    existing_user_reg = session.exec(existing_user_reg_stmt).first()
    if existing_user_reg:
        raise HTTPException(
            status_code=400,
            detail="You already have an active registration for this trip. Check your bookings."
        )

    # Guard: trip must not be full (count confirmed + pending_payment registrations)
    confirmed_count_stmt = sql_select(TripRegistrationModel).where(
        TripRegistrationModel.trip_id == trip_id,
        TripRegistrationModel.status.in_(["confirmed", "pending_payment"]),
    )
    existing_regs = session.exec(confirmed_count_stmt).all()
    booked_participants = sum(r.total_participants for r in existing_regs)
    if booked_participants + registration_in.total_participants > trip.max_participants:
        available = trip.max_participants - booked_participants
        raise HTTPException(
            status_code=400,
            detail=f"Not enough spots available. Only {available} spot(s) left."
        )

    # Guard: per-package spot check for packaged trips
    if trip.is_packaged_trip:
        from app.models.trip_package import TripPackage as TripPackageModel
        from app.models.trip_registration import TripRegistrationParticipant as TripParticipantModel
        from collections import Counter
        pkg_counts = Counter(
            p.package_id for p in registration_in.participants if p.package_id
        )
        for pkg_id, requested in pkg_counts.items():
            pkg = session.query(TripPackageModel).filter(
                TripPackageModel.id == pkg_id,
                TripPackageModel.trip_id == trip_id,
                TripPackageModel.is_active == True,
            ).first()
            if not pkg:
                raise HTTPException(status_code=400, detail=f"Package {pkg_id} not found or inactive")
            if pkg.max_participants is not None:
                booked_in_pkg = (
                    session.query(TripParticipantModel)
                    .join(TripRegistrationModel, TripParticipantModel.registration_id == TripRegistrationModel.id)
                    .filter(
                        TripParticipantModel.package_id == pkg_id,
                        TripRegistrationModel.status.in_(["confirmed", "pending_payment"]),
                    )
                    .count()
                )
                pkg_available = pkg.max_participants - booked_in_pkg
                if requested > pkg_available:
                    pkg_name = pkg.name_en or pkg.name_ar or str(pkg_id)
                    raise HTTPException(
                        status_code=400,
                        detail=f"Package '{pkg_name}' only has {pkg_available} spot(s) left."
                    )

    # Validate is_registration_user field - only one participant can have it set to True
    registration_user_count = sum(1 for p in registration_in.participants if p.is_registration_user)
    if registration_user_count > 1:
        raise HTTPException(
            status_code=400, 
            detail="Only one participant can be marked as the registration user (is_registration_user=True)"
        )
    
    # For non-packaged trips, auto-assign the hidden package to all participants
    from app.models.trip_package import TripPackage as TripPackageModel
    from app.models.trip_package_field import TripPackageRequiredField

    if not trip.is_packaged_trip:
        hidden_pkg = session.query(TripPackageModel).filter(
            TripPackageModel.trip_id == trip_id
        ).first()
        if hidden_pkg:
            for participant in registration_in.participants:
                if not participant.package_id:
                    participant.package_id = hidden_pkg.id

    # Validate that all required fields are provided for each participant based on their package
    for participant in registration_in.participants:
        if participant.package_id:
            # Verify package exists and belongs to trip
            package = session.query(TripPackageModel).filter(
                TripPackageModel.id == participant.package_id,
                TripPackageModel.trip_id == trip_id
            ).first()
            
            if not package:
                raise HTTPException(status_code=400, detail=f"Package {participant.package_id} not found for this trip")
            
            # Get required fields for this package
            required_fields = session.query(TripPackageRequiredField).filter(
                TripPackageRequiredField.package_id == participant.package_id
            ).all()
            required_field_types = [rf.field_type.value for rf in required_fields]
            
            # Validate required fields for this participant
            for required_field in required_fields:
                field_type = required_field.field_type
                field_value = getattr(participant, field_type.value, None)
                
                # Check if field is required and present
                if required_field.is_required and (field_value is None or (isinstance(field_value, str) and not field_value.strip())):
                    raise HTTPException(
                        status_code=400, 
                        detail=f"Required field '{field_type.value}' is missing for participant with package '{get_name(package)}'"
                    )
                
                # Validate field value against validation config if present
                if field_value and required_field.validation_config:
                    validation_errors = validate_field_value(field_type, str(field_value), required_field.validation_config)
                    if validation_errors:
                        raise HTTPException(
                            status_code=400,
                            detail=f"Validation failed for field '{field_type.value}' in package '{get_name(package)}': {', '.join(validation_errors)}"
                        )
    
    # Create registration with pending_payment status and 15-min spot reservation
    from app.models.trip_registration import TripRegistration as TripRegistrationModel, TripRegistrationParticipant as TripParticipantModel
    spot_reserved_until = datetime.utcnow() + timedelta(minutes=15)
    registration = TripRegistrationModel(
        trip_id=trip_id,
        user_id=current_user.id,
        total_participants=registration_in.total_participants,
        total_amount=registration_in.total_amount,
        status="pending_payment",
        spot_reserved_until=spot_reserved_until,
    )
    session.add(registration)
    session.commit()
    session.refresh(registration)
    
    # Create participants with their individual packages
    for participant_data in registration_in.participants:
        # Create participant data with registration_user_id
        participant_dict = participant_data.model_dump()
        participant_dict['registration_user_id'] = current_user.id  # Always set to the user making the registration
        
        participant = TripParticipantModel(
            registration_id=registration.id,
            **participant_dict
        )
        session.add(participant)
    
    session.commit()
    session.refresh(registration)

    # Build enriched response (provider must be serialized as dict, not SQLModel)
    from app.models.provider import Provider as ProviderModel
    from app.schemas.trip_registration import RegistrationTripInfo, TripRegistration as TripRegistrationSchema
    provider = trip.provider or session.get(ProviderModel, trip.provider_id)
    trip_info = RegistrationTripInfo(
        id=trip.id,
        name_en=trip.name_en,
        name_ar=trip.name_ar,
        description_en=trip.description_en,
        description_ar=trip.description_ar,
        start_date=trip.start_date,
        end_date=trip.end_date,
        provider_id=trip.provider_id,
        trip_reference=trip.trip_reference,
        provider={"id": str(provider.id), "company_name": provider.company_name} if provider else {"id": str(trip.provider_id), "company_name": "Unknown"},
    )
    return TripRegistrationSchema(
        id=registration.id,
        trip_id=registration.trip_id,
        user_id=registration.user_id,
        total_participants=registration.total_participants,
        total_amount=registration.total_amount,
        status=registration.status,
        registration_date=registration.registration_date,
        spot_reserved_until=registration.spot_reserved_until,
        booking_reference=registration.booking_reference,
        participants=list(registration.participants or []),
        trip=trip_info,
    )




@router.get("/{trip_id}/registrations")
def get_trip_registrations(
    *,
    session: Session = Depends(get_session),
    trip_id: uuid.UUID,
    current_user: User = Depends(get_current_active_provider),
):
    """Get all registrations for a trip (provider only), enriched with user info."""
    trip = crud.trip.get_trip(session=session, trip_id=trip_id)
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    if trip.provider_id != current_user.provider_id:
        raise HTTPException(status_code=403, detail="Not enough permissions")

    from sqlmodel import select as sql_select
    from app.models.trip_registration import TripRegistration as TripRegistrationModel
    from app.models.provider import Provider as ProviderModel
    from app.schemas.trip_registration import RegistrationTripInfo, TripRegistration as TripRegistrationSchema

    registrations = session.exec(
        sql_select(TripRegistrationModel).where(TripRegistrationModel.trip_id == trip_id)
    ).all()

    provider = trip.provider or session.get(ProviderModel, trip.provider_id)
    trip_info = RegistrationTripInfo(
        id=trip.id,
        name_en=trip.name_en,
        name_ar=trip.name_ar,
        description_en=trip.description_en,
        description_ar=trip.description_ar,
        start_date=trip.start_date,
        end_date=trip.end_date,
        provider_id=trip.provider_id,
        trip_reference=trip.trip_reference,
        provider={"id": str(provider.id), "company_name": provider.company_name} if provider else {"id": str(trip.provider_id), "company_name": "Unknown"},
    )

    result = []
    for reg in registrations:
        user = session.get(User, reg.user_id)
        reg_dict = TripRegistrationSchema(
            id=reg.id,
            trip_id=reg.trip_id,
            user_id=reg.user_id,
            total_participants=reg.total_participants,
            total_amount=reg.total_amount,
            status=reg.status,
            registration_date=reg.registration_date,
            spot_reserved_until=reg.spot_reserved_until,
            booking_reference=reg.booking_reference,
            participants=list(reg.participants or []),
            trip=trip_info,
        ).model_dump()
        reg_dict["user_name"] = user.name if user else None
        reg_dict["user_email"] = user.email if user else None
        reg_dict["user_phone"] = user.phone if user else None
        result.append(reg_dict)

    return result


# Field Validation Endpoints


@router.get("/validation/available/{field_type}")
def get_available_validations(
    field_type: TripFieldType,
    current_user: User = Depends(get_current_active_provider),
):
    """Get available validation types for a specific field type."""
    available = get_available_validations_for_field(field_type)
    return {"field_type": field_type, "available_validations": available}


@router.get("/validation/metadata")
def get_validation_metadata(
    current_user: User = Depends(get_current_active_provider),
):
    """Get metadata for all validation types."""
    return {"validation_metadata": VALIDATION_METADATA}


class ValidationConfigRequest(BaseModel):
    field_type: TripFieldType
    validation_config: Dict[str, Any]


class ValidationValueRequest(BaseModel):
    field_type: TripFieldType
    value: str
    validation_config: Optional[Dict[str, Any]] = None


@router.post("/validation/validate-config")
def validate_field_validation_config(
    *,
    request: ValidationConfigRequest,
    current_user: User = Depends(get_current_active_provider),
):
    """Validate a validation configuration for a field type."""
    errors = validate_validation_config(request.field_type, request.validation_config)
    return {
        "field_type": request.field_type,
        "validation_config": request.validation_config,
        "is_valid": len(errors) == 0,
        "errors": errors
    }


@router.post("/validation/validate-value")
def validate_field_value_endpoint(
    *,
    request: ValidationValueRequest,
    current_user: User = Depends(get_current_active_provider),
):
    """Validate a field value against validation configuration."""
    errors = validate_field_value(request.field_type, request.value, request.validation_config)
    return {
        "field_type": request.field_type,
        "value": request.value,
        "validation_config": request.validation_config,
        "is_valid": len(errors) == 0,
        "errors": errors
    }


@router.post("/{trip_id}/upload-images")
async def upload_trip_images(
    trip_id: uuid.UUID,
    files: List[UploadFile] = File(...),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_active_provider),
):
    """Upload images for a trip.

    Images are validated for minimum resolution (800×600 px), then compressed
    and downscaled to a maximum long edge of 1920 px before being stored.
    """
    from app.services.storage import storage_service
    from app.services.image_processing import process_trip_image

    # Get trip and verify ownership
    trip = crud.trip.get_trip(session=session, trip_id=trip_id)
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")

    if trip.provider_id != current_user.provider_id:
        raise HTTPException(status_code=403, detail="Not authorized to upload images for this trip")

    allowed_types = ["image/jpeg", "image/jpg", "image/png", "image/webp"]
    max_size = 10 * 1024 * 1024  # 10 MB raw input (will be compressed before storage)

    uploaded_urls = []

    for file in files:
        if file.content_type not in allowed_types:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid file type: {file.content_type}. Allowed types: JPEG, PNG, WEBP"
            )

        content = await file.read()

        if len(content) > max_size:
            raise HTTPException(
                status_code=400,
                detail=f"File '{file.filename}' is too large. Maximum accepted size is 10 MB"
            )

        # Validate resolution and compress — run in thread pool to avoid blocking the event loop
        try:
            loop = asyncio.get_event_loop()
            processed = await loop.run_in_executor(
                None, process_trip_image, content, file.filename or "image.jpg"
            )
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc))

        try:
            file_info = await storage_service.upload_file(
                file_data=processed.data,
                file_name=file.filename,
                content_type=processed.content_type,
                folder="trip_images"
            )
            uploaded_urls.append(file_info["downloadUrl"])
        except Exception as e:
            logger.error(f"Error uploading file {file.filename}: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to upload '{file.filename}'")

    # Update trip with new image URLs
    current_images = trip.images or []
    trip.images = current_images + uploaded_urls
    session.add(trip)
    session.commit()
    session.refresh(trip)

    return {
        "message": f"Successfully uploaded {len(uploaded_urls)} images",
        "uploaded_urls": uploaded_urls,
        "total_images": len(trip.images)
    }


@router.delete("/{trip_id}/images")
async def delete_trip_image(
    trip_id: uuid.UUID,
    image_url: str,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_active_provider),
):
    """Delete a specific image from a trip."""
    from app.services.storage import storage_service
    
    # Get trip and verify ownership
    trip = crud.trip.get_trip(session=session, trip_id=trip_id)
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    
    if trip.provider_id != current_user.provider_id:
        raise HTTPException(status_code=403, detail="Not authorized to delete images for this trip")
    
    if not trip.images or image_url not in trip.images:
        raise HTTPException(status_code=404, detail="Image not found in trip")
    
    # Remove image URL from trip - create new list to ensure SQLAlchemy detects the change
    trip.images = [img for img in trip.images if img != image_url]
    session.add(trip)
    session.commit()
    session.refresh(trip)
    
    # Note: We only have the URL, not the file_id needed for Backblaze deletion
    # In production, you might want to store file_id separately or extract it from URL
    # For now, we just remove the reference from the database
    logger.info(f"Removed image reference from trip: {image_url}")
    
    return {
        "message": "Image deleted successfully",
        "remaining_images": len(trip.images)
    }


# ===== Extra Fees Management =====

@router.post("/{trip_id}/extra-fees", response_model=TripExtraFeeResponse)
def create_trip_extra_fee(
    *,
    session: Session = Depends(get_session),
    trip_id: uuid.UUID,
    extra_fee_in: TripExtraFeeCreate,
    current_user: User = Depends(get_current_active_provider),
):
    """Create a new extra fee for a trip."""
    trip = crud.trip.get_trip(session=session, trip_id=trip_id)
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    
    if trip.provider_id != current_user.provider_id:
        raise HTTPException(status_code=403, detail="Not authorized to add fees to this trip")
    
    extra_fee = trip_extra_fee.create_extra_fee(
        session=session,
        trip_id=trip_id,
        extra_fee_data=extra_fee_in
    )
    return extra_fee


@router.get("/{trip_id}/extra-fees", response_model=List[TripExtraFeeResponse])
def get_trip_extra_fees(
    *,
    session: Session = Depends(get_session),
    trip_id: uuid.UUID,
):
    """Get all extra fees for a trip (public endpoint)."""
    trip = crud.trip.get_trip(session=session, trip_id=trip_id)
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    
    return trip_extra_fee.get_trip_extra_fees(session=session, trip_id=trip_id)


@router.put("/{trip_id}/extra-fees/{fee_id}", response_model=TripExtraFeeResponse)
def update_trip_extra_fee(
    *,
    session: Session = Depends(get_session),
    trip_id: uuid.UUID,
    fee_id: uuid.UUID,
    extra_fee_in: TripExtraFeeUpdate,
    current_user: User = Depends(get_current_active_provider),
):
    """Update an extra fee."""
    trip = crud.trip.get_trip(session=session, trip_id=trip_id)
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    
    if trip.provider_id != current_user.provider_id:
        raise HTTPException(status_code=403, detail="Not authorized to update fees for this trip")
    
    extra_fee = trip_extra_fee.get_extra_fee(session=session, extra_fee_id=fee_id)
    if not extra_fee or extra_fee.trip_id != trip_id:
        raise HTTPException(status_code=404, detail="Extra fee not found")
    
    updated_fee = trip_extra_fee.update_extra_fee(
        session=session,
        extra_fee=extra_fee,
        extra_fee_data=extra_fee_in
    )
    return updated_fee


@router.delete("/{trip_id}/extra-fees/{fee_id}")
def delete_trip_extra_fee(
    *,
    session: Session = Depends(get_session),
    trip_id: uuid.UUID,
    fee_id: uuid.UUID,
    current_user: User = Depends(get_current_active_provider),
):
    """Delete an extra fee."""
    trip = crud.trip.get_trip(session=session, trip_id=trip_id)
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    
    if trip.provider_id != current_user.provider_id:
        raise HTTPException(status_code=403, detail="Not authorized to delete fees for this trip")
    
    extra_fee = trip_extra_fee.get_extra_fee(session=session, extra_fee_id=fee_id)
    if not extra_fee or extra_fee.trip_id != trip_id:
        raise HTTPException(status_code=404, detail="Extra fee not found")
    
    trip_extra_fee.delete_extra_fee(session=session, extra_fee=extra_fee)
    return {"message": "Extra fee deleted successfully"}
