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
from app.crud import trip as trip_crud
from app.schemas.admin import ProviderRequestUpdate

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
    return trips
