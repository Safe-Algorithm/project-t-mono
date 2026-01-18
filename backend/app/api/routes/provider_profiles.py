"""
API routes for public provider profiles
"""

import uuid
from fastapi import APIRouter, Depends
from sqlmodel import Session

from app.api.deps import get_session
from app.schemas.provider import ProviderProfilePublic
from app import crud

router = APIRouter()


@router.get("/{provider_id}", response_model=ProviderProfilePublic)
def get_provider_profile(
    provider_id: uuid.UUID,
    session: Session = Depends(get_session)
):
    """
    Get public provider profile with statistics.
    
    Public endpoint - no authentication required.
    
    Returns:
    - Provider basic info (name, metadata)
    - Total trips count
    - Active trips count
    - Average rating across all trips
    - Total reviews count
    """
    profile_data = crud.provider_profile.get_provider_profile_public(
        session=session,
        provider_id=provider_id
    )
    
    return ProviderProfilePublic(**profile_data)
