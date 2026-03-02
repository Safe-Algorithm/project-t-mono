"""
File Definition API Routes

Public endpoints for retrieving file groups and their definitions for provider registration.
Admin CRUD endpoints are in admin.py under /admin/settings/file-definitions and /admin/settings/file-groups
"""

from typing import List, Optional
import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session

from app.api import deps
from app import crud
from app.schemas.file_definition import FileDefinitionPublic, ProviderFileGroupPublic, ProviderFileGroupListResponse

router = APIRouter()


@router.get("/groups", response_model=ProviderFileGroupListResponse)
def list_file_groups_public(
    *,
    session: Session = Depends(deps.get_session),
) -> ProviderFileGroupListResponse:
    """
    List all active file groups (Public endpoint - no auth required).
    Used by the provider registration page to show available registration categories.
    """
    groups = crud.provider_file_group.get_groups(session=session, active_only=True)
    total = crud.provider_file_group.count_groups(session=session, active_only=True)
    return ProviderFileGroupListResponse(items=groups, total=total)


@router.get("/groups/{group_id}", response_model=ProviderFileGroupPublic)
def get_file_group_public(
    *,
    session: Session = Depends(deps.get_session),
    group_id: uuid.UUID,
) -> ProviderFileGroupPublic:
    """
    Get a specific file group with its definitions (Public endpoint - no auth required).
    Used by the provider registration page after the provider picks a group.
    """
    group = crud.provider_file_group.get_group(session=session, group_id=group_id)
    if not group or not group.is_active:
        raise HTTPException(status_code=404, detail="File group not found")
    return group


@router.get("/provider-registration", response_model=List[FileDefinitionPublic])
def get_provider_registration_file_requirements(
    *,
    session: Session = Depends(deps.get_session),
) -> List[FileDefinitionPublic]:
    """
    Get active file definitions for provider registration (Public endpoint - no auth required).
    Returns only ungrouped (global) definitions. For group-specific definitions use /groups/{id}.
    Kept for backward compatibility.
    """
    file_definitions = crud.file_definition.get_active_file_definitions_for_provider_registration(
        session=session
    )
    return file_definitions
