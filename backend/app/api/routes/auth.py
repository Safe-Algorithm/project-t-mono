from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, status, Response, Request
from fastapi.security import OAuth2PasswordRequestForm
from sqlmodel import Session
from datetime import timedelta

from app import crud
from app.api import deps
from app.core import security
from app.schemas.token import Token, RefreshTokenRequest
from app.schemas.user import UserPublic, UserCreate, UserUpdate
from app.models.user import User
from app.models.source import RequestSource
from app.schemas.msg import Msg

router = APIRouter()


@router.post("/login/access-token", response_model=Token)
def login_for_access_token(
    response: Response,
    session: Session = Depends(deps.get_session),
    form_data: OAuth2PasswordRequestForm = Depends(),
    source: RequestSource = Depends(deps.get_request_source),
) -> Token:
    """
    OAuth2 compatible token login, get an access token for future requests.
    """
    user = crud.user.get_user_by_email_and_source(session, email=form_data.username, source=source)
    if not user or not security.verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token_expires = timedelta(minutes=security.settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = security.create_access_token(
        data={"sub": user.email}
    )
    refresh_token = security.create_refresh_token(
        data={"sub": user.email}
    )
    
    # Set refresh token as HttpOnly Secure SameSite cookie
    cookie_name = f"refresh_token_{source.value}"
    response.set_cookie(
        key=cookie_name,
        value=refresh_token,
        max_age=security.settings.REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60,  # Convert days to seconds
        httponly=True,
        secure=False,  # Set to False for development (localhost)
        samesite="lax"  # Changed to lax for better compatibility
    )
    
    return Token(access_token=access_token, refresh_token=refresh_token, token_type="bearer")


@router.post("/register", response_model=UserPublic)
def register(
    user_in: UserCreate,
    session: Session = Depends(deps.get_session),
    source: RequestSource = Depends(deps.get_request_source),
) -> User:
    """
    Create new user.
    """
    # Check if user exists with same email and source
    user = crud.user.get_user_by_email_and_source(session, email=user_in.email, source=source)
    if user:
        raise HTTPException(
            status_code=400,
            detail="The user with this email already exists for this source.",
        )
    
    # Check if user exists with same phone and source
    user_by_phone = crud.user.get_user_by_phone_and_source(session, phone=user_in.phone, source=source)
    if user_by_phone:
        raise HTTPException(
            status_code=400,
            detail="The user with this phone number already exists for this source.",
        )
    
    user = crud.user.create_user(session, user_in=user_in, source=source)
    return user


@router.post("/refresh", response_model=Token)
def refresh_access_token(
    request: Request,
    response: Response,
    session: Session = Depends(deps.get_session),
    source: RequestSource = Depends(deps.get_request_source),
) -> Token:
    """
    Refresh access token using refresh token from cookie.
    """
    try:
        # Get refresh token from cookie
        cookie_name = f"refresh_token_{source.value}"
        refresh_token = request.cookies.get(cookie_name)
        
        if not refresh_token:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Refresh token not found",
            )
        
        payload = security.verify_refresh_token(refresh_token)
        email = payload.get("sub")
        if not email:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid refresh token",
            )
        
        user = crud.user.get_user_by_email_and_source(session, email=email, source=source)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User not found",
            )
        
        # Create new tokens
        access_token = security.create_access_token(
            data={"sub": user.email}
        )
        new_refresh_token = security.create_refresh_token(
            data={"sub": user.email}
        )
        
        # Update refresh token cookie
        response.set_cookie(
            key=cookie_name,
            value=new_refresh_token,
            max_age=security.settings.REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60,
            httponly=True,
            secure=False,  # Set to False for development (localhost)
            samesite="lax"  # Changed to lax for better compatibility
        )
        
        return Token(access_token=access_token, refresh_token=new_refresh_token, token_type="bearer")
        
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token",
        )


@router.post("/logout", response_model=Msg)
def logout(
    response: Response,
    source: RequestSource = Depends(deps.get_request_source),
) -> Msg:
    """
    Logout user by clearing refresh token cookie.
    """
    cookie_name = f"refresh_token_{source.value}"
    response.delete_cookie(
        key=cookie_name,
        httponly=True,
        secure=False,  # Set to False for development (localhost)
        samesite="lax"  # Changed to lax for better compatibility
    )
    return Msg(msg="Successfully logged out")


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
    source: RequestSource = Depends(deps.get_request_source),
) -> Msg:
    """
    Forgot Password
    """
    user = crud.user.get_user_by_email_and_source(session, email=email, source=source)
    if not user:
        raise HTTPException(
            status_code=404,
            detail="The user with this email does not exist for this source.",
        )
    # Send email logic here
    return Msg(msg="Password recovery email sent")


@router.post("/reset-password", response_model=Msg)
def reset_password(
    token: str, 
    new_password: str, 
    session: Session = Depends(deps.get_session),
    source: RequestSource = Depends(deps.get_request_source),
) -> Msg:
    """
    Reset password
    """
    try:
        payload = security.decode_token(token)
        email = payload.get("sub")
        if not email:
            raise HTTPException(status_code=400, detail="Invalid token")
        
        user = crud.user.get_user_by_email_and_source(session, email=email, source=source)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Update password
        hashed_password = security.get_password_hash(new_password)
        user.hashed_password = hashed_password
        session.add(user)
        session.commit()
        
        # TODO: Invalidate all existing tokens for this user
        
        return Msg(msg="Password updated successfully")
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid or expired token")


@router.post("/change-password", response_model=Msg)
def change_password(
    current_password: str,
    new_password: str,
    current_user: User = Depends(deps.get_current_active_user),
    session: Session = Depends(deps.get_session),
    token: str = Depends(deps.reusable_oauth2),
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
    
    # TODO: Invalidate current token after password change
    
    return Msg(msg="Password updated successfully")

