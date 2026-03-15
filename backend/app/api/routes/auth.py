import json
import logging
from datetime import timedelta
import secrets

from fastapi import APIRouter, Depends, HTTPException, status, Response, Request, BackgroundTasks
from pydantic import BaseModel
from fastapi.security import OAuth2PasswordRequestForm
from sqlmodel import Session

from app import crud
from app.api import deps
from app.core import security
from app.core.config import settings
from app.core.redis import redis_client
from app.models.user import User
from app.models.source import RequestSource
from app.schemas.token import Token, RefreshTokenRequest
from app.schemas.user import UserPublic, UserCreate, UserUpdate
from app.schemas.msg import Msg
from app.services.email import email_service

logger = logging.getLogger(__name__)

router = APIRouter()


def _auth_url(source: RequestSource, path: str) -> str:
    """
    Return the correct base URL for auth email links based on request source.

    - MOBILE_APP     → deep-link into the app  (rihlaapp://path)
    - PROVIDERS_PANEL → providers panel web URL
    - ADMIN_PANEL     → admin panel web URL
    """
    if source == RequestSource.MOBILE_APP:
        return f"{settings.APP_DEEP_LINK_SCHEME}://{path}"
    elif source == RequestSource.PROVIDERS_PANEL:
        return f"{settings.PROVIDERS_PANEL_URL}/{path}"
    else:
        return f"{settings.ADMIN_PANEL_URL}/{path}"


def _get_request_scheme(request: Request) -> str:
    forwarded_proto = request.headers.get("x-forwarded-proto")
    if forwarded_proto:
        return forwarded_proto.split(",")[0].strip().lower()
    return request.url.scheme.lower()


def _get_auth_cookie_settings(request: Request) -> dict:
    secure = settings.AUTH_COOKIE_SECURE
    if secure is None:
        secure = _get_request_scheme(request) == "https"

    samesite = (settings.AUTH_COOKIE_SAMESITE or "auto").lower()
    if samesite == "auto":
        samesite = "none" if secure else "lax"

    if samesite not in {"lax", "strict", "none"}:
        samesite = "none" if secure else "lax"

    if samesite == "none" and not secure:
        samesite = "lax"

    cookie_settings = {
        "max_age": settings.REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60,
        "httponly": True,
        "secure": secure,
        "samesite": samesite,
    }
    if settings.AUTH_COOKIE_DOMAIN:
        cookie_settings["domain"] = settings.AUTH_COOKIE_DOMAIN
    return cookie_settings


def _set_refresh_token_cookie(request: Request, response: Response, source: RequestSource, refresh_token: str) -> None:
    cookie_name = f"refresh_token_{source.value}"
    response.set_cookie(
        key=cookie_name,
        value=refresh_token,
        **_get_auth_cookie_settings(request),
    )


def _clear_refresh_token_cookie(request: Request, response: Response, source: RequestSource) -> None:
    cookie_name = f"refresh_token_{source.value}"
    cookie_settings = _get_auth_cookie_settings(request)
    delete_kwargs = {
        "httponly": cookie_settings["httponly"],
        "secure": cookie_settings["secure"],
        "samesite": cookie_settings["samesite"],
    }
    if "domain" in cookie_settings:
        delete_kwargs["domain"] = cookie_settings["domain"]
    response.delete_cookie(
        key=cookie_name,
        **delete_kwargs,
    )


