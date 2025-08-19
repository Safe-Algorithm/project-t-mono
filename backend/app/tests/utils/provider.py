from sqlmodel import Session

from app import crud
from app.models.provider import Provider, ProviderRequest
from app.schemas.provider import ProviderRequestCreate

def create_random_provider_request(session: Session) -> ProviderRequest:
    from app.tests.utils.user import create_random_user, random_email, random_lower_string
    user = create_random_user(session)
    provider_req_in = ProviderRequestCreate(
        company_name=random_lower_string(),
        company_email=random_email(),
        company_phone="1234567890",
    )
    return crud.provider.create_provider_request(
        session, request_in=provider_req_in, user=user
    )

def create_random_provider(session: Session) -> Provider:
    from app.tests.utils.user import create_random_user

    provider_request = create_random_provider_request(session)
    provider = crud.provider.create_provider(session, provider_request=provider_request)
    user = provider_request.user
    user.provider_id = provider.id
    session.add(user)
    session.commit()
    session.refresh(user)
    return provider
