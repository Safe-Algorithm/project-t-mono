import logging
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

from app.api import deps
from app.models.user import User
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
    request_in: ProviderRegistrationRequest
):
    logger.info("Attempting to register a new provider.")
    try:
        user = user_crud.get_user_by_email(session=session, email=request_in.user.email)
        if user:
            raise HTTPException(
                status_code=400,
                detail="The user with this email already exists in the system.",
            )
        
        logger.info(f"Creating user with email: {request_in.user.email}")
        new_user = user_crud.create_user(session=session, user_in=request_in.user)
        logger.info(f"User created successfully with ID: {new_user.id}")

        logger.info(f"Creating provider request for user ID: {new_user.id}")
        provider_request = provider_crud.create_provider_request(
            session=session, request_in=request_in.provider, user=new_user
        )
        logger.info(f"Provider request created successfully with ID: {provider_request.id}")
        
        response_data = provider_request.model_dump()
        response_data['user'] = UserPublic.model_validate(new_user).model_dump()
        
        return ProviderRequestRead.model_validate(response_data)
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