@router.post("/login/access-token", response_model=Token)
def login_for_access_token(
    request: Request,
    response: Response,
    session: Session = Depends(deps.get_session),
    form_data: OAuth2PasswordRequestForm = Depends(),
    source: RequestSource = Depends(deps.get_request_source),
) -> Token:
    """
    OAuth2 compatible token login, get an access token for future requests.
    For mobile users, username can be either email or phone number.
    """
    user = None
    
    # Try to find user by email first
    user = crud.user.get_user_by_email_and_source(session, email=form_data.username, source=source)
    
    # If not found and source is mobile app, try phone number
    if not user and source == RequestSource.MOBILE_APP:
        user = crud.user.get_user_by_phone_and_source(session, phone=form_data.username, source=source)
    
    if not user or not security.verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Use email or phone as subject for token
    token_subject = user.email if user.email else user.phone
    
    access_token_expires = timedelta(minutes=security.settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = security.create_access_token(
        data={"sub": token_subject, "source": source.value}
    )
    refresh_token = security.create_refresh_token(
        data={"sub": token_subject, "source": source.value}
    )
    
    _set_refresh_token_cookie(request, response, source, refresh_token)
    
    return Token(access_token=access_token, refresh_token=refresh_token, token_type="bearer")


@router.post("/register", response_model=UserPublic)
def register(
    user_in: UserCreate,
    session: Session = Depends(deps.get_session),
    source: RequestSource = Depends(deps.get_request_source),
    verification_token: str = None,
) -> User:
    """
    Create new user.
    
    For mobile app users:
    - Must provide EITHER email OR phone (not both)
    - Must provide verification_token from OTP verification
    - Registration is via OTP, not email link
    
    For admin/provider users:
    - Must provide both email AND phone
    """
    # Mobile app specific validation
    if source == RequestSource.MOBILE_APP:
        # Ensure exactly one of email or phone is provided
        if user_in.email and user_in.phone:
            raise HTTPException(
                status_code=400,
                detail="Mobile app users must provide either email or phone, not both."
            )
        
        if not user_in.email and not user_in.phone:
            raise HTTPException(
                status_code=400,
                detail="Either email or phone must be provided."
            )
        
        # Require verification token
        if not verification_token:
            raise HTTPException(
                status_code=400,
                detail="Verification token is required for mobile app registration."
            )
        
        # Verify the token
        verification_key = f"phone_verified:{verification_token}" if user_in.phone else f"email_verified:{verification_token}"
        verification_data_str = redis_client.get(verification_key)
        
        if not verification_data_str:
            raise HTTPException(
                status_code=400,
                detail="Verification token expired or invalid. Please verify again."
            )
        
        # Parse verification data
        if isinstance(verification_data_str, bytes):
            verification_data = json.loads(verification_data_str.decode())
        else:
            verification_data = json.loads(verification_data_str)
        
        # Ensure contact method matches
        if user_in.phone and verification_data.get("phone") != user_in.phone:
            raise HTTPException(
                status_code=400,
                detail="Phone number does not match verified phone"
            )
        
        if user_in.email and verification_data.get("email") != user_in.email:
            raise HTTPException(
                status_code=400,
                detail="Email does not match verified email"
            )
        
        # Delete verification token
        redis_client.delete(verification_key)
    
    else:
        # Admin and provider users must provide both email and phone
        if not user_in.email or not user_in.phone:
            raise HTTPException(
                status_code=400,
                detail="Both email and phone are required for admin/provider registration."
            )
    
    # Check if user exists with same email and source (if email provided)
    if user_in.email:
        user = crud.user.get_user_by_email_and_source(session, email=user_in.email, source=source)
        if user:
            raise HTTPException(
                status_code=400,
                detail="The user with this email already exists for this source.",
            )
    
    # Check if user exists with same phone and source (if phone provided)
    if user_in.phone:
        user_by_phone = crud.user.get_user_by_phone_and_source(session, phone=user_in.phone, source=source)
        if user_by_phone:
            raise HTTPException(
                status_code=400,
                detail="The user with this phone number already exists for this source.",
            )
    
    # Create user
    user = crud.user.create_user(session, user_in=user_in, source=source)
    
    # Mark verified field based on what was verified
    if source == RequestSource.MOBILE_APP and verification_token:
        if user_in.phone:
            user.is_phone_verified = True
        if user_in.email:
            user.is_email_verified = True
        session.add(user)
        session.commit()
        session.refresh(user)
    
    return user


class RefreshTokenBody(BaseModel):
    refresh_token: str | None = None


@router.post("/refresh", response_model=Token)
def refresh_access_token(
    request: Request,
    response: Response,
    body: RefreshTokenBody = RefreshTokenBody(),
    session: Session = Depends(deps.get_session),
    source: RequestSource = Depends(deps.get_request_source),
) -> Token:
    """
    Refresh access token.
    - Web panels: refresh token read from HttpOnly cookie (sent automatically).
    - Mobile app: refresh token accepted in request body as {"refresh_token": "..."}.
    """
    try:
        cookie_name = f"refresh_token_{source.value}"
        refresh_token = request.cookies.get(cookie_name) or body.refresh_token

        if not refresh_token:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Refresh token not found",
            )

        payload = security.verify_refresh_token(refresh_token)
        subject = payload.get("sub")
        if not subject:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid refresh token",
            )

        # subject may be email or phone (mobile phone-registered users)
        user = crud.user.get_user_by_email_and_source(session, email=subject, source=source)
        if not user:
            user = crud.user.get_user_by_phone_and_source(session, phone=subject, source=source)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User not found",
            )

        token_subject = user.email if user.email else user.phone

        access_token = security.create_access_token(
            data={"sub": token_subject, "source": source.value}
        )
        new_refresh_token = security.create_refresh_token(
            data={"sub": token_subject, "source": source.value}
        )

        _set_refresh_token_cookie(request, response, source, new_refresh_token)

        return Token(access_token=access_token, refresh_token=new_refresh_token, token_type="bearer")

    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token",
        )


