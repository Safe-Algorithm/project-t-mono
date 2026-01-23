"""
File Definition API Routes

Public endpoint for retrieving provider registration file requirements.
Admin CRUD endpoints are in admin.py under /admin/settings/file-definitions
"""

from typing import List

from fastapi import APIRouter, Depends
from sqlmodel import Session

from app.api import deps
from app import crud
from app.schemas.file_definition import FileDefinitionPublic

router = APIRouter()


@router.get("/provider-registration", response_model=List[FileDefinitionPublic])
def get_provider_registration_file_requirements(
    *,
    session: Session = Depends(deps.get_session),
) -> List[FileDefinitionPublic]:
    """
    Get active file definitions for provider registration (Public endpoint - no auth required).
    Used by the provider registration page to know what files to request.
    """
    file_definitions = crud.file_definition.get_active_file_definitions_for_provider_registration(
        session=session
    )
    return file_definitions
