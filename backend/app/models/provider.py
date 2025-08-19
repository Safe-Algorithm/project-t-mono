import uuid
from typing import Dict, Any, List, Optional, TYPE_CHECKING
from sqlmodel import Field, SQLModel, Relationship, Column
from sqlalchemy import JSON

if TYPE_CHECKING:
    from .user import User
    from .trip import Trip

class Provider(SQLModel, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    company_name: str
    company_email: str = Field(unique=True, index=True)
    company_phone: str
    company_metadata: Optional[Dict[str, Any]] = Field(default=None, sa_column=Column(JSON))

    users: List["User"] = Relationship(back_populates="provider")
    provider_request_id: uuid.UUID = Field(foreign_key="providerrequest.id")
    provider_request: "ProviderRequest" = Relationship(back_populates="provider")
    trips: List["Trip"] = Relationship(back_populates="provider")


class ProviderRequest(SQLModel, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    company_name: str
    company_email: str = Field(unique=True, index=True)
    company_phone: str
    
    # Using JSONB for flexible metadata storage like documents and logos
    company_metadata: Optional[Dict[str, Any]] = Field(default=None, sa_column=Column(JSON))
    
    status: str = Field(default="pending", index=True)  # Values: pending, approved, denied
    denial_reason: Optional[str] = Field(default=None)
    
    # Foreign key to the user who submitted the request
    user_id: uuid.UUID = Field(foreign_key="user.id")
    user: "User" = Relationship(back_populates="provider_requests")
    provider: Optional["Provider"] = Relationship(back_populates="provider_request")
