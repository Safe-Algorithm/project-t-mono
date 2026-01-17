import uuid
import logging
from typing import List, Dict, Any, Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session
from pydantic import BaseModel

from app import crud
from app.api.deps import get_current_active_provider, get_session, get_current_active_user
from app.models.user import User
from app.schemas.trip import TripCreate, TripRead, TripUpdate
from app.schemas.trip_package_field import TripPackageRequiredFieldsResponse, PackageRequiredFieldWithValidation, TripPackageRequiredFieldsSet, TripPackageRequiredFieldsSetWithValidation
from app.models.trip_field import TripFieldType, FIELD_METADATA
from app.models.field_validation import get_available_validations_for_field, validate_field_value, validate_validation_config, VALIDATION_METADATA
from app.schemas.field_metadata import AvailableFieldsResponse, FieldMetadata, FieldOption
from app.schemas.trip_package import TripPackageCreate, TripPackage, TripPackageUpdate, TripPackageWithRequiredFields
from app.schemas.trip_registration import TripRegistrationCreate, TripRegistration

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
    
    # Get packages with required fields for each trip
    from app.models.trip_package import TripPackage as TripPackageModel
    from app.models.trip_package_field import TripPackageRequiredField
    
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
                name=package.name,
                description=package.description,
                price=package.price,
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
        
        trips_with_packages.append(TripRead(
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
        ))
    
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
                FieldOption(value=opt["value"], label=opt["label"]) 
                for opt in metadata["options"]
            ]
        
        field_metadata = FieldMetadata(
            field_name=field_type,
            display_name=metadata.get("display_name", field_type.value.replace("_", " ").title()),
            ui_type=metadata.get("ui_type", "text"),
            placeholder=metadata.get("placeholder"),
            required=metadata.get("required", True),
            options=options,
            available_validations=metadata.get("available_validations", [])
        )
        fields.append(field_metadata)
    
    return AvailableFieldsResponse(fields=fields)


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
    
    # Get packages with required fields
    from app.models.trip_package import TripPackage as TripPackageModel
    from app.models.trip_package_field import TripPackageRequiredField
    
    packages = session.query(TripPackageModel).filter(
        TripPackageModel.trip_id == trip_id,
        TripPackageModel.is_active == True
    ).all()
    
    # Create packages with required fields
    packages_with_fields = []
    for package in packages:
        required_fields = session.query(TripPackageRequiredField).filter(
            TripPackageRequiredField.package_id == package.id
        ).all()
        required_field_types = [rf.field_type.value for rf in required_fields]
        
        # Include detailed required fields with validation configs
        required_fields_details = []
        for rf in required_fields:
            required_fields_details.append({
                "id": str(rf.id),
                "package_id": str(rf.package_id),
                "field_type": rf.field_type.value,
                "is_required": rf.is_required,
                "validation_config": rf.validation_config
            })
        
        packages_with_fields.append(TripPackageWithRequiredFields(
            id=package.id,
            trip_id=package.trip_id,
            name=package.name,
            description=package.description,
            price=package.price,
            is_active=package.is_active,
            required_fields=required_field_types,
            required_fields_details=required_fields_details
        ))
    
    # Ensure trip has at least one package
    if not packages_with_fields:
        raise HTTPException(
            status_code=400, 
            detail="Trip must have at least one package. Please add a package to this trip."
        )
    
    # Get provider info
    from app.crud import provider as provider_crud
    provider = provider_crud.get_provider(session=session, provider_id=trip.provider_id)
    provider_info = {
        "id": provider.id,
        "company_name": provider.company_name
    } if provider else {"id": trip.provider_id, "company_name": "Unknown"}
    
    # Create response with packages including required fields
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
    
    # Update the trip
    trip = crud.trip.update_trip(session=session, db_trip=db_trip, trip_in=trip_in)
    
    # Get packages with properly serialized required fields
    from app.models.trip_package import TripPackage as TripPackageModel
    from app.models.trip_package_field import TripPackageRequiredField
    
    packages = session.query(TripPackageModel).filter(
        TripPackageModel.trip_id == trip_id,
        TripPackageModel.is_active == True
    ).all()
    
    packages_with_fields = []
    for package in packages:
        required_fields = session.query(TripPackageRequiredField).filter(
            TripPackageRequiredField.package_id == package.id
        ).all()
        required_field_types = [rf.field_type.value for rf in required_fields]
        
        # Include detailed required fields with validation configs
        required_fields_details = []
        for rf in required_fields:
            required_fields_details.append({
                "id": str(rf.id),
                "package_id": str(rf.package_id),
                "field_type": rf.field_type.value,
                "is_required": rf.is_required,
                "validation_config": rf.validation_config
            })
        
        packages_with_fields.append(TripPackageWithRequiredFields(
            id=package.id,
            trip_id=package.trip_id,
            name=package.name,
            description=package.description,
            price=package.price,
            currency=package.currency,
            is_active=package.is_active,
            required_fields=required_field_types,
            required_fields_details=required_fields_details
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
        name=package.name,
        description=package.description,
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
            name=package.name,
            description=package.description,
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
        name=package.name,
        description=package.description,
        price=package.price,
        is_active=package.is_active,
        required_fields=required_field_types
    )


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
def register_for_trip(
    *,
    session: Session = Depends(get_session),
    trip_id: uuid.UUID,
    registration_in: TripRegistrationCreate,
    current_user: User = Depends(get_current_active_user),
):
    """Register for a trip with multiple participants."""
    trip = crud.trip.get_trip(session=session, trip_id=trip_id)
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    
    # Validate is_registration_user field - only one participant can have it set to True
    registration_user_count = sum(1 for p in registration_in.participants if p.is_registration_user)
    if registration_user_count > 1:
        raise HTTPException(
            status_code=400, 
            detail="Only one participant can be marked as the registration user (is_registration_user=True)"
        )
    
    # Validate that all required fields are provided for each participant based on their package
    from app.models.trip_package import TripPackage as TripPackageModel
    from app.models.trip_package_field import TripPackageRequiredField
    
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
                        detail=f"Required field '{field_type.value}' is missing for participant with package '{package.name}'"
                    )
                
                # Validate field value against validation config if present
                if field_value and required_field.validation_config:
                    validation_errors = validate_field_value(field_type, str(field_value), required_field.validation_config)
                    if validation_errors:
                        raise HTTPException(
                            status_code=400,
                            detail=f"Validation failed for field '{field_type.value}' in package '{package.name}': {', '.join(validation_errors)}"
                        )
    
    # Create registration
    from app.models.trip_registration import TripRegistration as TripRegistrationModel, TripRegistrationParticipant as TripParticipantModel
    registration = TripRegistrationModel(
        trip_id=trip_id,
        user_id=current_user.id,
        total_participants=registration_in.total_participants,
        total_amount=registration_in.total_amount,
        status=registration_in.status
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
    return registration


@router.get("/{trip_id}/registrations", response_model=List[TripRegistration])
def get_trip_registrations(
    *,
    session: Session = Depends(get_session),
    trip_id: uuid.UUID,
    current_user: User = Depends(get_current_active_provider),
):
    """Get all registrations for a trip (provider only)."""
    trip = crud.trip.get_trip(session=session, trip_id=trip_id)
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    if trip.provider_id != current_user.provider_id:
        raise HTTPException(status_code=403, detail="Not enough permissions")
    
    from app.models.trip_registration import TripRegistration as TripRegistrationModel
    registrations = session.query(TripRegistrationModel).filter(
        TripRegistrationModel.trip_id == trip_id
    ).all()
    
    return registrations


# Field Validation Endpoints
@router.get("/validation/available/{field_type}")
def get_available_validations(
    field_type: TripFieldType,
    current_user: User = Depends(get_current_active_provider),
):
    """Get available validation types for a specific field type."""
    validations = get_available_validations_for_field(field_type)
    return {"field_type": field_type, "available_validations": validations}


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
