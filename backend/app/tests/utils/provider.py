from sqlmodel import Session

from app import crud
from app.models.provider import Provider, ProviderRequest
from app.schemas.provider import ProviderRequestCreate

def create_random_provider_request(session: Session) -> ProviderRequest:
    from app.tests.utils.user import create_random_user, random_email, random_lower_string
    from app import crud
    
    user = create_random_user(session)
    provider_req_in = ProviderRequestCreate(
        company_name=random_lower_string(),
        company_email=random_email(),
        company_phone="1234567890",
    )
    
    # Create provider immediately (new flow)
    provider = crud.provider.create_provider_from_request(
        session, request_in=provider_req_in, user=user
    )
    
    # Set provider_id on user
    user.provider_id = provider.id
    session.add(user)
    session.commit()
    session.refresh(user)
    
    # Create provider request
    provider_request = crud.provider.create_provider_request(
        session, request_in=provider_req_in, user=user, provider=provider
    )
    
    return provider_request

def create_random_provider(session: Session):
    from app.tests.utils.user import create_random_user, random_email, random_lower_string

    provider_request = create_random_provider_request(session)
    # Get the provider that was already created in create_random_provider_request
    user = provider_request.user
    provider = crud.provider.get_provider_by_id(session, id=user.provider_id)
    return provider
