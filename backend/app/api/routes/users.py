from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session
from app import crud
from app.api import deps
from app.schemas.user import UserCreate, UserPublic
from app.models.user import User

router = APIRouter()

@router.post("", response_model=UserPublic)
def create_user(
    *, 
    session: Session = Depends(deps.get_session), 
    user_in: UserCreate
):
    """
    Create new user.
    """
    user = crud.user.get_user_by_email(session=session, email=user_in.email)
    if user:
        raise HTTPException(
            status_code=400,
            detail="The user with this username already exists in the system.",
        )
    user = crud.user.create_user(session=session, user_in=user_in)
    return user

@router.get("/me", response_model=UserPublic)
def read_users_me(
    current_user: User = Depends(deps.get_current_active_user),
):
    """
    Get current user.
    """
    return current_user
