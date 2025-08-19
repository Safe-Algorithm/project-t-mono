from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlmodel import Session

from app import crud
from app.api import deps
from app.core import security
from app.schemas.token import Token
from app.schemas.user import UserPublic, UserCreate, UserUpdate
from app.models.user import User
from app.schemas.msg import Msg

router = APIRouter()


@router.post("/login/access-token", response_model=Token)
def login_for_access_token(
    session: Session = Depends(deps.get_session),
    form_data: OAuth2PasswordRequestForm = Depends(),
) -> Token:
    """
    OAuth2 compatible token login, get an access token for future requests.
    """
    user = crud.user.get_user_by_email(session, email=form_data.username)
    if not user or not security.verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token_expires = timedelta(minutes=security.settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = security.create_access_token(
        data={"sub": user.email},
        expires_delta=access_token_expires,
    )
    return Token(access_token=access_token, token_type="bearer")


@router.post("/register", response_model=UserPublic)
def register(
    user_in: UserCreate,
    session: Session = Depends(deps.get_session),
) -> User:
    """
    Create new user.
    """
    user = crud.user.get_user_by_email(session, email=user_in.email)
    if user:
        raise HTTPException(
            status_code=400,
            detail="The user with this username already exists in the system.",
        )
    user = crud.user.create_user(session, user_in=user_in)
    return user


@router.get("/me", response_model=UserPublic)
def read_users_me(current_user: User = Depends(deps.get_current_active_user)):
    """
    Get current user.
    """
    return current_user


@router.post("/forgot-password", response_model=Msg)
def forgot_password(
    email: str,
    session: Session = Depends(deps.get_session),
) -> Msg:
    """
    Forgot Password
    """
    user = crud.user.get_user_by_email(session, email=email)
    if not user:
        raise HTTPException(
            status_code=404,
            detail="The user with this username does not exist in the system.",
        )
    # Send email logic here
    return Msg(msg="Password recovery email sent")


@router.post("/reset-password", response_model=Msg)
def reset_password(token: str, new_password: str, session: Session = Depends(deps.get_session)) -> Msg:
    """
    Reset password
    """
    # Verify token and reset password logic here
    return Msg(msg="Password updated successfully")


@router.post("/change-password", response_model=Msg)
def change_password(
    current_password: str,
    new_password: str,
    current_user: User = Depends(deps.get_current_active_user),
    session: Session = Depends(deps.get_session),
) -> Msg:
    """
    Change password
    """
    if not security.verify_password(current_password, current_user.hashed_password):
        raise HTTPException(status_code=400, detail="Incorrect password")
    hashed_password = security.get_password_hash(new_password)
    current_user.hashed_password = hashed_password
    session.add(current_user)
    session.commit()
    return Msg(msg="Password updated successfully")


@router.post("/logout", response_model=Msg)
def logout(current_user: User = Depends(deps.get_current_active_user)) -> Msg:
    """
    Logout
    """
    # In a real-world application, you would invalidate the token.
    # For this example, we'll just return a success message.
    return Msg(msg="Logout successful")

