from typing import List, Optional
import uuid
import secrets
import json
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlmodel import Session

from app.api.deps import get_current_active_superuser, get_current_active_admin, get_session
from app.models.user import User, UserRole
from app.models.source import RequestSource
from app.crud import provider as provider_crud, user as user_crud
from app.schemas.provider import ProviderRequestRead, ProviderPublic
from app.schemas.user import UserPublic, UserCreate, UserPublicWithProvider
from app.schemas.trip import TripRead
from app.schemas.trip_package import TripPackageWithRequiredFields
from app.schemas.field_metadata import AvailableFieldsResponse, FieldMetadata, FieldOption
from app.models.trip_field import TripFieldType, FIELD_METADATA
from app.crud import trip as trip_crud, file_definition as file_definition_crud
from app.schemas.admin import ProviderRequestUpdate
from app.schemas.file_definition import (
    FileDefinitionCreate,
    FileDefinitionUpdate,
    FileDefinitionPublic,
    FileDefinitionListResponse
)
from app.models.trip_package import TripPackage as TripPackageModel
from app.models.trip_package_field import TripPackageRequiredField
from app.core.redis import redis_client
from app.core.config import settings
from app.services.email import email_service

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
    
    # Build response with company details from linked provider
    result = []
    for request in requests:
        # Get the provider associated with this user
        provider = provider_crud.get_provider_by_user_id(session, user_id=request.user_id)
        if provider:
            result.append(ProviderRequestRead(
                id=request.id,
                status=request.status,
                denial_reason=request.denial_reason,
                company_name=provider.company_name,
                company_email=provider.company_email,
                company_phone=provider.company_phone,
                provider_id=provider.id,
                user=request.user
            ))
    
    return result

@router.put("/provider-requests/{request_id}/approve", response_model=ProviderRequestRead)
def approve_provider_request(
    *, 
    session: Session = Depends(get_session), 
    request_id: uuid.UUID,
    current_user: User = Depends(get_current_active_superuser),
):
    """
    Approve a provider request.
    Requires all provider files to be accepted before approval.
    """
    from app.crud import provider_file as provider_file_crud
    
    db_request = provider_crud.get_provider_request(session=session, id=request_id)
    if not db_request:
        raise HTTPException(status_code=404, detail="Provider request not found")

    # Get the provider associated with this user
    provider = provider_crud.get_provider_by_user_id(session, user_id=db_request.user_id)
    if not provider:
        raise HTTPException(status_code=404, detail="Provider not found for this user")

    # Check if all provider files are accepted
    if not provider_file_crud.are_all_files_accepted(session=session, provider_id=provider.id):
        raise HTTPException(
            status_code=400, 
            detail="Cannot approve provider request: not all files are accepted. Please review and accept all provider files first."
        )

    # Update the request status to approved
    updated_request = provider_crud.update_provider_request_status(
        session=session,
        db_request=db_request,
        status="approved",
        denial_reason=None
    )

    return ProviderRequestRead(
        id=updated_request.id,
        status=updated_request.status,
        denial_reason=updated_request.denial_reason,
        company_name=provider.company_name,
        company_email=provider.company_email,
        company_phone=provider.company_phone,
        provider_id=provider.id,
        user=updated_request.user
    )

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

    # Get the provider associated with this user
    provider = provider_crud.get_provider_by_user_id(session, user_id=db_request.user_id)
    if not provider:
        raise HTTPException(status_code=404, detail="Provider not found for this user")

    # Update the request status to denied
    updated_request = provider_crud.update_provider_request_status(
        session=session,
        db_request=db_request,
        status="denied",
        denial_reason=request_in.denial_reason
    )

    return ProviderRequestRead(
        id=updated_request.id,
        status=updated_request.status,
        denial_reason=updated_request.denial_reason,
        company_name=provider.company_name,
        company_email=provider.company_email,
        company_phone=provider.company_phone,
        provider_id=provider.id,
        user=updated_request.user
    )


