from collections.abc import Generator

from fastapi import Depends, HTTPException, status, Header
from fastapi.security import OAuth2PasswordBearer
from jose import jwt
from pydantic import ValidationError
from sqlmodel import Session

from app import crud
from app.core import security
from app.core.config import settings
from app.core.db import engine
from app.core.redis import is_token_blacklisted
from app.models.user import User, UserRole
from app.models.source import RequestSource
from app.schemas.token import TokenPayload

reusable_oauth2 = OAuth2PasswordBearer(
    tokenUrl=f"/login"
)

def get_session() -> Generator[Session, None, None]:
    with Session(engine) as session:
        yield session

def get_current_user(
    session: Session = Depends(get_session),
    token: str = Depends(reusable_oauth2),
) -> User:
    # Check if token is blacklisted
    if is_token_blacklisted(token):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has been invalidated",
        )
    
    try:
        payload = jwt.decode(
            token, settings.SECRET_KEY, algorithms=[security.ALGORITHM]
        )
        token_data = TokenPayload(**payload)
    except (jwt.JWTError, ValidationError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
        )
    
    # Get user by email or phone (sub may be either for mobile phone-registered users)
    source = payload.get("source")
    if source:
        user = crud.user.get_user_by_email_and_source(
            session, email=token_data.sub, source=RequestSource(source)
        )
        if not user:
            user = crud.user.get_user_by_phone_and_source(
                session, phone=token_data.sub, source=RequestSource(source)
            )
    else:
        user = crud.user.get_user_by_email(session, email=token_data.sub)

    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if not user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")
    return user

def get_current_active_user(
    current_user: User = Depends(get_current_user),
) -> User:
    # This is a placeholder for a more complex active user check
    return current_user

def get_current_active_provider(
    current_user: User = Depends(get_current_user),
) -> User:
    if current_user.source != RequestSource.PROVIDERS_PANEL:
        raise HTTPException(
            status_code=403,
            detail="The user doesn't have provider privileges",
        )
    return current_user

def get_current_active_super_provider(
    current_provider: User = Depends(get_current_active_provider),
) -> User:
    if current_provider.role != UserRole.SUPER_USER:
        raise HTTPException(
            status_code=403,
            detail="The user doesn't have super provider privileges",
        )
    return current_provider

def get_current_active_superuser(
    current_user: User = Depends(get_current_user),
) -> User:
    if current_user.role != UserRole.SUPER_USER:
        raise HTTPException(
            status_code=403,
            detail="The user doesn't have superuser privileges",
        )
    return current_user


def get_current_active_admin(
    current_user: User = Depends(get_current_user),
) -> User:
    """Get current active admin user (must be from ADMIN_PANEL source with SUPER_USER role)"""
    if current_user.source != RequestSource.ADMIN_PANEL:
        raise HTTPException(
            status_code=403,
            detail="The user doesn't have admin panel privileges",
        )
    if current_user.role != UserRole.SUPER_USER:
        raise HTTPException(
            status_code=403,
            detail="The user doesn't have admin privileges",
        )
    return current_user

def get_request_source(
    x_source: str = Header(..., alias="X-Source")
) -> RequestSource:
    """Get the request source from header"""
    try:
        return RequestSource(x_source.lower())
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid source. Must be one of: {[source.value for source in RequestSource]}"
        )


def get_language(
    lang: str = None,
    accept_language: str = Header(None, alias="Accept-Language")
) -> str:
    """
    Get language preference from query parameter or Accept-Language header.
    
    Priority:
    1. Query parameter 'lang' (e.g., ?lang=ar)
    2. Accept-Language header
    3. Default to 'en'
    
    Returns:
        Language code ('en' or 'ar')
    """
    from app.core.language import get_language_from_header
    
    # Check query parameter first
    if lang and lang in ['en', 'ar']:
        return lang
    
    # Check Accept-Language header
    if accept_language:
        return get_language_from_header(accept_language)
    
    # Default to English
    return 'en'
