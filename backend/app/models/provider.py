import uuid
from datetime import datetime
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
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    users: List["User"] = Relationship(back_populates="provider")
    provider_request_id: Optional[uuid.UUID] = Field(default=None, foreign_key="providerrequest.id")
    provider_request: "ProviderRequest" = Relationship(back_populates="provider")
    trips: List["Trip"] = Relationship(back_populates="provider")


class ProviderRequest(SQLModel, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    status: str = Field(default="pending", index=True)  # Values: pending, approved, denied
    denial_reason: Optional[str] = Field(default=None)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    
    # Foreign key to the user who submitted the request
    user_id: uuid.UUID = Field(foreign_key="user.id")
    user: "User" = Relationship(back_populates="provider_requests")
    provider: Optional["Provider"] = Relationship(back_populates="provider_request")
