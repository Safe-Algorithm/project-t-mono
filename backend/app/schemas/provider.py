import uuid
from typing import Dict, Any, Optional
from sqlmodel import SQLModel
from .user import UserCreate, UserPublic

# Schema for the company details part of the request
class ProviderRequestCreate(SQLModel):
    company_name: str
    company_email: str
    company_phone: str
    company_metadata: Optional[Dict[str, Any]] = None

# Combined schema for the registration endpoint
class ProviderRegistrationRequest(SQLModel):
    user: UserCreate
    provider: ProviderRequestCreate

# Schema for reading a provider request
class ProviderRequestRead(SQLModel):
    id: uuid.UUID
    status: str
    denial_reason: Optional[str] = None
    company_name: str
    company_email: str
    company_phone: str
    provider_id: uuid.UUID
    user: UserPublic


# Properties to receive via API on update
class ProviderUpdate(SQLModel):
    company_name: Optional[str] = None
    company_email: Optional[str] = None
    company_phone: Optional[str] = None
    company_metadata: Optional[Dict[str, Any]] = None


# Properties to return to client
class ProviderPublic(SQLModel):
    id: uuid.UUID
    company_name: str
    company_email: str
    company_phone: str
    company_metadata: Optional[Dict[str, Any]] = None
    status: Optional[str] = None  # Status from provider request
