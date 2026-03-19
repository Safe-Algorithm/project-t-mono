import uuid
from datetime import datetime
from typing import TYPE_CHECKING, List, Optional
from enum import Enum

from sqlalchemy import Column, UniqueConstraint
from sqlalchemy.dialects.postgresql import ENUM as SQLEnum
from sqlmodel import Field, Relationship, SQLModel

from .source import RequestSource
from .links import TripParticipant
from .rbac import UserRoleLink

if TYPE_CHECKING:
    from .provider import Provider
    from .provider_request import ProviderRequest
    from .trip import Trip
    from .links import TripRating
    from .trip_favorite import TripFavorite
    from .trip_like import TripLike
    from .trip_bookmark import TripBookmark
    from .provider_rating import ProviderRating
    from .rbac import Role
    from .user_push_token import UserPushToken


class UserRole(str, Enum):
    NORMAL = "normal"
    SUPER_USER = "super_user"

class User(SQLModel, table=True):
    __table_args__ = (
        UniqueConstraint("email", "source", name="unique_email_per_source"),
        UniqueConstraint("phone", "source", name="unique_phone_per_source"),
    )
    
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    email: Optional[str] = Field(default=None, index=True)
    name: str
    phone: Optional[str] = Field(default=None)
    hashed_password: str
    avatar_url: Optional[str] = Field(default=None, max_length=500)
    avatar_file_id: Optional[str] = Field(default=None, max_length=255)
    avatar_file_name: Optional[str] = Field(default=None, max_length=500)
    is_active: bool = Field(default=True)
    is_superuser: bool = Field(default=False)
    is_phone_verified: bool = Field(default=False)
    is_email_verified: bool = Field(default=False)
    role: UserRole = Field(default=UserRole.NORMAL)
    source: RequestSource = Field(sa_column=Column(SQLEnum(RequestSource, name='requestsource', values_callable=lambda obj: [e.value for e in obj])))
    preferred_language: str = Field(default="en", max_length=5)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    provider_id: Optional[uuid.UUID] = Field(default=None, foreign_key="provider.id")
    provider: Optional["Provider"] = Relationship(back_populates="users")

    provider_requests: List["ProviderRequest"] = Relationship(back_populates="user")

    trips: List["Trip"] = Relationship(back_populates="participants", link_model=TripParticipant)
    trip_ratings: List["TripRating"] = Relationship(back_populates="user")
    favorite_trips: List["TripFavorite"] = Relationship(back_populates="user")
    liked_trips: List["TripLike"] = Relationship(back_populates="user")
    bookmarked_trips: List["TripBookmark"] = Relationship(back_populates="user")
    provider_ratings: List["ProviderRating"] = Relationship(back_populates="user", sa_relationship_kwargs={"cascade": "all, delete-orphan"})
    rbac_roles: List["Role"] = Relationship(back_populates="users", link_model=UserRoleLink)
    push_tokens: List["UserPushToken"] = Relationship(back_populates="user", sa_relationship_kwargs={"cascade": "all, delete-orphan"})