@router.post("/invite-admin", response_model=UserPublic)
async def invite_admin(
    *,
    background_tasks: BackgroundTasks,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_active_admin),
    user_in: UserCreate
):
    """
    Invite a new admin user.
    Only super admins can invite other admins.
    Sends an invitation email with a link to accept and activate the account.
    """
    # Check if user with email already exists
    user = user_crud.get_user_by_email_and_source(session, email=user_in.email, source=RequestSource.ADMIN_PANEL)
    if user:
        raise HTTPException(
            status_code=400,
            detail="A user with this email already exists in the admin panel."
        )
    
    # Check if user with phone already exists
    user_by_phone = user_crud.get_user_by_phone_and_source(session, phone=user_in.phone, source=RequestSource.ADMIN_PANEL)
    if user_by_phone:
        raise HTTPException(
            status_code=400,
            detail="A user with this phone number already exists in the admin panel."
        )
    
    # Generate invitation token
    invitation_token = secrets.token_urlsafe(32)
    
    # Store invitation data in Redis with 7-day expiry
    redis_key = f"admin_invitation:{invitation_token}"
    invitation_data = {
        "email": user_in.email,
        "name": user_in.name,
        "phone": user_in.phone,
        "password": user_in.password,
        "role": "normal",  # New admins start as normal users
        "inviter_name": current_user.name,
        "source": RequestSource.ADMIN_PANEL.value
    }
    redis_client.setex(redis_key, 7 * 24 * 60 * 60, json.dumps(invitation_data))
    
    # Send invitation email in background
    invitation_url = f"{settings.ADMIN_PANEL_URL}/accept-invitation?token={invitation_token}"
    background_tasks.add_task(
        email_service.send_team_invitation_email,
        to_email=user_in.email,
        to_name=user_in.name,
        inviter_name=current_user.name,
        company_name="Safe Algo Tourism Admin",
        invitation_token=invitation_token,
        invitation_url=invitation_url
    )
    
    # Create admin user with is_active=False until they accept invitation
    user_in.role = UserRole.NORMAL
    user = user_crud.create_user(session, user_in=user_in, source=RequestSource.ADMIN_PANEL)
    user.is_active = False  # User must accept invitation to activate
    session.add(user)
    session.commit()
    session.refresh(user)
    
    return user


@router.post("/accept-admin-invitation", response_model=UserPublic)
def accept_admin_invitation(
    token: str,
    session: Session = Depends(get_session),
):
    """
    Accept admin invitation using token from email.
    Activates the admin account.
    """
    # Check token in Redis
    redis_key = f"admin_invitation:{token}"
    invitation_data = redis_client.get(redis_key)
    
    if not invitation_data:
        raise HTTPException(
            status_code=400,
            detail="Invalid or expired invitation token"
        )
    
    # Parse invitation data (handle both bytes and string from Redis)
    if isinstance(invitation_data, bytes):
        data = json.loads(invitation_data.decode())
    else:
        data = json.loads(invitation_data)
    
    # Find user by email and source
    user = user_crud.get_user_by_email_and_source(
        session, 
        email=data["email"], 
        source=RequestSource.ADMIN_PANEL
    )
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Activate user account
    user.is_active = True
    session.add(user)
    session.commit()
    session.refresh(user)
    
    # Delete token from Redis
    redis_client.delete(redis_key)
    
    return user


@router.get("/providers", response_model=List[ProviderPublic])
def list_providers(
    session: Session = Depends(get_session),
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(get_current_active_superuser),
):
    """Retrieve all providers."""
    providers = provider_crud.get_all_providers(session, skip=skip, limit=limit)
    
    # Build response with status from provider request
    result = []
    for provider in providers:
        # Get the provider request status
        provider_request = None
        if provider.provider_request_id:
            provider_request = provider_crud.get_provider_request(session, id=provider.provider_request_id)
        
        result.append(ProviderPublic(
            id=provider.id,
            company_name=provider.company_name,
            company_email=provider.company_email,
            company_phone=provider.company_phone,
            company_metadata=provider.company_metadata,
            status=provider_request.status if provider_request else "unknown"
        ))
    
    return result

@router.get("/users", response_model=List[UserPublicWithProvider])
def list_users(
    session: Session = Depends(get_session),
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(get_current_active_superuser),
):
    """Retrieve all users with provider company information."""
    users = user_crud.get_users(session, skip=skip, limit=limit)
    
    # Build response with provider company names
    result = []
    for user in users:
        provider_company_name = None
        if user.provider_id:
            provider = provider_crud.get_provider(session, provider_id=user.provider_id)
            if provider:
                provider_company_name = provider.company_name
        
        result.append(UserPublicWithProvider(
            id=user.id,
            email=user.email,
            name=user.name,
            phone=user.phone,
            is_superuser=user.is_superuser,
            is_active=user.is_active,
            role=user.role,
            provider_id=user.provider_id,
            provider_company_name=provider_company_name,
            source=user.source.value
        ))
    
    return result

