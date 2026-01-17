from typing import List
from fastapi import APIRouter, Depends
from sqlmodel import Session

from app.api.deps import get_current_active_superuser, get_session
from app.models.user import User, UserRole
from app.crud import user as user_crud
from app.schemas.user import UserPublic

router = APIRouter()

@router.get("/admin", response_model=List[UserPublic])
def list_admin_users(
    session: Session = Depends(get_session),
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(get_current_active_superuser),
):
    """Retrieve admin users (SUPER_USER role with ADMIN_PANEL source)."""
    users = user_crud.get_admin_users(session=session, skip=skip, limit=limit)
    return users

@router.get("/provider", response_model=List[UserPublic])
def list_provider_users(
    session: Session = Depends(get_session),
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(get_current_active_superuser),
):
    """Retrieve provider users (users with PROVIDER_PANEL source)."""
    users = user_crud.get_provider_users(session=session, skip=skip, limit=limit)
    return users

@router.get("/normal", response_model=List[UserPublic])
def list_normal_users(
    session: Session = Depends(get_session),
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(get_current_active_superuser),
):
    """Retrieve normal users (NORMAL role only)."""
    users = user_crud.get_normal_users(session=session, skip=skip, limit=limit)
    return users