@router.post("/logout", response_model=Msg)
def logout(
    request: Request,
    response: Response,
    source: RequestSource = Depends(deps.get_request_source),
) -> Msg:
    """
    Logout user by clearing refresh token cookie.
    """
    _clear_refresh_token_cookie(request, response, source)
    return Msg(msg="Successfully logged out")


@router.get("/me", response_model=UserPublic)
def read_users_me(current_user: User = Depends(deps.get_current_active_user)):
    """
    Get current user.
    """
    return current_user


@router.post("/forgot-password", response_model=Msg)
async def forgot_password(
    email: str,
    background_tasks: BackgroundTasks,
    session: Session = Depends(deps.get_session),
    source: RequestSource = Depends(deps.get_request_source),
) -> Msg:
    """
    Send password reset email.
    """
    user = crud.user.get_user_by_email_and_source(session, email=email, source=source)
    if not user:
        # Don't reveal if user exists or not for security
        return Msg(msg="If an account exists with this email, a password reset link has been sent")
    
    # Generate reset token
    reset_token = secrets.token_urlsafe(32)
    
    # Store token in Redis with 1-hour expiry
    redis_key = f"password_reset:{reset_token}"
    redis_client.setex(redis_key, 60 * 60, f"{user.id}:{source.value}")
    
    # Send password reset email in background
    reset_url = _auth_url(source, "reset-password")
    background_tasks.add_task(
        email_service.send_password_reset_email,
        to_email=user.email,
        to_name=user.name,
        reset_token=reset_token,
        reset_url=reset_url,
        language=getattr(user, "preferred_language", "en") or "en",
    )
    
    return Msg(msg="If an account exists with this email, a password reset link has been sent")


@router.post("/reset-password", response_model=Msg)
def reset_password(
    token: str, 
    new_password: str, 
    session: Session = Depends(deps.get_session),
) -> Msg:
    """
    Reset password using token from email.
    """
    # Check token in Redis
    redis_key = f"password_reset:{token}"
    user_data = redis_client.get(redis_key)
    
    if not user_data:
        raise HTTPException(
            status_code=400,
            detail="Invalid or expired reset token"
        )
    
    # Parse user_id and source from stored data
    import uuid
    user_id_str, source_str = user_data.decode().split(":")
    user_id = uuid.UUID(user_id_str)
    source = RequestSource(source_str)
    
    # Get user
    user = crud.user.get_user_by_id(session, user_id=user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Update password
    hashed_password = security.get_password_hash(new_password)
    user.hashed_password = hashed_password
    session.add(user)
    session.commit()
    
    # Delete token from Redis
    redis_client.delete(redis_key)
    
    # TODO: Invalidate all existing tokens for this user
    
    return Msg(msg="Password updated successfully")


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


@router.post("/send-verification-email", response_model=Msg)
async def send_verification_email(
    background_tasks: BackgroundTasks,
    current_user: User = Depends(deps.get_current_active_user),
) -> Msg:
    """
    Send email verification link to current user.
    """
    if current_user.is_email_verified:
        raise HTTPException(
            status_code=400,
            detail="Email already verified"
        )
    
    # Generate verification token
    verification_token = secrets.token_urlsafe(32)
    
    # Store token in Redis with 24-hour expiry
    redis_key = f"email_verification:{verification_token}"
    redis_client.setex(redis_key, 24 * 60 * 60, str(current_user.id))
    
    # Send verification email in background
    verification_url = _auth_url(current_user.source, "verify-email")
    background_tasks.add_task(
        email_service.send_verification_email,
        to_email=current_user.email,
        to_name=current_user.name,
        verification_token=verification_token,
        verification_url=verification_url,
        language=getattr(current_user, "preferred_language", "en") or "en",
    )
    
    return Msg(msg="Verification email sent")


@router.post("/verify-email", response_model=Msg)
def verify_email(
    token: str,
    session: Session = Depends(deps.get_session),
) -> Msg:
    """
    Verify email using token from email link.
    """
    # Check token in Redis
    redis_key = f"email_verification:{token}"
    user_id = redis_client.get(redis_key)
    
    if not user_id:
        raise HTTPException(
            status_code=400,
            detail="Invalid or expired verification token"
        )
    
    # Get user and mark email as verified
    import uuid
    user = crud.user.get_user_by_id(session, user_id=uuid.UUID(user_id.decode()))
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    user.is_email_verified = True
    session.add(user)
    session.commit()
    
    # Delete token from Redis
    redis_client.delete(redis_key)
    
    return Msg(msg="Email verified successfully")

