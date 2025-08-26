import uuid
from typing import TYPE_CHECKING, List, Optional
from enum import Enum

from sqlalchemy import Column, UniqueConstraint
from sqlalchemy.dialects.postgresql import ENUM as SQLEnum
from sqlmodel import Field, Relationship, SQLModel

from .source import RequestSource
from .links import TripParticipant

if TYPE_CHECKING:
    from .provider import Provider
    from .provider_request import ProviderRequest
    from .trip import Trip
    from .links import TripRating


class UserRole(str, Enum):
    ADMIN = "admin"
    SUPER_ADMIN = "super_admin"
    PROVIDER = "provider"
    SUPER_PROVIDER = "super_provider"
    NORMAL = "normal"

class User(SQLModel, table=True):
    __table_args__ = (
        UniqueConstraint("email", "source", name="unique_email_per_source"),
        UniqueConstraint("phone", "source", name="unique_phone_per_source"),
    )
    
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    email: str = Field(index=True)
    name: str
    phone: str
    hashed_password: str
    is_active: bool = Field(default=True)
    is_superuser: bool = Field(default=False)
    is_phone_verified: bool = Field(default=False)
    is_email_verified: bool = Field(default=False)
    role: UserRole = Field(default=UserRole.NORMAL)
    source: RequestSource = Field(sa_column=Column(SQLEnum(RequestSource, name='requestsource', values_callable=lambda obj: [e.value for e in obj])))

    provider_id: Optional[uuid.UUID] = Field(default=None, foreign_key="provider.id")
    provider: Optional["Provider"] = Relationship(back_populates="users")

    provider_requests: List["ProviderRequest"] = Relationship(back_populates="user")

    trips: List["Trip"] = Relationship(back_populates="participants", link_model=TripParticipant)
    trip_ratings: List["TripRating"] = Relationship(back_populates="user")
