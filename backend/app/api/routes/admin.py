from typing import List
import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session

from app.api.deps import get_current_active_superuser, get_session
from app.models.user import User, UserRole
from app.crud import provider as provider_crud, user as user_crud
from app.schemas.provider import ProviderRequestRead, ProviderPublic
from app.schemas.user import UserPublic
from app.schemas.trip import TripRead
from app.schemas.trip_package import TripPackageWithRequiredFields
from app.crud import trip as trip_crud
from app.schemas.admin import ProviderRequestUpdate
from app.models.trip_package import TripPackage as TripPackageModel
from app.models.trip_package_field import TripPackageRequiredField

router = APIRouter()

@router.get("/provider-requests", response_model=List[ProviderRequestRead])
def list_provider_requests(
    session: Session = Depends(get_session),
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(get_current_active_superuser),
):
    """Retrieve all provider requests."""
    requests = provider_crud.get_provider_requests(session, skip=skip, limit=limit)
    return requests

@router.put("/provider-requests/{request_id}/approve", response_model=ProviderRequestRead)
def approve_provider_request(
    *, 
    session: Session = Depends(get_session), 
    request_id: uuid.UUID,
    current_user: User = Depends(get_current_active_superuser),
):
    """Approve a provider request."""
    db_request = provider_crud.get_provider_request(session=session, id=request_id)
    if not db_request:
        raise HTTPException(status_code=404, detail="Provider request not found")

    # Create a new provider
    new_provider = provider_crud.create_provider(session=session, provider_request=db_request)

    # Update the user's role to SUPER_PROVIDER and associate with the new provider
    user_crud.update_user_role_and_provider(
        session=session,
        db_user=db_request.user,
        role=UserRole.SUPER_PROVIDER,
        provider_id=new_provider.id
    )

    # Update the request status to approved
    updated_request = provider_crud.update_provider_request_status(
        session=session,
        db_request=db_request,
        status="approved",
        denial_reason=None
    )

    return updated_request

@router.put("/provider-requests/{request_id}/deny", response_model=ProviderRequestRead)
def deny_provider_request(
    *, 
    session: Session = Depends(get_session), 
    request_id: uuid.UUID,
    request_in: ProviderRequestUpdate,
    current_user: User = Depends(get_current_active_superuser),
):
    """Deny a provider request."""
    db_request = provider_crud.get_provider_request(session=session, id=request_id)
    if not db_request:
        raise HTTPException(status_code=404, detail="Provider request not found")

    # Update the request status to denied
    updated_request = provider_crud.update_provider_request_status(
        session=session,
        db_request=db_request,
        status="denied",
        denial_reason=request_in.denial_reason
    )

    return updated_request

@router.put("/provider-requests/{request_id}", response_model=ProviderRequestRead)
def update_provider_request(
    *, 
    session: Session = Depends(get_session), 
    request_id: uuid.UUID,
    request_in: ProviderRequestUpdate,
    current_user: User = Depends(get_current_active_superuser),
):
    """Update a provider request's status (approve/deny)."""
    db_request = provider_crud.get_provider_request(session=session, id=request_id)
    if not db_request:
        raise HTTPException(status_code=404, detail="Provider request not found")

    if request_in.status == "approved":
        # Create a new provider
        new_provider = provider_crud.create_provider(session=session, provider_request=db_request)

        # Update the user's role to SUPER_PROVIDER and associate with the new provider
        user_crud.update_user_role_and_provider(
            session=session,
            db_user=db_request.user,
            role=UserRole.SUPER_PROVIDER,
            provider_id=new_provider.id
        )

    # Update the request status
    updated_request = provider_crud.update_provider_request_status(
        session=session,
        db_request=db_request,
        status=request_in.status,
        denial_reason=request_in.denial_reason
    )

    return updated_request

@router.get("/providers", response_model=List[ProviderPublic])
def list_providers(
    session: Session = Depends(get_session),
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(get_current_active_superuser),
):
    """Retrieve all providers."""
    providers = provider_crud.get_all_providers(session, skip=skip, limit=limit)
    return providers

@router.get("/users", response_model=List[UserPublic])
def list_users(
    session: Session = Depends(get_session),
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(get_current_active_superuser),
):
    """Retrieve all users."""
    users = user_crud.get_users(session, skip=skip, limit=limit)
    return users

