import logging
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

from app.api import deps
from app.models.user import User, UserRole
from app.crud import user as user_crud
from app.crud import provider as provider_crud
from app.schemas.provider import (
    ProviderRegistrationRequest,
    ProviderRequestRead,
    ProviderUpdate,
    ProviderPublic,
)
from app.schemas.user import UserPublic

router = APIRouter()

@router.post("/register", response_model=ProviderRequestRead)
def register_provider(
    *, 
    session: Session = Depends(deps.get_session),
    source: deps.RequestSource = Depends(deps.get_request_source),
    request_in: ProviderRegistrationRequest
):
    logger.info("Attempting to register a new provider.")
    try:
        # Check if user already exists with this email and source
        user = user_crud.get_user_by_email_and_source(
            session=session, 
            email=request_in.user.email, 
            source=source
        )
        if user:
            raise HTTPException(
                status_code=400,
                detail="The user with this email already exists in the system.",
            )
        
        logger.info(f"Creating user with email: {request_in.user.email} for source: {source}")
        # Set role to SUPER_USER for provider company registrants
        user_data = request_in.user.model_copy()
        user_data.role = UserRole.SUPER_USER
        new_user = user_crud.create_user(session=session, user_in=user_data, source=source)
        logger.info(f"User created successfully with ID: {new_user.id}")

        logger.info(f"Creating provider for user ID: {new_user.id}")
        # Create provider immediately (not just request)
        provider = provider_crud.create_provider_from_request(
            session=session, request_in=request_in.provider, user=new_user
        )
        logger.info(f"Provider created successfully with ID: {provider.id}")

        # Update user with provider_id
        user_crud.update_user_role_and_provider(
            session=session,
            db_user=new_user,
            role=UserRole.SUPER_USER,
            provider_id=provider.id
        )
        
        # Create provider request for admin approval
        provider_request = provider_crud.create_provider_request(
            session=session, request_in=request_in.provider, user=new_user, provider=provider
        )
        logger.info(f"Provider request created successfully with ID: {provider_request.id}")
        
        return ProviderRequestRead(
            id=provider_request.id,
            status=provider_request.status,
            denial_reason=provider_request.denial_reason,
            company_name=provider.company_name,
            company_email=provider.company_email,
            company_phone=provider.company_phone,
            provider_id=provider.id,
            user=UserPublic.model_validate(new_user)
        )
    except Exception as e:
        logger.error(f"An error occurred during provider registration: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/profile", response_model=ProviderPublic)
def get_provider_profile(
    *,
    session: Session = Depends(deps.get_session),
    current_user: User = Depends(deps.get_current_active_provider),
):
    """
    Get current provider's profile.
    """
    provider = provider_crud.get_provider_by_id(session, id=current_user.provider_id)
    if not provider:
        raise HTTPException(status_code=404, detail="Provider not found")
    return provider


@router.get("/request-status", response_model=ProviderRequestRead)
def get_provider_request_status(
    *,
    session: Session = Depends(deps.get_session),
    current_user: User = Depends(deps.get_current_active_provider),
):
    """
    Get current user's provider request status.
    """
    provider_request = provider_crud.get_provider_request_by_user_id(session, user_id=current_user.id)
    if not provider_request:
        raise HTTPException(status_code=404, detail="Provider request not found")
    
    # Get the provider to include company details
    provider = provider_crud.get_provider_by_id(session, id=current_user.provider_id)
    if not provider:
        raise HTTPException(status_code=404, detail="Provider not found")
    
    return ProviderRequestRead(
        id=provider_request.id,
        status=provider_request.status,
        denial_reason=provider_request.denial_reason,
        company_name=provider.company_name,
        company_email=provider.company_email,
        company_phone=provider.company_phone,
        provider_id=provider.id,
        user=UserPublic.model_validate(current_user)
    )


@router.put("/profile", response_model=ProviderPublic)
def update_provider_profile(
    *,
    session: Session = Depends(deps.get_session),
    current_user: User = Depends(deps.get_current_active_super_provider),
    provider_in: ProviderUpdate,
):
    """
    Update provider profile.
    """
    provider = provider_crud.get_provider_by_id(session, id=current_user.provider_id)
    if not provider:
        # This case should ideally not be reached if logic is correct
        # because get_current_active_super_provider ensures provider_id exists
        raise HTTPException(status_code=404, detail="Provider not found")

    provider = provider_crud.update_provider(
        session, db_provider=provider, provider_in=provider_in
    )
    return provider