@router.get("/trips", response_model=List[TripRead])
def list_all_trips(
    session: Session = Depends(get_session),
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(get_current_active_superuser),
    search: Optional[str] = None,
    provider_id: Optional[str] = None,
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
    is_active: Optional[bool] = None,
):
    """Retrieve and filter all trips (admin view)."""
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
    
    # Parse provider_id if provided
    provider_uuid = uuid.UUID(provider_id) if provider_id else None
    
    trips = trip_crud.search_and_filter_trips(
        session=session,
        provider_id=provider_uuid,
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
            required_field_types = [rf.field_type.value for rf in required_fields]
            
            # Build detailed field information with validation configs
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
        
        # Get provider info
        provider = provider_crud.get_provider(session=session, provider_id=trip.provider_id)
        provider_info = {
            "id": provider.id,
            "company_name": provider.company_name
        } if provider else {"id": trip.provider_id, "company_name": "Unknown"}
        
        trip_responses.append(TripRead(
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
        required_field_types = [rf.field_type.value for rf in required_fields]
        
        # Build detailed field information with validation configs
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
    
    # Get provider info
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
        images=trip.images,
        trip_metadata=trip.trip_metadata,
        is_active=trip.is_active,
        packages=packages_with_fields
    )


@router.get("/available-fields", response_model=AvailableFieldsResponse)
def get_available_package_fields_admin(
    current_user: User = Depends(get_current_active_superuser),
):
    """Get all available field types with metadata for admin panel."""
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
            display_name=metadata.get("display_name", field_type.value),
            ui_type=metadata.get("ui_type", "text"),
            is_required=metadata.get("is_required", False),
            options=options,
            available_validations=metadata.get("available_validations", [])
        )
        
        fields.append(field_metadata)
    
    return AvailableFieldsResponse(fields=fields)

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
    
    # Get the provider request status
    provider_request = None
    if provider.provider_request_id:
        provider_request = provider_crud.get_provider_request(session, id=provider.provider_request_id)
    
    return ProviderPublic(
        id=provider.id,
        company_name=provider.company_name,
        company_email=provider.company_email,
        company_phone=provider.company_phone,
        company_avatar_url=provider.company_avatar_url,
        company_metadata=provider.company_metadata,
        status=provider_request.status if provider_request else "unknown"
    )

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
            required_field_types = [rf.field_type.value for rf in required_fields]
            
            # Build detailed field information with validation configs
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
        
        # Get provider info
        provider = provider_crud.get_provider(session=session, provider_id=trip.provider_id)
        provider_info = {
            "id": provider.id,
            "company_name": provider.company_name
        } if provider else {"id": trip.provider_id, "company_name": "Unknown"}
        
        trip_responses.append(TripRead(
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
    
    return trip_responses


# File Definition Settings Endpoints

@router.post("/settings/file-definitions", response_model=FileDefinitionPublic, status_code=201)
def create_file_definition(
    *,
    session: Session = Depends(get_session),
    file_definition_in: FileDefinitionCreate,
    current_user: User = Depends(get_current_active_superuser),
) -> FileDefinitionPublic:
    """Create a new file definition (Admin only)."""
    file_definition = file_definition_crud.create_file_definition(
        session=session,
        file_definition_in=file_definition_in
    )
    return file_definition


@router.get("/settings/file-definitions", response_model=FileDefinitionListResponse)
def list_file_definitions(
    *,
    session: Session = Depends(get_session),
    skip: int = 0,
    limit: int = 100,
    active_only: bool = False,
    current_user: User = Depends(get_current_active_superuser),
) -> FileDefinitionListResponse:
    """List all file definitions (Admin only)."""
    file_definitions = file_definition_crud.get_file_definitions(
        session=session,
        skip=skip,
        limit=limit,
        active_only=active_only
    )
    total = file_definition_crud.count_file_definitions(
        session=session,
        active_only=active_only
    )
    return FileDefinitionListResponse(items=file_definitions, total=total)


@router.get("/settings/file-definitions/{file_definition_id}", response_model=FileDefinitionPublic)
def get_file_definition(
    *,
    session: Session = Depends(get_session),
    file_definition_id: uuid.UUID,
    current_user: User = Depends(get_current_active_superuser),
) -> FileDefinitionPublic:
    """Get a file definition by ID (Admin only)."""
    file_definition = file_definition_crud.get_file_definition(
        session=session,
        file_definition_id=file_definition_id
    )
    if not file_definition:
        raise HTTPException(status_code=404, detail="File definition not found")
    return file_definition


@router.put("/settings/file-definitions/{file_definition_id}", response_model=FileDefinitionPublic)
def update_file_definition(
    *,
    session: Session = Depends(get_session),
    file_definition_id: uuid.UUID,
    file_definition_in: FileDefinitionUpdate,
    current_user: User = Depends(get_current_active_superuser),
) -> FileDefinitionPublic:
    """Update a file definition (Admin only)."""
    file_definition = file_definition_crud.update_file_definition(
        session=session,
        file_definition_id=file_definition_id,
        file_definition_in=file_definition_in
    )
    if not file_definition:
        raise HTTPException(status_code=404, detail="File definition not found")
    return file_definition


@router.delete("/settings/file-definitions/{file_definition_id}", status_code=204)
def delete_file_definition(
    *,
    session: Session = Depends(get_session),
    file_definition_id: uuid.UUID,
    current_user: User = Depends(get_current_active_superuser),
):
    """Delete a file definition (Admin only)."""
    success = file_definition_crud.delete_file_definition(
        session=session,
        file_definition_id=file_definition_id
    )
    if not success:
        raise HTTPException(status_code=404, detail="File definition not found")
    return None