@router.get("/trips", response_model=List[TripRead])
def list_all_trips(
    session: Session = Depends(get_session),
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(get_current_active_superuser),
):
    """Retrieve all trips."""
    trips = trip_crud.get_all_trips(session=session, skip=skip, limit=limit)
    
    # Build TripRead responses with packages and required fields
    trip_responses = []
    for trip in trips:
        # Get packages with required fields
        packages = session.query(TripPackageModel).filter(
            TripPackageModel.trip_id == trip.id,
            TripPackageModel.is_active == True
        ).all()
        
        packages_with_fields = []
        for package in packages:
            required_fields = session.query(TripPackageRequiredField).filter(
                TripPackageRequiredField.package_id == package.id
            ).all()
            required_field_types = [rf.field_type for rf in required_fields]
            
            packages_with_fields.append(TripPackageWithRequiredFields(
                id=package.id,
                trip_id=package.trip_id,
                name=package.name,
                description=package.description,
                price=package.price,
                is_active=package.is_active,
                required_fields=required_field_types
            ))
        
        trip_responses.append(TripRead(
            id=trip.id,
            provider_id=trip.provider_id,
            name=trip.name,
            description=trip.description,
            start_date=trip.start_date,
            end_date=trip.end_date,
            price=trip.price,
            max_participants=trip.max_participants,
            trip_metadata=trip.trip_metadata,
            is_active=trip.is_active,
            packages=packages_with_fields
        ))
    
    return trip_responses

@router.get("/trips/{trip_id}", response_model=TripRead)
def get_trip_details(
    trip_id: uuid.UUID,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_active_superuser),
):
    """Get detailed trip information by ID."""
    trip = trip_crud.get_trip(session=session, trip_id=trip_id)
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    
    # Get packages with required fields
    packages = session.query(TripPackageModel).filter(
        TripPackageModel.trip_id == trip_id,
        TripPackageModel.is_active == True
    ).all()
    
    packages_with_fields = []
    for package in packages:
        required_fields = session.query(TripPackageRequiredField).filter(
            TripPackageRequiredField.package_id == package.id
        ).all()
        required_field_types = [rf.field_type for rf in required_fields]
        
        packages_with_fields.append(TripPackageWithRequiredFields(
            id=package.id,
            trip_id=package.trip_id,
            name=package.name,
            description=package.description,
            price=package.price,
            is_active=package.is_active,
            required_fields=required_field_types
        ))
    
    return TripRead(
        id=trip.id,
        provider_id=trip.provider_id,
        name=trip.name,
        description=trip.description,
        start_date=trip.start_date,
        end_date=trip.end_date,
        price=trip.price,
        max_participants=trip.max_participants,
        trip_metadata=trip.trip_metadata,
        is_active=trip.is_active,
        packages=packages_with_fields
    )

@router.get("/providers/{provider_id}", response_model=ProviderPublic)
def get_provider_details(
    provider_id: uuid.UUID,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_active_superuser),
):
    """Get provider details by ID."""
    provider = provider_crud.get_provider(session=session, provider_id=provider_id)
    if not provider:
        raise HTTPException(status_code=404, detail="Provider not found")
    return provider

@router.get("/providers/{provider_id}/users", response_model=List[UserPublic])
def get_provider_users(
    provider_id: uuid.UUID,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_active_superuser),
):
    """Get all users for a specific provider."""
    users = user_crud.get_users_by_provider_id(session=session, provider_id=provider_id)
    return users

@router.get("/providers/{provider_id}/trips", response_model=List[TripRead])
def get_provider_trips(
    provider_id: uuid.UUID,
    session: Session = Depends(get_session),
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(get_current_active_superuser),
):
    """Get all trips for a specific provider."""
    trips = trip_crud.get_trips_by_provider(session=session, provider_id=provider_id, skip=skip, limit=limit)
    
    # Build TripRead responses with packages and required fields
    trip_responses = []
    for trip in trips:
        # Get packages with required fields
        packages = session.query(TripPackageModel).filter(
            TripPackageModel.trip_id == trip.id,
            TripPackageModel.is_active == True
        ).all()
        
        packages_with_fields = []
        for package in packages:
            required_fields = session.query(TripPackageRequiredField).filter(
                TripPackageRequiredField.package_id == package.id
            ).all()
            required_field_types = [rf.field_type for rf in required_fields]
            
            packages_with_fields.append(TripPackageWithRequiredFields(
                id=package.id,
                trip_id=package.trip_id,
                name=package.name,
                description=package.description,
                price=package.price,
                is_active=package.is_active,
                required_fields=required_field_types
            ))
        
        trip_responses.append(TripRead(
            id=trip.id,
            provider_id=trip.provider_id,
            name=trip.name,
            description=trip.description,
            start_date=trip.start_date,
            end_date=trip.end_date,
            price=trip.price,
            max_participants=trip.max_participants,
            trip_metadata=trip.trip_metadata,
            is_active=trip.is_active,
            packages=packages_with_fields
        ))
    
    return trip_responses
