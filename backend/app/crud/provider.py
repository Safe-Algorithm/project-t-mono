from typing import List, Optional
import uuid
from sqlmodel import Session, select
from app.models.provider import Provider, ProviderRequest
from app.schemas.provider import ProviderRequestCreate, ProviderUpdate
from app.models.user import User

def create_provider_from_request(session: Session, *, request_in: ProviderRequestCreate, user: User) -> Provider:
    """Create a provider immediately from registration request"""
    provider = Provider(
        company_name=request_in.company_name,
        company_email=request_in.company_email,
        company_phone=request_in.company_phone,
        company_metadata=request_in.company_metadata,
        provider_request_id=None  # Will be set when request is created
    )
    session.add(provider)
    session.commit()
    session.refresh(provider)
    return provider

def create_provider_request(session: Session, *, request_in: ProviderRequestCreate, user: User, provider: Provider = None) -> ProviderRequest:
    db_request = ProviderRequest(
        user_id=user.id
    )
    session.add(db_request)
    session.commit()
    session.refresh(db_request)
    
    # If provider was created, link it to this request
    if provider:
        provider.provider_request_id = db_request.id
        session.add(provider)
        session.commit()
        session.refresh(provider)
    
    return db_request

def get_provider_request(session: Session, *, id: uuid.UUID) -> Optional[ProviderRequest]:
    return session.get(ProviderRequest, id)

def get_provider_requests(session: Session, *, skip: int = 0, limit: int = 100) -> List[ProviderRequest]:
    statement = select(ProviderRequest).offset(skip).limit(limit)
    return session.exec(statement).all()

def get_provider_request_by_user_id(session: Session, *, user_id: uuid.UUID) -> Optional[ProviderRequest]:
    statement = select(ProviderRequest).where(ProviderRequest.user_id == user_id)
    return session.exec(statement).first()

def update_provider_request_status(
    session: Session, *, db_request: ProviderRequest, status: str, denial_reason: Optional[str] = None
) -> ProviderRequest:
    db_request.status = status
    db_request.denial_reason = denial_reason
    session.add(db_request)
    session.commit()
    session.refresh(db_request)
    return db_request

def get_provider_by_id(session: Session, *, id: uuid.UUID) -> Optional[Provider]:
    return session.get(Provider, id)


def update_provider(
    session: Session, *, db_provider: Provider, provider_in: ProviderUpdate
) -> Provider:
    provider_data = provider_in.model_dump(exclude_unset=True)
    for key, value in provider_data.items():
        setattr(db_provider, key, value)
    session.add(db_provider)
    session.commit()
    session.refresh(db_provider)
    return db_provider

def get_provider(session: Session, *, provider_id: uuid.UUID) -> Optional[Provider]:
    return session.get(Provider, provider_id)

def get_all_providers(session: Session, *, skip: int = 0, limit: int = 100) -> List[Provider]:
    statement = select(Provider).offset(skip).limit(limit)
    return session.exec(statement).all()

def get_provider_by_user_id(session: Session, *, user_id: uuid.UUID) -> Optional[Provider]:
    """Get provider by user ID"""
    statement = select(Provider).join(User).where(User.id == user_id)
    return session.exec(statement).first()
